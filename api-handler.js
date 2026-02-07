/**
 * API Handler Module | API 处理模块
 * Abstracts different LLM providers behind a unified interface
 * 将不同的 LLM 提供商抽象为统一接口
 * Supports: OpenAI, Claude, Qwen, Kimi, ChatGLM, DeepSeek, OpenRouter
 */

class APIHandler {
  /**
   * Create an API handler instance
   * 创建 API 处理器实例
   * @param {Object} config - Configuration object | 配置对象
   * @param {string} config.provider - API provider | API 提供商
   * @param {string} config.apiKey - API key | API 密钥
   * @param {string} config.endpoint - API endpoint | API 端点
   * @param {string} config.model - Model name | 模型名称
   */
  constructor(config) {
    this.provider = config.provider || 'openai';
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint;
    this.model = config.model;

    if (!this.apiKey) {
      throw new Error('API key is required | API 密钥不能为空');
    }
  }

  /**
   * Sleep helper
   * 睡眠辅助函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Organize bookmarks using AI with batch processing
   * 使用 AI 分批整理书签
   * @param {Array} bookmarks - Array of bookmark objects | 书签对象数组
   * @param {number} batchSize - Number of bookmarks per batch | 每批处理的书签数量
   * @returns {Promise<Object>} Organization plan | 整理方案
   */
  async organizeBookmarks(bookmarks, batchSize = 25) {
    // 书签太少不需要分批
    if (bookmarks.length <= batchSize) {
      const prompt = this.buildOrganizationPrompt(bookmarks);
      const response = await this.callAPI(prompt);
      return this.parseAIResponse(response);
    }

    console.log(`开始分批处理 ${bookmarks.length} 个书签，每批 ${batchSize} 个`);

    const allResults = {
      folders: [],
      unclassified: [],
      duplicates: [],
      batchResults: []
    };

    // 分批处理
    const batches = [];
    for (let i = 0; i < bookmarks.length; i += batchSize) {
      batches.push(bookmarks.slice(i, i + batchSize));
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`处理批次 ${i + 1}/${batches.length}，包含 ${batch.length} 个书签`);

      try {
        const prompt = this.buildOrganizationPrompt(batch);
        const response = await this.callAPI(prompt);
        const result = this.parseAIResponse(response);

        // 记录批次结果用于调试
        allResults.batchResults.push({
          batchIndex: i,
          folderCount: result.folders?.length || 0,
          unclassifiedCount: result.unclassified?.length || 0,
          bookmarksCount: this.countBookmarksInResult(result)
        });

        // 合并结果
        if (result.folders && Array.isArray(result.folders)) {
          allResults.folders.push(...result.folders);
        }
        if (result.unclassified && Array.isArray(result.unclassified)) {
          allResults.unclassified.push(...result.unclassified);
        }
        if (result.duplicates && Array.isArray(result.duplicates)) {
          allResults.duplicates.push(...result.duplicates);
        }
      } catch (error) {
        console.error(`批次 ${i + 1} 处理失败:`, error);
        // 失败的批次标记为未分类
        allResults.batchResults.push({
          batchIndex: i,
          error: error.message,
          bookmarks: batch.map(b => ({
            id: b.id,
            title: b.title,
            newTitle: b.title,
            reason: '批次处理失败'
          }))
        });

        // 将失败的批次全部放入未分类
        for (const bm of batch) {
          allResults.unclassified.push({
            id: bm.id,
            title: bm.title,
            newTitle: bm.title,
            reason: '批次处理失败'
          });
        }
      }
    }

    // 统计信息
    const totalCategorized = this.countBookmarksInResult({ folders: allResults.folders });
    const totalUnclassified = allResults.unclassified.length;
    allResults.stats = {
      totalBookmarks: bookmarks.length,
      totalCategorized,
      totalUnclassified,
      categorizedRate: ((totalCategorized / bookmarks.length) * 100).toFixed(1) + '%',
      batchCount: batches.length
    };

    console.log('分批处理完成:', allResults.stats);

    // 合并同名文件夹
    const mergedResult = this.mergeFolders(allResults);

