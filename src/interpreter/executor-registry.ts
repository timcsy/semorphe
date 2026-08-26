import type { SemanticNode } from '../core/types'
import type { BoardPinModel } from '../core/types'
import type { RuntimeValue, FunctionDef } from './types'
import type { Scope } from './scope'
import type { IOSystem } from './io'

/**
 * ExecutionContext — passed to each executor, wraps interpreter internal state.
 */
export interface ExecutionContext {
  /**
   * **「我認不出這一段」——停在這裡，讓人看得到、改得動，然後決定。**
   *
   * 🔴 由**元件自己**呼叫，不是核心猜。`raw_code` 裝的是辨識不出來的文字，
   * 而「那是認不出來的文字」這件事是**它的知識**，不是核心的
   * （`concepts/宣告登記處.md`：核心讀宣告，不重新認識語言）。
   *
   * 回 `'stop'` 時呼叫端照原樣丟錯；回 `'continue'` 表示
   * **人看過狀態、也改過了，決定讓這一行不執行**。
   *
   * ⚠️ **沒有宿主時它回 `'stop'`**——沒有人可以問的時候，正確處置是停止。
   */
  pauseForUnrecognized?: (label: string, nodeId: string | null) => Promise<'continue' | 'stop'>
  /**
   * 這一次執行是在哪一塊板子上（spec 145）。
   *
   * ⚠️ **省略 ＝ 這個目標沒有板子**（`cpp`／`c`／競程）——
   * 腳位那條路本來就不會被走到，而走到時退回預設（Uno）。
   * 🔴 消費者一律走 `boardIn(ctx)`，不自己查目標。
   */
  board?: BoardPinModel
  scope: Scope
  io: IOSystem
  functions: Map<string, FunctionDef>
  pointerTargets: Map<string, Scope>
  /** 結構／類別的型別登記處——見 `struct-types.ts` */
  structs: import('./struct-types').StructRegistry
  /**
   * 「這個值可不可以呼叫」與「怎麼呼叫它」——由**語言套件**安裝。
   *
   * 核心的 `func_call` 只需要知道「名字指向的東西可不可以呼叫」，
   * 而**什麼算可呼叫、捕捉語意怎麼實現**是語言套件的知識。
   * 沒安裝時兩個都是 undefined，行為與加入本機制之前完全相同。
   */
  /**
   * 一個作用域即將被丟棄——由**語言套件**安裝。
   *
   * 核心知道「作用域結束了」，但不知道**結束時該做什麼**（C++ 要跑解構式，
   * 別的語言可能什麼都不做）。沒安裝時行為與加入本機制之前完全相同。
   */
  onScopeExit?: (own: Map<string, RuntimeValue>) => Promise<void>
  /** 離開一個作用域：先收尾，再還原。**每個建立作用域的地方都要走這裡** */
  exitScope(inner: Scope, outer: Scope): Promise<void>
  callableOf?: (v: RuntimeValue) => unknown | null
  invokeCallable?: (c: unknown, args: SemanticNode[]) => Promise<RuntimeValue | void>
  scanfTokenBuffer: string[]
  executeNode(node: SemanticNode): Promise<RuntimeValue | void>
  executeBody(nodes: SemanticNode[]): Promise<void>
  evaluate(node: SemanticNode): Promise<RuntimeValue>
  countStep(): Promise<void>
  toBool(val: RuntimeValue): boolean
  toNumber(val: RuntimeValue): number
  coerceType(val: RuntimeValue, targetType: string): RuntimeValue
  /** Await input from provider with abort support. Returns null on EOF. */
  awaitInput(): Promise<string | null>
  /** Read a cin token (whitespace-delimited) from buffer or IO */
  readCinToken(): string | null
  /**
   * `cin` 是不是已經進入失敗狀態（C++ 的 `failbit`）。
   *
   * 🔴 **它會黏住**：`>>` 一旦失敗，之後每一次 `>>` 都立刻失敗，直到 `clear()`。
   * 沒有這個狀態的話，「回 0」同時是合法的回傳值與失敗的代號，
   * **而那時「它到底失敗了沒有」在程式裡沒有地方可以問**。
   */
  cinFailed: boolean
  /** 把 `cin` 設成失敗狀態。今天沒有 `cin.clear()` 元件，所以它只進不出——**真 C++ 也是**。 */
  failCin(): void
  /** Read a scanf token from buffer or IO */
  readScanfToken(): string | null
}

/**
 * Unified executor signature.
 */
export type ComponentExecutor = (node: SemanticNode, ctx: ExecutionContext) => Promise<RuntimeValue | void>

/**
 * Registry for component executors.
 */
export class ComponentExecutorRegistry {
  private executors = new Map<string, ComponentExecutor>()
  /** 同一概念被註冊幾次。>1 代表勝負由載入順序決定，而那個順序不是任何人設計的 */
  private registrationCount = new Map<string, number>()

  register(component: string, executor: ComponentExecutor): void {
    this.registrationCount.set(component, (this.registrationCount.get(component) ?? 0) + 1)
    this.executors.set(component, executor)
  }

  /**
   * 被註冊超過一次的概念。
   *
   * **不在註冊時報錯**——那會讓既有的載入順序相依一次炸開。這裡只讓它可見，
   * 逐一消除排在後面。見 knowledge/history/017（加嚴之前先回答「被拒絕的
   * 東西去哪了」，而這裡的答案目前是「不知道」）。
   */
  duplicates(): { component: string; count: number }[] {
    return [...this.registrationCount.entries()]
      .filter(([, n]) => n > 1)
      .map(([component, count]) => ({ component, count }))
      .sort((a, b) => b.count - a.count || a.component.localeCompare(b.component))
  }

  registerAll(map: Record<string, ComponentExecutor>): void {
    for (const [component, executor] of Object.entries(map)) {
      this.executors.set(component, executor)
    }
  }

  get(component: string): ComponentExecutor | undefined {
    return this.executors.get(component)
  }

  has(component: string): boolean {
    return this.executors.has(component)
  }

  /** 目前認得的所有概念。搬移用的清冊靠它——集合比對漏一個會現形，輸出比對不會 */
  list(): string[] {
    return [...this.executors.keys()].sort()
  }

  /**
   * 有沒有任何語言套件推過執行器。
   *
   * 用來分辨「這個概念真的沒人實作」與「語言套件根本沒載入」——後者的錯誤
   * 訊息若只說「未知概念」，看不出真正的原因。
   *
   * **判準是註冊表空不空，不是概念名長得像什麼**——後者會讓核心重新認識語言。
   */
  hasAnyExecutor(): boolean {
    return this.executors.size > 0
  }
}
