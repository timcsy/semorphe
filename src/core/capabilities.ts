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
import type { StepInfo } from './execution'

/** 四項能力，加上執行與除錯的兩個細節（缺了也要說得出來）。 */
export type CapabilityName = 'verdict' | 'types' | 'session' | 'steps'
export type Missing = CapabilityName | 'setInput' | 'setVariable'

/** 執行與除錯的細節——照盟約第 4 條：粒度、`setInput` 與 `setVariable` 分開、給不給步數。 */
export interface SessionDetails {
  granularity: 'statement' | 'node'
  /** 改環境輸入（硬體的腳位、感測器）。 */
  setInput: boolean
  /** 改變數。 */
  setVariable: boolean
  steps: boolean
}

export interface CapabilityDeclaration {
  session?: SessionDetails
  verdict?: true
  types?: true
}

/** 這次執行從外面拿到的東西，按發生順序（形狀與直譯器的 `ExecutionInput` 相同）。 */
export type SessionInput =
  | { kind: 'stdin'; value: string }
  | { kind: 'set-variable'; name: string; value: string }
  | { kind: 'pause-decision'; decision: 'continue' | 'stop' }

/**
 * **一次執行**——名字照 DAP 的語彙，但只放今天介面真的用到的事（簡約；階段 5 接 Cella 時再長）。
 */
export interface ExecutionSession {
  onOutput(cb: ((text: string) => void) | null): void
  onWaiting(cb: ((nodeId: string | null) => void) | null): void
  onStepRecord(cb: ((step: StepInfo) => Promise<void>) | null): void
  setInputProvider(provider: (() => Promise<string>) | null): void
  /** 停在認不得的東西上時，由宿主決定繼續或停止。 */
  setUnknownPause(fn: ((component: string, nodeId: string | null) => Promise<'continue' | 'stop'>) | null): void
  setRecordSteps(enabled: boolean): void
  run(program: SemanticNode): Promise<void>
  runWithSteps(program: SemanticNode): Promise<StepInfo[]>
  abort(): void
  scope(): { name: string; type: string; value: string }[]
  setVariable(name: string, raw: string): boolean
  /** 步數能力：每個節點被進入幾次。 */
  visitCounts(): ReadonlyMap<string, number>
  recordedInputs(): readonly SessionInput[]
}

export interface SessionOptions {
  maxSteps: number
  board?: BoardPinModel
}

export interface Provider {
  id: string
  declares: CapabilityDeclaration
  createSession?(options: SessionOptions): ExecutionSession
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
export function registerProvider(p: Provider): void {
  if (registry.some((r) => r.id === p.id)) return
  registry.push(p)
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
  }
  return { provider: p, provenance: p.id, missing }
}
