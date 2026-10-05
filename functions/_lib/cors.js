// 位置约束：本目录必须位于 functions/ 下（functions/_lib/）。
// 路由引用按目录深度写相对路径：functions/api/x.js → ../_lib/x.js；
// functions/api/<sub>/x.js → ../../_lib/x.js。打包器不解析 workspace 根的 tsconfig paths，
// 也不跟随一级目录之外的软链，路径写错会在部署构建时报 Could not resolve。

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
