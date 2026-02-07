# AGENT.md - AI开发助手指南

## 项目概述
你正在协助开发一个Chrome浏览器插件，用于通过AI大模型智能整理用户的混乱书签。

**项目名称**：AI书签整理助手  
**技术栈**：原生JavaScript (ES6+), Chrome Extension APIs  
**核心依赖**：无外部依赖，仅使用Chrome提供的API  
**目标用户**：拥有大量混乱书签的Chrome用户

---

## 一、你的角色定位

### 1.1 核心职责
- **代码生成**：根据用户需求生成符合规范的代码
- **架构建议**：提供模块化、可维护的架构方案
- **问题解决**：帮助调试和优化代码
- **最佳实践**：确保代码符合Chrome插件开发最佳实践

### 1.2 工作原则
- **遵守constitution.md**：所有建议必须符合项目宪章
- **渐进式开发**：先实现核心功能，再添加高级特性
- **代码质量优先**：宁可慢一点，也要保证代码质量
- **用户体验至上**：始终从用户角度思考

---

## 二、开发路线图

### 阶段1：基础框架（第1-2天）
**目标**：搭建可运行的插件基础结构

**任务清单**：
1. ✅ 创建manifest.json
   - 定义基本信息和权限
   - 配置popup和background
   
2. ✅ 创建UI框架
   - popup.html - 主界面骨架
   - config.html - 配置页面骨架
   - styles.css - 基础样式
   
3. ✅ 创建核心模块文件
   - bookmark-manager.js - 空壳，定义接口
   - api-handler.js - 空壳，定义接口
   - background.js - 基础监听器

**验收标准**：
- 插件可以在Chrome中加载
- 点击图标能弹出popup窗口
- 配置页面可以打开

---

### 阶段2：书签读取功能（第3天）
**目标**：能够读取和显示用户书签

**实现步骤**：
1. 实现`bookmark-manager.js`的书签读取功能
   ```javascript
   async function getAllBookmarks() {
     // 使用chrome.bookmarks.getTree()
     // 递归遍历书签树
     // 返回扁平化的书签列表
   }
   ```

2. 在popup中显示书签统计
   - 总书签数
   - 文件夹数
   - 层级深度

3. 添加书签列表预览
   - 分页显示
   - 显示路径

**验收标准**：
- 能正确读取所有书签
- 统计数据准确
- UI响应流畅

---

### 阶段3：配置管理（第4天）
**目标**：用户可以配置AI API

**实现内容**：
1. 配置表单
   - API提供商选择（下拉框）
   - API Key输入（password类型）
   - API Endpoint输入
   - 模型选择

2. 配置存储
   ```javascript
   async function saveConfig(config) {
     await chrome.storage.sync.set({ aiConfig: config });
   }
   
   async function loadConfig() {
     const result = await chrome.storage.sync.get('aiConfig');
     return result.aiConfig || getDefaultConfig();
   }
   ```

3. 配置验证
   - 检查必填字段
   - 验证API Key格式
   - 测试API连接（可选）

**验收标准**：
- 配置能正确保存和读取
- 表单验证工作正常
- 刷新后配置保持

---

### 阶段4：API集成（第5-6天）
**目标**：能够调用AI API进行书签整理

**实现策略**：

#### 4.1 统一API接口
创建抽象层，支持多个AI提供商：

```javascript
class AIProvider {
  constructor(config) {
    this.config = config;
  }
  
  async organize(bookmarks, strategy) {
    // 子类实现
  }
  
  buildPrompt(bookmarks, strategy) {
    // 构建prompt
  }
  
  parseResponse(response) {
    // 解析AI返回
  }
}

class OpenAIProvider extends AIProvider {
  async organize(bookmarks, strategy) {
    const prompt = this.buildPrompt(bookmarks, strategy);
    const response = await this.callAPI(prompt);
    return this.parseResponse(response);
  }
  
  async callAPI(prompt) {
    // OpenAI特定实现
  }
}

class ClaudeProvider extends AIProvider {
  // Claude特定实现
}

class QwenProvider extends AIProvider {
  // 通义千问特定实现
}
```

#### 4.2 Prompt工程
**系统提示词模板**：
```javascript
const SYSTEM_PROMPT = `你是一个专业的书签整理助手。
你的任务是分析用户的浏览器书签，并提供智能的分类和命名建议。

