<!-- fanxing-style:start -->
<picture>
  <source media="(prefers-color-scheme: light)" srcset="https://fanxing724.github.io/new-make/fanxing724/projects/edgeone-aichat/cover.light.flat.svg">
  <img alt="AI 剧场 · 故事开场" src="https://fanxing724.github.io/new-make/fanxing724/projects/edgeone-aichat/cover.flat.svg" width="100%">
</picture>

**给角色一个舞台，让对话接着发生。**

角色和故事需要一个可以展开的空间。这个 EdgeOne 聊天项目围绕角色对话、自定义模型与模型路由展开，给不同的创作想法留一个入口。

<sub>番星 / 星轨手记 · <a href="https://fanxing724.github.io/new-make/fanxing724/projects/style.html">风格样板</a> · <a href="https://fanxing724.github.io/">个人小站</a></sub>
<!-- fanxing-style:end -->

# AI 剧场 · 沉浸式角色演绎

一个基于 **EdgeOne Pages 全栈能力** 构建的沉浸式 AI 角色扮演（RP）Web 应用。用户创建或选择角色卡，通过流式对话与 AI 扮演的角色进行互动，AI 会自动推进剧情、描写场景、维护角色状态。

## 项目简介

**AI 剧场** 是一个纯前端单页应用（SPA），无需构建工具即可部署。项目利用 EdgeOne Pages 的边缘函数（Cloudflare Workers 风格 API）作为后端代理，统一接入 **Makers Models 网关**，实现：

- 开箱即用的**两路内置后端**：EdgeOne Makers 网关（OpenAI 兼容协议）与 Cloudflare Workers AI（原生协议）
- 可选自定义 OpenAI 兼容 API（BYOK，密钥仅存本地）
- 对外模型代理转发（`/v1/*`）：第三方 OpenAI 兼容客户端经本站调用 EdgeOne 模型，真实密钥不出服务端
- **三模式切换**：剧情演绎（RP）/ 世界书（Lorebook）/ 角色卡工坊
- 角色卡系统：内置卡、自定义卡、导入 SillyTavern（酒馆）V2/V3 角色卡（PNG/JSON）、导出酒馆 V2 兼容 JSON
- 流式对话（SSE）实时渲染
- 自动剧情摘要归档与注入
- 防重复机制（自动检测并换角度重写）
- 支持深浅色主题与移动端适配

## 技术架构

```
浏览器（index.html 单页应用）—— 同源调用，不发 CORS 头
   │
   ├── /api/cards ────────────→ 角色卡 API（KV 优先，FALLBACK 兜底）
   ├── /api/status ───────────→ 三路后端状态检查（builtin / cloudflare / groq）
   ├── /api/health ───────────→ 健康检查探针（恒 200，附带后端就绪布尔值，支持 HEAD）
   ├── /api/models ───────────→ 模型列表代理（透传 /models）
   ├── /api/chat/completions ─→ Makers Models 统一网关代理（SSE 透传）
   ├── /api/cf/run ───────────→ Cloudflare Workers AI 原生代理（@cf/ 模型，SSE 透传）
   ├── /api/cf/models ────────→ Workers AI 模型清单（环境变量 CF_MODELS 或内置清单）
   └── /api/groq/chat/completions → Groq 内置代理（@groq/ 模型，角色卡工坊默认走这一路）

第三方 OpenAI 兼容客户端 —— 跨域调用，带服务自有访问令牌
   │
   ├── /v1/chat/completions ──┐
   ├── /v1/models ────────────┼→ EdgeOne 模型网关（上游密钥锁定为服务端 MAKERS_MODELS_KEY）
   └── /v1/status ────────────┘
```

### 目录结构

