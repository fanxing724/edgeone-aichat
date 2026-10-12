// EdgeOne Pages 边缘函数：Cloudflare Workers AI 模型清单
// GET|POST /api/cf/models -> { models: [{ id, owned_by }] }
//
// Workers AI 的 /ai/run 是单模型端点，没有 OpenAI 风格的 /models 接口，
// 因此清单由服务端维护：环境变量 CF_MODELS（逗号分隔）优先，未配置时回落到 _lib/model-name.js 内置清单。
// 不返回任何凭据；同样不输出 CORS 头，仅允许本站页面调用。

import { cfModelList } from '../../_lib/env.js';
import { jsonResponse } from '../../_lib/http.js';
import { CF_MODELS } from '../../_lib/model-name.js';

export function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse({ error: { message: 'Method Not Allowed' } }, 405);
  }

  const ids = cfModelList(env) || CF_MODELS;
  return jsonResponse({ models: ids.map(id => ({ id, owned_by: 'cloudflare-workers-ai' })) });
}

export default onRequest;
