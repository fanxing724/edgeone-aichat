// 边缘函数共享库：/v1 对外代理准入校验（fail-closed）
// 校验顺序：令牌白名单未配置 → 503（路由整体关闭）；缺少令牌 → 401；令牌无效 → 403；上游密钥缺失 → 503。
// 通过则返回 { upstreamKey }：调用方用它替换调用方令牌后再转发上游，真实密钥永不出现在请求、响应或调用方手里。

import { accessKeys, platformKey } from './env.js';
import { bearerToken } from './http.js';
import { corsJson } from './cors.js';

export function gate(request, env, methods) {
  const m = methods || 'POST, OPTIONS';
  const keys = accessKeys(env);
  if (!keys.length) {
    return corsJson(request, env, { error: { message: '该代理尚未开放：请在 EdgeOne Pages 环境变量中配置 PROXY_ACCESS_KEYS（调用方需携带其中的令牌）' } }, 503, m);
  }
  const token = bearerToken(request);
  if (!token) {
    return corsJson(request, env, { error: { message: '缺少凭证：请携带 Authorization: Bearer <访问令牌>' } }, 401, m);
  }
  if (!keys.includes(token)) {
    return corsJson(request, env, { error: { message: '访问令牌无效' } }, 403, m);
  }
  const upstreamKey = platformKey(env);
  if (!upstreamKey) {
    return corsJson(request, env, { error: { message: '服务端未配置 MAKERS_MODELS_KEY 环境变量（EdgeOne Pages 项目设置 → 环境变量，添加后需重新部署）' } }, 503, m);
  }
  return { upstreamKey };
}