```
.
├── index.html              # 前端单页应用（全部 UI/逻辑/样式内联）
├── functions/              # EdgeOne Pages 边缘函数
│   ├── _lib/               # 边缘函数共享库（env / http / cors / gate / model-name；_ 前缀不注册路由）
│   │                       # 引用规则：functions/api/x.js → ../_lib/x.js；functions/<a>/<b>/x.js → ../../_lib/x.js
│   │                       # 打包器不解析 tsconfig paths、不跟随一级目录外的软链，路径写错部署构建会报 Could not resolve
│   ├── api/                # 本站页面专用（同源、无 CORS 头）
│   │   ├── cards.js        # 内置角色卡下发（KV 优先，代码兜底）
│   │   ├── status.js       # 平台密钥状态查询
│   │   ├── health.js       # 健康检查探针（uptime 监控用，恒 200）
│   │   ├── models.js       # 模型列表代理（支持 BYOK）
│   │   ├── chat/
│   │   │   └── completions.js  # Makers Models 网关代理（SSE 流式透传）
│   │   ├── cf/                 # Cloudflare Workers AI 内置后端（原生协议，不做 OpenAI 转换）
│   │   │   ├── run.js          # /api/cf/run：/ai/run/<model> 原样转发（支持 SSE）
│   │   │   └── models.js       # /api/cf/models：Workers AI 模型清单
│   │   └── groq/               # Groq 内置后端（OpenAI 兼容，角色卡工坊独立模型配置默认使用）
│   │       └── chat/
│   │           └── completions.js  # /api/groq/chat/completions：转发 api.groq.com（支持 BYOK）
│   └── v1/                     # 对外开放代理（OpenAI 兼容、带 CORS 与访问令牌校验）
│       ├── status.js           # 部署自查探针（免鉴权，只返回布尔值）
│       ├── models.js           # 对外模型列表
│       └── chat/
│           └── completions.js  # 对外对话补全转发
├── AGENTS.md                   # 仓库描述文件：架构约定 / 改动同步清单 / 安全红线 / 头图约定（改代码前先读）
└── .gitignore
```

## 三种工作模式

侧栏顶部的 `mode-switch` 支持在三种视图间切换：

| 模式 | 说明 |
|---|---|
| 🎭 剧情演绎（RP） | 选择一个角色卡，以单人视角流式对话互动，AI 扮演角色并推进剧情 |
| 📖 世界书 | 为当前角色维护关键词触发的世界观条目（Lorebook）：兼容导入/导出酒馆 World Info JSON，关键词命中或常驻时自动注入系统提示 |
| 🔧 角色卡工坊 | 模板填空 + AI 补全 + 草稿区 + JSON 导出的角色卡制作流水线 |

### 🔧 角色卡工坊

- **7 个内置模板**：空白卡 / 伙伴陪伴型 / 治愈温暖型 / 导师引导型 / 宿敌张力型 / 神秘引路型 / 闯入变数型
- 选择模板自动填入骨架字段（人设、底层输出规则等）作为起点
- **字段级「✨ 补全」** 与 **「AI 补全全部空字段」**：调用 `/api/chat/completions` 非流式生成 JSON，智能补齐缺省字段
- **草稿区**：持久化到 localStorage，支持编辑 / 复制 / 加入角色 / 删除；加入角色后自动从草稿移除并切回剧情演绎
- **一键清空表单**：编辑过程中可随时「清空表单」，重置当前角色卡的全部字段并从空白重新开始
- **导出**：单卡 / 批量导出酒馆 V2 兼容 JSON（`chara_card_v2` 规范，酒馆与本站均可回导；本站专有字段存于 `data.extensions.ai_theater`）
- 后端零改动（复用 `/api/chat/completions` 与 `/api/cards`）

## 核心功能

### 🎭 角色扮演

- **角色卡系统**：每个角色包含名称、Emoji、人设（persona）、底层输出规则（baseDirective）、剧情初始环境（initialScene）、用户设定（userProfile）、角色关系等字段
- **沉浸式演绎协议**：AI 回复需带 `【状态】`、`【场景】` 标记行，动作用 `*星号*` 包裹、台词用 `"引号"` 标注，前端自动解析并视觉化呈现
- **剧情状态栏**：实时展示 AI 当前角色状态、所处场景
- **剧情记忆**：对话超过 16 轮后自动调用 AI 生成剧情摘要（保留最近 3 段），注入后续系统提示，保证长对话连贯

### 📖 世界书（Lorebook）

对齐酒馆（SillyTavern）World Info 的轻量实现，按角色独立维护：

