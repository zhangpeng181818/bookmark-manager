/**
 * Configuration Page Logic | 配置页面逻辑
 */

class ConfigManager {
  constructor() {
    this.form = document.getElementById('configForm');
    this.messageEl = document.getElementById('message');
    this.providerSelect = document.getElementById('apiProvider');
    this.endpointInput = document.getElementById('endpoint');
    this.modelSelect = document.getElementById('model');
    
    this.init();
  }

  /**
   * Initialize configuration page
   */
  init() {
    // 检查是否正在整理中
    this.checkOrganizingStatus();
    this.loadConfig();
    this.bindEvents();
    this.updateEndpointPlaceholder();
  }

  async checkOrganizingStatus() {
    const { organizing } = await chrome.storage.local.get('organizing');
    if (organizing) {
      // 显示提示并返回
      document.body.innerHTML = `
        <div class="container" style="text-align: center; padding: 50px;">
          <h2>⚠️ 整理进行中</h2>
          <p>当前有窗口正在整理书签，请等待完成后再修改设置。</p>
          <button onclick="window.location.href='popup.html'" class="btn btn-primary" style="margin-top: 20px;">
            返回首页
          </button>
        </div>
      `;
    }
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    
    document.getElementById('toggleKey').addEventListener('click', () => {
      this.toggleApiKeyVisibility();
    });
    
    document.getElementById('testConnection').addEventListener('click', () => {
      this.testConnection();
    });
    
    this.providerSelect.addEventListener('change', () => {
      this.updateEndpointPlaceholder();
      this.updateModelOptions();
    });

    document.getElementById('organizationStrategy').addEventListener('change', (e) => {
      const customGroup = document.querySelector('.custom-prompt-group');
      customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });

    document.getElementById('backToHome').addEventListener('click', () => {
      window.location.href = 'popup.html';
    });
  }

  /**
   * Update endpoint placeholder based on provider
   */
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

    const provider = this.providerSelect.value;
    const defaultEndpoint = endpoints[provider] || '';
    this.endpointInput.placeholder = defaultEndpoint;
    
    // 如果当前值以 /v1 结尾，清除它
    if (this.endpointInput.value.endsWith('/v1')) {
      this.endpointInput.value = defaultEndpoint;
    }
  }

  /**
   * Update model options based on provider
   */
  updateModelOptions() {
    const provider = this.providerSelect.value;
    const optgroups = this.modelSelect.querySelectorAll('optgroup');
    
    optgroups.forEach(group => {
      if (group.dataset.provider === provider) {
        group.style.display = 'block';
      } else {
        group.style.display = 'none';
      }
    });
    
    // 设置默认模型
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
      this.modelSelect.value = defaultModel;
    }
  }

  /**
   * Load saved configuration
   */
  async loadConfig() {
    try {
      const config = await chrome.storage.sync.get(null);
      
      if (config.apiProvider) {
        this.providerSelect.value = config.apiProvider;
      }
      if (config.endpoint) {
        // 加载时清理 endpoint，移除末尾的 /v1
        let endpoint = config.endpoint.replace(/\/$/, '').replace(/\/v1$/, '');
        this.endpointInput.value = endpoint;
      }
      if (config.model) {
        this.modelSelect.value = config.model;
      }
      if (config.apiKey) {
        document.getElementById('apiKey').value = config.apiKey;
      }
      if (config.organizationStrategy) {
        document.getElementById('organizationStrategy').value = config.organizationStrategy;
      }
      if (config.customPrompt) {
        document.getElementById('customPrompt').value = config.customPrompt;
      }
      
      this.updateModelOptions();
    } catch (error) {
      this.showMessage('加载配置失败: ' + error.message, 'error');
    }
  }

  /**
   * Handle form submission
   */
  async handleSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(this.form);
    
    // 清理 endpoint，移除末尾的 /v1
    let endpoint = formData.get('endpoint');
    if (endpoint) {
      endpoint = endpoint.trim().replace(/\/$/, '').replace(/\/v1$/, '');
    }
    
    const config = {
      apiProvider: formData.get('apiProvider'),
      endpoint: endpoint,
      apiKey: formData.get('apiKey'),
      model: formData.get('model'),
      organizationStrategy: formData.get('organizationStrategy'),
      customPrompt: formData.get('customPrompt') || ''
    };

    try {
      await chrome.storage.sync.set(config);
      this.showMessage('设置已保存！', 'success');
    } catch (error) {
      this.showMessage('保存失败: ' + error.message, 'error');
    }
  }

  /**
   * Toggle API key visibility
   */
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

  /**
   * Test API connection
   */
  async testConnection() {
    const apiKey = document.getElementById('apiKey').value;
    const provider = this.providerSelect.value;
    const endpoint = this.endpointInput.value;
    const model = this.modelSelect.value;

    if (!apiKey) {
      this.showMessage('请先输入 API Key', 'error');
      return;
    }

    this.showMessage('正在测试连接...', 'info');

    try {
      console.log('Testing connection with:', { provider, endpoint, model });
      const handler = new APIHandler({ provider, apiKey, endpoint, model });
      
      const testPrompt = '请回复 "连接成功" 确认 API 正常工作。';
      const response = await handler.callAPI(testPrompt);
      
      console.log('Test response:', response);
      
      if (response.toLowerCase().includes('成功') || response.toLowerCase().includes('success')) {
        this.showMessage('连接测试成功！', 'success');
      } else {
        this.showMessage('API 响应异常，但连接正常', 'warning');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      let errorMsg = error.message;
      if (errorMsg.includes('没找到对象')) {
        errorMsg = 'API Endpoint 错误：URL 路径不正确。请确保 Endpoint 为 https://api.moonshot.cn（不要带 /v1）';
      }
      this.showMessage('连接失败: ' + errorMsg, 'error');
    }
  }

  /**
   * Show message to user
   */
  showMessage(text, type = 'info') {
    this.messageEl.textContent = text;
    this.messageEl.className = `message ${type}`;
    this.messageEl.style.display = 'block';
    
    setTimeout(() => {
      this.messageEl.style.display = 'none';
    }, 5000);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ConfigManager();
});
