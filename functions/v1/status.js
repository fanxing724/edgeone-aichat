// EdgeOne Pages 边缘函数：开放代理健康探针
// GET /v1/status -> { proxy: true|false, gateway: true|false }
//
// 不校验访问令牌，也不返回任何密钥内容，仅报告两个开关是否就绪，方便部署后自查：
// - proxy   PROXY_ACCESS_KEYS 是否已配置（否则 /v1/* 一律 503）
// - gateway MAKERS_MODELS_KEY 是否已配置（否则无法调用上游）

function platformKey(env) {
  const fromContext = env && env.MAKERS_MODELS_KEY;
  if (fromContext) return String(fromContext).trim();
  if (typeof MAKERS_MODELS_KEY !== 'undefined' && MAKERS_MODELS_KEY) return String(MAKERS_MODELS_KEY).trim();
  return '';
}

function hasAccessKeys(env) {
  const fromContext = env && (env.PROXY_ACCESS_KEYS || env.PROXY_ACCESS_KEY);
  if (fromContext && String(fromContext).trim()) return true;
  if (typeof PROXY_ACCESS_KEYS !== 'undefined' && String(PROXY_ACCESS_KEYS || '').trim()) return true;
  if (typeof PROXY_ACCESS_KEY !== 'undefined' && String(PROXY_ACCESS_KEY || '').trim()) return true;
  return false;
}

export function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type' } });
  }
  return new Response(JSON.stringify({ proxy: hasAccessKeys(env), gateway: !!platformKey(env) }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
  });
}

export default onRequest;
