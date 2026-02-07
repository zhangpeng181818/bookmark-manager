# Chrome书签整理插件开发指南

## 项目概述
开发一个Chrome浏览器插件，通过集成大模型API（如OpenAI、Claude、通义千问等）来智能整理和重写混乱的收藏夹。

---

## 一、项目结构

```
bookmark-organizer/
├── manifest.json          # Chrome插件配置文件
├── popup.html            # 弹出窗口界面
├── popup.js              # 弹出窗口逻辑
├── background.js         # 后台服务worker
├── config.html           # 配置页面
├── config.js             # 配置页面逻辑
├── api-handler.js        # API调用处理
├── bookmark-manager.js   # 书签管理逻辑
├── styles.css           # 样式文件
└── icons/               # 图标文件夹
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 二、核心功能模块

### 2.1 manifest.json 配置
需要申请的权限：
- `bookmarks` - 读取和修改书签
- `storage` - 存储API配置信息
- `activeTab` - 可选，用于获取当前标签页信息

### 2.2 用户配置界面
需要配置的内容：
1. **API提供商选择**：OpenAI / Anthropic Claude / 阿里通义千问 / 其他
2. **API Endpoint**：API地址
3. **API Key**：密钥
4. **模型选择**：gpt-4 / claude-3-sonnet / qwen-max 等
5. **整理策略**：
   - 按主题分类
   - 按网站类型分类
   - 按使用频率分类
   - 自定义prompt

### 2.3 书签读取模块
使用Chrome Bookmarks API：
- `chrome.bookmarks.getTree()` - 获取完整书签树
- 递归遍历所有书签
- 提取信息：title, url, dateAdded, 层级关系

### 2.4 AI整理逻辑
**步骤：**
1. 收集所有书签信息
2. 构建prompt发送给大模型
3. 解析AI返回的整理方案
4. 预览整理结果
5. 用户确认后应用更改

**Prompt设计建议：**
```
你是一个书签整理专家。我有以下书签需要整理：

[书签列表JSON]

请帮我：
1. 分析这些书签的主题和类别
2. 为每个书签提供更清晰的标题（如果原标题不够描述性）
3. 建议合理的文件夹分类结构
4. 删除重复的书签

请以JSON格式返回整理方案。
```

### 2.5 书签更新模块
使用Chrome Bookmarks API：
- `chrome.bookmarks.create()` - 创建新文件夹/书签
- `chrome.bookmarks.update()` - 更新书签标题
- `chrome.bookmarks.move()` - 移动书签位置
- `chrome.bookmarks.remove()` - 删除书签

---

## 三、开发步骤详解

### Step 1: 创建基础结构
1. 在OpenCode中创建新项目文件夹
2. 创建manifest.json，设置基本信息和权限
3. 准备图标文件（可以用AI生成或使用占位图）

### Step 2: 开发配置页面
1. 创建config.html - 表单界面
   - API提供商下拉选择
   - API Endpoint输入框
   - API Key输入框（password类型）
   - 模型选择下拉框
   - 保存按钮

2. 创建config.js - 配置逻辑
   - 使用`chrome.storage.sync`保存配置
   - 加载已保存的配置
   - 表单验证

### Step 3: 开发主界面
1. 创建popup.html - 主操作界面
   - 显示书签统计信息
   - "开始整理"按钮
   - 进度显示区域
   - 预览区域
   - "应用更改"按钮
   - "设置"链接

2. 创建popup.js - 主逻辑
   - 读取书签数据
   - 调用AI API
   - 显示整理预览
   - 应用更改

### Step 4: API调用模块
创建api-handler.js：

**支持的API格式：**

1. **OpenAI兼容格式**
   ```javascript
   POST {endpoint}/v1/chat/completions
   Headers: Authorization: Bearer {api_key}
   Body: {
     model: "gpt-4",
     messages: [{role: "user", content: "..."}]
   }
   ```

2. **Anthropic Claude格式**
   ```javascript
   POST https://api.anthropic.com/v1/messages
   Headers: 
     x-api-key: {api_key}
     anthropic-version: 2023-06-01
   Body: {
     model: "claude-3-sonnet-20240229",
     messages: [{role: "user", content: "..."}]
   }
   ```

3. **阿里通义千问**
   ```javascript
   POST https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
   Headers: Authorization: Bearer {api_key}
   Body: {
     model: "qwen-max",
     input: {messages: [...]}
   }
   ```

**错误处理：**
- 网络错误
- API密钥无效
- 请求限流
- 响应格式错误

### Step 5: 书签管理模块
创建bookmark-manager.js：

**功能函数：**
1. `getAllBookmarks()` - 获取所有书签
2. `parseBookmarkTree(tree)` - 解析书签树为扁平列表
3. `buildOrganizationPrompt(bookmarks)` - 构建AI prompt
4. `parseAIResponse(response)` - 解析AI返回的JSON
5. `applyChanges(changes)` - 应用整理方案
6. `createFolder(name, parentId)` - 创建文件夹
7. `moveBookmark(id, newParentId)` - 移动书签

### Step 6: 后台服务
创建background.js：
- 监听插件安装事件
- 可选：定期整理提醒
- 可选：监听书签变化

### Step 7: 样式优化
创建styles.css：
- 现代化UI设计
- 响应式布局
- 加载动画
- 差异对比样式

---

## 四、关键技术点

### 4.1 Chrome Bookmarks API使用
```javascript
// 获取书签树
chrome.bookmarks.getTree((tree) => {
  // 处理书签树
});

