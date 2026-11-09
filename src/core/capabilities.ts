/**
 * **語意的能力**——核心只認這一層，實作（提供者）在外面（spec 179，重構階段 1）。
 *
 * ## 為什麼
 *
 * 使用者 2026-10-31：降級路徑「應該是有系統的，且不混雜的，方便未來深嵌入完成之後替換過去」。
 * ⟹ 核心與介面**不認得任何一個實作**：它問「誰給執行？」，登錄表答「第一個宣告了它的那個」。
 * 切換到 Cella 那天（階段 6）是**拿掉一個提供者**，不是在核心裡到處拔。
 *
 * 與 `core/execution.ts` 同一條判準：**核心宣告角色，實作在外面**——直譯器是第一個實作，不是擁有者。
 *
 * ## 四項能力
 *
 * ```
 * verdict   這支程式對不對、為什麼（階段 5：Cella）
 * types     這個槽放得進什麼（階段 5：Cella）
 * session   跑、停、看變數、改輸入（今天：JS 直譯器；階段 5：Cella 的除錯工作階段）
 * steps     一步 ＝ 進入帶標籤的節點一次（雙方同意的定義）
 * ```
 *
 * ⚠️ 結果**一律**帶出處與缺項（P6 誠實降級：「必須可見」）——沒有提供者時不回 undefined。
 * 設計：`knowledge/draft/2026-10-31-重構的設計-能力介面與降級路徑.md`。
 */
import type { SemanticNode, BoardPinModel } from './types'
import type { Verdict, TypeQuery } from './verdict-diagnostics'
import type { HardwareState, HardwareRecord } from './hardware'

/** 四項能力，加上執行與除錯的兩個細節（缺了也要說得出來）。 */
export type CapabilityName = 'verdict' | 'types' | 'session' | 'steps'
export type Missing = CapabilityName | 'setInput' | 'setVariable' | 'stepping' | 'interactiveInput'

/** 執行與除錯的細節——照盟約第 4 條：粒度、`setInput` 與 `setVariable` 分開、給不給步數。 */
export interface SessionDetails {
  granularity: 'statement' | 'node'
  /** 改環境輸入（硬體的腳位、感測器）。 */
  setInput: boolean
  /** 改變數。 */
  setVariable: boolean
  steps: boolean
  /**
   * 能停下來：中斷點、單步（`stepIn`、`stopOnEntry`）、停著時看變數與 `terminate`（spec 210；cos-mos 階段 3 的宿主第一版只能一路跑到底）。
   * 沒有的話「除錯／單步／動畫」模式會照實說、改成直接跑完。
   */
  stepping: boolean
  /** 能在讀輸入時停下來等（`stopped(awaiting-input)` → `supplyInput`／`closeInput`）。沒有的話輸入要事先給完（批次）。 */
  interactiveInput: boolean
  /**
   * 跑完交得出這一次的板子紀錄（`ExecutionSession.hardware()`；spec 211，cos-mos 狀態流頻道 (b)）。
   * 沒有的話硬體分頁照舊畫判決順手給的那一份（Cella 今天是這樣）。
   */
  hardware: boolean
}

/** 程式的輸出走哪一條（cos-mos `console.wit` 的 `enum output`，2026-11-04 定案）。判題只看 stdout。 */
export type OutputStream = 'stdout' | 'stderr'

export interface CapabilityDeclaration {
  session?: SessionDetails
  verdict?: true
  types?: true
}

/** 這次執行從外面拿到的東西，按發生順序（形狀與直譯器的 `ExecutionInput` 相同）。 */
export type SessionInput =
  | { kind: 'stdin'; value: string }
  | { kind: 'set-variable'; name: string; value: string }
  /** 暫停時改了板子的輸入（感測器等，spec 185）。 */
  | { kind: 'set-input'; key: string; value: string }
  | { kind: 'pause-decision'; decision: 'continue' | 'stop' }

/**
 * 停下來的原因（DAP 的 `stopped` 事件；spec 183 R1）。
 * `unknown-component` 是 JS 直譯器才有的（跑到它認不得的東西，由宿主決定繼續或停止）。
 */
export type StopReason = 'entry' | 'breakpoint' | 'step' | 'pause' | 'awaiting-input' | 'unknown-component'

