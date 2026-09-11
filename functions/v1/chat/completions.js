// EdgeOne Pages 边缘函数：对外开放的模型代理转发（OpenAI 兼容）
// POST /v1/chat/completions -> https://ai-gateway.edgeone.link/v1/chat/completions
//
// 与 /api/chat/completions 的分工：
// - /api/*  服务本站页面：不发 CORS 头，支持 BYOK（调用方密钥透传上游）
// - /v1/*   服务第三方 OpenAI 兼容客户端：发 CORS 头；上游密钥锁定为服务端 MAKERS_MODELS_KEY，
//           调用方的 Authorization 只用于准入校验，任何情况下都不会出现在上游请求里
//
// 环境变量：
// - MAKERS_MODELS_KEY      上游 EdgeOne 网关密钥（必填）
// - PROXY_ACCESS_KEYS      准入令牌白名单，逗号 / 换行 / 分号分隔（必填；未配置时 /v1 整体返回 503，
//                          避免在没想清楚访问控制的情况下变成公开盗刷中继）
// - PROXY_ALLOWED_ORIGINS  可选，浏览器跨域来源白名单；留空表示允许任意 Origin

const UPSTREAM = 'https://ai-gateway.edgeone.link/v1/chat/completions';

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
    'access-control-allow-methods': 'POST, OPTIONS',
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

function gate(request, env) {
  const keys = accessKeys(env);
  if (!keys.length) {
    return json(request, env, { error: { message: '该代理尚未开放：请在 EdgeOne Pages 环境变量中配置 PROXY_ACCESS_KEYS（调用方需携带其中的令牌）' } }, 503);
  }
  const token = bearerToken(request);
  if (!token) {
    return json(request, env, { error: { message: '缺少凭证：请携带 Authorization: Bearer <访问令牌>' } }, 401);
  }
  if (!keys.includes(token)) {
    return json(request, env, { error: { message: '访问令牌无效' } }, 403);
  }
  const upstreamKey = platformKey(env);
  if (!upstreamKey) {
    return json(request, env, { error: { message: '服务端未配置 MAKERS_MODELS_KEY 环境变量（EdgeOne Pages 项目设置 → 环境变量，添加后需重新部署）' } }, 503);
  }
  return { upstreamKey };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  if (request.method !== 'POST') {
    return json(request, env, { error: { message: 'Method Not Allowed' } }, 405);
  }

  const authed = gate(request, env);
  if (authed instanceof Response) return authed;

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return json(request, env, { error: { message: '仅接受 application/json 请求' } }, 415);
  }

  let payload;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return json(request, env, { error: { message: '请求体不是有效的 JSON' } }, 400);
  }
  if (!payload || typeof payload.model !== 'string' || !payload.model.trim()) {
    return json(request, env, { error: { message: '缺少 model 字段', type: 'invalid_request_error' } }, 400);
  }

  // 裸模型名补 @makers/ 前缀，带 "/" 的按 provider/model 原样透传
  if (!payload.model.includes('/')) {
    const bare = payload.model.trim().replace(/^@?makers-?/, '');
    payload.model = '@makers/' + (bare || payload.model.trim());
  }

  let upstream;
  try {
    upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + authed.upstreamKey,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return json(request, env, { error: { message: '无法连接 EdgeOne 模型网关：' + (e && e.message ? e.message : 'network error') } }, 502);
  }

  const headers = corsHeaders(request, env);
  headers['cache-control'] = 'no-store';
  const ct = upstream.headers.get('content-type');
  if (ct) headers['content-type'] = ct;

  // 响应体（含 SSE 流）原样透传
  return new Response(upstream.body, { status: upstream.status, headers });
}

export default onRequest;