    return mergedResult;
  }

  /**
   * Merge folders with the same name into a single folder with nested structure
   * 合并同名文件夹，将书签归入同一文件夹的子分类
   * @param {Object} result - Raw organization result | 原始整理结果
   * @returns {Object} Merged result | 合并后的结果
   */
  mergeFolders(result) {
    const folderMap = new Map();
    const mergedFolders = [];

    // 第一遍：按名称收集文件夹
    for (const folder of result.folders || []) {
      const key = folder.name.trim();
      if (!folderMap.has(key)) {
        folderMap.set(key, {
          name: key,
          bookmarks: [],
          children: [],
          sourceBatches: []
        });
      }
      const entry = folderMap.get(key);

      // 合并书签
      if (folder.bookmarks && Array.isArray(folder.bookmarks)) {
        entry.bookmarks.push(...folder.bookmarks);
      }

      // 递归合并子文件夹
      if (folder.children && Array.isArray(folder.children)) {
        this.mergeChildrenInto(entry.children, folder.children);
      }

      entry.sourceBatches.push(folder);
    }

    // 第二遍：转换为数组，并尝试建立二级结构
    for (const [name, folder] of folderMap) {
      // 按子分类拆分大文件夹（如果书签超过 10 个，尝试建立子分类）
      if (folder.bookmarks.length > 10) {
        const subcategorized = this.autoSubcategorize(folder);
        mergedFolders.push(...subcategorized);
      } else {
        mergedFolders.push(folder);
      }
    }

    // 按类别优先级排序
    const categoryOrder = ['技术开发', '学习教育', '工作办公', '设计创意', '娱乐休闲', '生活服务', '新闻资讯', '社交社区', '金融理财', '其他'];
    mergedFolders.sort((a, b) => {
      const idxA = categoryOrder.indexOf(a.name);
      const idxB = categoryOrder.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    return {
      folders: mergedFolders,
      unclassified: result.unclassified || [],
      duplicates: result.duplicates || [],
      stats: result.stats
    };
  }

  /**
   * Auto subcategorize large folders based on bookmark topics
   * 基于书签主题自动为大型文件夹创建子分类
   * @param {Object} folder - Folder to subcategorize | 需要子分类的文件夹
   * @returns {Array} Array of subcategorized folders | 子分类后的文件夹数组
   */
  autoSubcategorize(folder) {
    // 提取常见子分类关键词
    const subcategoryKeywords = {
      '前端': ['html', 'css', 'javascript', 'react', 'vue', 'angular', 'css', '前端', 'frontend', 'ui'],
      '后端': ['node', 'python', 'java', 'go', 'rust', '后端', 'backend', 'api', 'server'],
      'AI/机器学习': ['ai', 'ml', '深度学习', '机器学习', 'pytorch', 'tensorflow', '大模型', 'llm'],
      '移动端': ['ios', 'android', '移动端', 'mobile', '小程序', '小程序'],
      '工具/效率': ['工具', '效率', '工具', 'git', 'vscode', 'IDE', 'debug'],
      '资源/素材': ['素材', '资源', '资源', '图标', '字体', '图片', 'font', 'icon'],
      '学习/教程': ['教程', '学习', '入门', '课程', 'course', 'tutorial', 'doc'],
      '博客/资讯': ['博客', '资讯', 'blog', 'news', '文章', 'post']
    };

    const subcategories = new Map();

    // 初始化子分类
    for (const sub of Object.keys(subcategoryKeywords)) {
      subcategories.set(sub, {
        name: sub,
        bookmarks: [],
        children: []
      });
    }

    // 分配书签到子分类
    const uncategorized = {
      name: '综合',
      bookmarks: [],
      children: []
    };

    for (const bookmark of folder.bookmarks) {
      const title = (bookmark.title + ' ' + (bookmark.newTitle || '')).toLowerCase();
      let assigned = false;

      for (const [subName, keywords] of Object.entries(subcategoryKeywords)) {
        if (keywords.some(kw => title.includes(kw.toLowerCase()))) {
          subcategories.get(subName).bookmarks.push(bookmark);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        uncategorized.bookmarks.push(bookmark);
      }
    }

    // 只保留有内容的子分类
    const result = [];
    for (const [name, sub] of subcategories) {
      if (sub.bookmarks.length > 0) {
        result.push(sub);
      }
    }

    if (uncategorized.bookmarks.length > 0) {
      result.push(uncategorized);
    }

    // 如果子分类太多，合并为一个文件夹
    if (result.length > 5) {
      return [{
        name: folder.name,
        bookmarks: folder.bookmarks,
        children: []
      }];
    }

    return result;
  }

  /**
   * Recursively merge children folders into target array
   * 递归合并子文件夹到目标数组
   * @param {Array} target - Target children array | 目标子文件夹数组
   * @param {Array} source - Source children to merge | 来源子文件夹数组
   */
  mergeChildrenInto(target, source) {
    for (const child of source) {
      const existing = target.find(c => c.name.trim() === child.name.trim());

      if (existing) {
        // 合并书签
        if (child.bookmarks && Array.isArray(child.bookmarks)) {
          existing.bookmarks.push(...child.bookmarks);
        }
        // 递归合并子文件夹
        if (child.children && Array.isArray(child.children)) {
          this.mergeChildrenInto(existing.children, child.children);
        }
      } else {
        // 添加新子文件夹
        target.push({
          name: child.name.trim(),
          bookmarks: child.bookmarks || [],
          children: child.children || []
        });
      }
    }
  }

  /**
   * Count total bookmarks in a result object
   * 统计结果中的书签总数
   * @param {Object} result - Organization result | 整理结果
   * @returns {number} Total bookmark count | 书签总数
   */
  countBookmarksInResult(result) {
    let count = 0;

    if (result.folders && Array.isArray(result.folders)) {
      for (const folder of result.folders) {
        if (folder.bookmarks && Array.isArray(folder.bookmarks)) {
          count += folder.bookmarks.length;
        }
        // 递归统计子文件夹
        if (folder.children && Array.isArray(folder.children)) {
          count += this.countBookmarksInChildren(folder.children);
        }
      }
    }

    return count;
  }

  /**
   * Count bookmarks in children folders recursively
   * 递归统计子文件夹中的书签
   * @param {Array} children - Child folders | 子文件夹数组
   * @returns {number} Bookmark count | 书签数量
   */
  countBookmarksInChildren(children) {
    let count = 0;

    for (const child of children) {
      if (child.bookmarks && Array.isArray(child.bookmarks)) {
        count += child.bookmarks.length;
      }
      if (child.children && Array.isArray(child.children)) {
        count += this.countBookmarksInChildren(child.children);
      }
    }

    return count;
  }

  /**
   * Build the organization prompt for AI
   * 构建 AI 整理提示词
   * @param {Array} bookmarks - Bookmark list | 书签列表
   * @returns {string} Formatted prompt | 格式化后的提示词
   */
  buildOrganizationPrompt(bookmarks) {
    // 精简书签信息，只传 AI 真正需要的字段
    const simplifiedBookmarks = bookmarks.map(b => {
      let hostname = '';
      try {
        hostname = new URL(b.url).hostname.replace('www.', '');
      } catch (e) {
        hostname = 'unknown';
      }

      return {
        id: b.id,
        title: b.title,
        site: hostname,  // 只传域名，简化信息量
        from: b.path?.[0] || b.path?.[1] || '根目录'  // 原有分类路径的前两级
      };
    });

    const bookmarkJson = JSON.stringify(simplifiedBookmarks, null, 2);
    const bookmarkCount = bookmarks.length;

    return `你是一个专业的书签整理专家。有 ${bookmarkCount} 个书签需要分类。

【分类框架 - 必须严格遵守】
按以下优先级分类，优先级高的先判断：
1. **技术开发** - 编程、文档、工具、技术博客 (GitHub, Stack Overflow, MDN, 技术博客)
2. **学习教育** - 教程、课程、文档、学术、技能提升
3. **工作办公** - 效率工具、协作平台、办公相关
4. **娱乐休闲** - 视频、音乐、游戏、段子
5. **生活服务** - 购物、外卖、出行、天气、地图
6. **新闻资讯** - 科技新闻、行业动态、博客
7. **社交社区** - 论坛、社交媒体、博客平台
8. **设计创意** - 设计素材、灵感、配色、工具 (Dribbble, Behance, Figma)
9. **金融理财** - 投资、理财、财经
10. **其他** - 完全无法归类的才放这里

【分类规则】
- 优先放入上述已有分类，不要新建过多文件夹
- 技术类细分：前端/后端/移动端/AI/开源项目
- 学习类细分：编程/语言/设计/商业
- 同一个网站的书签尽量归在一起
- site 字段（域名）是重要参考
- 如果 from 是"根目录"，说明原书杂乱，更需要合理分类

【标题优化规则】
- 保留原标题核心含义
- 可适当简化或补充说明
- 技术文档保留英文标题，中文博客用中文标题

【输出格式 - JSON】
{
  "folders": [
    {
      "name": "类别名称（必须用中文）",
      "bookmarks": [
        {"id": "原ID", "title": "原标题", "newTitle": "优化标题（可选）"}
      ]
    }
  ],
  "unclassified": [
    {"id": "原ID", "title": "原标题", "reason": "无法分类原因"}
  ],
  "duplicates": ["重复ID"]
}

【强制要求】
- 至少 ${Math.ceil(bookmarkCount * 0.85)} 个书签必须分类（85%+ 成功率）
- "其他" 文件夹最多放 ${Math.ceil(bookmarkCount * 0.15)} 个
- 只返回 JSON，不要任何解释文字
- 【检查清单】返回前数一数：
  - folders 中书签数 + unclassified 数 = ${bookmarkCount}
  - 确保所有书签都有 id 和 title

${bookmarkJson}`;
  }

  /**
   * Call the LLM API based on provider
   * 根据提供商调用 LLM API
   * @param {string} prompt - User prompt | 用户提示词
   * @returns {Promise<string>} AI response text | AI 响应文本
   */
  async callAPI(prompt) {
    const handlers = {
      openai: () => this.callOpenAI(prompt),
      claude: () => this.callClaude(prompt),
      qwen: () => this.callQwen(prompt),
      kimi: () => this.callKimi(prompt),
      chatglm: () => this.callChatGLM(prompt),
      deepseek: () => this.callDeepSeek(prompt),
      openrouter: () => this.callOpenRouter(prompt)
    };
    
    const handler = handlers[this.provider];
    if (!handler) {
      throw new Error(`Unsupported provider: ${this.provider} | 不支持的提供商: ${this.provider}`);
    }
    
    return handler();
  }

  /**
   * Call OpenAI compatible API
   * 调用 OpenAI 兼容格式 API
   */
  async callOpenAICompatible(url, body, errorPrefix) {
    const maxRetries = 3;
    const baseDelay = 2000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Calling ${errorPrefix} API (attempt ${attempt + 1}/${maxRetries + 1}):`, url);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(body)
        });

        console.log('Response status:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error response:', errorText);

          // 检查是否是服务器过载错误
          const isOverloaded = errorText.includes('overloaded') || errorText.includes('overload_error');

          if (isOverloaded && attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt);
            console.log(`服务器过载，${delay/1000}秒后重试...`);
            await this.sleep(delay);
            continue;
          }

          let errorMessage;
          try {
            const error = JSON.parse(errorText);
            errorMessage = error.error?.message || error.message || error.error || response.statusText;
          } catch {
            errorMessage = errorText || response.statusText;
          }
          throw new Error(`${errorPrefix} API error: ${errorMessage}`);
        }

        const data = await response.json();
        console.log('API Response:', data);
        return data.choices?.[0]?.message?.content || data.choices?.[0]?.text;

      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`请求失败，${delay/1000}秒后重试...`, error.message);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Call OpenAI API
   * 调用 OpenAI API
   */
  async callOpenAI(prompt) {
    const baseEndpoint = this.endpoint && this.endpoint.trim() ? this.endpoint : 'https://api.openai.com';
    const url = `${baseEndpoint}/v1/chat/completions`;
    
    console.log('OpenAI endpoint:', baseEndpoint);
    console.log('OpenAI model:', this.model);
    
    return this.callOpenAICompatible(url, {
      model: this.model || 'gpt-4',
      messages: [
        { role: 'system', content: '你是一个书签整理专家，擅长分类和组织信息。请只返回 JSON 格式的结果。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    }, 'OpenAI');
  }

  /**
   * Call Anthropic Claude API
   * 调用 Anthropic Claude API
   */
  async callClaude(prompt) {
    const url = 'https://api.anthropic.com/v1/messages';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model || 'claude-3-sonnet-20240229',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Claude API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  /**
   * Call Alibaba Qwen API
   * 调用阿里通义千问 API
   */
  async callQwen(prompt) {
    const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model || 'qwen-max',
        input: {
          messages: [
            { role: 'system', content: '你是一个书签整理专家，擅长分类和组织信息。请只返回 JSON 格式的结果。' },
            { role: 'user', content: prompt }
          ]
        }
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Qwen API error: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return data.output?.text || data.output?.message?.content;
  }

  /**
   * Call Moonshot Kimi API
   * 调用月之暗面 Kimi API (OpenAI 兼容格式)
   * 支持 Kimi K2 系列: kimi-k2-0711-preview, kimi-k2.5, kimi-k1.5, kimi-k1
   */
  async callKimi(prompt) {
    let baseUrl = this.endpoint && this.endpoint.trim() ? this.endpoint : 'https://api.moonshot.cn';
    baseUrl = baseUrl.replace(/\/$/, '').replace(/\/v1$/, '');
    const url = `${baseUrl}/v1/chat/completions`;
    
    console.log('Kimi API URL:', url);
    console.log('Kimi model:', this.model || 'kimi-k2-0711-preview');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model || 'kimi-k2-0711-preview',
        messages: [
          { role: 'system', content: '你是一个书签整理专家，擅长分类和组织信息。请只返回 JSON 格式的结果。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Kimi API Error:', errorText);
      console.error('Kimi API URL used:', url);
      let errorMessage;
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error?.message || error.message || error.error || response.statusText;
      } catch {
        errorMessage = errorText || response.statusText;
      }
      throw new Error(`Kimi API error: ${errorMessage} (URL: ${url})`);
    }

    const data = await response.json();
    console.log('Kimi API Response:', data);
    return data.choices?.[0]?.message?.content;
  }

  /**
   * Call Zhipu ChatGLM API
   * 调用智谱 ChatGLM API
   */
  async callChatGLM(prompt) {
    const url = `${this.endpoint || 'https://open.bigmodel.cn/api/paas/v4'}/chat/completions`;
    
    return this.callOpenAICompatible(url, {
      model: this.model || 'glm-4',
      messages: [
        { role: 'system', content: '你是一个书签整理专家，擅长分类和组织信息。请只返回 JSON 格式的结果。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    }, 'ChatGLM');
  }

  /**
   * Call DeepSeek API
   * 调用 DeepSeek API
   */
  async callDeepSeek(prompt) {
    const url = `${this.endpoint || 'https://api.deepseek.com'}/chat/completions`;
    
    return this.callOpenAICompatible(url, {
      model: this.model || 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个书签整理专家，擅长分类和组织信息。请只返回 JSON 格式的结果。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    }, 'DeepSeek');
  }

  /**
   * Call OpenRouter API
   * 调用 OpenRouter API (聚合平台)
   */
  async callOpenRouter(prompt) {
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': chrome.runtime.getManifest().homepage_url || 'https://chrome.google.com/webstore',
        'X-Title': chrome.runtime.getManifest().name
      },
      body: JSON.stringify({
        model: this.model || 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: '你是一个书签整理专家，擅长分类和组织信息。请只返回 JSON 格式的结果。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content;
  }

  /**
   * Parse AI response to extract JSON
   * 解析 AI 响应提取 JSON
   * @param {string} response - Raw AI response | 原始 AI 响应
   * @returns {Object} Parsed organization plan | 解析后的整理方案
   */
  parseAIResponse(response) {
    try {
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.trim();

      const plan = JSON.parse(jsonStr);

      if (!plan.folders || !Array.isArray(plan.folders)) {
        throw new Error('Invalid response structure: missing folders array');
      }

      return plan;
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      throw new Error(`无法解析 AI 响应: ${error.message}`);
    }
  }

  /**
   * Three-stage organization: Global planning → Smart batching → Optimization
   * 三阶段整理：全局规划 → 智能分批 → 优化
   * @param {Array} bookmarks - All bookmarks to organize | 所有待整理书签
   * @param {Object} options - Organization options | 整理选项
   * @returns {Promise<Object>} Final organization result | 最终整理结果
   */
  async organizeBookmarksThreeStage(bookmarks, options = {}) {
    const {
      batchSize = 35,
      enableOptimization = true,
      onProgress = () => {}
    } = options;

    const totalBookmarks = bookmarks.length;
    console.log(`开始三阶段整理，共 ${totalBookmarks} 个书签`);

    const organizer = new ThreeStageOrganizer(this, bookmarks);

    // 阶段1：全局分类规划
    onProgress({ stage: 1, message: '分析书签结构，规划分类体系...', progress: 0 });
    console.log('阶段1：开始全局分类规划...');

    const classificationTree = await organizer.planGlobalStructure();
    console.log('分类规划完成:', classificationTree);

    // 阶段2：智能分批处理
    const batches = organizer.createSmartBatches(bookmarks, classificationTree, batchSize);
    console.log(`创建了 ${batches.length} 个批次`);

    onProgress({ stage: 2, message: `分批处理中 (${batches.length} 批)...`, progress: 5 });

    const batchResults = await organizer.processBatches(batches, classificationTree, onProgress);

    // 合并结果
    const mergedResult = organizer.mergeBatchResults(batchResults);

    let finalResult = mergedResult;

    // 阶段3：优化审查
    if (enableOptimization) {
      onProgress({ stage: 3, message: '审查优化分类结构...', progress: 95 });
      console.log('阶段3：开始优化审查...');

      finalResult = await organizer.optimizeResults(mergedResult, classificationTree);
    }

    // 最终统计
    const totalCategorized = this.countBookmarksInResult({ folders: finalResult.folders });
    finalResult.stats = {
      totalBookmarks,
      totalCategorized,
      categorizedRate: ((totalCategorized / totalBookmarks) * 100).toFixed(1) + '%',
      batchCount: batches.length,
      stages: 3,
      classificationTree
    };

    console.log('三阶段整理完成:', finalResult.stats);

    return finalResult;
  }
}

/**
 * Three-stage bookmark organizer
 * 三阶段书签整理器
 */
class ThreeStageOrganizer {
  constructor(apiHandler, bookmarks) {
    this.apiHandler = apiHandler;
    this.bookmarks = bookmarks;
  }

  /**
   * Stage 1: Create global classification tree
   * 阶段1：创建全局分类树
   * @returns {Promise<Object>} Classification tree | 分类树
   */
  async planGlobalStructure() {
    // 提取书签摘要
    const summary = this.bookmarks.map(b => {
      let hostname = '';
      try {
        hostname = new URL(b.url).hostname.replace('www.', '');
      } catch (e) {
        hostname = 'unknown';
      }
      return {
        id: b.id,
        title: b.title,
        site: hostname
      };
    });

    const prompt = this.buildStage1Prompt(summary);

    const response = await this.apiHandler.callAPI(prompt);
    const result = this.parseClassificationTree(response);

    if (!result || !result.categories) {
      throw new Error('Failed to generate classification tree');
    }

    return result;
  }

  /**
   * Build Stage 1 prompt for classification planning
   * 构建阶段1提示词
   */
  buildStage1Prompt(summary) {
    const summaryJson = JSON.stringify(summary, null, 2);
    const bookmarkCount = summary.length;

    return `你是一个专业的信息架构师。我有 ${bookmarkCount} 个浏览器书签需要整理。

以下是所有书签的摘要（标题 + 域名）：
${summaryJson}

请完成以下任务：

1. **分析主题分布**
   - 识别主要类别（建议5-8个顶级分类）
   - 每个类别应该有明确的主题

2. **构建层级结构**
   - 顶层：主要类别（如：工作、学习、生活、娱乐）
   - 第二层：具体子分类（每个顶层分类下3-6个子分类）
   - **重要**：每个子分类必须提供至少5个keywords用于精确匹配

3. **估算分布**
   - 估算每个分类下的书签数量

4. **返回JSON格式**
{
  "categories": [
    {
      "name": "💼 工作学习",
      "description": "编程、技术、职业发展相关",
      "subcategories": [
        {
          "name": "前端开发",
          "keywords": ["React", "Vue", "JavaScript", "CSS", "HTML", "TypeScript", "前端", "frontend", "UI"],
          "estimated_count": 45
        },
        {
          "name": "后端开发",
          "keywords": ["Python", "Node.js", "数据库", "API", "Java", "Go", "后端", "backend", "服务器"],
          "estimated_count": 38
        },
        {
          "name": "AI与机器学习",
          "keywords": ["AI", "ML", "深度学习", "PyTorch", "TensorFlow", "大模型", "LLM", "ChatGPT", "机器学习"],
          "estimated_count": 25
        },
        {
          "name": "开发工具",
          "keywords": ["Git", "GitHub", "VSCode", "Docker", "IDE", "命令行", "工具", "调试"],
          "estimated_count": 30
        },
        {
          "name": "技术文档",
          "keywords": ["MDN", "文档", "教程", "API文档", "官方文档", "教程", "学习", "doc"],
          "estimated_count": 20
        }
      ],
      "total_estimated": 158
    }
  ],
  "total_bookmarks": ${bookmarkCount},
  "recommended_batch_size": 35,
  "notes": "额外建议和说明"
}

要求：
- 分类名称简洁清晰（建议加emoji）
- 避免"其他"、"杂项"等模糊分类
- 子分类必须至少5个keywords，用于后续智能分批匹配
- keywords 要覆盖各种可能的书签标题和域名
- 估算要合理，子分类总和要接近 total_estimated`;
  }

  /**
   * Parse classification tree from AI response
   * 解析 AI 返回的分类树
   */
  parseClassificationTree(response) {
    try {
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.trim();

      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Failed to parse classification tree:', error);
      throw new Error(`无法解析分类规划: ${error.message}`);
    }
  }

  /**
   * Stage 2: Create smart batches based on classification
   * 阶段2：根据分类创建智能批次
   * @param {Array} bookmarks - All bookmarks | 所有书签
   * @param {Object} classificationTree - Classification tree from Stage 1 | 阶段1的分类树
   * @param {number} batchSize - Target batch size | 目标批次大小
   * @returns {Array} Batches | 批次数组
   */
   createSmartBatches(bookmarks, classificationTree, batchSize = 35) {
    console.log('开始智能分批...');

    // 获取第一个分类作为默认 fallback
    const firstCategory = classificationTree.categories?.[0];
    const firstSubcategory = firstCategory?.subcategories?.[0];
    const defaultCategory = firstCategory?.name || '待整理';
    const defaultSubcategory = firstSubcategory?.name || '综合';

    // 按域名预分组
    const domainGroups = this.groupByDomain(bookmarks);

    // 创建批次
    const batches = [];
    let currentBatch = [];
    let batchIndex = 1;

    // 从分类树中提取关键词用于匹配
    const categoryKeywords = this.extractKeywords(classificationTree);

    // 对每个域名组进行分类标注
    const bookmarkCategories = new Map();

    for (const bookmark of bookmarks) {
      const domain = new URL(bookmark.url).hostname.toLowerCase();
      const title = bookmark.title.toLowerCase();

      // 查找最匹配的分类
      let bestMatch = { category: defaultCategory, subcategory: defaultSubcategory, score: 0 };

      for (const cat of classificationTree.categories || []) {
        for (const sub of cat.subcategories || []) {
          const score = this.calculateMatchScore(title, domain, sub.keywords || []);
          if (score > bestMatch.score) {
            bestMatch = {
              category: cat.name,
              subcategory: sub.name,
              score
            };
          }
        }
      }

      bookmarkCategories.set(bookmark.id, bestMatch);
    }

    // 按分类组合批次
    const categorizedBatches = new Map();

    for (const bookmark of bookmarks) {
      const match = bookmarkCategories.get(bookmark.id) || { category: defaultCategory, subcategory: defaultSubcategory };
      const key = `${match.category}|${match.subcategory}`;

      if (!categorizedBatches.has(key)) {
        categorizedBatches.set(key, {
          category: match.category,
          subcategory: match.subcategory,
          bookmarks: []
        });
      }
      categorizedBatches.get(key).bookmarks.push(bookmark);
    }

    // 合并小批次
    const mergedBatches = [];
    let buffer = [];

    for (const [key, batch] of categorizedBatches) {
      if (batch.bookmarks.length <= batchSize) {
        if (buffer.length + batch.bookmarks.length <= batchSize) {
          buffer.push(...batch.bookmarks);
        } else {
          if (buffer.length > 0) {
            mergedBatches.push({
              index: mergedBatches.length + 1,
              bookmarks: [...buffer],
              theme: buffer.length > 0 ? this.guessBatchTheme(buffer) : '混合分类'
            });
            buffer = [];
          }
          mergedBatches.push({
            index: mergedBatches.length + 1,
            bookmarks: batch.bookmarks,
            theme: `${batch.category}/${batch.subcategory}`
          });
        }
      } else {
        // 大批次需要拆分
        const subBatches = this.splitLargeBatch(batch.bookmarks, batchSize);
        for (const sub of subBatches) {
          mergedBatches.push({
            index: mergedBatches.length + 1,
            bookmarks: sub,
            theme: `${batch.category}/${batch.subcategory}`
          });
        }
      }
    }

    // 处理剩余的 buffer
    if (buffer.length > 0) {
      mergedBatches.push({
        index: mergedBatches.length + 1,
        bookmarks: buffer,
        theme: this.guessBatchTheme(buffer)
      });
    }

    console.log(`创建了 ${mergedBatches.length} 个智能批次`);

    return mergedBatches;
  }

  /**
   * Group bookmarks by domain
   * 按域名分组书签
   */
  groupByDomain(bookmarks) {
    const groups = new Map();

    for (const bookmark of bookmarks) {
      try {
        const domain = new URL(bookmark.url).hostname;
        if (!groups.has(domain)) {
          groups.set(domain, []);
        }
        groups.get(domain).push(bookmark);
      } catch (e) {
        // 无效URL，放到默认组
        if (!groups.has('unknown')) {
          groups.set('unknown', []);
        }
        groups.get('unknown').push(bookmark);
      }
    }

    return Array.from(groups.values());
  }

  /**
   * Extract keywords from classification tree
   * 从分类树提取关键词
   */
  extractKeywords(classificationTree) {
    const keywords = [];

    for (const cat of classificationTree.categories || []) {
      for (const sub of cat.subcategories || []) {
        keywords.push({
          category: cat.name,
          subcategory: sub.name,
          keywords: sub.keywords || []
        });
      }
    }

    return keywords;
  }

  /**
   * Calculate match score between bookmark and category keywords
   * 计算书签与分类关键词的匹配度
   */
  calculateMatchScore(title, domain, keywords) {
    let score = 0;
    const lowerTitle = title.toLowerCase();
    const lowerDomain = domain.toLowerCase();

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      if (lowerTitle.includes(lowerKeyword) || lowerDomain.includes(lowerKeyword)) {
        score += 1;
      }
    }

    return score;
  }

  /**
   * Split large batch into smaller batches
   * 拆分大型批次
   */
  splitLargeBatch(bookmarks, batchSize) {
    const batches = [];

    for (let i = 0; i < bookmarks.length; i += batchSize) {
      batches.push(bookmarks.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Guess batch theme from bookmarks
   * 猜测批次主题
   */
  guessBatchTheme(bookmarks) {
    const domains = bookmarks.map(b => {
      try {
        return new URL(b.url).hostname;
      } catch (e) {
        return 'unknown';
      }
    });

    // 统计最常见的域名
    const domainCount = {};
    for (const domain of domains) {
      domainCount[domain] = (domainCount[domain] || 0) + 1;
    }

    const topDomain = Object.entries(domainCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    return topDomain || '混合';
  }

  /**
   * Stage 2: Process each batch
   * 阶段2：处理每个批次
   */
  async processBatches(batches, classificationTree, onProgress) {
    const results = [];
    const totalBatches = batches.length;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`处理批次 ${i + 1}/${totalBatches}，主题: ${batch.theme}`);

      onProgress({
        stage: 2,
        message: `处理批次 ${i + 1}/${totalBatches} (${batch.theme})...`,
        progress: 5 + (i / totalBatches) * 90,
        currentBatch: i + 1,
        totalBatches
      });

      const prompt = this.buildStage2Prompt(batch, classificationTree);
      const response = await this.apiHandler.callAPI(prompt);
      const result = this.parseBatchResult(response);

      results.push({
        batchIndex: i + 1,
        theme: batch.theme,
        classifications: result.classifications || [],
        duplicates: result.duplicates || [],
        uncertain: result.uncertain_classifications || []
      });

      // 避免API限流
      await this.sleep(1500);
    }

    return results;
  }

  /**
   * Build Stage 2 prompt for batch processing
   * 构建阶段2提示词
   */
  buildStage2Prompt(batch, classificationTree) {
    // 精简书签信息
    const bookmarks = batch.bookmarks.map(b => {
      let hostname = '';
      try {
        hostname = new URL(b.url).hostname.replace('www.', '');
      } catch (e) {
        hostname = 'unknown';
      }
      return {
        id: b.id,
        title: b.title,
        site: hostname
      };
    });

    const categoriesJson = JSON.stringify(classificationTree.categories, null, 2);

    return `全局分类体系：
${categoriesJson}

当前批次：第 ${batch.index} 批
预期主题：${batch.theme}
书签数量：${bookmarks.length}

书签列表：
${JSON.stringify(bookmarks, null, 2)}

任务：
1. 将每个书签精确归类到全局分类体系中
2. 格式：category > subcategory > 书签
3. 如果标题不够描述性，提供改进的标题
 4. 如果发现重复书签，标记出来
 5. **必须为每个书签分配一个分类，不允许出现 uncertain_classifications**
 6. confidence < 0.5 的选择一个最可能的分类，降低 confidence 值即可

返回JSON格式：
{
  "classifications": [
    {
      "bookmark_id": "123",
      "original_title": "GitHub",
      "suggested_title": "GitHub - 代码托管",
      "category": "💼 工作学习",
      "subcategory": "开发工具",
      "confidence": 0.95
    }
  ],
  "duplicates": [
    {"id1": "123", "id2": "456", "reason": "相同URL"}
  ]
}

要求：
- 严格遵循全局分类体系
- 只返回 JSON，没有 uncertain_classifications 字段`
  }

  /**
   * Parse batch result from AI response
   * 解析批次结果
   */
   parseBatchResult(response) {
    try {
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.trim();

      const result = JSON.parse(jsonStr);

      // 规范化返回格式，移除 uncertain_classifications
      return {
        classifications: result.classifications || [],
        duplicates: result.duplicates || []
      };
    } catch (error) {
      console.error('Failed to parse batch result:', error);
      return { classifications: [], duplicates: [] };
    }
  }

  /**
   * Merge batch results into final structure
   * 合并批次结果
   */
   mergeBatchResults(batchResults) {
    const folders = new Map();
    const duplicates = [];

    for (const batch of batchResults) {
      // 处理分类结果
      for (const cls of batch.classifications || []) {
        const key = `${cls.category}|${cls.subcategory}`;

        if (!folders.has(key)) {
          folders.set(key, {
            name: cls.category,
            subcategory: cls.subcategory,
            bookmarks: []
          });
        }

        folders.get(key).bookmarks.push({
          id: cls.bookmark_id,
          title: cls.original_title,
          newTitle: cls.suggested_title,
          confidence: cls.confidence
        });
      }

      // 处理重复
      for (const dup of batch.duplicates || []) {
        duplicates.push(dup.id1, dup.id2);
      }
    }

    // 按分类树结构重组
    const organizedFolders = this.organizeIntoFolders(folders);

    return {
      folders: organizedFolders,
      duplicates: [...new Set(duplicates)],
      batchResults
    };
  }

  /**
   * Organize folders into hierarchical structure
   * 将文件夹组织成层级结构
   */
  organizeIntoFolders(folderMap) {
    const result = [];

    for (const [key, folder] of folderMap) {
      // 检查是否已有同名的顶层文件夹
      let existing = result.find(f => f.name === folder.name);

      if (!existing) {
        existing = {
          name: folder.name,
          bookmarks: [],
          children: []
        };
        result.push(existing);
      }

      // 添加子分类
      if (folder.subcategory && folder.subcategory !== '综合') {
        let subFolder = existing.children.find(c => c.name === folder.subcategory);

        if (!subFolder) {
          subFolder = {
            name: folder.subcategory,
            bookmarks: [],
            children: []
          };
          existing.children.push(subFolder);
        }

        subFolder.bookmarks.push(...folder.bookmarks);
      } else {
        existing.bookmarks.push(...folder.bookmarks);
      }
    }

    // 过滤空文件夹和兜底分类
    const filteredResult = result.filter(folder => {
      // 跳过兜底分类
      const skipNames = ['待整理', '未分类', '未分类书签', '其他', '综合'];
      if (skipNames.includes(folder.name)) return false;

      // 统计总书签数（包括子分类）
      const countBookmarks = (f) => {
        let count = f.bookmarks?.length || 0;
        if (f.children) {
          for (const child of f.children) {
            count += countBookmarks(child);
          }
        }
        return count;
      };

      return countBookmarks(folder) > 0;
    });

    // 排序
    this.sortFolders(filteredResult);

    return filteredResult;
  }

  /**
   * Sort folders by category priority
   * 按分类优先级排序
   */
  sortFolders(folders) {
    const priority = ['💼 工作学习', '💻 技术开发', '📚 学习教育', '🎨 设计创意', '🎮 娱乐休闲', '🛒 生活服务', '📰 新闻资讯', '💬 社交社区', '💰 金融理财', '📁 其他'];

    folders.sort((a, b) => {
      const idxA = priority.indexOf(a.name);
      const idxB = priority.indexOf(b.name);

      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;

      return a.name.localeCompare(b.name);
    });

    // 递归排序子文件夹
    for (const folder of folders) {
      if (folder.children && folder.children.length > 0) {
        folder.children.sort((a, b) => a.name.localeCompare(b.name));
      }
    }
  }

  /**
   * Stage 3: Optimize results
   * 阶段3：优化结果
   */
  async optimizeResults(mergedResult, classificationTree) {
    const prompt = this.buildStage3Prompt(mergedResult, classificationTree);

    const response = await this.apiHandler.callAPI(prompt);
    const optimization = this.parseOptimization(response);

    // 应用优化建议
    if (optimization && optimization.optimizations) {
      for (const opt of optimization.optimizations) {
        this.applyOptimization(mergedResult, opt);
      }
    }

    return mergedResult;
  }

  /**
   * Build Stage 3 prompt for optimization
   * 构建阶段3提示词
   */
  buildStage3Prompt(mergedResult, classificationTree) {
    const batchSummary = this.summarizeBatches(mergedResult);

    return `经过分批整理，得到以下结果：

全局分类树：
${JSON.stringify(classificationTree.categories, null, 2)}

各批次整理汇总：
${JSON.stringify(batchSummary, null, 2)}

请审查并优化：

1. **结构优化**
   - 是否有分类过细（<5个书签）需要合并？
   - 是否有分类过粗（>50个书签）需要拆分？

2. **一致性检查**
   - 不同批次的分类是否一致？

返回优化方案（只需返回需要修改的部分）：
{
  "optimizations": [
    {
      "type": "merge",
      "action": "合并说明",
      "target": ["分类A", "分类B"]
    }
  ]
}

如果结果已经很好，返回空的 optimizations 数组。

要求：只返回 JSON`;
  }

  /**
   * Summarize batch results
   * 汇总批次结果
   */
  summarizeBatches(mergedResult) {
    const summary = [];

    for (const folder of mergedResult.folders || []) {
      summary.push({
        category: folder.name,
        subcategories: folder.children?.map(c => ({
          name: c.name,
          count: c.bookmarks?.length || 0
        })) || [],
        directBookmarks: folder.bookmarks?.length || 0
      });
    }

    return summary;
  }

  /**
   * Parse optimization from AI response
   * 解析优化建议
   */
  parseOptimization(response) {
    try {
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.trim();

      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Failed to parse optimization:', error);
      return { optimizations: [] };
    }
  }

  /**
   * Apply optimization
   * 应用优化
   */
  applyOptimization(result, optimization) {
    // 这里可以实现具体的优化逻辑
    console.log('应用优化:', optimization);
  }

  /**
   * Sleep helper
   * 睡眠辅助函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = APIHandler;
  module.exports.ThreeStageOrganizer = ThreeStageOrganizer;
}