要求：
1. 按照主题和用途分类，而不仅仅是按域名
2. 为每个书签提供清晰、描述性的标题
3. 创建合理的文件夹层级（不超过3层）
4. 识别并标记重复的书签
5. 返回标准JSON格式

返回格式示例：
{
  "folders": [
    {
      "name": "开发工具",
      "description": "编程和开发相关资源",
      "bookmarks": [
        {"id": "123", "newTitle": "GitHub - 代码托管平台", "category": "开发工具"}
      ],
      "subfolders": []
    }
  ],
  "changes": [
    {"type": "rename", "bookmarkId": "123", "oldTitle": "GitHub", "newTitle": "GitHub - 代码托管平台"}
  ],
  "duplicates": ["456", "789"],
  "statistics": {
    "totalBookmarks": 100,
    "foldersCreated": 5,
    "duplicatesFound": 2
  }
}`;
```

**用户提示词模板**：
```javascript
function buildUserPrompt(bookmarks, strategy) {
  const bookmarkList = bookmarks.map(b => ({
    id: b.id,
    title: b.title,
    url: b.url,
    currentFolder: b.path.join(' > ')
  }));
  
  return `我有 ${bookmarks.length} 个书签需要整理：

${JSON.stringify(bookmarkList, null, 2)}

整理策略：${strategy}

请分析这些书签并提供整理方案。`;
}
```

#### 4.3 错误处理
```javascript
async function callAIWithRetry(provider, bookmarks, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await provider.organize(bookmarks);
      return result;
    } catch (error) {
      if (error.status === 429) {
        // 限流，等待后重试
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }
      if (error.status === 401) {
        // 认证失败，不重试
        throw new Error('API密钥无效，请检查配置');
      }
      if (i === maxRetries - 1) {
        throw error;
      }
    }
  }
}
```

**验收标准**：
- 至少支持OpenAI和一个国产模型
- API调用成功率 > 95%
- 错误提示友好清晰

---

### 阶段5：整理预览（第7天）
**目标**：显示AI整理方案，用户可以预览

**UI设计**：
```
┌─────────────────────────────────────┐
│  整理方案预览                        │
├─────────────────────────────────────┤
│  📊 统计                             │
│  • 将创建 5 个新文件夹                │
│  • 将移动 45 个书签                   │
│  • 将重命名 23 个书签                 │
│  • 发现 3 个重复书签                  │
├─────────────────────────────────────┤
│  📁 新文件夹结构                      │
│  ├─ 💼 工作相关 (15个书签)            │
│  ├─ 🎓 学习资源 (20个书签)            │
│  ├─ 🛠️ 开发工具 (10个书签)            │
│  └─ ...                              │
├─────────────────────────────────────┤
│  📝 主要变更                          │
│  • GitHub → GitHub - 代码托管平台    │
│  • docs → Vue.js官方文档              │
│  • ...                               │
├─────────────────────────────────────┤
│  [取消]  [应用更改]                   │
└─────────────────────────────────────┘
```

**实现要点**：
1. 对比视图（变更前后）
2. 可展开/折叠的树形结构
3. 高亮变更部分
4. 支持手动调整

**验收标准**：
- 预览信息完整准确
- 用户可以理解即将发生的变更
- 界面美观易用

---

### 阶段6：应用更改（第8天）
**目标**：将整理方案应用到实际书签

**实现逻辑**：
```javascript
async function applyOrganizationPlan(plan) {
  // 1. 备份当前书签结构
  const backup = await createBackup();
  
  try {
    // 2. 创建新文件夹
    const folderMap = {};
    for (const folder of plan.folders) {
      const newFolder = await chrome.bookmarks.create({
        parentId: '1', // 书签栏
        title: folder.name
      });
      folderMap[folder.name] = newFolder.id;
    }
    
    // 3. 移动和重命名书签
    for (const change of plan.changes) {
      if (change.type === 'move') {
        await chrome.bookmarks.move(change.bookmarkId, {
          parentId: folderMap[change.newFolder]
        });
      }
      if (change.type === 'rename') {
        await chrome.bookmarks.update(change.bookmarkId, {
          title: change.newTitle
        });
      }
    }
    
    // 4. 删除重复书签（需要用户确认）
    if (plan.duplicates.length > 0) {
      const confirmed = await confirmDeletion(plan.duplicates);
      if (confirmed) {
        for (const id of plan.duplicates) {
          await chrome.bookmarks.remove(id);
        }
      }
    }
    
    // 5. 保存备份引用（用于撤销）
    await saveBackupReference(backup);
    
    return { success: true };
  } catch (error) {
    // 6. 失败时恢复备份
    await restoreBackup(backup);
    throw error;
  }
}
```

