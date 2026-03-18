class PopupManager {
  constructor() {
    this.tabs = [];
    this.init();
  }

  async init() {
    this.bindEvents();

    try {
      await this.loadTabs();
    } catch (error) {
      console.error("初始化 popup 失败:", error);
      this.showNotification("加载失败，请重新打开扩展", "error");
    } finally {
      this.toggleLoading(false);
    }
  }

  async loadTabs() {
    this.tabs = (await this.sendMessage({ action: "getAllTabs" })) || [];
    this.renderTabs();
  }

  bindEvents() {
    document.addEventListener("click", async (event) => {
      const priorityButton = event.target.closest(".priority-btn");

      if (priorityButton) {
        event.stopPropagation();

        const tabId = Number(priorityButton.dataset.tabId);
        const priority = Number(priorityButton.dataset.priority);

        if (!tabId || !priority || priorityButton.disabled) {
          return;
        }

        try {
          await this.sendMessage({
            action: "setTabPriority",
            tabId,
            priority
          });
          await this.loadTabs();
          this.showNotification("标签分组已更新");
        } catch (error) {
          console.error("更新标签优先级失败:", error);
          this.showNotification("更新失败，请重试", "error");
        }

        return;
      }

      const tabCard = event.target.closest(".tab-card");

      if (!tabCard) {
        return;
      }

      const tabId = Number(tabCard.dataset.tabId);

      if (!tabId) {
        return;
      }

      try {
        await this.sendMessage({ action: "switchToTab", tabId });
        window.close();
      } catch (error) {
        console.error("切换标签失败:", error);
        this.showNotification("切换失败，请重试", "error");
      }
    });

    document.getElementById("close-archived").addEventListener("click", async () => {
      if (!confirm("确定要关闭所有已收纳标签吗？此操作不可撤销。")) {
        return;
      }

      try {
        const closedCount = await this.sendMessage({
          action: "closeTabsByPriority",
          priority: 3
        });

        await this.loadTabs();

        if (closedCount > 0) {
          this.showNotification(`已关闭 ${closedCount} 个标签页`);
        } else {
          this.showNotification("没有可关闭的已收纳标签");
        }
      } catch (error) {
        console.error("批量关闭标签失败:", error);
        this.showNotification("关闭失败，请重试", "error");
      }
    });
  }

  renderTabs() {
    const groups = {
      1: [],
      3: []
    };

    this.tabs.forEach((tab) => {
      if (tab.priority === 1 || tab.priority === 3) {
        groups[tab.priority].push(tab);
      }
    });

    this.updateStats(groups);
    this.renderPriorityGroup(1, groups[1]);
    this.renderPriorityGroup(3, groups[3]);
  }

  renderPriorityGroup(priority, tabs) {
    const container = document.getElementById(`priority-${priority}-tabs`);
    const countElement = document.getElementById(`priority-${priority}-count`);
    const sortedTabs = [...tabs].sort((a, b) => (b.accessCount || 0) - (a.accessCount || 0));

    countElement.textContent = String(sortedTabs.length);

    if (sortedTabs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          ${priority === 1
            ? "还没有常驻标签。先把最重要的页面标到这一组。"
            : "收纳区目前是空的，暂时没有待清理标签。"}
        </div>
      `;
      return;
    }

    container.innerHTML = sortedTabs.map((tab) => this.renderTabCard(tab)).join("");
  }

  renderTabCard(tab) {
    const priorityLabel = tab.priority === 1 ? "🔥 常驻" : "📁 收纳";
    const displayTitle = this.escapeHtml(this.getDisplayTitle(tab.title || "未命名标签"));
    const host = this.escapeHtml(this.getDisplayHost(tab.url));
    const count = tab.accessCount || 0;
    const fallbackIcon = this.getFallbackIcon();
    const favicon = this.escapeHtml(tab.favIconUrl || fallbackIcon);
    const safeFallbackIcon = this.escapeHtml(fallbackIcon);

    return `
      <article class="tab-card ${tab.active ? "is-active" : ""}" data-tab-id="${tab.id}">
        <div class="tab-main">
          <div class="favicon-wrap">
            <img
              class="tab-favicon"
              src="${favicon}"
              data-fallback="${safeFallbackIcon}"
              alt=""
              referrerpolicy="no-referrer"
              onerror="this.onerror=null;this.src=this.dataset.fallback;"
            >
            ${tab.active ? '<span class="active-dot"></span>' : ""}
          </div>
          <div class="tab-copy">
            <div class="tab-title-row">
              <span class="tab-title" title="${displayTitle}">${displayTitle}</span>
              <span class="section-badge">${priorityLabel}</span>
            </div>
            <div class="tab-meta">
              <span class="tab-host" title="${host}">${host}</span>
              <span class="access-badge">${count > 0 ? `${count} 次访问` : "未计数"}</span>
            </div>
            <div class="heat-row">${this.renderHeatDots(count)}</div>
          </div>
        </div>
        <div class="priority-actions">
          <button
            class="priority-btn ${tab.priority === 1 ? "is-active" : ""}"
            data-tab-id="${tab.id}"
            data-priority="1"
            ${tab.priority === 1 ? "disabled" : ""}
          >
            🔥 常驻
          </button>
          <button
            class="priority-btn ${tab.priority === 3 ? "is-active is-archived" : "is-archived"}"
            data-tab-id="${tab.id}"
            data-priority="3"
            ${tab.priority === 3 ? "disabled" : ""}
          >
            📁 收纳
          </button>
        </div>
      </article>
    `;
  }

  updateStats(groups) {
    document.getElementById("stat-total").textContent = String(this.tabs.length);
    document.getElementById("stat-priority-1").textContent = String(groups[1].length);
    document.getElementById("stat-priority-3").textContent = String(groups[3].length);
  }

  renderHeatDots(count) {
    const thresholds = [1, 3, 6, 10, 20];
    const activeDots = thresholds.filter((threshold) => count >= threshold).length;

    return Array.from({ length: thresholds.length }, (_, index) => `
      <span class="heat-dot ${index < activeDots ? "is-on" : ""}"></span>
    `).join("");
  }

  getDisplayTitle(title) {
    const cleaned = title.replace(
      /^(?:(?:[🔥⭐📁]\s*)|(?:●{1,5}🔘{0,5}\s*)|(?:●{3}\[\d+\]\s*)|(?:⚡\[\d+\]\s*)|(?:\[\d+\]\s*))+/gu,
      ""
    ).trim();

    return cleaned || title;
  }

  getDisplayHost(url) {
    try {
      const { hostname } = new URL(url);
      return hostname.replace(/^www\./, "");
    } catch (error) {
      return "系统页面";
    }
  }

  getFallbackIcon() {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%23CBD5E1'/%3E%3Ccircle cx='12' cy='12' r='5' fill='%235D6E80'/%3E%3C/svg%3E";
  }

  toggleLoading(isLoading) {
    document.getElementById("loading").hidden = !isLoading;
    document.getElementById("content").hidden = isLoading;
  }

  showNotification(message, type = "success") {
    document.querySelector(".toast")?.remove();

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;

    if (type === "error") {
      toast.style.background = "rgba(153, 27, 27, 0.92)";
    }

    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2200);
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(response);
      });
    });
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new PopupManager();
});
