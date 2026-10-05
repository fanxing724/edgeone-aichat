// EdgeOne Pages 边缘函数：网关状态查询
// GET /api/status -> { builtin: true|false }
// 报告平台是否已配置 MAKERS_MODELS_KEY（可使用内置模型），不泄露密钥本身。
// 前端据此显示密钥状态指示灯，并给出有针对性的提示。

import { platformKey } from '../_lib/env.js';

export function onRequest(context) {
  const { env } = context;
  return new Response(JSON.stringify({ builtin: !!platformKey(env) }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export default onRequest;
