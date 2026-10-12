// 位置约束：本目录必须位于 functions/ 下（functions/_lib/）。
// 路由引用按目录深度写相对路径：functions/api/x.js → ../_lib/x.js；
// functions/api/<sub>/x.js → ../../_lib/x.js。打包器不解析 workspace 根的 tsconfig paths，
// 也不跟随一级目录之外的软链，路径写错会在部署构建时报 Could not resolve。

// 边缘函数共享库：模型名归一化与兜底清单
// - applyModelPrefix：不带 "/" 的裸模型名自动补 @makers/ 前缀（如 deepseek-v4-flash → @makers/deepseek-v4-flash）；
//   带 "/" 的按 provider/model 原样透传（如 openai/gpt-5）。/api 与 /v1 两条聊天代理共用此实现。
// - KNOWN_MODELS：上游网关不提供 /models 接口时对外回落的已知清单（需与前端 BUILTIN_MODELS 保持同步）。

export function applyModelPrefix(payload) {
  if (!payload || typeof payload.model !== 'string' || !payload.model.trim() || payload.model.includes('/')) return payload;
  const bare = payload.model.trim().replace(/^@?makers-?/, '');
  payload.model = '@makers/' + (bare || payload.model.trim());
  return payload;
}

export function hasModel(payload) {
  return !!(payload && typeof payload.model === 'string' && payload.model.trim());
}

export const KNOWN_MODELS = [
  '@makers/deepseek-v4-flash',
  '@makers/deepseek-v4-pro',
  '@makers/hy3',
  '@makers/hy3-preview',
  '@makers/minimax-m2.7',
  '@makers/minimax-m3',
  '@makers/kimi-k2.6',
];

// 第二路内置后端：Cloudflare Workers AI（/api/cf/run，原生协议）
// Workers AI 不提供 OpenAI 风格的 /models 接口，清单在此维护（可用环境变量 CF_MODELS 覆盖）。
// 只留两个：均已用该账号（Workers Free 套餐）实测通过，且都是纯 instruct 模型，
// 不会像 R1/Qwen3 那样吐 <think> 思考块污染角色演绎输出。
// 若套餐变更导致不可用（403），改这里或配环境变量 CF_MODELS 换掉即可。
export const CF_MODELS = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
];

export const DEFAULT_CF_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

// @cf/ 与 @hf/ 走 Cloudflare Workers AI 分支（原生协议），其余走 Makers 网关（OpenAI 兼容协议）
export function isCfModel(id) {
  return typeof id === 'string' && /^@(cf|hf)\//i.test(id.trim());
}
