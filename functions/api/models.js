// EdgeOne Pages 边缘函数：模型列表代理
// POST /api/models  body: { base?: string, key?: string }
//   -> { models: [{ id, owned_by?, ... }] }
//
// 用途：前端「一键获取模型列表」。密钥可放在请求体（不落 URL、不进访问日志），
// 未携带时使用平台环境变量 MAKERS_MODELS_KEY。
// 注意：部分网关（含 Makers Models）不提供 /models 接口，会返回 404，
// 此时前端应引导用户手动填写模型名，内置模型清单由前端 BUILTIN_MODELS 维护。
// 同样不返回 CORS 头，仅允许本站页面调用，避免平台密钥被第三方站点盗刷。

import { platformKey } from '../../_lib/env.js';
import { jsonResponse } from '../../_lib/http.js';

const DEFAULT_BASE = 'https://ai-gateway.edgeone.link/v1';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'POST') return jsonResponse({ error: { message: 'Method Not Allowed' } }, 405);

  let body = {};
  try {
    body = JSON.parse(await request.text());
  } catch {
    return jsonResponse({ error: { message: '请求体不是有效的 JSON' } }, 400);
  }

  // base 支持相对路径 /api（回落到默认网关）与完整绝对地址
  let base = typeof body.base === 'string' ? body.base.trim().replace(/\/+$/, '') : '';
  if (!base || base === '/api') base = DEFAULT_BASE;

  const auth = request.headers.get('authorization') || '';
  const headerKey = /^bearer\s+/i.test(auth) ? auth.replace(/^bearer\s+/i, '').trim() : '';
  const userKey = (typeof body.key === 'string' && body.key.trim()) || headerKey;

  // 安全：平台密钥只允许发往默认网关，绝不发往用户指定的任意 base（防止 SSRF / 平台密钥泄露）。
  // 自定义 base 必须由调用方自带密钥，否则一律拒绝。
  const isDefaultBase = base === DEFAULT_BASE;
  const apiKey = userKey || (isDefaultBase ? platformKey(env) : '');

  if (!apiKey) {
    return jsonResponse({ error: { message: isDefaultBase
      ? '未配置 API Key，无法获取模型列表'
      : '使用自定义 API 地址时，请在设置中填写你自己的 API Key（平台密钥不会发往第三方地址）' } }, 401);
  }

  let upstream;
  try {
    upstream = await fetch(base + '/models', {
      method: 'GET',
      headers: { 'authorization': 'Bearer ' + apiKey },
    });
  } catch (e) {
    return jsonResponse({ error: { message: '无法连接上游服务：' + (e && e.message ? e.message : 'network error') } }, 502);
  }

  if (!upstream.ok) {
    let detail = '';
    try { detail = (await upstream.json()).error?.message || ''; } catch {}
    if (upstream.status === 404) {
      return jsonResponse({ error: { message: '该服务不提供模型列表接口（/models），请点击 ✎ 手动填写模型名' } }, 404);
    }
    return jsonResponse({ error: { message: upstream.status + ' ' + detail } }, upstream.status === 401 ? 401 : 502);
  }

  let data;
  try { data = await upstream.json(); } catch { return jsonResponse({ error: { message: '上游返回内容无法解析' } }, 502); }

  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const models = list
    .map(m => (typeof m === 'string' ? { id: m } : { id: m?.id || m?.name, owned_by: m?.owned_by }))
    .filter(m => m && typeof m.id === 'string' && m.id);

  return jsonResponse({ models });
}

export default onRequest;