**关键功能**：
1. **事务性操作**：要么全部成功，要么全部回滚
2. **进度显示**：实时显示操作进度
3. **备份机制**：操作前自动备份
4. **撤销功能**：5分钟内可撤销

**验收标准**：
- 操作成功率100%（或能正确回滚）
- 进度显示准确
- 撤销功能正常工作

---

### 阶段7：优化和打磨（第9-10天）
**目标**：完善细节，提升用户体验

**优化清单**：
1. **性能优化**
   - 大量书签分批处理（50个一批）
   - 添加缓存机制
   - 优化DOM操作

2. **UI优化**
   - 添加加载动画
   - 优化响应式布局
   - 改进错误提示

3. **功能增强**
   - 添加搜索过滤
   - 支持自定义整理策略
   - 添加键盘快捷键

4. **国际化**
   - 支持中英文切换
   - 本地化日期格式

**验收标准**：
- 处理500+书签流畅
- UI无卡顿
- 所有文本已翻译

---

## 三、代码生成指南

### 3.1 代码风格规范

**命名约定**：
- 变量/函数：小驼峰 `getUserBookmarks`
- 类/构造函数：大驼峰 `BookmarkManager`
- 常量：全大写下划线 `MAX_BOOKMARKS_PER_BATCH`
- 私有方法：下划线前缀 `_parseResponse`

**函数设计**：
```javascript
/**
 * 获取所有书签
 * @returns {Promise<Bookmark[]>} 书签列表
 */
async function getAllBookmarks() {
  // 实现
}
```

**错误处理模式**：
```javascript
async function riskyOperation() {
  try {
    const result = await someAsyncOperation();
    return { success: true, data: result };
  } catch (error) {
    console.error('Operation failed:', error);
    return { 
      success: false, 
      error: error.message,
      userMessage: '操作失败，请重试'
    };
  }
}
```

### 3.2 Chrome API使用模式

**Bookmarks API**：
```javascript
// ✅ 正确：使用Promise
async function getBookmarks() {
  return new Promise((resolve) => {
    chrome.bookmarks.getTree((tree) => {
      resolve(tree);
    });
  });
}

// ❌ 错误：直接使用回调（不便于async/await）
chrome.bookmarks.getTree((tree) => {
  // 处理tree
});
```

**Storage API**：
```javascript
// ✅ 使用chrome.storage.sync（自动同步）
await chrome.storage.sync.set({ config: data });

// ❌ 不使用localStorage（不同步）
localStorage.setItem('config', JSON.stringify(data));
```

### 3.3 常见模式

**单例模式（配置管理器）**：
```javascript
class ConfigManager {
  static instance = null;
  
  static getInstance() {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }
  
  async getConfig() {
    // 实现
  }
}
```

**工厂模式（AI Provider）**：
```javascript
class AIProviderFactory {
  static create(type, config) {
    switch(type) {
      case 'openai':
        return new OpenAIProvider(config);
      case 'claude':
        return new ClaudeProvider(config);
      case 'qwen':
        return new QwenProvider(config);
      default:
        throw new Error(`Unknown provider: ${type}`);
    }
  }
}
```

---

## 四、调试和测试指南

### 4.1 调试技巧

**Chrome DevTools**：
- Popup调试：右键popup → 检查
- Background调试：chrome://extensions → 背景页 → 检查视图
- Console日志：使用console分组
  ```javascript
  console.group('Bookmark Processing');
  console.log('Total:', count);
  console.groupEnd();
  ```

**常见问题排查**：
1. **权限问题**：检查manifest.json权限配置
2. **API调用失败**：检查网络面板
3. **存储问题**：chrome://sync-internals查看同步状态
4. **书签操作失败**：检查书签ID是否有效

