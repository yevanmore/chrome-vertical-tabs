class PopupManager {
  constructor() {
    this.tabs = [];
    this.init();
  }

  async init() {
    await this.loadTabs();
    this.bindEvents();
  }

  async loadTabs() {
    try {
      // 发送消息到background script获取所有标签
      const tabs = await this.sendMessage({ action: 'getAllTabs' });
      this.tabs = tabs;
      this.renderTabs();
      
      // 添加调试按钮
      this.addDebugButton();
      
      // 隐藏loading，显示内容
      document.getElementById('loading').style.display = 'none';
      document.getElementById('content').style.display = 'block';
      
    } catch (error) {
      console.error('加载标签失败:', error);
    }
  }

  renderTabs() {
    const priorityGroups = {
      1: [],
      3: []
    };

    // 按优先级分组，跳过priority 2
    this.tabs.forEach(tab => {
      if (tab.priority === 1 || tab.priority === 3) {
        priorityGroups[tab.priority].push(tab);
      }
    });

    // 渲染每个优先级的标签
    Object.keys(priorityGroups).forEach(priority => {
      this.renderPriorityGroup(priority, priorityGroups[priority]);
    });
  }

  renderPriorityGroup(priority, tabs) {
    const container = document.getElementById(`priority-${priority}-tabs`);
    const countElement = document.getElementById(`priority-${priority}-count`);
    
    // 按访问次数排序（从高到低）
    tabs.sort((a, b) => (b.accessCount || 0) - (a.accessCount || 0));
    
    countElement.textContent = tabs.length;

    if (tabs.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无标签</div>';
      return;
    }

    container.innerHTML = tabs.map(tab => `
      <div class="tab-item" data-tab-id="${tab.id}">
        <div class="tab-icon-container">
          <img class="tab-favicon" src="${tab.favIconUrl || 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'><path fill=\'%23666\' d=\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z\'/></svg>'}" 
               onerror="this.src='data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'><path fill=\'%23666\' d=\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z\'/></svg>'">
          ${this.generateAccessIndicators(tab.accessCount || 0)}
        </div>
        <div class="tab-title" title="${this.escapeHtml(tab.title)}">${this.escapeHtml(tab.title)}${tab.accessCount && tab.accessCount > 0 ? ` (${tab.accessCount})` : ' (0)'}</div>
        <div class="tab-actions">
          <button class="priority-btn p1" data-priority="1" title="设为常驻">🔥</button>
          <button class="priority-btn p3" data-priority="3" title="设为已收纳">📁</button>
        </div>
      </div>
    `).join('');
  }

  bindEvents() {
    // 标签点击切换
    document.addEventListener('click', async (e) => {
      const tabItem = e.target.closest('.tab-item');
      if (tabItem && !e.target.closest('.tab-actions')) {
        const tabId = parseInt(tabItem.dataset.tabId);
        console.log(`🖱️ 用户点击切换到标签 ${tabId}`);
        await this.sendMessage({ action: 'switchToTab', tabId });
        window.close();
      }
    });

    // 优先级按钮点击
    document.addEventListener('click', async (e) => {
      if (e.target.classList.contains('priority-btn')) {
        e.stopPropagation();
        const tabItem = e.target.closest('.tab-item');
        const tabId = parseInt(tabItem.dataset.tabId);
        const priority = parseInt(e.target.dataset.priority);
        
        await this.sendMessage({ 
          action: 'setTabPriority', 
          tabId, 
          priority 
        });
        
        // 重新加载标签列表
        await this.loadTabs();
      }
    });

    // 批量清理按钮
    document.getElementById('close-archived').addEventListener('click', async () => {
      if (confirm('确定要关闭所有已收纳的标签吗？此操作不可撤销。')) {
        const closedCount = await this.sendMessage({ 
          action: 'closeTabsByPriority', 
          priority: 3 
        });
        
        if (closedCount > 0) {
          await this.loadTabs();
          this.showNotification(`已关闭 ${closedCount} 个标签页`);
        }
      }
    });
  }

  sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  generateAccessIndicators(count) {
    if (count === 0) return '';
    
    let indicators = '';
    
    if (count <= 10) {
      // 1-10次：显示对应数量的小圆点
      for (let i = 0; i < count; i++) {
        const opacity = Math.max(0.3, 1 - (i * 0.1)); // 渐变透明度效果
        indicators += `<span class="access-dot" style="opacity: ${opacity}">●</span>`;
      }
    } else if (count <= 20) {
      // 11-20次：显示10个圆点 + 数字
      for (let i = 0; i < 10; i++) {
        const opacity = Math.max(0.3, 1 - (i * 0.1));
        indicators += `<span class="access-dot" style="opacity: ${opacity}">●</span>`;
      }
      indicators += `<span class="access-plus">+${count - 10}</span>`;
    } else {
      // 20+次：显示特殊标记
      indicators += '<span class="access-high">🔥</span>';
      indicators += `<span class="access-count-badge">${count}</span>`;
    }
    
    return `<div class="access-indicators">${indicators}</div>`;
  }

  showNotification(message) {
    // 简单的通知显示
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #10b981;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 2000);
  }

  addDebugButton() {
    // 添加调试按钮容器
    const debugContainer = document.createElement('div');
    debugContainer.style.cssText = `
      display: flex;
      gap: 4px;
      margin-top: 8px;
    `;
    
    // 调试按钮
    const debugBtn = document.createElement('button');
    debugBtn.textContent = '🔍 调试';
    debugBtn.style.cssText = `
      flex: 1;
      padding: 6px;
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
    `;
    
    debugBtn.addEventListener('click', async () => {
      const results = await this.sendMessage({ action: 'debugAccessCounts' });
      console.log('📊 当前访问计数:', results);
      console.table(results.map(tab => ({
        标题: tab.title.substring(0, 30),
        访问次数: tab.accessCount || 0,
        ID: tab.tabId
      })));
      this.showNotification('调试信息已输出到控制台');
    });
    
    // 重置按钮
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '🧹 重置';
    resetBtn.style.cssText = `
      flex: 1;
      padding: 6px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      color: #dc2626;
    `;
    
    resetBtn.addEventListener('click', async () => {
      if (confirm('确定要重置所有访问计数吗？此操作不可撤销。')) {
        // 获取所有访问计数键并删除
        chrome.storage.local.get(null, (allKeys) => {
          const accessCountKeys = Object.keys(allKeys).filter(key => 
            key.startsWith('access_count_')
          );
          
          if (accessCountKeys.length > 0) {
            chrome.storage.local.remove(accessCountKeys, () => {
              this.showNotification(`已重置 ${accessCountKeys.length} 个访问计数`);
              setTimeout(() => this.loadTabs(), 1000);
            });
          } else {
            this.showNotification('没有找到访问计数数据');
          }
        });
      }
    });
    
    debugContainer.appendChild(debugBtn);
    debugContainer.appendChild(resetBtn);
    document.getElementById('content').appendChild(debugContainer);
  }
}

// 初始化popup
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});