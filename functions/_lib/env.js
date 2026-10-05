// 边缘函数共享库：环境变量统一读取（唯一定义，各路由不再各自克隆）
// 读取优先级：context.env → 以全局常量形式注入的变量（EdgeOne Pages 两种注入形态都兼容）。
// 涉及的配置：
// - MAKERS_MODELS_KEY     上游 EdgeOne 模型网关密钥（/api 内置模式与 /v1 代理共用）
// - PROXY_ACCESS_KEYS     /v1 对外访问令牌白名单（支持单数别名 PROXY_ACCESS_KEY）
// - PROXY_ALLOWED_ORIGINS /v1 浏览器跨域来源白名单（留空表示 *）

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

export function allowedOrigins(env) {
  const fromContext = env && env.PROXY_ALLOWED_ORIGINS;
  let raw = fromContext ? String(fromContext) : '';
  if (!raw.trim() && typeof PROXY_ALLOWED_ORIGINS !== 'undefined' && PROXY_ALLOWED_ORIGINS) raw = String(PROXY_ALLOWED_ORIGINS);
  return raw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
}