### 4.2 测试用例

**单元测试（手动）**：
```javascript
// 测试书签读取
async function testGetBookmarks() {
  const bookmarks = await getAllBookmarks();
  console.assert(Array.isArray(bookmarks), 'Should return array');
  console.assert(bookmarks.length > 0, 'Should have bookmarks');
  console.log('✅ testGetBookmarks passed');
}

// 测试配置保存
async function testConfigSave() {
  const config = { apiKey: 'test-key' };
  await saveConfig(config);
  const loaded = await loadConfig();
  console.assert(loaded.apiKey === 'test-key', 'Config should persist');
  console.log('✅ testConfigSave passed');
}
```

**集成测试场景**：
1. 空书签测试
2. 大量书签测试（500+）
3. 深层嵌套测试（5层文件夹）
4. 特殊字符测试
5. 网络失败测试

### 4.3 性能测试

**性能基准**：
```javascript
async function benchmarkBookmarkProcessing() {
  const start = performance.now();
  const bookmarks = await getAllBookmarks();
  const readTime = performance.now() - start;
  
  console.log(`Read ${bookmarks.length} bookmarks in ${readTime}ms`);
  console.assert(readTime < 1000, 'Should read in <1s');
}
```

---

## 五、常见问题和解决方案

### 5.1 API相关

**Q: 如何处理API rate limit？**
```javascript
async function callWithRateLimit(apiCall, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.status === 429) {
        const delay = Math.pow(2, i) * 1000; // 指数退避
        console.log(`Rate limited, waiting ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
}
```

**Q: 如何验证API响应格式？**
```javascript
function validateAIResponse(response) {
  const schema = {
    folders: 'array',
    changes: 'array',
    statistics: 'object'
  };
  
  for (const [key, type] of Object.entries(schema)) {
    if (typeof response[key] !== type && 
        !(type === 'array' && Array.isArray(response[key]))) {
      throw new Error(`Invalid response: ${key} should be ${type}`);
    }
  }
  
  return true;
}
```

### 5.2 书签操作相关

**Q: 如何避免删除所有书签？**
```javascript
async function safeDeleteBookmark(id) {
  // 1. 确认书签存在
  const bookmark = await chrome.bookmarks.get(id);
  if (!bookmark) {
    throw new Error('Bookmark not found');
  }
  
  // 2. 不允许删除文件夹（防止误删）
  if (bookmark[0].url === undefined) {
    throw new Error('Cannot delete folder');
  }
  
  // 3. 删除前备份
  await createBackup();
  
  // 4. 执行删除
  await chrome.bookmarks.remove(id);
}
```

**Q: 如何处理并发书签操作？**
```javascript
// 使用队列串行化操作
class BookmarkQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }
  
  async add(operation) {
    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject });
      this.process();
    });
  }
  
  async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    const { operation, resolve, reject } = this.queue.shift();
    
    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.processing = false;
      this.process(); // 处理下一个
    }
  }
}
```

### 5.3 UI相关

**Q: 如何显示长时间操作的进度？**
```javascript
class ProgressTracker {
  constructor(total, onProgress) {
    this.total = total;
    this.current = 0;
    this.onProgress = onProgress;
  }
  
  increment() {
    this.current++;
    const percent = Math.round((this.current / this.total) * 100);
    this.onProgress(percent, this.current, this.total);
  }
}

// 使用
const progress = new ProgressTracker(bookmarks.length, (percent) => {
  updateProgressBar(percent);
});

for (const bookmark of bookmarks) {
  await processBookmark(bookmark);
  progress.increment();
}
```

---

## 六、安全检查清单

在生成代码时，请确保：

### 6.1 数据安全
- [ ] API密钥不在代码中硬编码
- [ ] 不在console.log中输出敏感信息
- [ ] 用户数据不发送到非用户指定的服务器
- [ ] 所有网络请求使用HTTPS

### 6.2 操作安全
- [ ] 危险操作（删除）需要二次确认
- [ ] 批量操作有备份机制
- [ ] 操作失败能够回滚
- [ ] 有撤销功能

### 6.3 权限安全
- [ ] 只申请必要的权限
- [ ] 不访问无关的Chrome API
- [ ] 不读取用户浏览历史（除非必要且说明）

---

## 七、与用户沟通指南

### 7.1 代码解释
当用户询问代码时：
1. **先解释目的**："这段代码的作用是..."
2. **再解释实现**："通过...方式实现"
3. **最后解释细节**："其中...是为了..."

### 7.2 方案建议
当提供多个方案时：
```markdown
有两种实现方式：

