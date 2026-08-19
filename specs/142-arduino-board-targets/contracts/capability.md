# 契約：能力（capability）

> 這個專案的「契約」是**宣告的形狀**與**匯出的函式名**——見 `src/core/component/paths.ts`。

## 元件側

```jsonc
// component.json
"traits": { "needsCapability": "<能力名>" }
```

- 型別：`string`（單值）
- 省略 ＝ **所有目標都提供**
- ⚠️ 值必須是**已被某個目標提供**的能力——否則那顆元件在所有板子上都拿不到，
  而護欄會報（見下）

## 目標側

```ts
interface Target { provides?: readonly string[] }
```

- 省略 ＝ **提供全部**（非硬體目標不受影響）
- `[]` ＝ **一個都不提供**（Uno／Nano）

## 讀取的唯一入口

```ts
// src/core/component/traits.ts
export function capabilityOf(conceptId: string): string | undefined
export function targetProvides(target: Target, capability: string | undefined): boolean
```

🔴 **消費者一律走這兩個函式**，不得自己讀 `traits.needsCapability`
——`concepts/性狀.md` 的整章理由：**問性質，不問名字**，而「問」要有唯一入口。

## 護欄

| 護欄 | 判準 | 硬性零？ |
|---|---|---|
| **能力供給完備性**（新） | 每一個被宣告需要的能力，**至少一個目標提供它** | ✅ 硬性零 |
| 可拿性（既有） | **不必改**——見 [research.md](research.md) R2 | — |

判準理由：留一筆「沒有任何板子提供的能力」在那裡，
「這顆元件拿得到」這句話就是假的 → 硬性零（`build-guardrail` 6.8）。
