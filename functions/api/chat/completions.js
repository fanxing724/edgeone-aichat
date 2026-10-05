// EdgeOne Pages 边缘函数：Makers Models 统一网关代理
// POST /api/chat/completions -> https://ai-gateway.edgeone.link/v1/chat/completions
//
// 特性：
// - 内置模型开箱即用：平台密钥保存在 Pages 环境变量 MAKERS_MODELS_KEY 中，不暴露给前端
// - BYOK：请求自带 Authorization: Bearer <key> 时优先使用请求中的密钥
// - SSE 流式响应原样透传（ReadableStream 直传）
// - 安全：仅接受 application/json 请求、不输出 CORS 头，防止其他网站跨站盗刷平台密钥
// - 便捷：模型名归一化与密钥读取分别复用 _lib/model-name.js 与 _lib/env.js（唯一定义）

import { platformKey } from '../../_lib/env.js';
import { jsonResponse } from '../../_lib/http.js';
import { applyModelPrefix } from '../../_lib/model-name.js';

const UPSTREAM = 'https://ai-gateway.edgeone.link/v1/chat/completions';

export async function onRequest(context) {
  const { request, env } = context;

  // 不返回 CORS 头：仅允许同源页面调用，跨域预检会直接失败
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

  if (request.method !== 'POST') {
    return jsonResponse({ error: { message: 'Method Not Allowed' } }, 405);
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return jsonResponse({ error: { message: '仅接受 application/json 请求' } }, 415);
  }

  let payload;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return jsonResponse({ error: { message: '请求体不是有效的 JSON' } }, 400);
  }

  // 模型名便捷归一化：经代理调用时允许省略 @makers/ 前缀
  applyModelPrefix(payload);

  // 密钥优先级：请求自带（BYOK） > 平台环境变量
  const auth = request.headers.get('authorization') || '';
  const userKey = /^bearer\s+/i.test(auth) ? auth.replace(/^bearer\s+/i, '').trim() : '';
  const apiKey = userKey || platformKey(env);

  if (!apiKey) {
    return jsonResponse({ error: { message: '服务端未配置 MAKERS_MODELS_KEY 环境变量（EdgeOne Pages 项目设置 → 环境变量，添加后需重新部署）；或在页面设置中填写你自己的 API Key。' } }, 401);
  }

  let upstream;
  try {
    upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return jsonResponse({ error: { message: '无法连接 Makers Models 网关：' + (e && e.message ? e.message : 'network error') } }, 502);
  }

  const headers = { 'cache-control': 'no-store' };
  const ct = upstream.headers.get('content-type');
  if (ct) headers['content-type'] = ct;

  // 响应体（含 SSE 流）直接透传给浏览器
  return new Response(upstream.body, { status: upstream.status, headers });
}

export default onRequest;
