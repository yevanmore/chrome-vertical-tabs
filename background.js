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
    
    // 每10分钟检查一次是否需要重排
    setInterval(async () => {
      console.log('⏰ 定期检查标签排序');
      await this.checkAutoPinning();
      await this.sortTabsByFrequency();
    }, 600000); // 10分钟
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

  stripManagedDecorations(title = '') {
    const cleanedTitle = title.replace(
      /^(?:(?:[🔥⭐📁]\s*)|(?:●{1,5}🔘{0,5}\s*)|(?:●{3}\[\d+\]\s*)|(?:⚡\[\d+\]\s*)|(?:\[\d+\]\s*))+/gu,
      ''
    ).trim();

    return cleanedTitle || title;
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
      const tab = await chrome.tabs.get(tabId);
      
      // 更新标签页标题
      const priorityIcons = {
        1: '🔥', // 常驻
        3: '📁'  // 已收纳
      };
      
      const priorityIcon = priorityIcons[priority];

      // 清理原标题（移除之前的图标和指示器）
      const originalTitle = this.stripManagedDecorations(tab.title);
      
      // 访问次数只在 popup 中展示，不再写回标签标题
      const newTitle = `${priorityIcon} ${originalTitle}`;
      
      // 通过content script更新标题
      chrome.tabs.sendMessage(tabId, {
        action: 'updateTitle',
        title: newTitle,
        priority: priority
      }).catch(() => {});
      
    } catch (error) {
      console.error('更新标签显示失败:', error);
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
      
      // 检查是否需要自动设置为常驻标签
      await this.checkAutoPinning();
      
      // 执行立即排序
      await this.sortTabsByFrequency();
      
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

  async checkAutoPinning() {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const tabsWithCounts = [];
      
      // 获取所有标签的访问次数
      for (const tab of tabs) {
        const accessCount = await this.getAccessCount(tab.id);
        const priority = await this.getTabPriority(tab.id);
        tabsWithCounts.push({
          ...tab,
          accessCount,
          priority
        });
      }
      
      // 按访问次数排序
      tabsWithCounts.sort((a, b) => b.accessCount - a.accessCount);
      
      // 计算前30%的数量
      const top30PercentCount = Math.ceil(tabs.length * 0.3);
      
      // 自动将前30%标记为常驻
      for (let i = 0; i < top30PercentCount; i++) {
        const tab = tabsWithCounts[i];
        if (tab.priority !== 1 && tab.accessCount > 0) {
          console.log(`📌 自动设置常驻标签: ${tab.title} (访问次数: ${tab.accessCount})`);
          await this.setTabPriority(tab.id, 1);
        }
      }
      
    } catch (error) {
      console.error('自动标记常驻标签失败:', error);
    }
  }

  async sortTabsByFrequency() {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const tabsWithData = [];
      
      // 获取所有标签的数据
      for (const tab of tabs) {
        const accessCount = await this.getAccessCount(tab.id);
        const priority = await this.getTabPriority(tab.id);
        tabsWithData.push({
          ...tab,
          accessCount,
          priority
        });
      }
      
      // 分组：常驻标签和已收纳标签
      const priorityTabs = tabsWithData.filter(tab => tab.priority === 1);
      const archivedTabs = tabsWithData.filter(tab => tab.priority === 3);
      
      // 分别按访问频率排序
      priorityTabs.sort((a, b) => b.accessCount - a.accessCount);
      archivedTabs.sort((a, b) => b.accessCount - a.accessCount);
      
      // 合并并重新排列标签
      const sortedTabs = [...priorityTabs, ...archivedTabs];
      
      // 移动标签到正确位置
      for (let i = 0; i < sortedTabs.length; i++) {
        const tab = sortedTabs[i];
        if (tab.index !== i) {
          await chrome.tabs.move(tab.id, { index: i });
        }
      }
      
      console.log(`🔄 标签重新排序完成`);
      
    } catch (error) {
      console.error('标签排序失败:', error);
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
      
    case 'getCurrentTabId':
      // 获取当前标签ID
      chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        sendResponse(tabs[0]?.id);
      });
      return true;

    case 'requestPriorityUpdate':
      if (!sender.tab?.id) {
        sendResponse({ success: false });
        return false;
      }

      tabManager.updateTabDisplay(sender.tab.id).then(() => {
        sendResponse({ success: true });
      });
      return true;
  }
});
