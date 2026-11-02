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
import { findNearMiss } from './near-miss'

/** 判決的一個問題（Cella 判決 JSON 的 `problems[]`）。`at` 是 formalize 給的節點標籤。 */
export interface VerdictProblem {
  kind: string
  /**
   * 這一則屬於哪一類——**由 Cella 給**（三方會議第二輪 Q15，cella 0.1.202611021901 起）：
   * error 學生寫錯｜unsupported 系統還不會｜indeterminate 本質判不出｜termination 程式怎麼結束｜incomplete 還沒寫完｜invalid 程式本身不成形。
   * 沒有這一格的要**明說**（`CELLA_UNCLASSIFIED`），不得由接收端猜（cos-mos 衍生原則 7：跨邊界的意思由產生的一方宣告）。
   */
  class?: string
  at?: string
  clause?: string
  reason?: string
}

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
 * 問題種類 → 規則身分（決定文案）。**文案在 i18n**（`DIAG_<規則>_BLOCK`／`_CODE`），
 * 第四十二條護欄從 `VERDICT_RULES` 導出身分、要求每個面板每種語言都有一份。
 * 不在表上的種類 → `CELLA_OTHER`，原文放在 `reason`。
 * 🔴 **嚴重度不在這裡**（2026-11-03，cella 0.1.202611021901）：它由 Cella 給的 `class` 決定（`CLASS_SEVERITY`）——
 * 原本這張表也定嚴重度、表外的照「reject → error」猜，那正是 Q15 要拿掉的「接收端自己歸類」（`ub…` 同時用在未定義與未指定行為）。
 */
const KINDS: Record<string, { rule: string }> = {
  ubUninit: { rule: 'CELLA_UB_UNINIT' },
  ubBounds: { rule: 'CELLA_UB_BOUNDS' },
  ubOverflow: { rule: 'CELLA_UB_OVERFLOW' },
  ubDivZero: { rule: 'CELLA_UB_DIV_ZERO' },
  ubOverlap: { rule: 'CELLA_UB_OVERLAP' },
  reject: { rule: 'CELLA_REJECT' },
  unsupported: { rule: 'CELLA_UNSUPPORTED' },
  fuel: { rule: 'CELLA_FUEL' },
  unspecified: { rule: 'CELLA_UNSPECIFIED' },
  // 求值順序未指定、而兩邊的副作用互相衝突（`f() + g()` 兩個都印東西）——標準允許不只一種結果（cella 0.1.202610312349 起）
  ubOrder: { rule: 'CELLA_UNSPECIFIED' },
  abort: { rule: 'CELLA_TERMINATION' },
  uncaught: { rule: 'CELLA_TERMINATION' },
}

/** 判決產出端的全部規則身分（護欄用）。 */
export const VERDICT_RULES: readonly string[] = [...new Set(Object.values(KINDS).map((k) => k.rule))].concat('CELLA_OTHER', 'CELLA_UNCLASSIFIED', 'TYPE_MISMATCH')

/**
 * 類別 → 嚴重度（Q15：分類是 Cella 的事，這裡只決定【怎麼呈現】那一類）。
 * 系統還不會、本質判不出、程式不成形都不是學生的錯 ⟹ info（P6）；程式怎麼結束照實顯示 ⟹ warning；還沒寫完不顯示。
 */
const CLASS_SEVERITY: Record<string, 'error' | 'warning' | 'info' | null> = {
  error: 'error', unsupported: 'info', indeterminate: 'info', termination: 'warning', incomplete: null, invalid: 'info',
}

/** 實作假設 → 中文（「依 libc++」小標點開的說明）。 */
const ASSUMES: Record<string, string> = {
  'vector.growth': 'vector 的容量怎麼長、什麼時候搬家，照 libc++ 的做法',
  'library.what': '例外的 what() 印出的文字，照 libc++ 的寫法',
  // cella 0.1.202610312349 起（spec 194）
  'rand.sequence': 'rand() 產生的那一串數字，照 glibc 的演算法（沒有呼叫 srand 時種子是 1）',
  'time.now': 'time() 讀到的「現在」——判斷時固定當成 0，實際執行每次都不同',
  'sort.order': 'sort 排序時，相等的元素誰先誰後，照 libc++ 的做法',
  // cella 下一版（2026-11-01 預告）：math.h 的 sin、cos、exp、log、pow…
  // cella 2026-11-02 預告：只寫 <bits/stdc++.h> 的程式照 libstdc++ 的內容帶進所有標準標頭（int64_t、INT_MAX 不再判 unknown）
  'header.contents': '<bits/stdc++.h> 會帶進哪些標準標頭，照 GCC（libstdc++）的內容——這個標頭不是 C++ 標準的一部分，有些編譯器沒有它',
  'math.correctlyRounded': '數學函式（sin、cos、exp、log、pow…）算出的小數照正確捨入算；實際的函式庫最後一位可能不同',
}

