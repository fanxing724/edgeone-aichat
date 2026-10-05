// 位置约束：本目录必须位于 functions/ 下（functions/_lib/）。
// 路由引用按目录深度写相对路径：functions/api/x.js → ../_lib/x.js；
// functions/api/<sub>/x.js → ../../_lib/x.js。打包器不解析 workspace 根的 tsconfig paths，
// 也不跟随一级目录之外的软链，路径写错会在部署构建时报 Could not resolve。

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
