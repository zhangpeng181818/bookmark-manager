/**
 * Popup Page Logic | 弹出窗口逻辑
 * Main interface for bookmark organization with SPA view switching
 */

class PopupManager {
  constructor() {
    this.bookmarkManager = new BookmarkManager();
    this.apiHandler = null;
    this.currentPlan = null;
    this.allBookmarks = [];
    this.currentView = 'home'; // 'home' or 'settings'

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadStats();
    this.loadConfig();
    this.loadAllBookmarks();
  }

  /**
   * View switching
   */
  showHomeView() {
    document.getElementById('homeView').style.display = 'block';
    document.getElementById('settingsView').style.display = 'none';
    document.getElementById('popupHeader').style.justifyContent = 'space-between';

    // Change back button to settings icon
    const settingsBtn = document.getElementById('openSettings');
    settingsBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82V9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    `;
    settingsBtn.dataset.view = 'home';

    this.currentView = 'home';
  }

  showSettingsView() {
    // 立即更新状态，防止闪烁
    if (!document.getElementById('homeView') || !document.getElementById('settingsView')) return;

    this.currentView = 'settings';
    document.getElementById('homeView').style.display = 'none';
    document.getElementById('settingsView').style.display = 'block';
    document.getElementById('popupHeader').style.justifyContent = 'flex-start';

    // Change settings button to back icon
    const settingsBtn = document.getElementById('openSettings');
    if (settingsBtn) {
      settingsBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
      settingsBtn.dataset.view = 'settings';
    }

    // 异步检查是否正在整理（不使用 this 回调）
    chrome.storage.local.get('organizing').then(function(result) {
      if (result && result.organizing) {
        // 直接调用 DOM 操作返回首页
        document.getElementById('homeView').style.display = 'block';
        document.getElementById('settingsView').style.display = 'none';
        document.getElementById('popupHeader').style.justifyContent = 'space-between';
        const btn = document.getElementById('openSettings');
        if (btn) {
          btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82V9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
          btn.dataset.view = 'home';
        }
      }
    });
  }

  bindEvents() {
    // Settings button - directly toggle views without method calls
    const settingsBtn = document.getElementById('openSettings');
    if (settingsBtn) {
      settingsBtn.onclick = function() {
        const homeView = document.getElementById('homeView');
        const settingsView = document.getElementById('settingsView');
        const header = document.getElementById('popupHeader');

        if (!homeView || !settingsView || !header) return;

        if (homeView.style.display !== 'none') {
          // Switch to settings view
          homeView.style.display = 'none';
          settingsView.style.display = 'block';
          header.style.justifyContent = 'flex-start';
          settingsBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
        } else {
          // Switch to home view
          homeView.style.display = 'block';
          settingsView.style.display = 'none';
          header.style.justifyContent = 'space-between';
          settingsBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82V9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
        }
      };
    }

    // Start organization
    document.getElementById('startOrganize').addEventListener('click', () => {
      this.startOrganization();
    });

    // Apply changes
    document.getElementById('applyChanges').addEventListener('click', () => {
      this.applyOrganization();
    });

    // Cancel changes
    document.getElementById('cancelChanges').addEventListener('click', () => {
      this.hidePreview();
    });

    // Search input
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearch');

    searchInput.addEventListener('input', (e) => {
      this.handleSearch(e.target.value);
    });

    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim()) {
        this.showSearchResults();
      }
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      this.hideSearchResults();
      clearSearchBtn.style.display = 'none';
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-section')) {
        this.hideSearchResults();
      }
    });

    // Settings events
    document.getElementById('openSettings').addEventListener('click', () => {
      if (this.currentView === 'home') {
        this.showSettingsView();
      } else {
        this.showHomeView();
      }
    });

    document.getElementById('configForm').addEventListener('submit', (e) => {
      this.handleSettingsSubmit(e);
    });

    document.getElementById('toggleKey').addEventListener('click', () => {
      this.toggleApiKeyVisibility();
    });

    document.getElementById('testConnection').addEventListener('click', () => {
      this.testApiConnection();
    });

    document.getElementById('apiProvider').addEventListener('change', () => {
      this.updateEndpointPlaceholder();
      this.updateModelOptions();
    });
  }

  async loadAllBookmarks() {
    try {
      this.allBookmarks = await this.bookmarkManager.getAllBookmarks();
    } catch (error) {
      console.error('加载书签失败:', error);
    }
  }

  handleSearch(query) {
    const clearSearchBtn = document.getElementById('clearSearch');

    if (!query.trim()) {
      this.hideSearchResults();
      clearSearchBtn.style.display = 'none';
      return;
    }

    clearSearchBtn.style.display = 'flex';

    const lowerQuery = query.toLowerCase();
    const results = this.allBookmarks.filter(bm =>
      bm.title.toLowerCase().includes(lowerQuery) ||
      bm.url.toLowerCase().includes(lowerQuery)
    );

    this.renderSearchResults(results, query);
  }

  renderSearchResults(results, query) {
    const searchResults = document.getElementById('searchResults');

    if (results.length === 0) {
      searchResults.innerHTML = '<div class="search-no-results">未找到匹配的书签</div>';
    } else {
      // 显示所有搜索结果
      const html = results.map(bm => {
        const highlightedTitle = this.highlightText(bm.title, query);
        const highlightedUrl = this.highlightText(bm.url, query);
        const folderPath = bm.path && bm.path.length > 0 ? bm.path.join(' > ') : '书签栏';

        return `
          <div class="search-result-item" data-bookmark-id="${bm.id}">
            <div class="search-result-title">${highlightedTitle}</div>
            <div class="search-result-url">${highlightedUrl}</div>
            <div class="search-result-path">${folderPath}</div>
          </div>
        `;
      }).join('');

      searchResults.innerHTML = html;

      searchResults.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const bookmarkId = item.dataset.bookmarkId;
          const bookmark = this.allBookmarks.find(bm => bm.id === bookmarkId);
          if (bookmark) {
            chrome.tabs.create({ url: bookmark.url });
          }
        });
      });
    }

    searchResults.style.display = 'block';
  }

  highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${this.escapeRegExp(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  showSearchResults() {
    const searchResults = document.getElementById('searchResults');
    if (searchResults.innerHTML.trim()) {
      searchResults.style.display = 'block';
    }
  }

  hideSearchResults() {
    document.getElementById('searchResults').style.display = 'none';
  }

  async loadStats() {
    try {
      const stats = await this.bookmarkManager.getStatistics();
      document.getElementById('totalBookmarks').textContent = stats.totalBookmarks;
      document.getElementById('uniqueDomains').textContent = stats.uniqueDomains;

      const topDomainsEl = document.getElementById('topDomains');
      if (stats.topDomains.length > 0) {
        topDomainsEl.innerHTML = '<h3>常用网站:</h3>' +
          stats.topDomains.map(([domain, count]) =>
            `<span class="domain-tag">${domain} (${count})</span>`
          ).join('');
      }
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  }

  async loadConfig() {
    try {
      const config = await chrome.storage.sync.get(null);
      if (config.apiKey) {
        this.apiHandler = new APIHandler(config);
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }

  // Settings methods
  async loadSettingsConfig() {
    try {
      const config = await chrome.storage.sync.get(null);

      if (config.apiProvider) {
        document.getElementById('apiProvider').value = config.apiProvider;
      }
      if (config.endpoint) {
        let endpoint = config.endpoint.replace(/\/$/, '').replace(/\/v1$/, '');
        document.getElementById('endpoint').value = endpoint;
      }
      if (config.model) {
        document.getElementById('model').value = config.model;
      }
      if (config.apiKey) {
        document.getElementById('apiKey').value = config.apiKey;
      }

      this.updateModelOptions();
    } catch (error) {
      this.showSettingsMessage('加载配置失败: ' + error.message, 'error');
    }
  }

  updateEndpointPlaceholder() {
    const endpoints = {
      openai: 'https://api.openai.com',
      claude: 'https://api.anthropic.com',
      qwen: 'https://dashscope.aliyuncs.com',
      kimi: 'https://api.moonshot.cn',
      chatglm: 'https://open.bigmodel.cn/api/paas/v4',
      deepseek: 'https://api.deepseek.com',
      openrouter: 'https://openrouter.ai'
    };

    const provider = document.getElementById('apiProvider').value;
    const defaultEndpoint = endpoints[provider] || '';
    document.getElementById('endpoint').placeholder = defaultEndpoint;
  }

  updateModelOptions() {
    const provider = document.getElementById('apiProvider').value;
    const optgroups = document.getElementById('model').querySelectorAll('optgroup');

    optgroups.forEach(group => {
      if (group.dataset.provider === provider) {
        group.style.display = 'block';
      } else {
        group.style.display = 'none';
      }
    });

    const defaultModels = {
      openai: 'gpt-4o',
      claude: 'claude-3-5-sonnet-20241022',
      qwen: 'qwen-max',
      kimi: 'kimi-k2-0711-preview',
      chatglm: 'glm-4',
      deepseek: 'deepseek-chat',
      openrouter: 'anthropic/claude-3.5-sonnet'
    };

    const defaultModel = defaultModels[provider];
    if (defaultModel) {
      document.getElementById('model').value = defaultModel;
    }
  }

  async handleSettingsSubmit(e) {
    e.preventDefault();

    const endpoint = document.getElementById('endpoint').value;
    const cleanedEndpoint = endpoint ? endpoint.trim().replace(/\/$/, '').replace(/\/v1$/, '') : '';

    const config = {
      apiProvider: document.getElementById('apiProvider').value,
      endpoint: cleanedEndpoint,
      apiKey: document.getElementById('apiKey').value,
      model: document.getElementById('model').value
    };

    try {
      await chrome.storage.sync.set(config);
      this.apiHandler = new APIHandler(config);
      this.showSettingsMessage('设置已保存！', 'success');
    } catch (error) {
      this.showSettingsMessage('保存失败: ' + error.message, 'error');
    }
  }

  toggleApiKeyVisibility() {
    const apiKeyInput = document.getElementById('apiKey');
    const toggleBtn = document.getElementById('toggleKey');

    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleBtn.textContent = '隐藏';
    } else {
      apiKeyInput.type = 'password';
      toggleBtn.textContent = '显示';
    }
  }

  async testApiConnection() {
    const apiKey = document.getElementById('apiKey').value;
    const provider = document.getElementById('apiProvider').value;
    const endpoint = document.getElementById('endpoint').value;
    const model = document.getElementById('model').value;

    if (!apiKey) {
      this.showSettingsMessage('请先输入 API Key', 'error');
      return;
    }

    this.showSettingsMessage('正在测试连接...', 'info');

    try {
      const handler = new APIHandler({ provider, apiKey, endpoint, model });
      const testPrompt = '请回复 "连接成功" 确认 API 正常工作。';
      const response = await handler.callAPI(testPrompt);

      if (response.toLowerCase().includes('成功') || response.toLowerCase().includes('success')) {
        this.showSettingsMessage('连接测试成功！', 'success');
      } else {
        this.showSettingsMessage('API 响应异常，但连接正常', 'warning');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      let errorMsg = error.message;
      if (errorMsg.includes('没找到对象')) {
        errorMsg = 'API Endpoint 错误：URL 路径不正确。请确保 Endpoint 为 https://api.moonshot.cn（不要带 /v1）';
      }
      this.showSettingsMessage('连接失败: ' + errorMsg, 'error');
    }
  }

  showSettingsMessage(text, type = 'info') {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';

    setTimeout(() => {
      messageEl.style.display = 'none';
    }, 5000);
  }

  // Organization methods
  async startOrganization() {
    if (!this.apiHandler) {
      this.showMessage('请先配置 API 设置', 'error');
      this.showSettingsView();
      return;
    }

    // Check if organizing
    const { organizing } = await chrome.storage.local.get('organizing');
    if (organizing) {
      this.showMessage('已有窗口正在整理，请等待完成', 'warning');
      return;
    }

    // Set organizing state
    await chrome.storage.local.set({ organizing: true });

    // Disable button
    const startBtn = document.getElementById('startOrganize');
    startBtn.disabled = true;
    startBtn.querySelector('.btn-text').textContent = '整理中...';

    this.showProgress('正在读取书签...', 0);

    try {
      const bookmarks = await this.bookmarkManager.getAllBookmarks();

      if (bookmarks.length === 0) {
        this.showMessage('没有找到书签', 'warning');
        this.hideProgress();
        this.resetButton();
        return;
      }

      console.log(`开始整理 ${bookmarks.length} 个书签，使用三阶段策略`);

      // Three-stage organization
      const plan = await this.apiHandler.organizeBookmarksThreeStage(bookmarks, {
        batchSize: 100,
        enableOptimization: true,
        onProgress: (info) => {
          let message = info.message || '';
          let progress = info.progress || 0;

          if (info.stage === 1) {
            message = '阶段1: 分析书签结构，规划分类体系...';
            progress = 5;
          } else if (info.stage === 2) {
            message = `阶段2: 分批处理 ${info.currentBatch}/${info.totalBatches}...`;
            progress = 5 + (info.currentBatch / info.totalBatches) * 90;
          } else if (info.stage === 3) {
            message = '阶段3: 审查优化分类结构...';
            progress = 95;
          }

          this.showProgress(message, progress);
        }
      });

      this.currentPlan = plan;

      this.showProgress('整理方案已生成', 100);
      setTimeout(() => {
        this.hideProgress();
        this.showPreview(plan);
        this.resetButton();
      }, 500);

    } catch (error) {
      this.hideProgress();
      this.resetButton();
      console.error('整理失败详细错误:', error);
      let errorMsg = error.message;
      if (errorMsg.includes('没找到对象')) {
        errorMsg = 'API 请求失败：Endpoint 配置错误。请检查：\n1. Endpoint 应为 https://api.moonshot.cn（不要带 /v1）\n2. API Key 是否正确\n3. 模型名称是否有效';
      }
      this.showMessage('整理失败: ' + errorMsg, 'error');
    }
  }

  resetButton() {
    const startBtn = document.getElementById('startOrganize');
    startBtn.disabled = false;
    startBtn.querySelector('.btn-text').textContent = '开始整理';
    chrome.storage.local.set({ organizing: false });
  }

  showPreview(plan) {
    const previewSection = document.getElementById('previewSection');
    const previewContent = document.getElementById('previewContent');

    let html = '';

    const renderFolder = (folder, level = 0) => {
      const indent = level * 20;
      const folderClass = level === 0 ? 'preview-folder' : 'preview-folder preview-folder-nested';

      let folderHtml = `
        <div class="${folderClass}" style="margin-left: ${indent}px">
          <h3 style="font-size: ${16 - level * 2}px">${this.escapeHtml(folder.name)}</h3>
          <ul>
            ${folder.bookmarks ? folder.bookmarks.map(bm => `
              <li>
                <span class="bookmark-title">${this.escapeHtml(bm.newTitle || bm.title)}</span>
              </li>
            `).join('') : ''}
          </ul>
        </div>
      `;

      if (folder.children && Array.isArray(folder.children)) {
        folder.children.forEach(child => {
          folderHtml += renderFolder(child, level + 1);
        });
      }

      return folderHtml;
    };

    plan.folders.forEach(folder => {
      html += renderFolder(folder);
    });

    if (plan.duplicates && plan.duplicates.length > 0) {
      html += `
        <div class="preview-duplicates">
          <h3>将删除的重复项 (${plan.duplicates.length}个)</h3>
        </div>
      `;
    }

    previewContent.innerHTML = html;
    previewSection.style.display = 'block';
  }

  hidePreview() {
    document.getElementById('previewSection').style.display = 'none';
    this.currentPlan = null;
  }

  async applyOrganization() {
    if (!this.currentPlan) return;

    const btn = document.getElementById('applyChanges');
    btn.disabled = true;
    btn.textContent = '应用中...';

    try {
      const stats = await this.bookmarkManager.applyOrganization(this.currentPlan);

      this.hidePreview();
      this.showMessage(
        `整理完成！创建了 ${stats.foldersCreated} 个文件夹，移动了 ${stats.bookmarksMoved} 个书签`,
        'success'
      );

      this.loadStats();

    } catch (error) {
      this.showMessage('应用失败: ' + error.message, 'error');
      btn.disabled = false;
      btn.textContent = '应用更改';
    }
  }

  showProgress(text, percent) {
    const section = document.getElementById('progressSection');
    const fill = document.getElementById('progressFill');
    const textEl = document.getElementById('progressText');

    section.style.display = 'block';
    fill.style.width = percent + '%';
    textEl.textContent = text;
  }

  hideProgress() {
    document.getElementById('progressSection').style.display = 'none';
  }

  showMessage(text, type = 'info') {
    const el = document.getElementById('message');
    el.textContent = text;
    el.className = `message ${type}`;
    el.style.display = 'block';

    setTimeout(() => {
      el.style.display = 'none';
    }, 5000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
