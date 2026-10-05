// 边缘函数共享库：模型名归一化与兜底清单
// - applyModelPrefix：不带 "/" 的裸模型名自动补 @makers/ 前缀（如 deepseek-v4-flash → @makers/deepseek-v4-flash）；
//   带 "/" 的按 provider/model 原样透传（如 openai/gpt-5）。/api 与 /v1 两条聊天代理共用此实现。
// - KNOWN_MODELS：上游网关不提供 /models 接口时对外回落的已知清单（需与前端 BUILTIN_MODELS 保持同步）。

export function applyModelPrefix(payload) {
  if (!payload || typeof payload.model !== 'string' || !payload.model.trim() || payload.model.includes('/')) return payload;
  const bare = payload.model.trim().replace(/^@?makers-?/, '');
  payload.model = '@makers/' + (bare || payload.model.trim());
  return payload;
}

export function hasModel(payload) {
  return !!(payload && typeof payload.model === 'string' && payload.model.trim());
}

export const KNOWN_MODELS = [
  '@makers/deepseek-v4-flash',
  '@makers/deepseek-v4-pro',
  '@makers/hy3',
  '@makers/hy3-preview',
  '@makers/minimax-m2.7',
  '@makers/minimax-m3',
  '@makers/kimi-k2.6',
];