/** 擔保者 → 顯示的名字（小標上的「依 …」）。認不得的照原文。 */
const IMPLEMENTATIONS: Record<string, string> = { environment: '執行環境' }

/**
 * 標籤 `<id>/<角色>`、`<id>#<槽>`、`<id>:<合成>` → `<id>`（與 `tests/probes/binding-verdict` 的 `owner` 同一條規則）。
 * `:` 是 Cella 展開範圍 for 時合成的運算式（`:begin`、`:end`、`:element`、`:test`、`:step`；cella 2026-11-01 告知）——對回範圍 for 本身。
 */
export const ownerOf = (label: string): string => label.split(/[/#:]/)[0]

function ids(tree: SemanticNode): Set<string> {
  const out = new Set<string>()
  const walk = (n: SemanticNode): void => {
    out.add(n.id)
    for (const kids of Object.values(n.slots ?? {})) kids.forEach(walk)
  }
  walk(tree)
  return out
}

/**
 * Cella 判「use of undeclared identifier 'X'」時，在**樹裡宣告過的名字**與**語言給的常用名字**裡找近似名（spec 206）。
 * 樹裡的名字：每顆節點的 `name` 屬性（宣告、函式、參數都用這一格）——它不認得任何元件，只讀這一格。
 * ⚠️ 判準寧可漏，不可錯（`near-miss.ts` 檔頭）：找不到就回 undefined，診斷照原本的那一則。
 */
function nearMissFor(reason: string, tree: SemanticNode, knownNames: Iterable<string> = []): { name: string; near: string } | undefined {
  const m = /undeclared identifier '([^']+)'/.exec(reason)
  if (!m) return undefined
  const names = new Set<string>(knownNames)
  const walk = (n: SemanticNode): void => {
    const v = n.properties?.name
    if (typeof v === 'string' && v !== '') names.add(v)
    for (const kids of Object.values(n.slots ?? {})) for (const c of kids) walk(c)
  }
  walk(tree)
  names.delete(m[1])
  const near = findNearMiss(m[1], names)
  return near === undefined ? undefined : { name: m[1], near }
}

/**
 * **串流配錯運算子**（spec 207）——比較運算（`<`、`>`）的左邊是串流：輸出入串流不能比大小，所以那一定是配錯（`cin < x` 要 `>>`）。
 * 判決說不出這句（它說 invalid operands，或指著 `endl` 說不是 C++），所以這裡從樹的形狀補上，並**取代**落在同一個比較運算子樹裡的
 * 那幾則 Cella 的 reject——不然學生同時看到一句對的和一句讓人更困惑的。
 * ⚠️ 只讀節點的 `operator` 屬性與 `left` 那一格第一顆的 `name`，不認得任何元件；哪些名字是串流由語言給。
 */
function streamHints(tree: SemanticNode, streams: Readonly<Record<string, string>>, diagnostics: Diagnostic[]): void {
  const hits: { node: SemanticNode; stream: string; op: string; want: string }[] = []
  const walk = (n: SemanticNode): void => {
    const op = n.properties?.operator
    const left = n.slots?.left?.[0]
    const stream = typeof left?.properties?.name === 'string' ? left.properties.name : undefined
    if ((op === '<' || op === '>') && stream && streams[stream] && streams[stream] !== op) hits.push({ node: n, stream, op, want: streams[stream] })
    for (const kids of Object.values(n.slots ?? {})) for (const c of kids) walk(c)
  }
  walk(tree)
  for (const h of hits) {
    const inside = ids(h.node)
    for (let i = diagnostics.length - 1; i >= 0; i--) {
      const d = diagnostics[i]
      if (d.source === 'cella' && (d.rule === 'CELLA_REJECT' || d.rule === 'CELLA_OTHER') && inside.has(d.nodeId)) diagnostics.splice(i, 1)
    }
    diagnostics.push({ nodeId: h.node.id, source: 'cella', rule: 'STREAM_OPERATOR_SUGGEST', severity: 'error', params: { stream: h.stream, op: h.op, want: h.want } })
  }
}

const RUNTIME = (kind: string): boolean => kind.startsWith('ub') || kind === 'fuel'

