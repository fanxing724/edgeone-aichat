// 边缘函数共享库：HTTP 基础封装
// jsonResponse 统一 JSON 响应（一律 no-store）；bearerToken 解析 Authorization 头。
// /api/*（同源，无 CORS 头）与 /v1/*（跨域，CORS 头由 _lib/cors.js 追加）共用。

export function bearerToken(request) {
  const auth = request.headers.get('authorization') || '';
  return /^bearer\s+/i.test(auth) ? auth.replace(/^bearer\s+/i, '').trim() : '';
}

export function jsonResponse(obj, status, extraHeaders) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign(
      { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      extraHeaders || {}
    ),
  });
}
