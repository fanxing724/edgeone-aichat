// 位置约束：本目录必须位于 functions/ 下（functions/_lib/）。
// 路由引用按目录深度写相对路径：functions/api/x.js → ../_lib/x.js；
// functions/api/<sub>/x.js → ../../_lib/x.js。打包器不解析 workspace 根的 tsconfig paths，
// 也不跟随一级目录之外的软链，路径写错会在部署构建时报 Could not resolve。

// 边缘函数共享库：环境变量统一读取（唯一定义，各路由不再各自克隆）
// 读取优先级：context.env → 以全局常量形式注入的变量（EdgeOne Pages 两种注入形态都兼容）。
// 涉及的配置：
// - MAKERS_MODELS_KEY     上游 EdgeOne 模型网关密钥（/api 内置模式与 /v1 代理共用）
// - PROXY_ACCESS_KEYS     /v1 对外访问令牌白名单（支持单数别名 PROXY_ACCESS_KEY）
// - PROXY_ALLOWED_ORIGINS /v1 浏览器跨域来源白名单（留空表示 *）
// - CF_ACCOUNT_ID         Cloudflare 账户 ID（32 位十六进制），Workers AI 内置后端
// - CF_API_TOKEN          Cloudflare API Token，Workers AI 内置后端
// - CF_MODELS             可选：逗号分隔的 Workers AI 模型清单，覆盖代码内置清单

export function platformKey(env) {
  const fromContext = env && env.MAKERS_MODELS_KEY;
  if (fromContext) return String(fromContext).trim();
  if (typeof MAKERS_MODELS_KEY !== 'undefined' && MAKERS_MODELS_KEY) return String(MAKERS_MODELS_KEY).trim();
  return '';
}

export function accessKeys(env) {
  const fromContext = env && (env.PROXY_ACCESS_KEYS || env.PROXY_ACCESS_KEY);
  let raw = fromContext ? String(fromContext) : '';
  if (!raw.trim() && typeof PROXY_ACCESS_KEYS !== 'undefined' && PROXY_ACCESS_KEYS) raw = String(PROXY_ACCESS_KEYS);
  if (!raw.trim() && typeof PROXY_ACCESS_KEY !== 'undefined' && PROXY_ACCESS_KEY) raw = String(PROXY_ACCESS_KEY);
  return raw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
}

export function hasAccessKeys(env) {
  return accessKeys(env).length > 0;
}

// Cloudflare Workers AI 内置后端：账户 ID 与 API Token 必须同时配置才算就绪
// 内嵌兜底凭据：未配置环境变量时直接使用，开箱即用（改密钥时优先配环境变量覆盖，无需改代码）
// ⚠ 这是明文 API Token，会随代码进仓库。仓库一旦公开即等于泄露，请务必：
//   1) 在 Cloudflare 控制台把该 Token 的可用范围收紧到「Account → Workers AI → 读/运行」；
//   2) 定期轮换（轮换后改这里或配 CF_API_TOKEN 环境变量）；
//   3) 若仓库公开，改为只配环境变量 CF_ACCOUNT_ID / CF_API_TOKEN，并删掉这两个常量。
const EMBEDDED_CF_ACCOUNT_ID = '34a4ee2f0e5cc51e92076cd2bc797cc0';
const EMBEDDED_CF_API_TOKEN = 'cfut_m43kga2JNhprNrHr3J24fgkOePzliXquZI3JMqCf8940289c';

export function cfAccountId(env) {
  const fromContext = env && env.CF_ACCOUNT_ID;
  if (fromContext) return String(fromContext).trim();
  if (typeof CF_ACCOUNT_ID !== 'undefined' && CF_ACCOUNT_ID) return String(CF_ACCOUNT_ID).trim();
  return EMBEDDED_CF_ACCOUNT_ID;
}

export function cfApiToken(env) {
  const fromContext = env && env.CF_API_TOKEN;
  if (fromContext) return String(fromContext).trim();
  if (typeof CF_API_TOKEN !== 'undefined' && CF_API_TOKEN) return String(CF_API_TOKEN).trim();
  return EMBEDDED_CF_API_TOKEN;
}

export function cfReady(env) {
  return !!(cfAccountId(env) && cfApiToken(env));
}

// Workers AI 没有 OpenAI 风格的 /models 接口，清单由环境变量或代码内置维护
export function cfModelList(env) {
  const fromContext = env && env.CF_MODELS;
  let raw = fromContext ? String(fromContext) : '';
  if (!raw.trim() && typeof CF_MODELS !== 'undefined' && CF_MODELS) raw = String(CF_MODELS);
  const ids = raw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  return ids.length ? ids : null;
}

export function allowedOrigins(env) {
  const fromContext = env && env.PROXY_ALLOWED_ORIGINS;
  let raw = fromContext ? String(fromContext) : '';
  if (!raw.trim() && typeof PROXY_ALLOWED_ORIGINS !== 'undefined' && PROXY_ALLOWED_ORIGINS) raw = String(PROXY_ALLOWED_ORIGINS);
  return raw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
}
