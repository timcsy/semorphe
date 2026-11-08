/**
 * **用判決提供者的 `check()` 做成的 Judge**（spec 218）——瀏覽器宿主用（app 把登錄表裡的判決提供者交進來）。
 * 只依賴核心的 `CheckRequest`／`CheckAnswer`：不認得任何一個提供者（Node 的批次與測試各自包自己的 Judge）。
 *
 * 情境：`payload.text` → 標準輸入；`payload.events` → 板子的時間序列輸入（`boardInputs`）。兩者都沒有 → 照實回「判不了」。
 * 判決過期（送出之後又有更新的請求）或提供者還沒好 → `pending`（比對器標成不可比，不假裝有結果）。
 * Arduino 比的是序列埠輸出＋結束時輸出腳的電位（`hardwareOf` 的 end）——不比腳位變化的時間戳（行為相同的兩支程式差幾微秒很正常）。
 */
import type { CheckAnswer, CheckRequest } from '../capabilities'
import { hardwareOf } from '../hardware'
import type { Judge, RunOutcome } from './types'

type Base = Omit<CheckRequest, 'tree' | 'input' | 'boardInputs'>

/** 結束時輸出腳的電位：`{ pin13: 1 }` */
export function outputLevels(verdict: Parameters<typeof hardwareOf>[0]): Record<string, number> | undefined {
  const end = hardwareOf(verdict)?.end
  return end ? Object.fromEntries(end.pins.filter((p) => p.mode === 'OUTPUT').map((p) => [`pin${p.pin}`, p.level])) : undefined
}

export function makeCheckJudge(check: (req: CheckRequest) => Promise<CheckAnswer>, base: Base): Judge {
  return async (tree, scenario): Promise<RunOutcome> => {
    const p = scenario.payload as { text?: unknown; events?: unknown }
    const text = typeof p?.text === 'string' ? p.text : undefined
    const events = Array.isArray(p?.events) ? (p.events as { t: number; key: string; value: number }[]) : undefined
    if (text === undefined && events === undefined) {
      return { verdict: 'pending', out: '', problems: [{ kind: 'unsupported-scenario', reason: `判決請求接不了「${scenario.kind}」這種情境` }] }
    }
    const a = await check({ ...base, tree, input: text ?? '', ...(events ? { boardInputs: events } : {}) })
    if (a.stale || !a.verdict) return { verdict: 'pending', out: '', problems: [{ kind: a.stale ? 'stale' : 'not-ready' }] }
    const v = a.verdict
    return {
      verdict: v.verdict === 'invalid' ? 'untranslated' : v.verdict,
      out: v.out,
      board: outputLevels(v),
      problems: v.problems.map((x) => ({ kind: x.kind, ...(x.reason ? { reason: x.reason } : {}) })),
    }
  }
}