**方案A：简单但有限制**
- 优点：实现简单，代码少
- 缺点：只支持50个书签
- 适用：快速原型

**方案B：复杂但完整**
- 优点：支持无限书签，性能好
- 缺点：代码较多
- 适用：生产环境

建议：如果是学习，用方案A；如果要发布，用方案B
```

### 7.3 错误诊断
当用户报告错误时：
1. 询问错误信息
2. 询问操作步骤
3. 提供可能的原因
4. 给出解决方案
5. 提供调试建议

---

## 八、迭代开发建议

### 8.1 MVP（最小可用产品）
**第一版应该包含**：
- ✅ 基本配置（仅OpenAI）
- ✅ 读取书签
- ✅ 简单分类（按域名）
- ✅ 预览和应用

**第一版可以不包含**：
- ❌ 多AI提供商
- ❌ 复杂整理策略
- ❌ 撤销功能
- ❌ 国际化

### 8.2 功能优先级
1. **P0（必须有）**：读取书签、基本整理、应用更改
2. **P1（应该有）**：多AI支持、预览、错误处理
3. **P2（可以有）**：撤销、高级策略、性能优化
4. **P3（锦上添花）**：国际化、主题、导出功能

### 8.3 版本规划
- **v0.1**：MVP，仅核心功能
- **v0.5**：完善的单AI版本
- **v1.0**：支持多AI，ready for release
- **v1.5**：高级功能和优化
- **v2.0**：协作和云同步

---

## 九、代码审查要点

生成代码后，请自我审查：

### 9.1 功能性
- [ ] 代码实现了需求的功能
- [ ] 边界情况有处理
- [ ] 错误处理完整

### 9.2 可读性
- [ ] 变量命名语义化
- [ ] 函数职责单一
- [ ] 关键逻辑有注释

### 9.3 性能
- [ ] 无明显性能问题
- [ ] 大量数据有优化
- [ ] 无内存泄漏

### 9.4 安全性
- [ ] 无安全漏洞
- [ ] 用户数据受保护
- [ ] 权限使用合理

---

## 十、快速参考

### 10.1 常用Chrome API

```javascript
// Bookmarks
chrome.bookmarks.getTree(callback)
chrome.bookmarks.get(id, callback)
chrome.bookmarks.create({parentId, title, url}, callback)
chrome.bookmarks.update(id, {title}, callback)
chrome.bookmarks.move(id, {parentId, index}, callback)
chrome.bookmarks.remove(id, callback)

// Storage
chrome.storage.sync.set({key: value}, callback)
chrome.storage.sync.get([keys], callback)
chrome.storage.sync.remove(keys, callback)

// Runtime
chrome.runtime.sendMessage({type, data}, callback)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {})
```

### 10.2 常用工具函数

```javascript
// 延迟
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 防抖
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 节流
function throttle(fn, delay) {
  let last = 0;
  return function(...args) {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn.apply(this, args);
    }
  };
}

// 深拷贝
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));
```

---

## 十一、最后的提醒

### 作为AI开发助手，你应该：

✅ **应该做的**：
- 提供可运行的完整代码
- 解释代码的工作原理
- 提供多种实现方案
- 指出潜在问题
- 给出最佳实践建议
- 帮助调试和优化

❌ **不应该做的**：
- 生成不符合constitution.md的代码
- 硬编码敏感信息
- 忽略错误处理
- 过度复杂化简单问题
- 使用外部依赖（除非用户明确要求）
- 生成不安全的代码

### 核心原则

记住这三点：
1. **用户数据安全第一** - 这是底线
2. **代码质量优于速度** - 宁慢勿错
3. **沟通清晰友好** - 帮助用户理解

---

## 变更日志
- v1.0.0 (2024-02-05) - 初始版本，完整的开发指南

**祝开发顺利！遇到问题随时参考这份指南。**
