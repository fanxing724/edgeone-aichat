# AI 剧场 · 仓库描述文件

给 AI 协作者与新人看的**落地版**说明书：讲清边界、约定和红线。功能细节看 `README.md`。

## 这是什么

沉浸式 AI 角色扮演 Web 应用，部署在 **EdgeOne Pages**。

- 前端：单文件 `index.html`（约 1700 行，UI / 逻辑 / 样式全内联），**无构建工具**，双击就能开
- 后端：`functions/` 下的边缘函数（Workers 风格 `onRequest` 导出），只做密钥持有与协议转发
- 无依赖管理：`package.json`、`node_modules` 都不存在，别引入

## 目录约定

```
index.html                    前端全部代码
functions/_lib/               共享库（env / http / cors / gate / model-name）
functions/api/                本站页面专用，同源调用，不输出 CORS 头
functions/api/chat/           Makers 网关代理（OpenAI 兼容，SSE 透传）
functions/api/cf/             Cloudflare Workers AI 原生协议转发
functions/api/groq/chat/      Groq 转发（仅角色卡工坊使用）
functions/v1/                 对外 OpenAI 兼容代理，带 CORS + 令牌校验
docs/                         README 位图资源（头图等），无代码
```

**`_lib` 的引用路径是最容易踩的坑**：`_` 前缀目录不注册路由，按目录深度写相对路径——

- `functions/api/x.js` → `../_lib/x.js`
- `functions/<a>/<b>/x.js` → `../../_lib/x.js`

打包器**不解析** `tsconfig` paths，**不跟随**一级目录外的软链。写错就是部署构建时 `Could not resolve`（已在历史提交里摔过两次）。

## 改动路由时必须同步的地方

| 改了什么 | 还要改哪里 |
|---|---|
| 新增 `@makers/*` 模型 | `_lib/model-name.js` 的 `KNOWN_MODELS` + `index.html` 的 `BUILTIN_MODELS`（两处必须一致） |
| 新增 `@cf/*` 模型 | `_lib/model-name.js` 的 `CF_MODELS` + `index.html` 的 `CF_MODELS` |
| 新增环境变量 | `_lib/env.js` 读取 + `README.md` 环境变量速查表 + 部署说明 |
| 改了工坊锁定模型 | `index.html` 的 `SHOP_GROQ_MODEL`（旧存档靠这个常量自动收敛） |
| 改了 `@groq/*` 模型清单 | 前端目前**不列清单**：`isGroqModel()` 按前缀判断，工坊下拉锁定 `SHOP_GROQ_MODEL`（Groq 已退役的模型会直接 404，改常量前先查官方模型页） |
| 改了字段结构 | 角色卡要保持酒馆 V2 round-trip，本站专有字段只能放 `data.extensions.ai_theater` |

## 模型分流（三条内置后端）

模型名前缀决定走哪条路，前端按前缀切换，后端不互相兜底：

- `@makers/*` → `/api/chat/completions` → EdgeOne Makers 网关（OpenAI 兼容，SSE 透传）
- `@cf/*` → `/api/cf/run` → Cloudflare Workers AI（**原生协议，不做 OpenAI 转换**）
- `@groq/*` → `/api/groq/chat/completions` → Groq（**仅工坊**，剧情演绎不开放）

裸模型名（不含 `/`）自动补 `@makers/` 前缀，两套代理共用 `applyModelPrefix`（只作用于 `/api/chat/completions` 与 `/v1/chat/completions`；`/api/cf/run` 与 `/api/groq/*` 收原始模型名，不补前缀）。

`@cf/*` 与 `@groq/*` 有已知差异：不支持 `thinking` / `reasoning_effort`，前端会自动降级。别在后端"贴心"地帮用户转换协议，那会让前端适配层变成两套逻辑。

## README 图片约定

头图和所有 README 配图**随仓库提交在 `docs/` 下，用相对路径引用**，不直连外部 Pages。

为什么不做外链：上游 `fanxing724/new-make` 的封面是 Actions 整点重渲染的产物，`projects/**` 不是稳定契约（项目清单增删都会改目录）。README 只拉取一次、存成仓库内快照，展示就与上游调度彻底解耦。

- 更新流程：从 `https://fanxing724.github.io/new-make/fanxing724/projects/edgeone-aichat/cover.svg`（浅色用 `cover.light.svg`）拉最新产物 → Chromium 按 2x 渲染成 PNG → 缩到 1600px 宽 → 覆盖 `docs/cover-dark.png` / `docs/cover-light.png`
- `docs/cover-dark.png` 对应深色主题，`docs/cover-light.png` 对应浅色主题，靠 `<picture>` + `prefers-color-scheme` 切换（GitHub / CNB 都原生支持）
- 文案出处是上游 `projects.config.json` 的 `owners.fanxing724.projects["edgeone-aichat"]`，改标题/标语要去那边改，本站只换图
- 实测记录：GitHub 的 Camo 代理对 SVG 是**原样透传**——`cover.svg` 返回 200 / `image/svg+xml` / 39616 字节，md5 与源文件一致，`<style>`、`url(#…)`、`data:` 内嵌图都没被改写。选 PNG 是为了快照稳定和体积可控，不是被 Camo 逼的；别再把「Camo 会净化 SVG」当事实引用
- 图挂了只影响头图，正文照常（`<picture>` 会退化成 alt 文案）