// 创建文件夹
chrome.bookmarks.create({
  parentId: '1',
  title: '工作相关'
}, (result) => {
  console.log('文件夹已创建:', result);
});

// 更新书签标题
chrome.bookmarks.update(bookmarkId, {
  title: '新标题'
});

// 移动书签
chrome.bookmarks.move(bookmarkId, {
  parentId: newFolderId,
  index: 0
});
```

### 4.2 数据存储
```javascript
// 保存配置
chrome.storage.sync.set({
  apiProvider: 'openai',
  apiKey: 'sk-xxx',
  endpoint: 'https://api.openai.com',
  model: 'gpt-4'
}, () => {
  console.log('配置已保存');
});

// 读取配置
chrome.storage.sync.get(['apiKey', 'endpoint', 'model'], (result) => {
  console.log('配置:', result);
});
```

### 4.3 AI Prompt设计技巧
**输入格式示例：**
```json
{
  "bookmarks": [
    {"id": "123", "title": "GitHub", "url": "https://github.com"},
    {"id": "124", "title": "Stack Overflow", "url": "https://stackoverflow.com"},
    ...
  ],
  "task": "请将这些书签按照类别整理，并提供更描述性的标题"
}
```

**期望输出格式：**
```json
{
  "folders": [
    {
      "name": "开发工具",
      "bookmarks": [
        {"id": "123", "newTitle": "GitHub - 代码托管平台"},
        {"id": "124", "newTitle": "Stack Overflow - 编程问答社区"}
      ]
    },
    {
      "name": "学习资源",
      "bookmarks": [...]
    }
  ],
  "duplicates": ["125", "126"],
  "suggestions": "建议删除重复的书签..."
}
```

### 4.4 批量处理优化
- 分批发送（避免token限制）
- 进度显示
- 错误重试机制
- 回滚功能（保存原始状态）

---

## 五、高级功能建议

### 5.1 智能分类策略
- **按域名聚类**：相同域名的书签归类
- **按访问频率**：使用chrome.history API
- **语义相似度**：使用AI理解内容相关性
- **时间维度**：按添加时间分组

### 5.2 预览和对比
- 树形结构对比视图
- 高亮变更部分
- 支持手动调整AI方案
- 撤销/重做功能

### 5.3 定期维护
- 定时检查新增书签
- 检测失效链接
- 提醒重复书签
- 自动备份

### 5.4 导入导出
- 导出整理方案为JSON
- 导入其他浏览器书签
- 分享整理配置

---

## 六、安全注意事项

1. **API密钥保护**
   - 不要硬编码API密钥
   - 使用chrome.storage加密存储
   - 提醒用户密钥安全

2. **隐私保护**
   - 说明数据发送到哪里
   - 可选本地处理模式
   - 不上传敏感书签

3. **权限最小化**
   - 只申请必要权限
   - 解释权限用途

---

## 七、测试要点

### 7.1 功能测试
- [ ] 配置保存和读取
- [ ] 书签读取完整性
- [ ] API调用成功
- [ ] 整理方案正确性
- [ ] 书签更新无误
- [ ] 错误处理

### 7.2 边界情况
- [ ] 空书签栏
- [ ] 超大书签数量（1000+）
- [ ] 网络断开
- [ ] API限流
- [ ] 特殊字符标题
- [ ] 嵌套很深的文件夹

### 7.3 性能测试
- [ ] 大量书签处理速度
- [ ] 内存占用
- [ ] API调用次数优化

---

## 八、部署和发布

### 8.1 本地测试
1. 打开Chrome扩展管理页面：`chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目文件夹

