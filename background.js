// 标签页优先级管理
class TabPriorityManager {
  constructor() {
    this.priorities = {
      1: 'priority-1', // 常驻
      3: 'priority-3'  // 已收纳
    };
    this.init();
  }

  init() {
    console.log('🚀 TabPriorityManager 初始化...');
    
    // 监听快捷键命令
    chrome.commands.onCommand.addListener((command) => {
      this.handleCommand(command);
    });

    // 监听标签页更新  
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        console.log(`🔄 标签页更新完成: ${tabId} - ${tab.title}`);
        this.updateTabDisplay(tabId);
        
        // 只有在页面URL变化时才增加计数，避免重复计数
        if (this.shouldIncrementCount(tabId, changeInfo)) {
          console.log(`📈 页面导航计数: ${changeInfo.url || '页面重载'}`);
          this.incrementAccessCount(tabId);
        }
      }
    });

    // 监听标签页激活
    chrome.tabs.onActivated.addListener((activeInfo) => {
      console.log(`🎯 标签页激活: ${activeInfo.tabId}`);
      this.updateTabDisplay(activeInfo.tabId);
      this.incrementAccessCount(activeInfo.tabId);
    });

    // 定期检查和同步计数（确保不会丢失）
    this.startPeriodicSync();
    
    // 初始化所有现有标签的显示
    this.initializeAllTabDisplays();
    
    console.log('✅ 所有事件监听器已设置');
  }

  startPeriodicSync() {
    // 每30秒检查一次当前活动标签并确保计数同步
    setInterval(async () => {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab) {
          const count = await this.getAccessCount(activeTab.id);
          // 发送同步消息到content script
          chrome.tabs.sendMessage(activeTab.id, {
            action: 'syncAccessCount',
            count: count
          }).catch(() => {}); // 忽略错误
        }
      } catch (error) {
        // 静默处理错误
      }
    }, 30000);
  }

  async initializeAllTabDisplays() {
    try {
      console.log('🔄 初始化所有标签页显示...');
      const tabs = await chrome.tabs.query({});
      
      for (const tab of tabs) {
        await this.updateTabDisplay(tab.id);
      }
      
      console.log(`✅ 已初始化 ${tabs.length} 个标签页的显示`);
    } catch (error) {
      console.error('初始化标签显示失败:', error);
    }
  }

  async handleCommand(command) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    switch (command) {
      case 'mark-priority-1':
        await this.setTabPriority(activeTab.id, 1);
        break;

      case 'mark-priority-3':
        await this.setTabPriority(activeTab.id, 3);
        break;
      case 'switch-priority-tabs':
        await this.switchBetweenPriorityTabs();
        break;
      case 'switch-priority-tabs-left':
        await this.switchBetweenPriorityTabs('left');
        break;
      case 'switch-priority-tabs-right':
        await this.switchBetweenPriorityTabs('right');
        break;
    }
  }

  async setTabPriority(tabId, priority) {
    try {
      // 保存到storage
      const key = `tab_${tabId}`;
      await chrome.storage.local.set({ [key]: priority });
      
      // 更新标签页显示
      await this.updateTabDisplay(tabId);
      
      // 发送消息到content script更新显示
      chrome.tabs.sendMessage(tabId, {
        action: 'updatePriority',
        priority: priority
      }).catch(() => {}); // 忽略错误，某些页面可能无法接收消息
      
    } catch (error) {
      console.error('设置标签优先级失败:', error);
    }
  }

  async getTabPriority(tabId) {
    try {
      const result = await chrome.storage.local.get(`tab_${tabId}`);
      return result[`tab_${tabId}`] || 3; // 默认为已收纳
    } catch (error) {
      return 3;
    }
  }

  // 修复：只对新标签或URL变化时增加计数
  shouldIncrementCount(tabId, changeInfo) {
    // 如果是新标签激活，总是计数
    if (!changeInfo) return true;
    
    // 如果URL变化，说明是导航到新页面，应该计数
    if (changeInfo.url) return true;
    
    // 其他情况不计数
    return false;
  }

  async updateTabDisplay(tabId) {
    try {
      const priority = await this.getTabPriority(tabId);
      const accessCount = await this.getAccessCount(tabId);
      const tab = await chrome.tabs.get(tabId);
      
      // 更新标签页标题
      const priorityIcons = {
        1: '🔥', // 常驻
        3: '📁'  // 已收纳
      };
      
      const priorityIcon = priorityIcons[priority];
      
      // 生成访问次数指示器
      const accessIndicator = this.generateTitleAccessIndicator(accessCount);
      
      // 清理原标题（移除之前的图标和指示器）
      const originalTitle = tab.title
        .replace(/^[🔥⭐📁●🔘⚪]+\s*/, '') // 移除所有可能的图标
        .replace(/\s*\[\d+\]$/, '') // 移除数字标记
        .replace(/\s*●+$/, ''); // 移除圆点
      
      // 组合新标题
      const newTitle = `${priorityIcon}${accessIndicator} ${originalTitle}`;
      
      // 通过content script更新标题
      chrome.tabs.sendMessage(tabId, {
        action: 'updateTitle',
        title: newTitle,
        priority: priority,
        accessCount: accessCount
      }).catch(() => {});
      
    } catch (error) {
      console.error('更新标签显示失败:', error);
    }
  }

  generateTitleAccessIndicator(count) {
    if (count === 0) return '';
    
    if (count <= 5) {
      // 1-5次：显示对应数量的小圆点
      return '●'.repeat(count);
    } else if (count <= 10) {
      // 6-10次：显示5个圆点 + 中等圆点
      return '●●●●●' + '🔘'.repeat(Math.min(count - 5, 5));
          } else if (count <= 20) {
        // 11-20次：显示简化形式 + 数字
        return `●●●[${count}]`;
      } else {
        // 20+次：高频标记
        return `⚡[${count}]`;
      }
  }

  async switchBetweenPriorityTabs(direction = 'right') {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const priorityTabs = [];
      
      // 获取所有常驻标签
      for (const tab of tabs) {
        const priority = await this.getTabPriority(tab.id);
        if (priority === 1) {
          priorityTabs.push(tab);
        }
      }
      
      if (priorityTabs.length <= 1) return;
      
      // 找到当前激活的标签
      const activeTab = priorityTabs.find(tab => tab.active);
      const currentIndex = priorityTabs.indexOf(activeTab);
      
      // 切换到下一个常驻标签
      let nextIndex;
      if (direction === 'left') {
        nextIndex = (currentIndex - 1 + priorityTabs.length) % priorityTabs.length;
      } else {
        nextIndex = (currentIndex + 1) % priorityTabs.length;
      }
      await chrome.tabs.update(priorityTabs[nextIndex].id, { active: true });
      
    } catch (error) {
      console.error('切换常驻标签失败:', error);
    }
  }

  async incrementAccessCount(tabId) {
    try {
      // 获取标签信息用于调试
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab) {
        console.log(`⚠️ 标签 ${tabId} 不存在，跳过计数`);
        return;
      }
      
      const tabTitle = tab.title || '未知标签';
      
      const key = `access_count_${tabId}`;
      const result = await chrome.storage.local.get(key);
      const currentCount = result[key] || 0;
      const newCount = currentCount + 1;
      await chrome.storage.local.set({ [key]: newCount });
      
      // 详细的调试信息
      console.log(`🔢 访问计数更新 - 标签: ${tabTitle} (ID: ${tabId}) - 新计数: ${newCount}`);
      
      // 立即更新标签页标题显示
      await this.updateTabDisplay(tabId);
      
      // 只对可以接收消息的页面发送消息
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        try {
          await chrome.tabs.sendMessage(tabId, {
            action: 'updateAccessCount',
            count: newCount
          });
        } catch (messageError) {
          // 静默处理消息发送失败，不影响计数功能
          console.log(`📝 无法向标签 ${tabId} 发送消息 (这是正常的)`);
        }
      }
      
    } catch (error) {
      console.error('🚨 更新访问计数失败:', error);
    }
  }

  async getAccessCount(tabId) {
    try {
      const result = await chrome.storage.local.get(`access_count_${tabId}`);
      return result[`access_count_${tabId}`] || 0;
    } catch (error) {
      return 0;
    }
  }

  async debugAllAccessCounts() {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const results = [];
      
      for (const tab of tabs) {
        const count = await this.getAccessCount(tab.id);
        results.push({
          tabId: tab.id,
          title: tab.title,
          url: tab.url,
          accessCount: count
        });
      }
      
      console.log('📊 所有标签的访问计数:', results);
      return results;
    } catch (error) {
      console.error('调试访问计数失败:', error);
      return [];
    }
  }

  async getAllTabsWithPriorities() {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const tabsWithPriorities = [];
      
      for (const tab of tabs) {
        const priority = await this.getTabPriority(tab.id);
        const accessCount = await this.getAccessCount(tab.id);
        tabsWithPriorities.push({
          ...tab,
          priority: priority,
          accessCount: accessCount
        });
      }
      
      return tabsWithPriorities;
    } catch (error) {
      console.error('获取标签列表失败:', error);
      return [];
    }
  }

  async closeTabsByPriority(priority) {
    try {
      const tabs = await this.getAllTabsWithPriorities();
      const tabsToClose = tabs.filter(tab => tab.priority === priority);
      const tabIds = tabsToClose.map(tab => tab.id);
      
      if (tabIds.length > 0) {
        await chrome.tabs.remove(tabIds);
        
        // 清理storage
        const keysToRemove = [];
        tabIds.forEach(id => {
          keysToRemove.push(`tab_${id}`);
          keysToRemove.push(`access_count_${id}`);
        });
        await chrome.storage.local.remove(keysToRemove);
      }
      
      return tabIds.length;
    } catch (error) {
      console.error('批量关闭标签失败:', error);
      return 0;
    }
  }
}

