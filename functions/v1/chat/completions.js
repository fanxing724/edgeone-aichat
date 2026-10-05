// EdgeOne Pages 边缘函数：对外开放的模型代理转发（OpenAI 兼容）
// POST /v1/chat/completions -> https://ai-gateway.edgeone.link/v1/chat/completions
//
// 与 /api/chat/completions 的分工：
// - /api/*  服务本站页面：不发 CORS 头，支持 BYOK（调用方密钥透传上游）
// - /v1/*   服务第三方 OpenAI 兼容客户端：发 CORS 头；上游密钥锁定为服务端 MAKERS_MODELS_KEY，
//           调用方的 Authorization 只用于准入校验，任何情况下都不会出现在上游请求里
//
// CORS 头、准入校验（fail-closed）与模型名归一化分别复用 _lib/cors.js、_lib/gate.js、_lib/model-name.js。

import { corsHeaders, corsJson } from '../../_lib/cors.js';
import { gate } from '../../_lib/gate.js';
import { applyModelPrefix, hasModel } from '../../_lib/model-name.js';

const UPSTREAM = 'https://ai-gateway.edgeone.link/v1/chat/completions';
const METHODS = 'POST, OPTIONS';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env, METHODS) });
  }
  if (request.method !== 'POST') {
    return corsJson(request, env, { error: { message: 'Method Not Allowed' } }, 405, METHODS);
  }

  const authed = gate(request, env, METHODS);
  if (authed instanceof Response) return authed;

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return corsJson(request, env, { error: { message: '仅接受 application/json 请求' } }, 415, METHODS);
  }

  let payload;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return corsJson(request, env, { error: { message: '请求体不是有效的 JSON' } }, 400, METHODS);
  }
  if (!hasModel(payload)) {
    return corsJson(request, env, { error: { message: '缺少 model 字段', type: 'invalid_request_error' } }, 400, METHODS);
  }

  // 裸模型名补 @makers/ 前缀，带 "/" 的按 provider/model 原样透传
  applyModelPrefix(payload);

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
    return corsJson(request, env, { error: { message: '无法连接 EdgeOne 模型网关：' + (e && e.message ? e.message : 'network error') } }, 502, METHODS);
  }

  const headers = corsHeaders(request, env, METHODS);
  headers['cache-control'] = 'no-store';
  const ct = upstream.headers.get('content-type');
  if (ct) headers['content-type'] = ct;

  // 响应体（含 SSE 流）原样透传
  return new Response(upstream.body, { status: upstream.status, headers });
}

export default onRequest;