export interface Stop {
  reason: StopReason
  /** 停在哪一顆（語義樹的 id）；不知道時是 null。 */
  nodeId: string | null
  detail?: Record<string, string>
}

/**
 * 一個指令的結果：停在某處（等下一個指令）、跑完了、或停不下去了。
 * 未定義行為、未捕捉的例外、執行期錯誤、被停止，都是 `failed`——帶核心認得的 `SessionStop`。
 */
export type Outcome =
  | { kind: 'stopped'; stop: Stop }
  | { kind: 'ended' }
  | { kind: 'failed'; error: SessionStop }
  /** 只會是 `launch` 的結果：提供者開跑時才發現跑不了（一步也沒有執行）——宿主換下一個提供者。 */
  | { kind: 'declined'; reason: string }

/**
 * **一次執行**——形狀照 DAP（spec 183 R1）：**宿主下指令**，每個指令回一個 `Outcome`。
 *
 * 🔴 在此之前是「直譯器每走一步回呼宿主、宿主決定停不停」——那是 JS 直譯器的形狀。
 *    Cella 的工作階段一步要一次 worker 往返（3.5 ms），保留回呼模型的話「執行」會慢 25 倍
 *    （`tests/probes/cella-dap-cost.test.ts` 量的）。P8：介面換一次，兩個提供者都照新形狀。
 */
export interface ExecutionSession {
  /** 程式印的東西，邊跑邊送；`stream` 沒給是 stdout（spec 210） */
  onOutput(cb: ((text: string, stream?: OutputStream) => void) | null): void
  /** 中斷點：節點 id 的集合（翻譯成行號的是懂「行」的那一端）。執行中也可以改。 */
  setBreakpoints(nodeIds: Iterable<string>): void
  launch(program: SemanticNode, options: { stopOnEntry: boolean }): Promise<Outcome>
  continue(): Promise<Outcome>
  stepIn(): Promise<Outcome>
  /** 停在 `awaiting-input` 時給一行（不含換行由提供者補）；之後照上一個指令繼續（continue 或 stepIn）。 */
  supplyInput(line: string): Promise<Outcome>
  /** 輸入結束（EOF）。 */
  closeInput(): Promise<Outcome>
  /** 執行中要求停下（下一個帶標籤的節點之前停成 `pause`）。 */
  pause(): void
  terminate(): void
  /** 停著的時候，目前看得到的變數。 */
  variables(): { name: string; type: string; value: string }[]
  /** Cella 那一側要一次 worker 往返，所以可以是 Promise。 */
  setVariable(name: string, raw: string): boolean | Promise<boolean>
  /** 停著的時候，板子當下的狀態（spec 185）；不是板子上的程式、或提供者給不出來時是 null。 */
  environment(): HardwareState | null
  /**
   * 停著的時候改板子的輸入（`analog:A0`、`digital:2`……），從下一次讀取開始生效（spec 185）。
   * 只有宣告了 `setInput` 的提供者有。
   */
  setInput?(key: string, value: string): Promise<{ ok: boolean; message?: string }>
  /** 每個節點被進入幾次（步數能力）；給不出來時是 null（結果的 `missing` 帶 `steps`，畫面要說出來）。 */
  coverage(): ReadonlyMap<string, number> | null
  /** `coverage()` 裡迴圈節點的次數算的是什麼（spec 205）：沒寫是 `entries`（進入次數）；Cella 是 `checks`（圈數＋進入次數）。見 `core/iterations.ts` */
  readonly loopCounts?: 'entries' | 'checks'
  /** 這次執行從外面拿到的東西（重現用、插手紀錄）。 */
  recordedInputs(): readonly SessionInput[]
  /**
   * 這一次執行的板子紀錄（spec 211）：跑之前是 null，`ended`／`failed` 之後交出。只有宣告了 `hardware` 的提供者有。
   * 形狀同判決那一路（`core/hardware.ts`）：`changes` 的 `t` 是模擬的毫秒、最多 1000 筆（超過照實標 `truncated`）；`end` 給不出是 null。
   */
  hardware?(): HardwareRecord | null
}