- **条目模型**：`keys`（触发关键词，逗号分隔）+ `content`（设定内容）+ `常驻`（constant，不依赖关键词每轮注入）+ 启用/停用 + `order`（注入顺序）
- **触发规则**：最近 8 条消息命中任一关键词（不区分大小写）或条目为常驻时注入；命中条目按 `order` 升序拼接为系统提示中的【世界书设定】块
- **导入/导出**：兼容酒馆 World Info JSON（`entries` 数组或 `uid→对象` 形态、`originalData` 包裹均可解析），导出即酒馆原生格式，可 round-trip
- **写时复制**：内置角色首次添加世界书条目时自动复制为「我的角色」，不污染服务端模板

### 🔌 模型接入

- **内置模式（默认）**：平台密钥存于 Pages 环境变量，无需用户配置即可使用，按模型名前缀自动分流：
  - `@makers/*` → EdgeOne Makers 网关（`MAKERS_MODELS_KEY`，OpenAI 兼容协议 `/api/chat/completions`）
  - `@cf/*` → Cloudflare Workers AI（`CF_ACCOUNT_ID` + `CF_API_TOKEN`，原生协议 `/api/cf/run`）
  - `@groq/*` → Groq（`GROQ_API_KEY`，OpenAI 兼容协议 `/api/groq/chat/completions`）
- **自定义模式（BYOK）**：支持任意 OpenAI 兼容 API 地址，密钥存于浏览器 localStorage
- **模型名归一化**：不带 `/` 的模型名自动补 `@makers/` 前缀；带 `/` 的按 `provider/model` 原样透传
- **内置免费模型**：DeepSeek、MiniMax、Kimi、Hy3 等（无 `/models` 接口时由前端 `BUILTIN_MODELS` 维护清单）
- **设置页分组**：内置模式下模型下拉按 `EdgeOne Makers 内置` / `Cloudflare Workers AI` / `我的模型` 三组展示，任选即切换后端

### ☁️ Cloudflare Workers AI 后端（`/api/cf/*`）

Workers AI 的 `/ai/run` 是单模型端点，协议与 OpenAI 不同，**本站保持其原生格式原样转发**，由前端单独适配：

| 项目 | 说明 |
|---|---|
| 上游 | `https://api.cloudflare.com/client/v4/accounts/<account>/ai/run/<model>` |
| 请求体 | 原生字段直接透传（`messages` / `prompt` / `stream` / `max_tokens` / `temperature` …）；`model` 走 URL，不重复放 body |
| 非流式响应 | `{ success, result: { response, choices:[{ message:{ content } }] } }`——实测两个字段内容一致，前端两者都兜底 |
| 流式响应 | SSE，每片 `data: {"response":"…", choices:[{ delta:{ content:"…" } }]}`，两者同为该片增量，结束为 `data: [DONE]` |
| 凭据 | 服务端 `CF_ACCOUNT_ID` + `CF_API_TOKEN`；也支持请求体自带 `account`/`token`（BYOK，优先使用） |
| 已知差异 | 无 `thinking`/`reasoning_effort`/`top_p`，思考模式对 `@cf/` 模型自动不生效；输出长度受模型上限约束（默认取 2048） |

**凭据已内嵌**：账户 ID 与 API Token 作为兜底常量写在 `functions/_lib/env.js`，不配环境变量即可直接用；配了 `CF_ACCOUNT_ID` / `CF_API_TOKEN` 则优先用环境变量。

> ⚠ 内嵌等于把明文 Token 写进仓库。**仓库一旦公开，任何人都可拿它刷你的 Workers AI 额度**。请务必把该 Token 的权限收紧到「Workers AI 运行」，并定期轮换；公开仓库请改为只配环境变量并删除这两个常量。

**内置模型（已在 Workers Free 套餐实测通过）**：

| 模型 | 定位 |
|---|---|
| `@cf/openai/gpt-oss-120b` | 120B 推理最强，默认模型 |
| `@cf/meta/llama-4-scout-17b-16e-instruct` | Llama 4 Scout（MoE 17B 激活），长上下文表现好 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 70B 通用，稳定兜底 |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | 24B，多语言与文风表现好 |