// 初始化管理器
const tabManager = new TabPriorityManager();

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getAllTabs':
      tabManager.getAllTabsWithPriorities().then(sendResponse);
      return true;
      
    case 'setTabPriority':
      tabManager.setTabPriority(request.tabId, request.priority).then(() => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'closeTabsByPriority':
      tabManager.closeTabsByPriority(request.priority).then(sendResponse);
      return true;
      
    case 'switchToTab':
      console.log(`🔀 开始通过popup切换到标签 ${request.tabId}`);
      chrome.tabs.update(request.tabId, { active: true }).then(() => {
        console.log(`✅ popup切换成功到标签 ${request.tabId}`);
        // 通过popup切换时不增加计数，因为onActivated事件会处理
        sendResponse({ success: true });
      }).catch(error => {
        console.error(`❌ popup切换失败:`, error);
        sendResponse({ success: false, error: error.message });
      });
      return true;
      
    case 'getAccessCount':
      tabManager.getAccessCount(request.tabId).then(sendResponse);
      return true;
      
    case 'debugAccessCounts':
      // 调试功能：显示所有标签的访问计数
      tabManager.debugAllAccessCounts().then(sendResponse);
      return true;
      
    case 'getCurrentTabId':
      // 获取当前标签ID
      chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        sendResponse(tabs[0]?.id);
      });
      return true;
  }
});