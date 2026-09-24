// EdgeOne Pages 边缘函数：内置角色卡
// GET /api/cards -> { cards: [...] }
//
// 数据来源优先级：
// 1. KV 命名空间（变量名 CARDS_KV，在 Pages 控制台绑定）中的 builtin-cards 键
//    —— 运营侧可随时增删改内置卡，所有访客下次打开即生效，无需重新部署。
// 2. 代码内的兜底内置卡（保证未配置 KV 时开箱即用）。
//
// KV 中存 JSON 数组，字段与前端角色卡一致：
// name / emoji / description / baseDirective / persona / userProfile / initialScene / relationship

// 兜底内置卡已清空：默认角色仅保留前端 defaults 中的「初音未来」。
// 运营侧如需下发内置卡，请在 EdgeOne 控制台绑定 CARDS_KV 命名空间并写入 builtin-cards 键。
const FALLBACK_CARDS = [];

async function readFromKv() {
  try {
    // Pages 控制台绑定 KV 命名空间后，变量名会直接注入为全局变量
    if (typeof CARDS_KV === 'undefined' || !CARDS_KV || !CARDS_KV.get) return null;
    const raw = await CARDS_KV.get('builtin-cards');
    if (!raw) return null;
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(list) && list.length ? list : null;
  } catch {
    return null;
  }
}

export async function onRequest() {
  const cards = (await readFromKv()) || FALLBACK_CARDS;
  return new Response(JSON.stringify({ cards }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export default onRequest;