前三者均为纯 instruct/常规输出模型，不会像 R1 / Qwen3 那样吐 `<think>` 思考块污染角色演绎输出；gpt-oss 的 Responses 风格输出（`result.output[].content[].text`）与 `response.output_text.delta` 流式事件已由前端解析层兼容，非流式文本还会自动剥离 `<think>` 块。

> 实测记录：`@cf/moonshotai/kimi-k2.7-code` 与 `@cf/google/gemma-3-12b-it` 在该 Free 账号下均返回 403（前者「不在免费套餐」，后者「账号无权访问」），故未纳入。
> 同账号下也可用但未选：`@cf/qwen/qwen2.5-coder-32b-instruct`、`@cf/qwen/qwen3-30b-a3b-fp8`、`@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`、`@cf/openai/gpt-oss-20b`、`@cf/meta/llama-3.1-8b-instruct`（qwen3 / r1 系会输出思考块，不适合直接演绎）。

模型清单可随时用环境变量 `CF_MODELS` 覆盖（逗号分隔），或改 `functions/_lib/model-name.js` 与前端的同名清单（两处需同步）。

```bash
# 非流式（部署后，注意：/api/* 不输出 CORS 头，仅同源页面可用）
curl https://你的域名/api/cf/run \
  -H "Content-Type: application/json" \
  -d '{"model":"@cf/moonshotai/kimi-k2.7-code","messages":[{"role":"user","content":"你好"}]}'

# 流式
curl -N https://你的域名/api/cf/run \
  -H "Content-Type: application/json" \
  -d '{"model":"@cf/moonshotai/kimi-k2.7-code","messages":[{"role":"user","content":"你好"}],"stream":true}'
```

模型清单由环境变量 `CF_MODELS` 维护（逗号分隔），未配置时回落到 `functions/_lib/model-name.js` 的 `CF_MODELS`。

### 🧩 角色卡工坊独立模型（`@groq/*`）

角色卡工坊的「AI 补全 / 一句话生成」走**独立模型配置**，不占用剧情演绎的主模型渠道（Cloudflare 渠道优化：主模型专注演绎，结构化生成走更快的 Groq）：

- **Groq 模型已锁定为 `@groq/qwen/qwen3.8-27b`，且 Groq 渠道仅用于角色卡工坊**（剧情演绎的主模型不开放 Groq）。模型沿革：`qwen/qwen3-32b` 已于 2026-07-17 退役；当前 Qwen 27B 为预览版 `qwen3.8-27b`（另有 `qwen/qwen3.6-27b`），预览版可能下线，失效时改 `index.html` 的 `SHOP_GROQ_MODEL` 常量即可；旧存档保存的 `@groq/*` 会自动收敛到该锁定模型
- 工坊页顶部「工坊模型」栏：锁定模型（默认）/「跟随主模型」/点 ✎ 手填任意模型 ID（`@groq/` 统一收敛到锁定模型，`@cf/` 走 Workers AI，其余走当前 API）
- 凭据：服务端环境变量 `GROQ_API_KEY` 优先；未配置时用户可在工坊模型栏自带 Groq API Key（BYOK，仅存本机 localStorage，随请求体携带、服务端剥离、不落日志）
- 上游锁定 `api.groq.com`，模型名先经白名单校验再放进请求体；`/api/groq/*` 不输出 CORS 头，仅同源可用

### 🔀 开放模型代理（/v1）

EdgeOne 的模型接口只能由 EdgeOne 自己的服务调用，第三方 OpenAI 兼容客户端无法直接使用。因此本站在聊天功能之外，同时充当**模型网关的唯一出口**：

- **上游密钥锁定**：真正调用 EdgeOne 网关的密钥只存在服务端环境变量 `MAKERS_MODELS_KEY` 中，任何情况下都不会出现在请求、响应或日志里
- **双层密钥**：第三方调用 `/v1/*` 时携带的 `Authorization: Bearer <token>` 是**本站自己签发的访问令牌**（`PROXY_ACCESS_KEYS`），只用于准入校验，边缘函数校验通过后替换成平台密钥再转发——调用方永远拿不到真实模型密钥
- **访问控制**：可签发多个令牌（逗号 / 分号 / 换行分隔），便于按调用方分发与单独吊销