export interface SessionOptions {
  maxSteps: number
  board?: BoardPinModel
  /**
   * 交給「形式化」的提供者（Cella）的那一份：含骨架積木的樹、目標、風格、骨架（與判決的 `CheckRequest` 同一組）。
   * JS 直譯器用不到——它直接跑 `launch` 收到的樹。
   */
  formal?: { tree: SemanticNode; targetId: string; styleId: string; skeletonId: string }
  /**
   * **批次輸入**（2026-11-04，與 cos-mos 定的 (a)）：整段標準輸入，行與行之間 `\n`——與 `CheckRequest.input` 同一個格式，
   * 「換宿主，結果不變」才守得住（判決與執行吃同一份測資）。
   * 缺席 ＝ 沒有輸入（程式一讀就是 EOF），**不是**「等使用者」。
   * 宣告了 `interactiveInput` 的提供者（Cella）可以忽略它、照舊停下來等；有給的話也可以先吃這一份，吃完才停。
   * 🟢 內建的 Cella 提供者**忽略它**：重播時控制器已經把那幾行排進主控台（照常回顯、照常被讀），它再吃一次會重複。
   */
  input?: string
}

/** 一次判決的請求：語義樹（含骨架積木）、目標與風格、輸入。翻成提供者自己的形式（語言、板名）是提供者的事。 */
export interface CheckRequest {
  tree: SemanticNode
  targetId: string
  styleId: string
  /** 骨架隱藏時樹裡沒有進入點（`main`）——提供者照骨架宣告補上。 */
  skeletonId: string
  input: string
  /**
   * 板子的環境輸入（時間序列：`{ t: 毫秒, key: 'digital:2' | 'analog:A0' | …, value }`）——規格消歧的 Arduino 情境用（spec 218）。
   * 省略 ＝ 沒有外部輸入（今天的每一次判決）。
   */
  boardInputs?: readonly { t: number; key: string; value: number }[]
}

/** 判決與型別查詢的答案。`stale`：送出之後又有更新的請求——這一筆的節點可能已經不在，丟掉。 */
export interface CheckAnswer {
  verdict: Verdict | null
  types: TypeQuery | null
  stale: boolean
  /** 這支程式會讀標準輸入——沒有測資時，執行期的問題可能是空輸入的假象（由提供者看它自己的程式形式判斷）。 */
  readsInput: boolean
  /**
   * **在這份輸入上觀察到的型別**（spec 225）——不寫型別的語言（Python）要換成要寫型別的語言時用；鍵是節點 id。
   * `basis`：每一格是觀察到的、還是這份輸入下沒跑到。提供者給不出（語言不是這一類、或版本還沒有）就沒有這一格。
   */
  observed?: { nodes: Readonly<Record<string, string>>; basis: Readonly<Record<string, 'observed' | 'unreached'>> } | null
}

/** 提供者的就緒狀態（昂貴的提供者要先載入；狀態列照這個顯示）。 */
export type Readiness = { state: 'idle' | 'loading' | 'ready' } | { state: 'unavailable'; reason: string }

/** 這次不接（翻不出來、還沒就緒、無法使用）——說得出原因，登錄表往下找下一個（spec 183 R3）。 */
/** 不接：原因，以及（翻不出時）卡在哪一顆節點——畫面要指得到那一行（spec 205 T013） */
export interface Declined {
  declined: string
  nodeId?: string
  /**
   * **還在準備，等一下就會好**（暖機中、除錯模組還在下載；spec 205 T003）——呼叫端可以顯示「準備中」再試，而不是當成跑不了。
   * 沒有這一格＝這一支這個提供者就是接不了（翻不出、這個語言沒有、無法使用）。
   */
  pending?: true
}

export interface Provider {
  id: string
  declares: CapabilityDeclaration
  /** `program` 讓提供者判斷這一支它跑不跑得了；跑不了回 `Declined`。 */
  createSession?(options: SessionOptions, program: SemanticNode): ExecutionSession | Declined
  /** `verdict`／`types`：判決與型別查詢一起回（同一次翻譯、同一次載入）。 */
  check?(req: CheckRequest): Promise<CheckAnswer>
  /** 這個語言判得了嗎（判決只有某些語言的套件）——不宣告就當成都可以。 */
  supports?(language: string): boolean
  readiness?(): Readiness
  onReadiness?(cb: (r: Readiness) => void): void
  /** 開始載入（宿主在閒置時呼叫；不呼叫就等第一次 `check`）。 */
  warmUp?(): void
}

