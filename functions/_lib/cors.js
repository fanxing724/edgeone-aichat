// 边缘函数共享库：/v1 对外代理的 CORS 头
// 规则：PROXY_ALLOWED_ORIGINS 未配置 → *；已配置 → 命中白名单才回显 Origin（并带 Vary: origin）。
// 仅 /v1/* 使用；/api/* 面向同源页面，不输出任何 CORS 头（防跨站盗刷平台密钥）。

import { allowedOrigins } from './env.js';
import { jsonResponse } from './http.js';

export function corsHeaders(request, env, methods) {
  const headers = {
    'access-control-allow-methods': methods || 'GET, OPTIONS',
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

export function corsJson(request, env, obj, status, methods) {
  return jsonResponse(obj, status, corsHeaders(request, env, methods));
}