| 路由 | 方法 | 说明 |
|---|---|---|
| `/v1/chat/completions` | POST | 对话补全，`stream: true` 时 SSE 原样透传 |
| `/v1/models` | GET | 模型列表；上游无 `/models` 时回落已知清单 |
| `/v1/status` | GET | 部署自查探针，免鉴权，仅返回 `{ proxy, gateway }` 两个布尔值 |

**fail-closed**：未配置 `PROXY_ACCESS_KEYS` 时 `/v1/*` 整体返回 `503`，不会退化成无鉴权的公开中继。

```bash
# 部署后自查
curl https://你的域名/v1/status
# {"proxy":true,"gateway":true}

# 对话补全（裸模型名会自动补 @makers/ 前缀）
curl https://你的域名/v1/chat/completions \
  -H "Authorization: Bearer <访问令牌>" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"你好"}]}'
```

任何 OpenAI SDK 直接把 `base_url` 指向本站即可：

```python
from openai import OpenAI
client = OpenAI(base_url="https://你的域名/v1", api_key="<访问令牌>")
```

**跨域**：默认对任意 Origin 返回 CORS 头（浏览器内的第三方页面可用）。若只想放行已知站点，配置 `PROXY_ALLOWED_ORIGINS`（留空即 `*`）；纯服务端调用不受此项影响。

### 📝 角色卡管理

- 创建/编辑/删除自定义角色
- 服务端 KV 下发内置角色（当前代码兜底卡为空，前端内置「初音未来」及遗憾主题双卡「他」「她」），运营侧可通过 CARDS_KV 随时增删
- 遗憾主题双卡：同一段没走完的故事的两个视角，两张卡各自独立存档、独立剧情记忆，互不影响
- 支持导入 SillyTavern PNG/JSON 角色卡（V2/V3 自动映射字段；`system_prompt` 映射为底层输出设定，`extensions.ai_theater` 还原本站专有字段）或 TXT/Markdown 文件
- 工坊导出为酒馆 V2 兼容 JSON，可直接导入酒馆或回导本站（round-trip 不丢字段）

### 💬 对话体验

- SSE 流式逐字渲染，带思考动画
- **随时停止生成**：生成中发送键变为停止键（■），中断后可保留已生成的部分内容；页面卸载自动中断，避免悬挂连接
- **流式看门狗**：首字节与分片间隔超时（60s）自动中断并提示，防止上游挂起把界面永久锁死
- **✨ 生成开场白**：空对话时一键让 AI 基于人设写出符合演绎协议的角色开场
- 支持撤回上一轮、重新生成、复制消息
- 支持上传文本附件（≤256KB）
- 反重复机制：自动检测内容相似度，超出阈值时强制换角度重新生成
- 思考参数容错：模型不支持 `thinking`/`reasoning_effort` 返回 400 时，自动降级为普通采样并记住该模型，后续不再重试思考模式
- 高级演绎参数：思考模式（off/high/max）、temperature、top_p 均可调
- 无角色时的空状态引导：可直接创建角色、打开工坊或从内置角色库加入

## 部署到 EdgeOne Pages

### 前置准备

