// Content Script - 在每个页面中运行
class TabContentManager {
  constructor() {
    this.init();
  }

  init() {
    console.log('🚀 Content script 已加载:', window.location.href);

    chrome.runtime.onMessage.addListener((request) => {
      console.log('📩 Content script 收到消息:', request);

      switch (request.action) {
        case 'updatePriority':
          this.updatePagePriority(request.priority);
          break;
        case 'updateTitle':
          this.updatePageTitle(request.title, request.priority);
          break;
        case 'updateAccessCount':
          this.updateAccessCountDisplay(request.count);
          break;
        case 'syncAccessCount':
          this.updateAccessCountDisplay(request.count);
          break;
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.requestAccessCount();
      }
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.requestPriorityUpdate();
        this.requestAccessCount();
      });
    } else {
      this.requestPriorityUpdate();
      this.requestAccessCount();
    }
  }

  updatePagePriority(priority) {
    this.removeExistingIndicator();
    this.addPriorityIndicator(priority);
  }

  updatePageTitle(title, priority) {
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

    if (!config) {
      return;
    }

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
    document.getElementById('tab-priority-indicator')?.remove();
  }

  requestPriorityUpdate() {
    chrome.runtime.sendMessage({
      action: 'requestPriorityUpdate'
    }).catch(() => {
      // 忽略错误，可能是在特殊页面
    });
  }

  async requestAccessCount() {
    try {
      const tabId = await this.getCurrentTabId();

      if (!tabId) {
        return;
      }

      chrome.runtime.sendMessage(
        {
          action: 'getAccessCount',
          tabId
        },
        (count) => {
          this.updateAccessCountDisplay(count || 0);
        }
      );
    } catch (error) {
      console.log('获取访问次数失败:', error);
    }
  }

  getCurrentTabId() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getCurrentTabId' }, resolve);
    });
  }

  updateAccessCountDisplay(count) {
    console.log(`📊 访问计数更新: ${count}`);
  }
}

new TabContentManager();
