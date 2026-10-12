// EdgeOne Pages 边缘函数：Cloudflare Workers AI 原生代理（第二路内置后端）
// POST /api/cf/run -> https://api.cloudflare.com/client/v4/accounts/<account>/ai/run/<model>
//
// 与 /api/chat/completions 的区别：
// - 协议：本路由保持 Cloudflare Workers AI 原生格式，不做 OpenAI 协议转换。
//   请求体原样转发（messages / prompt / stream / max_tokens …），响应体原样回传：
//   非流式 { success, result: { response } }；流式 SSE 每片 data: {"response":"…"}，结束为 data: [DONE]。
// - 凭据：优先取 Pages 环境变量 CF_ACCOUNT_ID / CF_API_TOKEN，未配置时回落到 _lib/env.js 内嵌的兜底常量，
//   永不暴露给前端；也支持请求体自带 account / token（BYOK），自带时优先级最高。
// - 安全：宿主固定为 api.cloudflare.com，账户 ID 与模型名均做白名单校验后再拼进 URL，
//   杜绝路径穿越与 SSRF；不输出 CORS 头，仅允许同源页面调用。

import { cfAccountId, cfApiToken } from '../../_lib/env.js';
import { jsonResponse } from '../../_lib/http.js';
import { DEFAULT_CF_MODEL } from '../../_lib/model-name.js';

const CF_HOST = 'https://api.cloudflare.com';
const ACCOUNT_ID_RE = /^[0-9a-f]{32}$/i;                       // Cloudflare 账户 ID
// 每段都必须以字母或数字开头，从而排除 "." / ".." 这类会被 URL 归一化的路径穿越段
const MODEL_RE = /^@[a-z0-9][a-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)+$/; // @vendor/model[/sub]

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
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return jsonResponse({ error: { message: '请求体必须是 JSON 对象' } }, 400);
  }

  // 凭据优先级：请求体自带（BYOK） > 平台环境变量
  const account = (typeof payload.account === 'string' && payload.account.trim()) || cfAccountId(env);
  const token = (typeof payload.token === 'string' && payload.token.trim()) || cfApiToken(env);
  const model = (typeof payload.model === 'string' && payload.model.trim()) || DEFAULT_CF_MODEL;

  if (!ACCOUNT_ID_RE.test(account)) {
    return jsonResponse({ error: { message: 'CF_ACCOUNT_ID 无效或未配置（应为 32 位十六进制账户 ID，在 EdgeOne Pages 项目设置 → 环境变量中添加后需重新部署）' } }, 500);
  }
  if (!token) {
    return jsonResponse({ error: { message: '服务端未配置 CF_API_TOKEN 环境变量；也可在请求体中自带 token（BYOK）' } }, 401);
  }
  if (!MODEL_RE.test(model)) {
    return jsonResponse({ error: { message: '模型名无效：Workers AI 需使用 @vendor/model 形式，例如 ' + DEFAULT_CF_MODEL } }, 400);
  }

  // 剥离本站专用字段，其余原样转发（模型名在 URL 中指定，不重复放进请求体）
  const body = { ...payload };
  delete body.account;
  delete body.token;
  delete body.model;

  const url = CF_HOST + '/client/v4/accounts/' + account + '/ai/run/' + encodeURI(model);

  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + token,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return jsonResponse({ error: { message: '无法连接 Cloudflare Workers AI：' + (e && e.message ? e.message : 'network error') } }, 502);
  }

  const headers = { 'cache-control': 'no-store' };
  const ct = upstream.headers.get('content-type');
  if (ct) headers['content-type'] = ct;
  headers['x-ai-model'] = model;

  // 响应体（含 SSE 流）直接透传给浏览器，保持原生格式
  return new Response(upstream.body, { status: upstream.status, headers });
}

export default onRequest;