### 8.2 打包发布
1. 在扩展管理页面点击"打包扩展程序"
2. 生成.crx文件
3. 可选：发布到Chrome Web Store

### 8.3 Chrome Web Store发布
- 需要开发者账号（$5注册费）
- 准备推广图片和截图
- 填写详细描述
- 隐私政策说明

---

## 九、代码片段参考

### 读取所有书签
```javascript
function getAllBookmarks() {
  return new Promise((resolve) => {
    chrome.bookmarks.getTree((tree) => {
      const bookmarks = [];
      
      function traverse(nodes, depth = 0) {
        nodes.forEach(node => {
          if (node.url) {
            bookmarks.push({
              id: node.id,
              title: node.title,
              url: node.url,
              depth: depth
            });
          }
          if (node.children) {
            traverse(node.children, depth + 1);
          }
        });
      }
      
      traverse(tree);
      resolve(bookmarks);
    });
  });
}
```

### 调用OpenAI API
```javascript
async function callOpenAI(prompt, apiKey, model) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: '你是一个书签整理专家，擅长分类和组织信息。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7
    })
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}
```

### 应用整理方案
```javascript
async function applyOrganization(plan) {
  // 1. 创建新文件夹结构
  for (const folder of plan.folders) {
    const newFolder = await chrome.bookmarks.create({
      parentId: '1', // 书签栏ID
      title: folder.name
    });
    
    // 2. 移动书签到对应文件夹
    for (const bookmark of folder.bookmarks) {
      await chrome.bookmarks.move(bookmark.id, {
        parentId: newFolder.id
      });
      
      // 3. 更新标题
      if (bookmark.newTitle) {
        await chrome.bookmarks.update(bookmark.id, {
          title: bookmark.newTitle
        });
      }
    }
  }
  
  // 4. 删除重复书签
  for (const duplicateId of plan.duplicates) {
    await chrome.bookmarks.remove(duplicateId);
  }
}
```

---

## 十、常见问题

### Q1: 如何处理大量书签？
A: 分批处理，每次50-100个，避免API token限制和超时。

### Q2: 如何避免整理失败导致书签丢失？
A: 在应用更改前先导出备份，使用chrome.bookmarks.export()。

### Q3: 不同AI模型返回格式不一致怎么办？
A: 在prompt中明确要求JSON格式，并在代码中做格式校验和兼容处理。

### Q4: 如何提高整理质量？
A: 优化prompt，提供示例，增加上下文信息（如网站描述、访问频率）。

---

## 十一、扩展想法

1. **智能标签**：自动为书签添加标签
2. **搜索增强**：AI辅助的书签搜索
3. **推荐系统**：基于现有书签推荐相关网站
4. **协作功能**：分享整理方案给团队
5. **多浏览器同步**：支持Firefox、Edge等
6. **移动端**：开发配套移动应用

---

## 附录：相关资源

- Chrome Extension官方文档：https://developer.chrome.com/docs/extensions/
- Bookmarks API文档：https://developer.chrome.com/docs/extensions/reference/bookmarks/
- OpenAI API文档：https://platform.openai.com/docs/
- Anthropic API文档：https://docs.anthropic.com/
- 阿里通义千问API：https://help.aliyun.com/zh/dashscope/

---

**开发愉快！如果在OpenCode实现过程中遇到具体问题，随时可以继续咨询。**
