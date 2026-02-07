# Constitution - Chrome书签整理插件

## 项目宪章
本文档定义了Chrome书签整理插件的核心原则、架构约束和开发规范。所有代码实现必须遵循这些原则。

---

## 一、核心价值观

### 1.1 用户至上
- **隐私第一**：用户书签数据是隐私信息，必须妥善保护
- **用户控制**：所有操作必须经过用户明确授权，提供预览和撤销机制
- **透明度**：清晰说明数据发送到哪里，如何使用
- **无强制**：不能强制用户使用特定API提供商

### 1.2 可靠性
- **数据安全**：任何操作前必须有备份机制
- **错误处理**：优雅处理所有错误，不能导致书签丢失
- **回滚能力**：支持撤销操作，恢复到之前状态
- **幂等性**：重复执行相同操作应得到一致结果

### 1.3 性能优先
- **响应迅速**：UI操作响应时间 < 100ms
- **渐进式加载**：大量书签分批处理，显示进度
- **资源节约**：最小化内存占用和API调用次数
- **后台处理**：耗时操作在后台执行，不阻塞UI

---

## 二、架构原则

### 2.1 模块化设计
**强制分层**：
```
├── UI层（popup, config）
│   └── 只负责展示和用户交互
├── 业务逻辑层（bookmark-manager）
│   └── 处理书签操作和整理逻辑
├── API层（api-handler）
│   └── 封装不同AI提供商的API调用
└── 数据层（chrome.storage, chrome.bookmarks）
    └── 数据持久化和Chrome API交互
```

**原则**：
- 每个模块职责单一
- 模块间通过接口通信
- 禁止跨层调用
- UI层不直接调用Chrome API

### 2.2 依赖管理
- **零外部依赖**：不使用任何npm包或第三方库
- **纯原生JS**：使用ES6+标准语法
- **Chrome API Only**：只依赖Chrome提供的API
- **理由**：保持插件轻量、安全、快速加载

### 2.3 状态管理
- **单一数据源**：配置存储在chrome.storage.sync
- **不可变数据**：操作前复制，不直接修改原始数据
- **状态同步**：配置变更立即同步到所有界面
- **本地优先**：优先使用本地缓存，减少存储读写

---

## 三、API设计原则

### 3.1 统一接口
所有AI提供商必须实现统一接口：
```javascript
interface AIProvider {
  name: string;
  async organize(bookmarks, prompt, config): Promise<OrganizationPlan>;
  validateConfig(config): boolean;
  getDefaultModel(): string;
}
```

### 3.2 支持的AI提供商
**必须支持**：
1. OpenAI (GPT-3.5, GPT-4)
2. Anthropic Claude (Claude 3 Sonnet/Opus)
3. 阿里通义千问
4. 自定义OpenAI兼容API（如DeepSeek、Moonshot等）

**扩展性**：
- 易于添加新的AI提供商
- 统一的错误处理机制
- 统一的响应格式解析

### 3.3 错误处理
**必须处理的错误**：
- 网络错误（超时、断网）
- API认证失败
- API限流（429错误）
- 响应格式错误
- Token超限

**错误处理策略**：
- 显示友好的错误提示
- 提供重试机制
- 记录错误日志（不包含敏感信息）
- 失败时不改变原有书签

---

## 四、数据结构规范

### 4.1 书签数据结构
```typescript
interface Bookmark {
  id: string;           // Chrome书签ID
  title: string;        // 原始标题
  url: string;          // URL
  parentId: string;     // 父文件夹ID
  index: number;        // 在文件夹中的位置
  dateAdded: number;    // 添加时间戳
  path: string[];       // 文件夹路径（用于显示）
}
```

### 4.2 整理方案数据结构
```typescript
interface OrganizationPlan {
  version: string;                    // 方案版本
  timestamp: number;                  // 生成时间
  folders: FolderStructure[];         // 文件夹结构
  changes: BookmarkChange[];          // 变更列表
  duplicates: string[];               // 重复书签ID
  brokenLinks: string[];              // 失效链接ID（可选）
  statistics: {                       // 统计信息
    totalBookmarks: number;
    foldersCreated: number;
    bookmarksMoved: number;
    bookmarksRenamed: number;
    duplicatesRemoved: number;
  };
  aiSuggestions: string;              // AI的额外建议
}

interface FolderStructure {
  name: string;                       // 文件夹名称
  description?: string;               // 文件夹描述
  bookmarkIds: string[];              // 包含的书签ID列表
  subfolders?: FolderStructure[];     // 子文件夹
}

interface BookmarkChange {
  type: 'move' | 'rename' | 'delete' | 'create_folder';
  bookmarkId: string;
  oldValue?: any;
  newValue?: any;
  reason?: string;                    // 变更原因
}
```

