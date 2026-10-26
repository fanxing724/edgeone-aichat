// EdgeOne Pages 边缘函数：Groq 内置代理（第三路内置后端，OpenAI 兼容协议）
// POST /api/groq/chat/completions -> https://api.groq.com/openai/v1/chat/completions
//
// 与主聊天代理（/api/chat/completions）的区别：
// - 上游固定为 Groq（api.groq.com）。主要服务于角色卡工坊的独立模型配置：生成角色卡是
//   结构化 JSON 任务，Groq 响应快、免费额度充足，不必占用剧情演绎的主模型渠道。
// - 模型名支持 @groq/ 前缀（前端统一用 @groq/<model> 标识渠道），转发前剥掉前缀；
//   也可直接传 Groq 官方模型 ID（如 llama-3.3-70b-versatile、openai/gpt-oss-120b）。
// - 凭据：优先取环境变量 GROQ_API_KEY；也支持请求体自带 token / key（BYOK），自带时优先级最高。
//   两者都没有时返回 401 与明确提示。
// - 安全：宿主固定为 api.groq.com，模型名做白名单校验后再放进请求体；不输出 CORS 头，
//   仅允许同源页面调用；密钥只进 Authorization 头，绝不回传前端。

import { groqApiKey } from '../../_lib/env.js';
import { jsonResponse } from '../../_lib/http.js';

const GROQ_HOST = 'https://api.groq.com';
// Groq 模型 ID：每段以字母或数字开头，段内可含 . _ -，允许 / 分段（如 openai/gpt-oss-120b）
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

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

  // 兼容 @groq/ 前缀（前端用它标识渠道），转发给 Groq 时剥掉
  let model = typeof payload.model === 'string' ? payload.model.trim() : '';
  model = model.replace(/^@?groq\//i, '');
  if (!model || !MODEL_RE.test(model)) {
    return jsonResponse({ error: { message: '模型名无效：Groq 需使用官方模型 ID，例如 llama-3.3-70b-versatile' } }, 400);
  }

  // 凭据优先级：请求体自带（BYOK） > 平台环境变量
  const byok = (typeof payload.token === 'string' && payload.token.trim()) || (typeof payload.key === 'string' && payload.key.trim());
  const token = byok || groqApiKey(env);
  if (!token) {
    return jsonResponse({ error: { message: '服务端未配置 GROQ_API_KEY 环境变量；也可在工坊模型栏自带 Groq API Key（BYOK），或把工坊模型改为「跟随主模型」' } }, 401);
  }

  // 剥离本站专用字段，其余原样转发（模型名统一为剥完前缀的官方 ID）
  const body = { ...payload, model };
  delete body.token;
  delete body.key;

  let upstream;
  try {
    upstream = await fetch(GROQ_HOST + '/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + token,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return jsonResponse({ error: { message: '无法连接 Groq：' + (e && e.message ? e.message : 'network error') } }, 502);
  }

  const headers = { 'cache-control': 'no-store' };
  const ct = upstream.headers.get('content-type');
  if (ct) headers['content-type'] = ct;
  headers['x-ai-model'] = '@groq/' + model;

  // 响应体原样回传，保持 OpenAI 兼容格式
  return new Response(upstream.body, { status: upstream.status, headers });
}

export default onRequest;
