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
  /** 板子上的程式才有（`@cella-lang/arduino`）：腳位變化、是否截斷、結束時的硬體（JSON 字串）——見 `core/hardware.ts`。 */
  pins?: { t: number; pin: number; value: number }[]
  pinsTruncated?: boolean
  env?: unknown
}

/**
 * 型別查詢的結果（照抄 `@cella-lang/cfamily` README〈Type query〉）。
 * 標錯只用 `errors`——已經接上而型別不合的那一句；`slots` 的 `fits` 是「洞裡放什麼合」，留給工具箱提示。
 */
export interface TypeQuery {
  nodes?: Record<string, string>
  slots?: Record<string, { display?: string; expects?: string | null; fits?: Record<string, { level: 'exact' | 'convert' | 'narrowing' | 'no'; reason?: string }> }>
  errors?: { at: string; reason: string }[]
}

/**
 * 問題種類 → 規則身分與嚴重度（data-model 的表）。**文案在 i18n**（`DIAG_<規則>_BLOCK`／`_CODE`），
 * 第四十二條護欄從 `VERDICT_RULES` 導出身分、要求每個面板每種語言都有一份。
 * 不在表上的種類 → `CELLA_OTHER`（嚴重度依判決：reject → error、其餘 → info），原文放在 `reason`。
 */
const KINDS: Record<string, { rule: string; severity: 'error' | 'info' }> = {
  ubUninit: { rule: 'CELLA_UB_UNINIT', severity: 'error' },
  ubBounds: { rule: 'CELLA_UB_BOUNDS', severity: 'error' },
  ubOverflow: { rule: 'CELLA_UB_OVERFLOW', severity: 'error' },
  ubDivZero: { rule: 'CELLA_UB_DIV_ZERO', severity: 'error' },
  ubOverlap: { rule: 'CELLA_UB_OVERLAP', severity: 'error' },
  reject: { rule: 'CELLA_REJECT', severity: 'error' },
  unsupported: { rule: 'CELLA_UNSUPPORTED', severity: 'info' },
  fuel: { rule: 'CELLA_FUEL', severity: 'info' },
  unspecified: { rule: 'CELLA_UNSPECIFIED', severity: 'info' },
}

/** 判決產出端的全部規則身分（護欄用）。 */
export const VERDICT_RULES: readonly string[] = [...Object.values(KINDS).map((k) => k.rule), 'CELLA_OTHER', 'TYPE_MISMATCH']

/** 實作假設 → 中文（「依 libc++」小標點開的說明）。 */
const ASSUMES: Record<string, string> = {
  'vector.growth': 'vector 的容量怎麼長、什麼時候搬家，照 libc++ 的做法',
  'library.what': '例外的 what() 印出的文字，照 libc++ 的寫法',
}

/** 標籤 `<id>/<角色>`、`<id>#<槽>` → `<id>`（與 `tests/probes/binding-verdict` 的 `owner` 同一條規則）。 */
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
}): { diagnostics: Diagnostic[]; notes: string[]; assumes: { implementation: string; text: string }[] } {
  const { verdict, types, tree, readsInput, hasStdin } = input
  const notes: string[] = []
  if (!verdict) return { diagnostics: [], notes: ['判斷功能需要 Cella（還沒載好，或這個語言還沒有）'], assumes: [] }

  const known = ids(tree)
  const diagnostics: Diagnostic[] = []
  let dropped = 0
  for (const p of verdict.problems) {
    if (p.kind === 'hole') continue                                   // 空槽＝還沒寫完，不顯示
    if (readsInput && !hasStdin && RUNTIME(p.kind)) { dropped++; continue }
    const nodeId = p.at ? ownerOf(p.at) : ''
    if (!known.has(nodeId)) { notes.push(`有一則判決對不到積木：${p.kind}${p.reason ? `（${p.reason}）` : ''}`); continue }
    const k = KINDS[p.kind]
    diagnostics.push({
      nodeId, source: 'cella',
      rule: k?.rule ?? 'CELLA_OTHER',
      severity: k?.severity ?? (verdict.verdict === 'reject' ? 'error' : 'info'),
      params: { kind: p.kind, reason: p.reason ?? '', clause: p.clause ?? '' },
    })
  }
  if (dropped > 0) notes.push('這支程式要讀輸入——給一份輸入，才判得出執行時的問題')

  // `assumes`：不改變有錯／沒錯（第 14 題），單獨交出去給「依 libc++」小標——不混進 notes
  const assumes = (verdict.assumes ?? []).map((a) => ({ implementation: a.implementation, text: ASSUMES[a.choice] ?? a.choice }))

  // 型別不合：允許接上、標在那一句（第 16 題）。判決的 reject 也指到同一顆時只留一則
  for (const e of types?.errors ?? []) {
    const nodeId = ownerOf(e.at)
    if (!known.has(nodeId)) { notes.push(`有一則型別錯誤對不到積木（${e.reason}）`); continue }
    if (diagnostics.some((d) => d.nodeId === nodeId && d.rule === 'CELLA_REJECT')) continue
    diagnostics.push({ nodeId, severity: 'error', source: 'cella', rule: 'TYPE_MISMATCH', params: { reason: e.reason } })
  }
  return { diagnostics, notes, assumes }
}
