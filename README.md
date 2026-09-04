# AI 剧场 · 沉浸式角色演绎

一个基于 **EdgeOne Pages 全栈能力** 构建的沉浸式 AI 角色扮演（RP）Web 应用。用户创建或选择角色卡，通过流式对话与 AI 扮演的角色进行互动，AI 会自动推进剧情、描写场景、维护角色状态。

## 项目简介

**AI 剧场** 是一个纯前端单页应用（SPA），无需构建工具即可部署。项目利用 EdgeOne Pages 的边缘函数（Cloudflare Workers 风格 API）作为后端代理，统一接入 **Makers Models 网关**，实现：

- 开箱即用的内置模型（平台侧密钥存于环境变量，前端零接触）
- 可选自定义 OpenAI 兼容 API（BYOK，密钥仅存本地）
- **三模式切换**：剧情演绎（RP）/ 世界书（占位预留）/ 角色卡工坊
- 角色卡系统：内置卡、自定义卡、支持导入 SillyTavern（酒馆）V2/V3 角色卡（PNG/JSON）
- 流式对话（SSE）实时渲染
- 自动剧情摘要归档与注入
- 防重复机制（自动检测并换角度重写）
- 支持深浅色主题与移动端适配

## 技术架构

```
浏览器（index.html 单页应用）
   │
   ├── /api/cards ────────────→ 角色卡 API（KV 优先，FALLBACK 兜底）
   ├── /api/status ───────────→ 网关状态检查（是否配置平台密钥）
   ├── /api/models ───────────→ 模型列表代理（透传 /models）
   └── /api/chat/completions ─→ Makers Models 统一网关代理（SSE 透传）
```

### 目录结构

```
.
├── index.html              # 前端单页应用（全部 UI/逻辑/样式内联）
├── functions/              # EdgeOne Pages 边缘函数
│   └── api/
│       ├── cards.js        # 内置角色卡下发（KV 优先，代码兜底）
│       ├── status.js       # 平台密钥状态查询
│       ├── models.js       # 模型列表代理（支持 BYOK）
│       └── chat/
│           └── completions.js  # Makers Models 网关代理（SSE 流式透传）
└── .gitignore
```

## 三种工作模式

侧栏顶部的 `mode-switch` 支持在三种视图间切换：

| 模式 | 说明 |
|---|---|
| 🎭 剧情演绎（RP） | 选择一个角色卡，以单人视角流式对话互动，AI 扮演角色并推进剧情 |
| 📖 世界书 | 占位预留：规划为多角色同场、事件推进、正反派博弈的更宏大舞台（即将上线） |
| 🔧 角色卡工坊 | 模板填空 + AI 补全 + 草稿区 + JSON 导出的角色卡制作流水线 |

### 🔧 角色卡工坊

- **7 个内置模板**：空白卡 / 恋人纵容型 / 治愈陪伴型 / 悬疑引路型 / 严师益友型 / 反派宿敌型 / 闯入变数型
- 选择模板自动填入骨架字段（人设、底层输出规则等）作为起点
- **字段级「✨ 补全」** 与 **「AI 补全全部空字段」**：调用 `/api/chat/completions` 非流式生成 JSON，智能补齐缺省字段
- **草稿区**：持久化到 localStorage，支持编辑 / 复制 / 加入角色 / 删除；加入角色后自动从草稿移除并切回剧情演绎
- **导出**：单卡 / 批量导出 JSON（文件名带角色名或时间戳）
- 后端零改动（复用 `/api/chat/completions` 与 `/api/cards`）

## 核心功能

### 🎭 角色扮演

- **角色卡系统**：每个角色包含名称、Emoji、人设（persona）、底层输出规则（baseDirective）、剧情初始环境（initialScene）、用户设定（userProfile）、角色关系等字段
- **沉浸式演绎协议**：AI 回复需带 `【状态】`、`【场景】` 标记行，动作用 `*星号*` 包裹、台词用 `"引号"` 标注，前端自动解析并视觉化呈现
- **剧情状态栏**：实时展示 AI 当前角色状态、所处场景
- **剧情记忆**：对话超过 16 轮后自动调用 AI 生成剧情摘要（保留最近 3 段），注入后续系统提示，保证长对话连贯

### 🔌 模型接入

- **内置模式（默认）**：平台密钥存于 Pages 环境变量 `MAKERS_MODELS_KEY`，无需用户配置即可使用
- **自定义模式（BYOK）**：支持任意 OpenAI 兼容 API 地址，密钥存于浏览器 localStorage
- **模型名归一化**：不带 `/` 的模型名自动补 `@makers/` 前缀；带 `/` 的按 `provider/model` 原样透传
- **内置免费模型**：DeepSeek、MiniMax、Kimi、Hy3 等（无 `/models` 接口时由前端 `BUILTIN_MODELS` 维护清单）

### 📝 角色卡管理

- 创建/编辑/删除自定义角色
- 服务端 KV 下发内置角色（沈砚、苏棠、雾城引路人等），运营侧可随时更新
- 支持导入 SillyTavern PNG/JSON 角色卡（V2/V3 自动映射字段）或 TXT/Markdown 文件

### 💬 对话体验

- SSE 流式逐字渲染，带思考动画
- 支持撤回上一轮、重新生成、复制消息
- 支持上传文本附件（≤256KB）
- 反重复机制：自动检测内容相似度，超出阈值时强制换角度重新生成
- 高级演绎参数：思考模式（off/high/max）、temperature、top_p 均可调

## 部署到 EdgeOne Pages

### 前置准备

1. 在 EdgeOne Pages 控制台创建项目（framework 选择「纯静态」）
2. 上传/关联仓库代码
3. **设置环境变量**：
   ```
   MAKERS_MODELS_KEY=sk-xxxx  # Makers Models 网关密钥
   ```
4. **绑定 KV 命名空间**（可选）：
   - 变量名：`CARDS_KV`
   - 将 JSON 数组写入 `builtin-cards` 键，格式：
     ```json
     [{"id":"my-card","name":"角色名","emoji":"✨","description":"简介","baseDirective":"...","persona":"...","userProfile":"","initialScene":"...","relationship":"..."}]
     ```
5. 部署后即可访问

### 模型接入说明

内置模型走 **Makers Models 网关**（`https://ai-gateway.edgeone.link/v1`），需平台侧预配额度。若绑定自有厂商密钥（OpenAI/DeepSeek 等），可将 API 地址与 Key 在页面设置中自行填写。

### 环境变量速查

| 变量名 | 用途 | 是否必填 |
|---|---|---|
| `MAKERS_MODELS_KEY` | 平台侧 Makers Models 密钥，供内置模型代理使用 | 使用内置模型时必填 |
| `CARDS_KV` | 绑定 KV 命名空间，覆盖内置角色卡 | 可选，未配置时使用代码内兜底卡 |

## 安全设计

- **不输出 CORS 头**：API 仅允许同源页面调用，防止其他网站跨站盗刷平台密钥
- **密钥分级保护**：自定义密钥只存于浏览器 localStorage；平台密钥存于服务端环境变量，前端全程接触不到
- **模型列表请求不落 URL**：密钥通过请求体传递，不进入访问日志
- **响应禁缓存**：所有 API 均设置 `cache-control: no-store`

## 开发调试

无需任何构建工具。本地直接打开 `index.html` 即可调试 UI（API 调用会 404，需部署后联调）。部署后可在 EdgeOne 控制台查看边缘函数日志。

---

**注意**：本应用面向 EdgeOne Pages 平台，边缘函数使用 Workers 风格的 `onRequest` 导出函数。
