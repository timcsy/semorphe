/**
 * 元件的五路註冊——**一個組裝點**
 *
 * ## 為什麼不讓每個元件自己 import 進語言套件
 *
 * 那會讓「加一顆元件」＝編輯語言套件的某個 index——正是元件化要消滅的東西。
 * 這裡用 `import.meta.glob` 掃出實作檔，呼叫端只多一行。
 *
 * ## ⚠️ 匯出的函式名是契約
 *
 * `generate.ts` → `registerGenerate`、`execute.ts` → `registerExecute`、
 * `lift.ts` → `registerLift`。名字不對就 throw——**不是安靜地少一路**。
 * 這與 `StdModule.registerExecutors` 的紀律同一條：
 * 讓「顯式的空」與「遺漏的空」分得出來。
 */
import { registeredComponents } from './registry'

const GENERATE = import.meta.glob('/src/components/*/*/generate.ts', { eager: true }) as Record<string, Record<string, unknown>>
const EXECUTE = import.meta.glob('/src/components/*/*/execute.ts', { eager: true }) as Record<string, Record<string, unknown>>
const LIFT = import.meta.glob('/src/components/*/*/lift.ts', { eager: true }) as Record<string, Record<string, unknown>>
/**
 * 膠囊的**具名辨識策略**——與 `lift.ts` 分開的檔，因為它們接的是不同的登錄表。
 *
 * `lift.ts` 拿到的是 `lifter`（節點型別 → 處理函式）；
 * 這裡拿到的是 `LiftStrategyRegistry`（具名策略，由 lift-pattern 以名字引用）。
 * **兩個登錄表，兩個入口**——合成一個會逼呼叫端再分一次流。
 *
 * ⚠️ 2026-08-11 建立時**還沒有任何膠囊用它**：第一次嘗試搬那 14 個
 * 「只產一種身分」的策略時，有 7 個用到 `registerCppLiftStrategies` 內部的
 * **閉包 helper**（`openBrace` 捕獲 `style`、`拆解成員`…）搬不動，
 * 而搬得動的 7 個引入了誤差迴歸，整批回退。
 * **機制留著是因為它獨立成立**——下一次不必再造一次。
 */
const LIFT_STRATEGY = import.meta.glob('/src/components/*/*/lift-strategy.ts', { eager: true }) as Record<string, Record<string, unknown>>

function 取(mods: Record<string, Record<string, unknown>>, 名: string, 路: string): ((...a: never[]) => void)[] {
  const out: ((...a: never[]) => void)[] = []
  const 已宣告 = new Set(
    registeredComponents()
      .filter((c) => c.manifest.paths?.[路 as 'generate'] != null)
      .map((c) => c.sourceDir),
  )
  for (const [key, mod] of Object.entries(mods)) {
    const parts = key.split('/').filter(Boolean)
    const i = parts.indexOf('components')
    const dir = `${parts[i + 1]}/${parts[i + 2]}`
    if (!已宣告.has(dir)) {
      throw new Error(
        `${key} 存在，但 ${dir}/component.json 的 paths.${路} 是 null 或缺席——` +
          `**有實作卻沒宣告**，那是孤兒實作。`,
      )
    }
    const fn = mod[名]
    if (typeof fn !== 'function') throw new Error(`${key} 必須匯出 ${名}()`)
    out.push(fn as (...a: never[]) => void)
  }
  return out
}

export const componentGenerateRegistrars = (): ((...a: never[]) => void)[] => 取(GENERATE, 'registerGenerate', 'generate')
export const componentExecuteRegistrars = (): ((...a: never[]) => void)[] => 取(EXECUTE, 'registerExecute', 'execute')
export const componentLiftRegistrars = (): ((...a: never[]) => void)[] => 取(LIFT, 'registerLift', 'lift')
export const componentLiftStrategyRegistrars = (): ((...a: never[]) => void)[] =>
  取(LIFT_STRATEGY, 'registerLiftStrategy', 'liftStrategy')
