// EdgeOne Pages 边缘函数：对外开放的模型列表（OpenAI 兼容）
// GET /v1/models -> { object: 'list', data: [{ id, object: 'model', owned_by }] }
//
// 供第三方 OpenAI 兼容客户端枚举可用模型。准入规则与 /v1/chat/completions 完全一致：
// 调用方令牌只校验 PROXY_ACCESS_KEYS，上游一律使用服务端 MAKERS_MODELS_KEY。
// EdgeOne 网关若不提供 /models，则回落到代码内的已知清单，保证客户端不会拿到空列表。

const UPSTREAM_MODELS = 'https://ai-gateway.edgeone.link/v1/models';

const KNOWN_MODELS = [
  '@makers/deepseek-v4-flash',
  '@makers/deepseek-v4-pro',
  '@makers/hy3',
  '@makers/hy3-preview',
  '@makers/minimax-m2.7',
  '@makers/minimax-m3',
  '@makers/kimi-k2.6',
];

// 与 functions/api/* 一致：env 优先，裸全局兜底（Pages 可能把变量注入为全局常量）
function platformKey(env) {
  const fromContext = env && env.MAKERS_MODELS_KEY;
  if (fromContext) return String(fromContext).trim();
  if (typeof MAKERS_MODELS_KEY !== 'undefined' && MAKERS_MODELS_KEY) return String(MAKERS_MODELS_KEY).trim();
  return '';
}

function accessKeys(env) {
  const fromContext = env && (env.PROXY_ACCESS_KEYS || env.PROXY_ACCESS_KEY);
  let raw = fromContext ? String(fromContext) : '';
  if (!raw.trim() && typeof PROXY_ACCESS_KEYS !== 'undefined' && PROXY_ACCESS_KEYS) raw = String(PROXY_ACCESS_KEYS);
  if (!raw.trim() && typeof PROXY_ACCESS_KEY !== 'undefined' && PROXY_ACCESS_KEY) raw = String(PROXY_ACCESS_KEY);
  return raw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
}

function allowedOrigins(env) {
  const fromContext = env && env.PROXY_ALLOWED_ORIGINS;
  let raw = fromContext ? String(fromContext) : '';
  if (!raw.trim() && typeof PROXY_ALLOWED_ORIGINS !== 'undefined' && PROXY_ALLOWED_ORIGINS) raw = String(PROXY_ALLOWED_ORIGINS);
  return raw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
}

function bearerToken(request) {
  const auth = request.headers.get('authorization') || '';
  return /^bearer\s+/i.test(auth) ? auth.replace(/^bearer\s+/i, '').trim() : '';
}

function corsHeaders(request, env) {
  const headers = {
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
  };
  const list = allowedOrigins(env);
  const origin = request.headers.get('origin');
  if (!list.length) {
    headers['access-control-allow-origin'] = '*';
  } else if (origin && (list.includes('*') || list.includes(origin))) {
    headers['access-control-allow-origin'] = origin;
    headers['vary'] = 'origin';
  }
  return headers;
}

function json(request, env, obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign(corsHeaders(request, env), {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    }),
  });
}

function toOpenAiList(ids) {
  return {
    object: 'list',
    data: ids.map(id => ({ id, object: 'model', owned_by: id.startsWith('@makers/') ? 'edgeone-makers' : 'upstream' })),
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  if (request.method !== 'GET') {
    return json(request, env, { error: { message: 'Method Not Allowed' } }, 405);
  }

  const keys = accessKeys(env);
  if (!keys.length) {
    return json(request, env, { error: { message: '该代理尚未开放：请在 EdgeOne Pages 环境变量中配置 PROXY_ACCESS_KEYS' } }, 503);
  }
  const token = bearerToken(request);
  if (!token) return json(request, env, { error: { message: '缺少凭证：请携带 Authorization: Bearer <访问令牌>' } }, 401);
  if (!keys.includes(token)) return json(request, env, { error: { message: '访问令牌无效' } }, 403);

  const upstreamKey = platformKey(env);
  if (!upstreamKey) {
    return json(request, env, { error: { message: '服务端未配置 MAKERS_MODELS_KEY 环境变量' } }, 503);
  }

  let upstream;
  try {
    upstream = await fetch(UPSTREAM_MODELS, {
      method: 'GET',
      headers: { 'authorization': 'Bearer ' + upstreamKey },
    });
  } catch {
    return json(request, env, toOpenAiList(KNOWN_MODELS));
  }

  if (!upstream.ok) {
    return json(request, env, toOpenAiList(KNOWN_MODELS));
  }

  let data;
  try { data = await upstream.json(); } catch { return json(request, env, toOpenAiList(KNOWN_MODELS)); }

  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const ids = [...new Set(
    list.map(m => (typeof m === 'string' ? m : m?.id || m?.name)).filter(id => typeof id === 'string' && id)
  )].sort();

  return json(request, env, toOpenAiList(ids.length ? ids : KNOWN_MODELS));
}

export default onRequest;