1. 在 EdgeOne Pages 控制台创建项目（framework 选择「纯静态」）
2. 上传/关联仓库代码
3. **设置环境变量**：
   ```
   MAKERS_MODELS_KEY=sk-xxxx             # Makers Models 网关密钥（上游，调用方不可见）
   CF_ACCOUNT_ID=34a4ee...               # 可选：Cloudflare 账户 ID，覆盖代码内嵌值
   CF_API_TOKEN=cfut_xxxx                # 可选：Cloudflare API Token，覆盖代码内嵌值（公开仓库务必改用它）
   CF_MODELS=                            # 可选，逗号分隔的 Workers AI 模型清单，留空用内置清单
   GROQ_API_KEY=gsk_xxxx                 # 可选：Groq 密钥，角色卡工坊独立模型使用；不配则由用户在工坊页自带 BYOK
   PROXY_ACCESS_KEYS=your-service-key     # 本站自签发的对外访问令牌，多个用逗号分隔；不配则 /v1/* 关闭
   PROXY_ALLOWED_ORIGINS=                 # 可选，跨域来源白名单；留空表示允许任意 Origin
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
| `MAKERS_MODELS_KEY` | 平台侧 Makers Models 密钥，供 `@makers/*` 模型使用 | 使用内置 Makers 模型时必填 |
| `CF_ACCOUNT_ID` | Cloudflare 账户 ID（32 位十六进制），覆盖代码内嵌值 | 可选（已内嵌） |
| `CF_API_TOKEN` | Cloudflare API Token，覆盖代码内嵌值 | 可选（已内嵌，公开仓库建议配置并删除内嵌常量） |
| `CF_MODELS` | Workers AI 模型清单，逗号分隔，覆盖代码内置清单 | 可选 |
| `GROQ_API_KEY` | Groq 密钥，供 `@groq/*`（角色卡工坊独立模型）使用；未配置时前端可 BYOK | 可选（不配则工坊需用户自带 Key 或跟随主模型） |
| `PROXY_ACCESS_KEYS` | 对外代理 `/v1/*` 的访问令牌白名单，逗号/分号/换行分隔（单数别名 `PROXY_ACCESS_KEY` 同样识别） | 开放 `/v1/*` 时必填，未配置则该路由整体 503 |
| `PROXY_ALLOWED_ORIGINS` | 限制可跨域调用 `/v1/*` 的浏览器来源 | 可选，留空表示 `*` |
| `CARDS_KV` | 绑定 KV 命名空间，覆盖内置角色卡 | 可选，未配置时使用代码内兜底卡 |

## 安全设计

- **`/api/*` 不输出 CORS 头**：仅允许同源页面调用，防止其他网站跨站盗刷平台密钥
- **对外代理密钥分离**：`/v1/*` 的调用方令牌只在本边缘函数内校验，校验通过后替换为服务端 `MAKERS_MODELS_KEY` 再转发，真实密钥不出现在请求、响应或调用方手里
- **默认关闭**：未配置 `PROXY_ACCESS_KEYS` 时 `/v1/*` 整体返回 503，不会意外变成公开中继
- **密钥分级保护**：自定义密钥只存于浏览器 localStorage；平台密钥存于服务端环境变量，前端全程接触不到
- **Workers AI 上游固定**：`/api/cf/run` 的宿主恒为 `api.cloudflare.com`，且账户 ID（32 位十六进制）与模型名（`@vendor/model`）先经白名单校验再拼进 URL，杜绝路径穿越与 SSRF
- **平台密钥不外流**：`/api/models` 仅在请求默认网关时使用服务端 `MAKERS_MODELS_KEY`；调用方指定自定义 `base` 时必须自带密钥，平台密钥绝不发往第三方地址（防 SSRF / 密钥盗取）
- **模型列表请求不落 URL**：密钥通过请求体传递，不进入访问日志
- **响应禁缓存**：所有 API 均设置 `cache-control: no-store`

## 开发调试

无需任何构建工具。本地直接打开 `index.html` 即可调试 UI（API 调用会 404，需部署后联调）。部署后可在 EdgeOne 控制台查看边缘函数日志。

要改代码（包括让 AI 帮你改）请先读 [AGENTS.md](./AGENTS.md)：那里只写「从代码里读不出来、但必须知道」的硬约定——`_lib` 引用层级、模型清单双处同步、安全红线。功能细节则以本文件为准。

## 开源协议

本项目基于 [MIT License](./LICENSE) 开源。

你可以自由地使用、复制、修改、合并、发布、分发、再许可和/或销售本软件，唯一的要求是保留原始版权声明与本许可声明。软件按「原样」提供，不附带任何形式的担保。

> 注意：仓库内置/示例角色卡、角色名称与相关设定仅用于功能演示，版权归各自权利人所有，不随本项目的 MIT 协议一并授权。你导入或分发的第三方角色卡（如 SillyTavern 角色卡）请自行确认其授权情况。

---

**注意**：本应用面向 EdgeOne Pages 平台，边缘函数使用 Workers 风格的 `onRequest` 导出函数。
