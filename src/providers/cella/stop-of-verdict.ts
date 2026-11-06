/**
 * **一次判決 → 執行停下的原因**（鍵、參數、節點）。
 *
 * 內建的 Cella 提供者（`worker.ts` 的除錯工作階段）與 cos-mos 的 Provider（元件 report 的判決）共用**同一張對照表**：
 * 第二條不變式「換宿主，結果不變」——同一支有號溢位的程式，在兩個宿主上學生看到同一句「整數算到超出範圍了」。
 * cos-mos 不另抄一份：semorphe 匯出這個函式，cos-mos 在建立 Provider 時注入（2026-11-04 與 cos-mos 定，和 `SessionStop`、`formalizeForSession` 同一個做法）。
 *
 * 規則：
 * - accept 而沒有該停的問題 → `null`（`ended`）。
 * - 挑**第一則學生該看的**問題，不一定是 `problems[0]`：還沒寫完（incomplete）不算；嚴重度照類別——錯誤 → 結束方式 → 判不出 → 系統還不會。
 * - 「程式錯了」與「沒辦法判斷」用不同的鍵（後者：步數用完、模型做不到）。
 * - 系統之間的問題（invalid）不說成「程式不合規則」——那是學生寫錯的說法。
 * - 不是 accept 卻挑不到問題 → 照實說判決本身，**不得回 null 冒充跑完**。
 */
import { ownerOf } from '../../core/verdict-diagnostics'
import type { CellaVerdict } from './verdict'

/** 未定義行為的種類 → 執行期訊息的鍵（中文說法與判決的 `DIAG_CELLA_UB_*` 同一套）。`worker.ts` 的除錯工作階段也讀這一張。 */
export const UB_KEY: Readonly<Record<string, string>> = {
  ubUninit: 'RUNTIME_ERR_UB_UNINIT', ubFlowOffEnd: 'RUNTIME_ERR_UB_FLOW_OFF_END', ubBounds: 'RUNTIME_ERR_UB_BOUNDS', ubOverflow: 'RUNTIME_ERR_UB_OVERFLOW',
  ubDivZero: 'RUNTIME_ERR_UB_DIV_ZERO', ubOverlap: 'RUNTIME_ERR_UB_OVERLAP',
  // spec 205：6c-2 量到的另外兩種（越過結尾、板子上沒有的腳）——原本落到通用的「標準沒有定義」那句
  ubPastEnd: 'RUNTIME_ERR_UB_PAST_END', ubPin: 'RUNTIME_ERR_UB_PIN',
}

export interface VerdictStop {
  kind: 'runtime'
  i18nKey: string
  params: Record<string, string>
  nodeId: string | null
}

/** 類別 → 挑選的先後（數字小的先）；不在表裡的（incomplete）不挑。 */
const RANK: Record<string, number> = { error: 0, termination: 1, indeterminate: 2, unsupported: 3, invalid: 4 }

type Problem = CellaVerdict['problems'][number] & { params?: Readonly<Record<string, string | boolean>> }

function keyOf(p: Problem): string {
  if (p.category === 'invalid') return 'RUNTIME_ERR_CELLA_INVALID'
  if (p.kind === 'fuel') return 'RUNTIME_ERR_MAX_STEPS'
  if (p.kind === 'unsupported' || p.category === 'unsupported') return 'RUNTIME_ERR_CELLA_UNSUPPORTED'
  if (p.kind === 'uncaught' || p.kind === 'abort') return 'RUNTIME_ERR_UNCAUGHT_EXCEPTION'
  if (p.category === 'indeterminate') return 'RUNTIME_ERR_UNSPECIFIED_BEHAVIOR'
  if (p.kind.startsWith('ub')) return UB_KEY[p.kind] ?? 'RUNTIME_ERR_UNDEFINED_BEHAVIOR'
  return 'RUNTIME_ERR_CELLA_REJECTED'
}

export function stopOfVerdict(verdict: CellaVerdict): VerdictStop | null {
  const candidates = (verdict.problems as Problem[])
    .filter((p) => p.category !== undefined && p.category in RANK && p.kind !== 'assumed' && p.kind !== 'hole')
    .sort((a, b) => RANK[a.category!] - RANK[b.category!])
  // accept 時只有「結束方式」那一類（沒接住的例外、NameError）算停下；其餘（例如假設）不擋
  const p = verdict.verdict === 'accept' ? candidates.find((x) => x.category === 'termination') : candidates[0]
  if (!p) {
    if (verdict.verdict === 'accept') return null
    const key = verdict.verdict === 'invalid' ? 'RUNTIME_ERR_CELLA_INVALID' : verdict.verdict === 'unknown' ? 'RUNTIME_ERR_CELLA_UNSUPPORTED' : 'RUNTIME_ERR_CELLA_REJECTED'
    return { kind: 'runtime', i18nKey: key, params: { why: verdict.verdict }, nodeId: null }
  }
  const reason = p.reason ?? ''
  const structured = Object.fromEntries(Object.entries(p.params ?? {}).map(([k, v]) => [k, String(v)]))
  const params: Record<string, string> = {
    ...structured, kind: p.kind, clause: p.clause ?? '', reason,
    // 各句用到的欄位：UB 的 {clause}／{pre}、例外的 {text}、不支援與不合規則的 {why}
    pre: reason, text: reason, why: reason,
  }
  return { kind: 'runtime', i18nKey: keyOf(p), params, nodeId: p.at ? ownerOf(p.at) : null }
}