## 安全红线（改代码前先读）

1. **`/api/*` 绝不输出 CORS 头**。它是同源专用通道，加了头等于把平台密钥暴露给任意网站刷额度。
2. **平台密钥不出服务端**。`MAKERS_MODELS_KEY` 只在 `_lib/gate.js` 里被替换成上游鉴权，任何情况下不进请求、响应、日志。
3. **`/v1/*` fail-closed**。`PROXY_ACCESS_KEYS` 未配置时必须整体 503，不许退化成公开中继。
4. **用户指定的 `base` 必须自带密钥**。`/api/models` 只在默认网关下使用平台密钥，防止被诱导把真密钥发往第三方地址（SSRF / 密钥盗取）。
5. **上游 URL 拼装前先白名单校验**。`/api/cf/run` 的 account 必须是 32 位十六进制、模型名必须匹配 `@vendor/model`，杜绝路径穿越。
6. **不记录请求体**。密钥走请求体、不落 URL、不打日志。
7. **代码里不许出现任何密钥**。曾经的 CF 内嵌凭据已删除（历史遗留），现在 `CF_ACCOUNT_ID` / `CF_API_TOKEN` 只读环境变量，缺一个就让 `/api/cf/*` 保持未就绪。内嵌的代价是实打实的：GitHub 的 push protection 会拦下整条历史，密钥也只能靠轮换止血。

## 调试与验证

没有测试框架、没有 lint。改完这样验证：

```bash
# 1. 前端：直接打开 index.html 看 UI（API 会 404，属正常）
# 2. 边缘函数：部署后打健康探针（需部署环境，本地无替代品）
curl -i https://<域名>/api/health          # 恒 200，services 里看三路密钥就绪布尔值
curl -i https://<域名>/v1/status           # { proxy, gateway }，免鉴权
# 3. 语法自检：逐个函数文件过一遍解析器（直接 cat 进 node 只是执行，会因缺 onRequest 上下文报运行时错误，看不出语法问题）
for f in $(git ls-files 'functions/**/*.js'); do node --check "$f" || echo "FAIL $f"; done
```

临时校验脚本命名为 `.verify.mjs` / `.cardtest.mjs`（已在 `.gitignore` 里），别提交。

## 提交与协作

- 提交规范：`fix: …` / `feat: …`，中文描述为主，一次提交只说一件事
- Issue 里改了代码就开 PR，别重复建；PR 在源分支上继续改
- 改了行为就同步 `README.md`——这个仓库的 README 是**运维手册**，环境变量表、模型清单、安全设计都是靠它活的

### 镜像仓库（GitHub / Gitee）

主库在 CNB，另有两个镜像：`fanxing724/edgeone-aichat`（GitHub）、`knight3fax/ai-chat`（Gitee）。

- Gitee 与 CNB 历史一致，直接 `git push <gitee-url> main:main` 即可快进
- **GitHub 不能直接推**：它的 `main` 有本仓没有的提交（`78fd3ca` 开源协议、`d7e4786` README 头图），历史已分叉。按「同步提交」推，保住对端历史：

  ```bash
  git fetch https://github.com/fanxing724/edgeone-aichat.git 'main:refs/remotes/gh/main'
  tree=$(git rev-parse 'main^{tree}')
  sync=$(git commit-tree "$tree" -p refs/remotes/gh/main -m 'sync: 同步 CNB main')
  git push https://github.com/fanxing724/edgeone-aichat.git "${sync}:refs/heads/main"
  ```

- 提交历史里还躺着已删除的内嵌 CF 凭据，所以**别对 GitHub 做整历史推送**（push protection 会直接拒绝），同步提交只带一个干净快照，正好绕开

## 风格

- 注释解释**为什么**和**约束**，不复述代码。`_lib` 每个文件顶部的"位置约束"注释是有用的，别删。
- 前端保持单文件。想拆模块前先问：部署流程会不会因此变复杂？答案是"会"就别拆。
- 中文文案统一用中文标点；错误信息写清"下一步该做什么"（例：让用户去配哪个环境变量）。
- 前端模型分组按协议走（`@makers/` / `@cf/` / 其他），`@groq/` 只出现在工坊栏；新增后端时同步 `modelOptions()` 的分组条件，否则模型会掉进「我的模型」里。