### 4.3 配置数据结构
```typescript
interface UserConfig {
  apiProvider: string;                // 'openai' | 'claude' | 'qwen' | 'custom'
  apiKey: string;                     // API密钥（加密存储）
  apiEndpoint: string;                // API地址
  model: string;                      // 模型名称
  organizationStrategy: string;       // 'topic' | 'domain' | 'custom'
  customPrompt?: string;              // 自定义prompt
  maxBookmarksPerBatch: number;       // 每批处理数量（默认50）
  autoBackup: boolean;                // 是否自动备份
  language: string;                   // 界面语言
}
```

---

## 五、UI/UX原则

### 5.1 设计原则
- **简洁明了**：界面简洁，操作步骤清晰
- **渐进式披露**：高级功能折叠，避免信息过载
- **即时反馈**：所有操作提供即时视觉反馈
- **防呆设计**：危险操作需要二次确认

### 5.2 交互流程
**核心流程必须遵循**：
1. 首次使用 → 引导配置API
2. 点击整理 → 读取书签 → 显示统计
3. 调用AI → 显示进度（0-100%）
4. 返回结果 → 显示预览（对比视图）
5. 用户确认 → 应用更改 → 显示成功提示
6. 提供撤销选项（5分钟内）

### 5.3 响应式设计
- popup宽度：400px
- 高度自适应内容
- 支持滚动
- 关键按钮始终可见

### 5.4 无障碍访问
- 所有交互元素可键盘访问
- 提供aria-label
- 颜色对比度符合WCAG 2.1 AA标准
- 支持屏幕阅读器

---

## 六、安全规范

### 6.1 数据保护
**禁止事项**：
- ❌ 硬编码API密钥
- ❌ 明文存储密钥
- ❌ 在日志中记录敏感信息
- ❌ 未经用户同意上传数据

**必须执行**：
- ✅ API密钥存储在chrome.storage.sync（Chrome会加密）
- ✅ 清晰标注数据发送给哪个AI服务
- ✅ 提供"本地模式"选项（不使用AI）
- ✅ 用户可随时删除所有配置

### 6.2 权限最小化
**只申请必要权限**：
- `bookmarks` - 必需，读写书签
- `storage` - 必需，保存配置
- 禁止申请：`history`, `tabs`, `webRequest`等非必需权限

### 6.3 网络安全
- 只使用HTTPS连接
- 验证API响应格式
- 设置合理的超时时间（30秒）
- 防止XSS注入（sanitize所有用户输入）

---

## 七、性能约束

### 7.1 响应时间
- UI渲染：< 100ms
- 配置保存：< 200ms
- 读取书签（100个）：< 500ms
- AI API调用：< 30秒（含超时）
- 应用更改（100个）：< 2秒

### 7.2 资源限制
- 内存占用：< 50MB
- 单次处理书签数：建议50-100个
- API调用频率：遵循提供商限制
- 存储空间：< 5MB（配置+缓存）

### 7.3 优化策略
- 懒加载：按需加载模块
- 防抖：用户输入300ms后再处理
- 缓存：缓存AI响应（可选）
- 批处理：大量操作分批执行

---

## 八、开发规范

### 8.1 代码风格
- **命名**：驼峰命名法，语义化
- **注释**：关键逻辑必须注释
- **格式**：2空格缩进，单引号
- **ES6+**：使用async/await，箭头函数，解构等

### 8.2 错误处理
**必须使用try-catch**：
```javascript
async function riskyOperation() {
  try {
    // 操作代码
  } catch (error) {
    console.error('Operation failed:', error.message);
    showUserFriendlyError(error);
    // 记录但不暴露技术细节给用户
  }
}
```

