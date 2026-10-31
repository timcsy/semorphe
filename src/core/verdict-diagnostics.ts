/**
 * **判決 → 診斷**（spec 182，重構階段 5a）。
 *
 * 判決（`verdict` 能力的結果）與型別查詢（`types`）轉成既有的 `Diagnostic`，走 `app.ts` 原本的 `onDiagnostics` 通道
 * ——積木高亮、程式碼波浪都由視圖既有的 nodeId 投影畫出，不另做一套標示（research R1）。
 *
 * ⚠️ **核心只認判決的形狀**（照抄 Cella 的判決 JSON），不認識任何提供者——分層護欄照舊。
 *
 * ## 不變式（`contracts/verdict-diagnostics.md`）
 *
 * - accept 且型別都合 ⟹ 0 則（不產生「通過」雜訊）
 * - 尚未支援的構造 ⟹ `info`，永不 `error`（P6：系統能力不足不是學生的錯）
 * - 每則的 `nodeId` 都在樹裡；對不到的只進 notes
 * - 要讀輸入而沒有測資 ⟹ 丟掉 `ub*`／`fuel`（空輸入的假象，第 394 刀量到 21 支）
 * - 能力缺 ⟹ 0 則，notes 說需要 Cella
 */
import type { Diagnostic } from './diagnostics'
import type { SemanticNode } from './types'

/** 判決的一個問題（Cella 判決 JSON 的 `problems[]`）。`at` 是 formalize 給的節點標籤。 */
export interface VerdictProblem { kind: string; at?: string; clause?: string; reason?: string }

/** 判決（Cella 判決 JSON 的形狀；板子上的程式另有 pins／env，這裡不收窄）。 */
export interface Verdict {
  verdict: 'accept' | 'reject' | 'unknown' | 'invalid'
  basis: string
  exit: number | null
  out: string
  problems: VerdictProblem[]
  assumes?: { implementation: string; choice: string }[]
}

/** 型別查詢的結果——只用到「不合」的那幾格。 */
export interface TypeQuery {
  slots: Record<string, { display?: string; expects?: string; actual?: string; fits?: { level?: string } }>
}

/** 問題種類 → 嚴重度與中文（data-model 的表）。不在表上的：依判決（reject → error、unknown → info），訊息用原文。 */
const KINDS: Record<string, { severity: 'error' | 'info'; zh: string }> = {
  ubUninit: { severity: 'error', zh: '用到還沒有值的變數' },
  ubBounds: { severity: 'error', zh: '讀寫到陣列（或容器）外面了' },
  ubOverflow: { severity: 'error', zh: '整數算到超出範圍' },
  ubDivZero: { severity: 'error', zh: '除以零' },
  ubOverlap: { severity: 'error', zh: '指定時，來源與目的地重疊' },
  reject: { severity: 'error', zh: '型別或寫法不合規則' },
  unsupported: { severity: 'info', zh: '這個用法還判不出來' },
  fuel: { severity: 'info', zh: '跑太久了，判不出來' },
  unspecified: { severity: 'info', zh: '這裡的結果，標準允許不只一種' },
}

/** 實作假設 → 中文（「依 libc++」小標點開的說明）。 */
const ASSUMES: Record<string, string> = {
  'vector.growth': 'vector 的容量怎麼長、什麼時候搬家，照 libc++ 的做法',
  'library.what': '例外的 what() 印出的文字，照 libc++ 的寫法',
}

/** 標籤 `<id>/<角色>`、`<id>#<槽>` → `<id>`（與 `tests/probes/c18-verdict` 的 `owner` 同一條規則）。 */
export const ownerOf = (label: string): string => label.split(/[/#]/)[0]

function ids(tree: SemanticNode): Set<string> {
  const out = new Set<string>()
  const walk = (n: SemanticNode): void => {
    out.add(n.id)
    for (const kids of Object.values(n.slots ?? {})) kids.forEach(walk)
  }
  walk(tree)
  return out
}

const RUNTIME = (kind: string): boolean => kind.startsWith('ub') || kind === 'fuel'

export function toDiagnostics(input: {
  verdict: Verdict | null
  types: TypeQuery | null
  tree: SemanticNode
  readsInput: boolean
  hasStdin: boolean
}): { diagnostics: Diagnostic[]; notes: string[] } {
  const { verdict, types, tree, readsInput, hasStdin } = input
  const notes: string[] = []
  if (!verdict) return { diagnostics: [], notes: ['判斷功能需要 Cella（還沒載好，或這個語言還沒有）'] }

  const known = ids(tree)
  const diagnostics: Diagnostic[] = []
  let dropped = 0
  for (const p of verdict.problems) {
    if (p.kind === 'hole') continue                                   // 空槽＝還沒寫完，不顯示
    if (readsInput && !hasStdin && RUNTIME(p.kind)) { dropped++; continue }
    const nodeId = p.at ? ownerOf(p.at) : ''
    if (!known.has(nodeId)) { notes.push(`有一則判決對不到積木：${p.kind}${p.reason ? `（${p.reason}）` : ''}`); continue }
    const k = KINDS[p.kind]
    const severity = k?.severity ?? (verdict.verdict === 'reject' ? 'error' : 'info')
    if (!k) notes.push(`新的判決種類（還沒有中文說明）：${p.kind}`)
    diagnostics.push({
      nodeId, severity, source: 'cella', rule: `cella_${p.kind}`,
      params: { message: k?.zh ?? p.reason ?? p.kind, ...(p.reason ? { reason: p.reason } : {}), ...(p.clause ? { clause: p.clause } : {}) },
    })
  }
  if (dropped > 0) notes.push('這支程式要讀輸入——給一份輸入，才判得出執行時的問題')

  for (const a of verdict.assumes ?? []) {
    notes.push(`依 ${a.implementation}：${ASSUMES[a.choice] ?? a.choice}`)
  }

  for (const [label, s] of Object.entries(types?.slots ?? {})) {
    if (s.fits?.level !== 'no') continue
    const nodeId = ownerOf(label)
    if (!known.has(nodeId)) continue
    diagnostics.push({
      nodeId, severity: 'error', source: 'cella', rule: 'type_mismatch',
      params: { message: s.display ?? '型別不合', ...(s.expects ? { expects: s.expects } : {}), ...(s.actual ? { actual: s.actual } : {}) },
    })
  }
  return { diagnostics, notes }
}
