# AI Bookmark Manager

使用 AI 智能整理 Chrome 书签的扩展程序。支持多种 AI 服务商（Kimi、OpenAI、Claude、DeepSeek 等）。

## 功能特性

- 🤖 **AI 智能分类** - 使用大模型自动分析并整理书签
- 📁 **三阶段整理策略** - 全局规划 → 智能分批 → 优化审查
- 🔍 **搜索功能** - 高亮匹配关键词，快速定位书签
- ⚙️ **多服务商支持** - Kimi、OpenAI、Claude、DeepSeek、智谱等
- 🎨 **SPA 界面** - 流畅的视图切换体验
- ✅ **自动化测试** - 内置视图切换测试

## 安装方法

### 方法一：Chrome 网上应用店
（待发布）

### 方法二：开发者模式安装

1. 克隆或下载本项目：
```bash
git clone https://github.com/zhangpeng181818/bookmark-manager.git
```

2. 打开 Chrome，访问 `chrome://extensions/`

3. 开启右上角的「开发者模式」

4. 点击「加载已解压的扩展程序」

5. 选择本项目的 `bookmark-manager` 文件夹

## 使用方法

### 1. 配置 API

1. 点击扩展图标打开 popup
2. 点击右上角设置按钮
3. 选择 AI 服务商（如 Kimi）
4. 输入 API Key
5. 选择模型
6. 点击「测试连接」验证
7. 点击「保存设置」

### 2. 整理书签

1. 点击「开始整理」
2. 等待 AI 分析和整理（进度条显示进度）
3. 预览整理方案
4. 点击「应用更改」执行整理

### 3. 搜索书签

在搜索框输入关键词，支持标题和 URL 匹配。

## 支持的 AI 服务商

| 服务商 | Endpoint | 推荐模型 |
|--------|----------|----------|
| Kimi | https://api.moonshot.cn | kimi-k2-0711-preview |
| OpenAI | https://api.openai.com | gpt-4o |
| Claude | https://api.anthropic.com | claude-3-5-sonnet |
| DeepSeek | https://api.deepseek.com | deepseek-chat |
| 智谱 ChatGLM | https://open.bigmodel.cn | glm-4 |

## 项目结构

```
bookmark-manager/
├── manifest.json          # Chrome 扩展配置
├── popup.html            # 主界面（SPA 结构）
├── popup.js              # Popup 逻辑
├── api-handler.js        # AI API 调用（含三阶段整理）
├── bookmark-manager.js    # Chrome bookmarks API 封装
├── config.html           # 设置页面（可独立使用）
├── config.js             # 设置页面逻辑
├── styles.css            # 样式文件
├── background.js         # Service Worker
├── tests/                # 自动化测试
│   ├── view-switching.test.js  # 视图切换单元测试
│   └── popup.spec.js     # Playwright 测试
├── icons/                # 图标资源
└── docs/                 # 文档
    ├── bookmark-organization-strategy.md  # 整理策略
    └── chrome-bookmark-organizer-guide.md  # 用户指南
```

## 开发

### 运行测试

```bash
npm test
```

### 项目特点

- **三阶段整理策略**：
  1. 全局分类规划 - AI 分析所有书签，创建分类树
  2. 智能分批处理 - 按主题分批，每批 ~100 个书签
  3. 结果优化审查 - 合并、排序、去重

- **SPA 架构**：
  - 首页/设置页在同一界面切换
  - 整理中禁止跳转到设置
  - 视图切换有状态锁防并发

## License

MIT

## Contributing

欢迎提交 Issue 和 Pull Request！
