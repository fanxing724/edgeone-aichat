// EdgeOne Pages 边缘函数：对外开放的模型列表（OpenAI 兼容）
// GET /v1/models -> { object: 'list', data: [{ id, object: 'model', owned_by }] }
//
// 供第三方 OpenAI 兼容客户端枚举可用模型。准入规则与 /v1/chat/completions 完全一致
// （复用 _lib/gate.js）：调用方令牌只校验 PROXY_ACCESS_KEYS，上游一律使用服务端 MAKERS_MODELS_KEY。
// EdgeOne 网关若不提供 /models，则回落到 _lib/model-name.js 的已知清单，保证客户端不会拿到空列表。

import { corsHeaders, corsJson } from '../_lib/cors.js';
import { gate } from '../_lib/gate.js';
import { KNOWN_MODELS } from '../_lib/model-name.js';

const UPSTREAM_MODELS = 'https://ai-gateway.edgeone.link/v1/models';
const METHODS = 'GET, OPTIONS';

function toOpenAiList(ids) {
  return {
    object: 'list',
    data: ids.map(id => ({ id, object: 'model', owned_by: id.startsWith('@makers/') ? 'edgeone-makers' : 'upstream' })),
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env, METHODS) });
  }
  if (request.method !== 'GET') {
    return corsJson(request, env, { error: { message: 'Method Not Allowed' } }, 405, METHODS);
  }

  const authed = gate(request, env, METHODS);
  if (authed instanceof Response) return authed;

  let upstream;
  try {
    upstream = await fetch(UPSTREAM_MODELS, {
      method: 'GET',
      headers: { 'authorization': 'Bearer ' + authed.upstreamKey },
    });
  } catch {
    return corsJson(request, env, toOpenAiList(KNOWN_MODELS), 200, METHODS);
  }

  if (!upstream.ok) {
    return corsJson(request, env, toOpenAiList(KNOWN_MODELS), 200, METHODS);
  }

  let data;
  try { data = await upstream.json(); } catch { return corsJson(request, env, toOpenAiList(KNOWN_MODELS), 200, METHODS); }

  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const ids = [...new Set(
    list.map(m => (typeof m === 'string' ? m : m?.id || m?.name)).filter(id => typeof id === 'string' && id)
  )].sort();

  return corsJson(request, env, toOpenAiList(ids.length ? ids : KNOWN_MODELS), 200, METHODS);
}

export default onRequest;