export function toDiagnostics(input: {
  verdict: Verdict | null
  types: TypeQuery | null
  tree: SemanticNode
  readsInput: boolean
  hasStdin: boolean
  /** 語言給的常用名字（`cout`、`cin`…）——近似名建議的候選之一（spec 206）；樹裡宣告過的名字另外收 */
  knownNames?: Iterable<string>
  /** 串流名 → 它要配的運算子（`cout` → `<<`、`cin` → `>>`）——「串流配錯運算子」的提示（spec 207）；語言給 */
  streamOperators?: Readonly<Record<string, string>>
}): {
  diagnostics: Diagnostic[]
  notes: string[]
  assumes: { implementation: string; text: string }[]
  /**
   * **對不到積木的問題**（`at` 是空的，或指到樹上沒有的節點——例如步數用盡）：照嚴重度計數，狀態列要算進去。
   * ⚠️ 2026-11-01 之前它只進 `notes`（狀態列的 title），而狀態列寫「沒有發現問題」——把判不了說成對的（P6）。
   */
  unplaced: { error: number; info: number }
} {
  const { verdict, types, tree, readsInput, hasStdin } = input
  const notes: string[] = []
  const unplaced = { error: 0, info: 0 }
  if (!verdict) return { diagnostics: [], notes: ['判斷功能需要 Cella（還沒載好，或這個語言還沒有）'], assumes: [], unplaced }

  const known = ids(tree)
  const diagnostics: Diagnostic[] = []
  let dropped = 0
  for (const p of verdict.problems) {
    if (p.class === 'incomplete' || p.kind === 'hole') continue        // 還沒寫完（空槽），不顯示
    if (readsInput && !hasStdin && RUNTIME(p.kind)) { dropped++; continue }
    const nodeId = p.at ? ownerOf(p.at) : ''
    const k = KINDS[p.kind]
    // 🔴 沒有類別的問題：明說，不猜它是學生的錯還是系統的錯（history/330 的護欄）
    const classified = p.class !== undefined && p.class in CLASS_SEVERITY
    if (!classified) notes.push(`有一則判決沒有說明類別：${p.kind}${p.class ? `（類別「${p.class}」認不得）` : ''}${p.reason ? `：${p.reason}` : ''}`)
    const severity = classified ? CLASS_SEVERITY[p.class!]! : 'info'
    if (!known.has(nodeId)) {
      unplaced[severity === 'error' ? 'error' : 'info']++
      notes.push(`有一則判決對不到積木：${p.kind}${p.reason ? `（${p.reason}）` : ''}`)
      continue
    }
    // spec 206：未宣告的名字——有一個長得很像的就說出來（原本住在 JS 直譯器，6c-4 刪掉它之前搬過來）；找不到就不提
    const suggest = p.kind === 'reject' ? nearMissFor(p.reason ?? '', tree, input.knownNames) : undefined
    if (suggest) {
      diagnostics.push({ nodeId, source: 'cella', rule: 'CELLA_UNDECLARED_SUGGEST', severity, params: { kind: p.kind, reason: p.reason ?? '', clause: p.clause ?? '', ...suggest } })
      continue
    }
    diagnostics.push({
      nodeId, source: 'cella',
      rule: !classified ? 'CELLA_UNCLASSIFIED' : k?.rule ?? 'CELLA_OTHER',
      severity,
      params: { kind: p.kind, reason: p.reason ?? '', clause: p.clause ?? '' },
    })
  }
  if (dropped > 0) notes.push('這支程式要讀輸入——給一份輸入，才判得出執行時的問題')
  if (verdict.verdict === 'reject' && input.streamOperators) streamHints(tree, input.streamOperators, diagnostics)

  // `assumes`：不改變有錯／沒錯（第 14 題），單獨交出去給「依 libc++」小標——不混進 notes
  const assumes = (verdict.assumes ?? []).map((a) => ({ implementation: IMPLEMENTATIONS[a.implementation] ?? a.implementation, text: ASSUMES[a.choice] ?? a.choice }))

  // 型別不合：允許接上、標在那一句（第 16 題）。判決的 reject 也指到同一顆時只留一則
  for (const e of types?.errors ?? []) {
    const nodeId = ownerOf(e.at)
    if (!known.has(nodeId)) { unplaced.error++; notes.push(`有一則型別錯誤對不到積木（${e.reason}）`); continue }
    if (diagnostics.some((d) => d.nodeId === nodeId && d.rule === 'CELLA_REJECT')) continue
    diagnostics.push({ nodeId, severity: 'error', source: 'cella', rule: 'TYPE_MISMATCH', params: { reason: e.reason } })
  }
  return { diagnostics, notes, assumes, unplaced }
}