/**
 * **執行停下來的原因**——控制器只認這一種，不認任何提供者自己的錯誤型別。
 * `aborted` 是使用者按了停止；`runtime` 是程式在執行中出了事（i18n 鍵與參數交給介面組訊息）。
 */
export class SessionStop extends Error {
  readonly kind: 'aborted' | 'runtime'
  readonly i18nKey: string
  readonly params: Record<string, string>
  readonly nodeId: string | null

  constructor(kind: 'aborted' | 'runtime', i18nKey: string, params: Record<string, string> = {}, nodeId: string | null = null) {
    super(i18nKey)
    this.name = 'SessionStop'
    this.kind = kind
    this.i18nKey = i18nKey
    this.params = params
    this.nodeId = nodeId
  }
}

/** 帶出處與缺項的答案。沒有提供者時 `provider` 是 null，而 `missing` 說得出缺哪一項。 */
export interface Provided {
  provider: Provider | null
  provenance: string | null
  missing: Missing[]
}

const registry: Provider[] = []

/** 組裝點呼叫——**有序**：先登記的優先。同一個身分只登記一次。 */
export function registerProvider(p: Provider, options: { first?: boolean } = {}): void {
  if (registry.some((r) => r.id === p.id)) return
  // `first`：排到最前面——宿主的入口才知道有沒有這個提供者（網頁版有 Cella、擴充還沒有），而它要排在共用組裝點登記的那些之前
  if (options.first) registry.unshift(p)
  else registry.push(p)
}

/** ⚠️ 只給測試用。 */
export function resetProvidersForTest(): void {
  registry.length = 0
}

function declares(p: Provider, cap: CapabilityName): boolean {
  if (cap === 'steps') return p.declares.session?.steps === true
  return Boolean(p.declares[cap])
}

/** 這項能力由誰給——登錄表裡第一個宣告了它的提供者。 */
export function provide(cap: CapabilityName): Provided {
  const p = registry.find((r) => declares(r, cap))
  if (!p) return { provider: null, provenance: null, missing: [cap] }
  const missing: Missing[] = []
  const s = p.declares.session
  if (cap === 'session' && s) {
    if (!s.steps) missing.push('steps')
    if (!s.setVariable) missing.push('setVariable')
    if (!s.setInput) missing.push('setInput')
    if (!s.stepping) missing.push('stepping')
    if (!s.interactiveInput) missing.push('interactiveInput')
  }
  return { provider: p, provenance: p.id, missing }
}

/** 開一次執行的結果：誰接了、前面誰不接以及為什麼（畫面要說得出來，P6）。 */
export interface OpenedSession {
  session: ExecutionSession | null
  provenance: string | null
  declined: { provider: string; reason: string; nodeId?: string; pending?: true }[]
  missing: Missing[]
}

/**
 * **開一次執行**（spec 183 R3）——照登錄順序問每個宣告了 `session` 的提供者；不接的記下原因、往下找。
 * 6c-3 T008 之後只有 Cella：還沒就緒時回 `pending`（呼叫端顯示「準備中」再試）；翻不出來時照實說，沒有退路（`declined` 說得出為什麼）。
 */
export function openSession(options: SessionOptions, program: SemanticNode, skip: ReadonlySet<string> = new Set()): OpenedSession {
  const declined: OpenedSession['declined'] = []
  for (const p of registry) {
    if (!p.declares.session || !p.createSession || skip.has(p.id)) continue
    const s = p.createSession(options, program)
    if ('declined' in s) { declined.push({ provider: p.id, reason: s.declined, ...(s.nodeId ? { nodeId: s.nodeId } : {}), ...(s.pending ? { pending: true as const } : {}) }); continue }
    const d = p.declares.session
    const missing: Missing[] = []
    if (!d.steps) missing.push('steps')
    if (!d.setVariable) missing.push('setVariable')
    if (!d.setInput) missing.push('setInput')
    if (!d.stepping) missing.push('stepping')
    if (!d.interactiveInput) missing.push('interactiveInput')
    return { session: s, provenance: p.id, declined, missing }
  }
  return { session: null, provenance: null, declined, missing: ['session'] }
}