### 8.3 日志规范
- 开发环境：详细日志
- 生产环境：只记录错误和关键操作
- 禁止记录：API密钥、用户书签URL、个人信息

### 8.4 测试要求
**必须测试**：
- 空书签场景
- 大量书签（500+）
- 网络失败场景
- API错误响应
- 并发操作

---

## 九、AI Prompt规范

### 9.1 Prompt模板
**系统提示词**：
```
你是一个专业的书签整理助手。你的任务是分析用户的书签并提供合理的分类和命名建议。

要求：
1. 返回标准JSON格式
2. 文件夹名称简洁、语义清晰
3. 书签标题描述性强，包含关键信息
4. 识别并标记重复书签
5. 按主题而非域名分类
```

**用户提示词**：
```
我有以下{count}个书签需要整理：

{bookmarks_json}

请按照主题分类，并为每个书签提供更好的标题。返回JSON格式。
```

### 9.2 响应格式验证
- 必须是有效的JSON
- 包含必需字段：folders, changes
- 书签ID必须真实存在
- 文件夹名称不能为空
- 拒绝不符合格式的响应

### 9.3 Fallback机制
如果AI返回无效：
1. 尝试修复JSON（去除markdown标记）
2. 使用简单规则分类（按域名）
3. 提示用户AI处理失败

---

## 十、版本管理

### 10.1 版本号规则
遵循语义化版本：`MAJOR.MINOR.PATCH`
- MAJOR：不兼容的API变更
- MINOR：新功能，向后兼容
- PATCH：错误修复

### 10.2 变更日志
每个版本必须记录：
- 新增功能
- 修复的bug
- 性能改进
- 破坏性变更

### 10.3 向后兼容
- 配置格式变更需要迁移脚本
- 保持旧版本配置可用性
- 至少支持前一个主版本

---

## 十一、禁止事项

### ❌ 绝对禁止
1. **未经同意修改书签**：所有操作必须预览+确认
2. **收集用户数据**：不得上传书签到自己的服务器
3. **注入广告/追踪**：保持代码纯净
4. **混淆代码**：代码必须可读，便于审查
5. **滥用权限**：不访问无关数据

### ⚠️ 强烈不建议
1. 自动整理（没有预览）
2. 默认删除书签
3. 强制要求登录
4. 捆绑其他功能
5. 过度请求权限

---

## 十二、扩展性设计

### 12.1 插件化架构
- 新增AI提供商应只需添加一个文件
- 支持自定义整理策略（插件）
- 支持主题定制

### 12.2 国际化
- 所有文本使用i18n
- 支持至少中英文
- 日期时间格式本地化

### 12.3 未来功能预留
- 智能标签系统
- 书签推荐引擎
- 协作分享
- 移动端同步

---

## 十三、文档要求

### 13.1 必须提供
- README.md - 项目介绍和快速开始
- CHANGELOG.md - 版本变更记录
- PRIVACY.md - 隐私政策
- 代码注释 - 关键函数说明

### 13.2 用户文档
- 安装指南
- 配置教程（含截图）
- 常见问题FAQ
- 故障排除

### 13.3 开发者文档
- 架构说明
- API文档
- 贡献指南
- 本constitution.md

---

## 十四、发布检查清单

发布前必须完成：
- [ ] 所有核心功能测试通过
- [ ] 在至少3个不同Chrome版本测试
- [ ] 隐私政策已编写
- [ ] 无console.log/debugger语句
- [ ] manifest.json版本号已更新
- [ ] CHANGELOG已更新
- [ ] 图标符合Chrome Store规范
- [ ] 无硬编码的测试数据/密钥
- [ ] 代码经过人工审查
- [ ] 性能测试通过（500+书签）

---

## 十五、核心信条

**记住这些原则**：

1. **数据是用户的** - 我们只是帮助管理，不拥有
2. **失败时保守** - 宁可不做，不要做错
3. **透明胜于聪明** - 让用户知道发生了什么
4. **简单优于复杂** - 能用简单方案就别搞复杂
5. **速度很重要** - 用户时间宝贵
6. **隐私不妥协** - 这是底线

---

## 修订历史
- v1.0.0 (2024-02-05) - 初始版本

**本宪章是开发的指导原则，所有代码必须遵循。如有冲突，以本文档为准。**
