// Content Script - 在每个页面中运行
class TabContentManager {
  constructor() {
    this.init();
  }

  init() {
    console.log('🚀 Content script 已加载:', window.location.href);
    
    // 监听来自background script的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('📩 Content script 收到消息:', request);
      switch (request.action) {
        case 'updatePriority':
          this.updatePagePriority(request.priority);
          break;
        case 'updateTitle':
          this.updatePageTitle(request.title, request.priority);
          break;
        case 'updateAccessCount':
          console.log(`📊 显示访问计数: ${request.count}`);
          this.showAccessCountNotification(request.count);
          break;
        case 'syncAccessCount':
          console.log(`🔄 同步访问计数: ${request.count}`);
          this.updateAccessCountDisplay(request.count);
          break;
      }
    });

    // 监听页面可见性变化（当标签页变为活动时）
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('👁️ 页面变为可见，请求计数更新');
        this.requestAccessCount();
      }
    });

    // 页面加载完成后更新显示
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.requestPriorityUpdate();
      });
    } else {
      this.requestPriorityUpdate();
    }
    
    // 添加一个简单的计数显示器到页面
    this.addAccessCountDisplay();
    
    // 设置调试命令
    this.setupDebugCommands();
  }

  updatePagePriority(priority) {
    // 在页面上添加优先级指示器
    this.removeExistingIndicator();
    this.addPriorityIndicator(priority);
  }

  updatePageTitle(title, priority) {
    // 更新页面标题
    document.title = title;
    this.updatePagePriority(priority);
  }

  addPriorityIndicator(priority) {
    const indicator = document.createElement('div');
    indicator.id = 'tab-priority-indicator';
    
    const priorityConfig = {
      1: { icon: '🔥', color: '#f59e0b', text: '常驻' },
      3: { icon: '📁', color: '#6b7280', text: '已收纳' }
    };

    const config = priorityConfig[priority];
    
    indicator.innerHTML = `
      <div style="
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 10000;
        background: ${config.color};
        color: white;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 4px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        opacity: 0.9;
        transition: opacity 0.3s ease;
      ">
        <span>${config.icon}</span>
        <span>${config.text}</span>
      </div>
    `;

    document.body.appendChild(indicator);

    // 3秒后自动隐藏
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.style.opacity = '0';
        setTimeout(() => {
          if (indicator.parentNode) {
            indicator.remove();
          }
        }, 300);
      }
    }, 3000);
  }

  removeExistingIndicator() {
    const existing = document.getElementById('tab-priority-indicator');
    if (existing) {
      existing.remove();
    }
  }

  requestPriorityUpdate() {
    // 请求background script更新当前标签的显示
    chrome.runtime.sendMessage({ 
      action: 'requestPriorityUpdate' 
    }).catch(() => {
      // 忽略错误，可能是在特殊页面
    });
  }

  // 添加调试功能到页面
  setupDebugCommands() {
    // 为页面添加调试功能
    window.extensionDebug = {
      showAccessCounts: () => {
        chrome.runtime.sendMessage({ action: 'debugAccessCounts' }, (result) => {
          console.log('📊 当前访问计数:', result);
          console.table(result.map(tab => ({
            标题: tab.title.substring(0, 40),
            访问次数: tab.accessCount || 0,
            标签ID: tab.tabId,
            URL: tab.url.substring(0, 50)
          })));
        });
      },
      
      getCurrentTabInfo: () => {
        chrome.runtime.sendMessage({ action: 'getCurrentTabId' }, (tabId) => {
          console.log('当前标签ID:', tabId);
          if (tabId) {
            chrome.runtime.sendMessage({ action: 'getAccessCount', tabId: tabId }, (count) => {
              console.log('当前页面访问次数:', count);
            });
          }
        });
      },
      
             resetAccessCounts: () => {
         chrome.storage.local.get(null, (allKeys) => {
           const accessCountKeys = Object.keys(allKeys).filter(key => 
             key.startsWith('access_count_')
           );
           
           if (accessCountKeys.length > 0) {
             chrome.storage.local.remove(accessCountKeys, () => {
               console.log(`✅ 已重置 ${accessCountKeys.length} 个访问计数`);
             });
           } else {
             console.log('📝 没有找到访问计数数据');
           }
         });
       },
       
       forceRefresh: () => {
         console.log('🔄 强制刷新访问计数...');
         if (window.extensionDebug) {
           window.extensionDebug.getCurrentTabInfo();
         }
         // 强制刷新访问计数
         document.querySelector('#access-count-display')?.click?.() || this.requestAccessCount();
       }
    };
    
         console.log('🛠️ 调试工具已加载！使用方法:');
     console.log('- extensionDebug.showAccessCounts() - 显示所有访问计数');
     console.log('- extensionDebug.getCurrentTabInfo() - 显示当前标签信息');
     console.log('- extensionDebug.resetAccessCounts() - 重置所有访问计数');
     console.log('- extensionDebug.forceRefresh() - 强制刷新当前计数');
     
     // 自动刷新当前计数
     setTimeout(() => {
       this.requestAccessCount();
     }, 1000);
  }

  addAccessCountDisplay() {
    // 需求3已删除：不再添加右下角的访问计数显示器
    // 请求当前的访问次数用于内部状态同步
    this.requestAccessCount();
  }

  async requestAccessCount() {
    try {
      const tabId = await this.getCurrentTabId();
      if (tabId) {
        chrome.runtime.sendMessage({ 
          action: 'getAccessCount', 
          tabId: tabId 
        }, (count) => {
          console.log(`📊 请求到的访问次数: ${count}`);
          this.updateAccessCountDisplay(count || 0);
        });
      }
    } catch (error) {
      console.log('获取访问次数失败:', error);
    }
  }

  // 强制刷新访问计数
  forceRefreshAccessCount() {
    console.log('🔄 强制刷新访问计数...');
    this.requestAccessCount();
  }

  getCurrentTabId() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getCurrentTabId' }, resolve);
    });
  }

  updateAccessCountDisplay(count) {
    // 需求3已删除：不再更新右下角显示器
    console.log(`📊 访问计数更新: ${count}`);
  }

  showAccessCountNotification(count) {
    // 需求3已删除：不再显示访问次数通知
    this.updateAccessCountDisplay(count);
  }
}

// 初始化content manager
new TabContentManager();