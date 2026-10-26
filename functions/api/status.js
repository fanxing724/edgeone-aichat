// EdgeOne Pages 边缘函数：网关状态查询
// GET /api/status -> { builtin: true|false, cloudflare: true|false, groq: true|false }
// 报告三路内置后端是否就绪，不泄露密钥本身：
// - builtin     MAKERS_MODELS_KEY 是否已配置（@makers/* 模型可用）
// - cloudflare  CF_ACCOUNT_ID + CF_API_TOKEN 是否都已配置（@cf/* 模型可用）
// - groq        GROQ_API_KEY 是否已配置（@groq/* 模型可用；未配置时前端可自带 BYOK 密钥）
// 前端据此显示密钥状态指示灯，并给出有针对性的提示。

import { platformKey, cfReady, groqApiKey } from '../_lib/env.js';

export function onRequest(context) {
  const { env } = context;
  return new Response(JSON.stringify({ builtin: !!platformKey(env), cloudflare: cfReady(env), groq: !!groqApiKey(env) }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export default onRequest;
