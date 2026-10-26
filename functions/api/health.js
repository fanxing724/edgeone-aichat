// EdgeOne Pages 边缘函数：健康检查
// GET|HEAD /api/health -> 200 { ok, status, time, services }
//
// 与 /api/status 的区别：/api/status 面向前端做密钥就绪提示；本路由面向 uptime 监控、
// 探活脚本与容器编排，只要函数本身活着就返回 200，不做鉴权、不读 KV、无副作用。
// services 里顺带报告三路内置后端的密钥就绪状态（布尔值，不泄露密钥本身），
// 便于巡检时一眼看出是「服务挂了」还是「只是某路密钥没配」。
// 不输出 CORS 头，与 /api/* 保持一致，仅同源或服务端探针可直接调用。

import { platformKey, cfReady, groqApiKey } from '../_lib/env.js';
import { jsonResponse } from '../_lib/http.js';

export function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return jsonResponse({ error: { message: 'Method Not Allowed' } }, 405);
  }

  const body = JSON.stringify({
    ok: true,
    status: 'healthy',
    time: new Date().toISOString(),
    services: {
      builtin: !!platformKey(env),      // MAKERS_MODELS_KEY（@makers/* 可用）
      cloudflare: cfReady(env),         // CF_ACCOUNT_ID + CF_API_TOKEN（@cf/* 可用）
      groq: !!groqApiKey(env),          // GROQ_API_KEY（@groq/* 可用，前端可 BYOK 兜底）
    },
  });

  // HEAD 探针只要状态码，不回响应体
  return new Response(request.method === 'HEAD' ? null : body, {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export default onRequest;
