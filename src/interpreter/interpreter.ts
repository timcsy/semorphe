import { StructRegistry } from './struct-types'
import type { BoardPinModel } from '../core/types'
import type { SemanticNode } from '../core/types'
import { isSkipped, hasAnnotation, declareSkips, declareAnnotations } from '../core/skip-declarations'
import { allLanguageExecutors, allBuiltinConstants, isBuiltinName } from '../core/language-executors'
import { universalComponents } from '../core/universal'
import type { RuntimeValue, FunctionDef, ExecutionStatus, StepInfo } from './types'
import { defaultValue, valueToString, parseInputValue } from './types'
import type { ExecutionInput } from './types'
import { RuntimeError, RUNTIME_ERRORS } from './errors'
import { Scope } from './scope'
import { IOSystem } from './io'
import { ComponentExecutorRegistry, type ExecutionContext } from './executor-registry'
import { registerMutationExecutors } from './executors/mutations'

interface InterpreterOptions {
  maxSteps?: number
  /** 這一次執行在哪一塊板子上（spec 145）。⚠️ 省略 ＝ 沒有板子。 */
  board?: BoardPinModel
}

/** universal 概念的宣告與標註——只載入一次 */
let universalLoaded = false
function loadUniversalDeclarations(): void {
  if (universalLoaded) return
  universalLoaded = true
  for (const c of universalComponents as unknown as {
    componentId: string
    skipReasons?: Record<string, string>
    annotations?: Record<string, unknown>
  }[]) {
    if (c.skipReasons && Object.keys(c.skipReasons).length > 0) {
      declareSkips(c.componentId, c.skipReasons as never)
    }
    if (c.annotations && Object.keys(c.annotations).length > 0) {
      declareAnnotations(c.componentId, c.annotations)
    }
  }
}

export class SemanticInterpreter implements ExecutionContext {
  scope: Scope = new Scope()
  io: IOSystem = new IOSystem()
  functions = new Map<string, FunctionDef>()
  pointerTargets = new Map<string, Scope>()
  /** 結構／類別的型別登記處。**每個實例一份**——全域的話結構會漏到下一個測試 */
  structs = new StructRegistry()
  /** 作用域結束時該做什麼——語言套件安裝（見 executor-registry 的說明） */
  onScopeExit?: (own: Map<string, RuntimeValue>) => Promise<void>
  callableOf?: (v: RuntimeValue) => unknown | null
  invokeCallable?: (c: unknown, args: SemanticNode[]) => Promise<RuntimeValue | void>
  scanfTokenBuffer: string[] = []
  /** C++ 的 `failbit`——見 `ExecutionContext.cinFailed` 的說明。 */
  cinFailed = false
  private status: ExecutionStatus = 'idle'
  private steps = 0
  private maxSteps: number
  /** 這一次執行在哪一塊板子上——⚠️ **公開**，因為直譯器自己就是 `ExecutionContext`。 */
  board?: BoardPinModel
  private stepRecords: StepInfo[] = []
  private recordSteps = false
  /** 這一次執行到過的節點 id——⚠️ 每次 `execute` 開頭清空，見 `getVisitedNodes`。 */
  /**
   * **這一次執行，每一顆節點被走過幾次。**
   *
   * 🔴 從 `Set` 換成 `Map` 是為了「迴圈跑了幾次」（2026-09-04）——而
   * **這裡不知道誰是迴圈**（那是元件的知識，核心不重新認識語言）。
   * 它只記次數；「哪一塊是重複器」由**看得到結構的那一側**推
   * （見 `BlocklyPanel.markIterations`：**一個孩子跑得比自己多的積木**）。
   *
   * > **要說出「迴圈跑了幾次」，核心不必認得迴圈——
   * > 它只要誠實地數，讓看得到結構的人去比。**
   */
  private visitCounts = new Map<string, number>()
  private inputProvider: (() => Promise<string>) | null = null
  private outputCallback: ((text: string) => void) | null = null
  private aborted = false
  private abortReject: ((reason: RuntimeError) => void) | null = null
  private waitingCallback: ((nodeId: string | null) => void) | null = null
  /**
   * **這次執行從外面拿到的東西**，按發生順序。見 `types.ts` 的 `ExecutionInput`。
   * ⚠️ 它是**唯一**讓一次執行重現得出來的東西——沒有它，
   * 一個有人介入過的執行與一個沒有的長得一模一樣。
   */
  private recordedInputs: ExecutionInput[] = []
  /** 重播中要照著吃的那份紀錄；`null` ＝ 這是一次新的執行。 */
  private replayInputs: ExecutionInput[] | null = null
  private replayIndex = 0
  private unknownComponentPause:
    | ((component: string, nodeId: string | null) => Promise<'continue' | 'stop'>)
    | null = null
  private stepRecordCallback: ((step: StepInfo) => Promise<void>) | null = null
  private currentNode: SemanticNode | null = null
  private executorRegistry: ComponentExecutorRegistry

  constructor(options: InterpreterOptions = {
}) {
    this.maxSteps = options.maxSteps ?? 100000
    this.board = options.board
    // universal 概念是核心自己的資料（中立性護欄明確排除 universal 層），
    // 所以核心可以自行載入它們的宣告與標註。語言專屬的那些由語言套件推進來。
    loadUniversalDeclarations()
    this.executorRegistry = new ComponentExecutorRegistry()
    const reg = (component: string, executor: import('./executor-registry').ComponentExecutor) =>
      this.executorRegistry.register(component, executor)
    registerMutationExecutors(reg)
    // 🔴 **降級節點跑到時要說人話**（2026-08-22）。
    //
    // `unresolved`（子節點認得出、外層認不出）沒有執行器，於是它掉進
    // 「未知概念」那條路，而使用者看到的是
    // `RUNTIME_ERR_UNKNOWN_COMPONENT: {"component":"unresolved"}`
    // ——一個我們的內部詞彙。而同族的 `raw_code` 說的是
    // 「這一段程式我看不懂，所以沒有辦法執行它」。
    //
    // > **「未知概念」與「宣告過的降級」是兩件事：前者代表這個系統壞了，
    // > 後者代表這一段我們誠實地認不出來——而它們不該長得一樣。**
    reg('unresolved', async (node) => {
      const src = String(node.metadata?.rawCode ?? '').split('\n')[0].slice(0, 60)
      const label = src || String(node.properties?.node_type ?? '(不明)')
      // 🔴 **它也要停**（2026-08-26）。⚠️ 而它是這一族的**第三個**註冊點——
      //    前兩個是 `components/{cpp,python}/raw_code/execute.ts`，
      //    而**實測樹裡出現的是這一顆**（外層認不出、子節點認得出）：
      //    `asm volatile("nop")` 產出的是 `unresolved`，`raw_code` 是它的子節點。
      //
      //    > **一族三個註冊點，改了兩個而漏掉的那一個，正好是真實語料唯一會走的。**
      //
      //    抓到它的不是型別檢查也不是測試，是**開瀏覽器貼一段真的程式**。
      if (await this.pauseForUnrecognized(label, node.id ?? null) === 'continue') return
      throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': label })
    })


    // cstdlib functions

    // cctype 的四個字元分類函式已搬進 `languages/cpp/std/cctype/executors.ts`。
    //
    // ⚠️ 它們原本寫成**裸的物件鍵**（`cpp_char_is_alpha:` 而非 `'cpp_char_is_alpha'`），
    // 而中立性護欄只比對引號字串字面——**一筆都沒數到**。那條護欄的「0」
    // 因此不完整；同一維度的不同書寫形式也會漏掉。

    // swap

    // ⚠️ 「執行不了」的那兩類概念已搬進語言套件
    // （`languages/cpp/core/executors/unimplemented.ts`）——看不懂的兜底容器
    // （執行到就出聲，不靜靜略過）與未實作的物件導向（十個空操作）。
    //
    // **那是「搬」不是「宣告」。** 那十個仍然是殼，完備性護欄照樣數它們；
    // 搬移只改變了住處，沒有改變任何一個判定。它們**不得**取得 `skipPaths`
    // 宣告——見 history/018「拿判準當藉口，把缺陷洗成設計」。
    //
    // `cpp_include_local` 曾在同一份清單裡，但它有真的宣告（components.json
    // 的 `skipPaths: ['execute']`），而下面的 `isSkipped` 會讀它。那一筆是
    // 053 之後的殘留，已刪除——不是搬過去。

    // algorithm components — noop for sort/reverse/fill (operate on containers, not interpreter values)

    // min/max — evaluate children and return the smaller/larger

    // stdlib advanced expressions

    // ⚠️ **這一段必須在建構式的最後。**
    //
    // 語言套件對**自己的概念**有最終發言權。放在前面的話，核心層後面那些
    // 佔位用的空操作會把語言的真實作蓋掉——這個專案已經被同一件事咬過三次
    // （`static_cast` 輸出 void、四個轉型被清單覆蓋、條件編譯的 body 不跑）。
    //
    // 註冊表是「後註冊的贏」，所以順序就是優先權。見 knowledge/history/020。
    for (const { component, executor } of allLanguageExecutors()) reg(component, executor as never)
  }

  /** Abort execution from outside (e.g., Ctrl+C) */
  abort(): void {
    this.aborted = true
    this.status = 'error'
    if (this.abortReject) {
      this.abortReject(new RuntimeError(RUNTIME_ERRORS.ABORTED))
      this.abortReject = null
    }
  }

  /** Await input provider with abort support. Returns null on EOF (\x04) or if no provider. */
  awaitInput(): Promise<string | null> {
    // 🔴 **重播中直接從紀錄取，不問任何人**（2026-08-26，第七十六條護欄）。
    //    ⚠️ 放在 `inputProvider` 檢查【之前】：一次重播不需要宿主，
    //    而那正是「跑得起來的重播」與「重跑」的差別。
    const replayed = this.nextReplay('stdin')
    if (replayed) return Promise.resolve(replayed.value)
    if (!this.inputProvider) return Promise.resolve(null)
    if (this.aborted) return Promise.reject(new RuntimeError(RUNTIME_ERRORS.ABORTED))
    this.waitingCallback?.(this.currentNode?.id ?? null)
    return new Promise<string | null>((resolve, reject) => {
      this.abortReject = reject
      this.inputProvider!().then(val => {
        this.abortReject = null
        if (val === '\x04') resolve(null)
        else {
          // 🔴 **記下來**——沒有這一行，這次執行重現不出來。
          this.recordedInputs.push({ kind: 'stdin', value: val })
          resolve(val)
        }
      }, reject)
    })
  }

  /** Register a callback fired when interpreter is waiting (e.g., for input) */
  setWaitingCallback(callback: ((nodeId: string | null) => void) | null): void {
    this.waitingCallback = callback
  }

  /** Register an async callback fired after each step is recorded (for real-time animation) */
  setStepRecordCallback(callback: ((step: StepInfo) => Promise<void>) | null): void {
    this.stepRecordCallback = callback
  }

  /**
   * **碰到沒看過的東西時，把決定權交給宿主——而宿主要先讓人【看得到狀態】。**
   *
   * 使用者 2026-08-26 逐字：
   * 「這不能直接跑，而是跑到那邊**要有斷點**，讓使用者**調整完狀態**才能繼續跑下去，
   *  或是**直接停止**」。
   *
   * ## ⚠️ 這【不是】那個被拿掉的 `'skip'` 換一個字
   *
   * ```
   * 舊的 'skip'   一個 confirm() 問「要不要跳過」   看不到狀態 · 改不了狀態 · 一個對話框
   * 現在          【停在那一行】                     看得到停在哪 · 看得到變數 · 改得動它們
   * ```
   *
   * > **差別不在那個回答叫什麼，在回答的人有沒有被給到判斷的依據。**
   *
   * 🔴 **沒有註冊宿主時仍然丟錯**——一個沒有 UI 的宿主（Node、測試、
   * `examples/bring-your-own-view/`）沒有人可以問，而「沒有人可以問」的
   * 正確處置是停止，不是繼續。
   */
  setUnknownComponentPause(
    fn: ((component: string, nodeId: string | null) => Promise<'continue' | 'stop'>) | null,
  ): void {
    this.unknownComponentPause = fn
  }

  /**
   * **元件說「我認不出這一段」時走的那條路**（`ExecutionContext` 的那一格）。
   *
   * 🔴 它與未知元件走**同一個宿主鉤子**，因為對使用者來說是同一件事：
   * 「有一行我不會跑，先停在這裡」。差別只在**誰發現的**——
   * 未知元件是核心發現的，這一條是元件自己說的。
   *
   * ⚠️ **沒有宿主就回 `'stop'`**：沒有人可以問時，正確處置是停止。
   */
  pauseForUnrecognized = async (label: string, nodeId: string | null): Promise<'continue' | 'stop'> => {
    // 🔴 **重播中照紀錄走**：先把當時改過的狀態套回去，再照當時的決定。
    //    ⚠️ 順序不可反——決定是在那些改動【之後】做的。
    if (this.replayInputs) {
      for (let e = this.nextReplay('set-variable'); e; e = this.nextReplay('set-variable')) {
        this.applyVariable(e.name, e.value)
      }
      const decided = this.nextReplay('pause-decision')
      if (decided) return decided.decision
    }
    if (!this.unknownComponentPause) return 'stop'
    const decision = await this.unknownComponentPause(label, nodeId)
    this.recordedInputs.push({ kind: 'pause-decision', decision })
    return decision
  }

  /** 把一個值寫進作用域——記錄與重播共用，**不再記一次**。 */
  private applyVariable(name: string, raw: string): boolean {
    try {
      const current = this.scope.get(name)
      const next = parseInputValue(raw, current.type)
      if (!next) return false
      this.scope.set(name, next)
      return true
    } catch {
      return false
    }
  }

  /**
   * **現在看得到的變數**——暫停時宿主要拿它去畫。
   *
   * 🔴 抽出來是因為**暫停不是一個 step**：`recordStep` 只在標了 `debug_step`
   * 的概念上跑，而「跑到一個看不懂的東西」不在那條路上。
   * 少了這一支，暫停時變數面板是**空的**，而「調整完狀態」就成了一句空話
   * （2026-08-26 開瀏覽器實測抓到——工具列出來了、積木亮了、而變數一列都沒有）。
   */
  snapshotScope(): { name: string; type: string; value: string }[] {
    const out: { name: string; type: string; value: string }[] = []
    for (const [name, val] of this.scope.getAll()) {
      if (isBuiltinName(name)) continue
      out.push({ name, type: val.type, value: valueToString(val) })
    }
    return out
  }

  /**
   * **從宿主改一個執行期變數**——「調整完狀態才能繼續」的那個「調整」。
   *
   * 回傳有沒有真的改到。⚠️ **改不到要說**，不要靜靜失敗：
   * 一個「按了沒反應」的編輯框，比一個唯讀的更糟。
   */
  setVariableFromHost(name: string, raw: string): boolean {
    if (!this.applyVariable(name, raw)) return false
    // 🔴 **記下來**——這一行就是 2026-08-26 那個洞被補起來的地方：
    //    在此之前手填的值直接落進 `scope`，於是同一支程式跑兩次答案不同。
    this.recordedInputs.push({ kind: 'set-variable', name, value: raw })
    return true
  }

  /** 這次執行拿到的外部輸入（按順序）。宿主拿它去重播。 */
  getRecordedInputs(): readonly ExecutionInput[] {
    return this.recordedInputs
  }

  /**
   * **照著一份紀錄重播**——傳 `null` 回到「這是一次新的執行」。
   *
   * ⚠️ 重播時**不問任何人**：`awaitInput` 直接從紀錄取、暫停直接照紀錄的決定走。
   * 🔴 而紀錄用完之後就**回到會問人**——一份短的紀錄不該讓後面的執行變成不可判定。
   */
  setReplayInputs(inputs: readonly ExecutionInput[] | null): void {
    this.replayInputs = inputs ? [...inputs] : null
    this.replayIndex = 0
  }

  /** 重播時取下一筆；不是重播、或紀錄用完了就回 `null`。 */
  private nextReplay<K extends ExecutionInput['kind']>(kind: K): Extract<ExecutionInput, { kind: K }> | null {
    if (!this.replayInputs) return null
    const next = this.replayInputs[this.replayIndex]
    if (!next || next.kind !== kind) return null
    this.replayIndex++
    return next as Extract<ExecutionInput, { kind: K }>
  }

  setInputProvider(provider: (() => Promise<string>) | null): void {
    this.inputProvider = provider
  }

  /** Register a callback for real-time output (called on each write/newline) */
  setOutputCallback(callback: ((text: string) => void) | null): void {
    this.outputCallback = callback
    this.io.onOutput(callback)

  }

  /**
   * **這一次執行到過哪些節點。**
   *
   * 🔴 「沒到過」不等於「錯」——一個 `if` 的另一支本來就可能不該跑。
   * 所以這份資料的用途是**問一句**（「這 3 塊沒跑到，是故意的嗎？」），
   * 不是判對錯。
   */
  getVisitedNodes(): ReadonlySet<string> {
    return new Set(this.visitCounts.keys())
  }

  /**
   * **每一顆節點被走過幾次**——「迴圈跑了幾次」的原料。
   *
   * ⚠️ 迴圈**自己**的次數是 1（`executeNode` 對那顆 `while` 只呼叫一次），
   * 而它**身體裡**的那幾句是 N。所以「跑了幾次」是**孩子比自己多出來的倍數**，
   * 不是這裡任何一個數字本身。
   */
  getVisitCounts(): ReadonlyMap<string, number> {
    return this.visitCounts
  }

  async execute(program: SemanticNode, stdin: string[] = []): Promise<void> {
    // ⚠️ **每一次開跑都要清**——不清的話第二次執行會把第一次到過的算進去，
    //    而那個 bug 的樣子是「沒跑到的積木越來越少」，看起來像是自己好了。
    this.visitCounts.clear()
    this.scope = new Scope()
    this.io = new IOSystem(stdin)
    if (this.outputCallback) this.io.onOutput(this.outputCallback)
    this.functions = new Map()
    this.steps = 0
    this.status = 'running'
    this.aborted = false
    this.abortReject = null

    this.scanfTokenBuffer = []
    this.cinFailed = false

    // Built-in C/C++ constants — declare subset needed for scope-based lookup
    for (const [name, val] of allBuiltinConstants()) {
      this.scope.declare(name, { type: val.type, value: val.value })
    }

    try {
      await this.executeNode(program)
      this.status = 'completed'
    } catch (e) {
      if (e instanceof RuntimeError) {
        this.status = 'error'
        throw e
      }
      throw e
    }
  }

  getState(): { status: ExecutionStatus } {
    return { status: this.status }
  }

  getOutput(): string[] {
    return this.io.getOutput()
  }

  getScope(): Scope {
    return this.scope
  }

  /** Enable or disable step recording */
  setRecordSteps(enabled: boolean): void {
    this.recordSteps = enabled
  }

  /** Execute with step recording for replay-based stepping */
  async executeWithSteps(program: SemanticNode, stdin: string[] = []): Promise<StepInfo[]> {
    this.stepRecords = []
    this.recordSteps = true
    await this.execute(program, stdin)
    this.recordSteps = false
    return [...this.stepRecords]
  }

  getStepRecords(): StepInfo[] {
    return [...this.stepRecords]
  }

  reset(): void {
    this.scope = new Scope()
    this.io.reset()
    this.functions = new Map()
    this.steps = 0
    this.status = 'idle'
    this.stepRecords = []
    this.recordSteps = false
  }

  // --- ExecutionContext implementation ---

  /**
   * 查詢某個概念有沒有註冊 executor。**唯讀、零行為改動。**
   *
   * 給完備性護欄用（specs/049-audit-guardrails）。若不開這個查詢，護欄就得
   * 在測試裡複製一份 executor 註冊清單——那會立刻長成第二個真相源，
   * 正是本專案頭號病灶。
   */
  getExecutor(component: string): ((node: SemanticNode, ctx: ExecutionContext) => unknown) | undefined {
    return this.executorRegistry.get(component)
  }

  /** 被註冊超過一次的概念——勝負由載入順序決定的那些 */
  duplicateRegistrations(): { component: string; count: number }[] {
    return this.executorRegistry.duplicates()
  }

  async executeNode(node: SemanticNode): Promise<RuntimeValue | void> {
    await this.countStep()
    this.currentNode = node
    // 🔴 **這一次跑到了誰**——執行覆蓋（2026-09-04）。
    //
    //    初學者的 bug 有壓倒性的比例是這兩種：**這一段從來沒跑到**、
    //    **跑的次數不對**。而 `executeNode` 是每一顆節點的唯一漏斗，
    //    所以記在這裡是最便宜的：一次 `Set.add`，沒有新的回呼、沒有匯流排流量。
    //
    // ⚠️ 它**不是**除錯的步進紀錄（那一份要 `debug_step` 標註、要快照作用域，
    //    而且只在除錯模式開著）。覆蓋要的只是「有沒有到過」。
    if (node.id !== undefined) this.visitCounts.set(node.id, (this.visitCounts.get(node.id) ?? 0) + 1)
    const component = node.componentId

    const executor = this.executorRegistry.get(component)
    if (executor) {
      // ── 概念自己宣告「我引入一個作用域」，核心讀它
      //
      // `introduces_scope` 這個標註**存在，而沒有任何東西在讀它**——那是
      // `components/執行機構.md`「機制有了，沒人接上」講的形狀，而這裡藏的是
      // 一個真的語義錯誤：分支裡宣告的變數會外洩到外層。
      //
      // 寫死「if 和 if_else 要建子作用域」也能修，但那會是**第三份**寫死的
      // 清單（前兩份已經在這個階段換成宣告了）。核心讀宣告，語言套件推宣告。
      if (hasAnnotation(component, 'introduces_scope')) {
        const outer = this.scope
        const inner = outer.createChild()
        this.scope = inner
        try {
          return await executor(node, this)
        } finally {
          await this.exitScope(inner, outer)
        }
      }
      return executor(node, this)
    }

    // 概念自己宣告了「刻意不執行」——來源是概念檔，不是核心層的清單
    if (isSkipped(component, 'execute')) return

    // 🪦 **未知概念不再問人要不要跳過**（2026-08-26，第七十五條護欄）。
    //
    // 這裡本來掛著一個 `unknownComponentHandler`，回 `'skip' | 'abort'`，
    // 而 UI 用一個 `confirm()` 去問學生。使用者 2026-08-24 逐字：
    // 「**如果沒看過的東西就不要執行下去了，要誠實的說沒看過**」。
    //
    // 🔴 那個 `'skip'` **不是「跳過一行」，是「帶著錯的狀態繼續跑」**：
    // 跳掉一個賦值之後，後面每一行都在讀一個錯的值——**而每一步看起來都正常**。
    //
    // > 跳過一個【輸出】少印一行，看得出來；
    // > 跳過一個【賦值】看不出來，而學生會拿那個輸出當答案。
    //
    // ⚠️ 這**不是**把三條出口（手填／委派／停止）做掉了——那是同一個路線圖項的
    // 後續幾刀，而它們的閘還沒開（`draft/2026-08-24-執行遇到沒看過的東西.md`
    // 的「未決」有五題）。這一刀只做「**把錯的那個答案拿掉**」，
    // 而問題也跟著消失：沒有選項要問，就不需要那個對話框。
    //
    // ⚠️ 與上面那行 `isSkipped` 是**兩件事**：那是概念自己宣告的「刻意不執行」，
    // 這裡是「沒看過」。前者今天仍然是靜默 return，而那是另一刀（也在未決裡）。
    // 🔴 **有宿主的話，停在這裡讓人看**（2026-08-26，使用者拍板）。
    //
    // 「跑到那邊要有斷點，讓使用者調整完狀態才能繼續跑下去，或是直接停止」。
    // 宿主拿到這個呼叫時要做的是**暫停**（與斷點同一條路）：指到那一顆、
    // 打開變數、等一個決定。`setVariableFromHost` 是那期間改狀態的入口。
    //
    // ⚠️ **回 `'continue'` 不等於當年的 `'skip'`**：那時是一個 `confirm()`，
    // 看不到停在哪、看不到變數、也改不動它們。**現在回答的人有依據。**
    // 而**沒有宿主就直接丟**——沒有人可以問時，正確處置是停止。
    if (this.unknownComponentPause) {
      const decision = await this.unknownComponentPause(component, node.id ?? null)
      if (decision === 'continue') return
    }
    throw new RuntimeError(RUNTIME_ERRORS.UNKNOWN_COMPONENT, {
      component,
      // 判準是「註冊表空不空」，不是「概念名長得像什麼」——後者會讓核心
      // 重新認識語言，等於把剛搬走的東西搬回來
      ...(this.executorRegistry.hasAnyExecutor()
        ? {}
        : { hint: '可能是沒有載入語言套件（例如未呼叫 registerCppLanguage()）' }),
    })
  }

  /**
   * 離開一個作用域：先收尾，再還原。
   *
   * **每一個建立作用域的地方都要走這裡**——分支、迴圈、函式、方法、lambda。
   * 漏掉任何一個，那裡宣告的物件就永遠不會被收尾，**而症狀是沒有症狀**：
   * 少跑一段解構式，程式照樣跑完。
   */
  async exitScope(inner: Scope, outer: Scope): Promise<void> {
    try {
      if (this.onScopeExit) await this.onScopeExit(inner.ownVariables())
    } finally {
      this.scope = outer
    }
  }

  async countStep(): Promise<void> {
    if (this.aborted) {
      throw new RuntimeError(RUNTIME_ERRORS.ABORTED)
    }
    this.steps++
    if (this.steps > this.maxSteps) {
      throw new RuntimeError(RUNTIME_ERRORS.MAX_STEPS_EXCEEDED)
    }
    if (this.steps % 10000 === 0) {
      await new Promise<void>(r => setTimeout(r, 0))
    }
  }

  async executeBody(nodes: SemanticNode[]): Promise<void> {
    for (const child of nodes) {
      await this.executeNode(child)
      await this.recordStepInfo(child)
    }
  }

  async evaluate(node: SemanticNode): Promise<RuntimeValue> {
    const result = await this.executeNode(node)
    if (result && typeof result === 'object' && 'type' in result) {
      return result as RuntimeValue
    }
    return defaultValue('void')
  }

  toNumber(val: RuntimeValue): number {
    // 指標：**空與非空要分得出來**。
    //
    // 指標的值存的是被指變數的名字（字串），而下面那句 `Number(字串) || 0`
    // 會把它變成 0——於是 `p != 0` 對一個**有效的指標**也是假，
    // `while ((p = strchr(...)) != 0)` 這種寫法**一次都不跑**，
    // 而程式照樣跑完印出後面的東西。靜默降級最典型的形狀。
    if (val.type === 'pointer') return val.value === null || val.value === undefined ? 0 : 1
    // **`new T` 配出來的那塊儲存體也是一個指標**，只是它的 `type` 是 `array`
    // （`cpp:new` 的檔頭：「一塊連續的儲存體，在這個直譯器裡就是 `array`」）。
    //
    // 🔴 少了這一行，它掉到最後的 `return 0`，於是
    // `while (p != NULL)` 對一個**剛配好的節點**是 `0 != 0` ＝ 假
    // ——整條 Linked List 的走訪**一圈都不跑，而程式照樣跑完、沒有錯誤訊息**。
    // 與上一行講的是同一件事：**一塊存在的儲存體不是空指標。**
    if (val.type === 'array' && Array.isArray(val.value)) return 1
    if (typeof val.value === 'number') return val.value
    if (typeof val.value === 'boolean') return val.value ? 1 : 0
    // **`char` 在算術情境下是它的字元碼**——C++ 就是這樣（`'a' + 1` 是 98）。
    //
    // 少了這一行，`Number('A') || 0` 給 **0**，於是 `(char)toupper(c)` 產出
    // `'\0'`：程式跑完、印出東西、而印的是一個看不見的字元。
    // ⚠️ 與根因 1（char 持有數值時印成字元）是同一條路的**另一個方向**。
    if (val.type === 'char' && typeof val.value === 'string') {
      return val.value.length > 0 ? val.value.charCodeAt(0) : 0
    }
    if (typeof val.value === 'string') return Number(val.value) || 0
    return 0
  }

  /**
   * 一個值的真假。
   *
   * 🔴 **容器看「空不空」**（2026-08-21）——原本的 `return false` 讓
   * `if xs:` 在**非空的串列上也是 false**，於是那個分支永遠不跑。
   *
   * ⚠️ 症狀是**不報錯、有輸出、而走錯邊**：參照直譯器抓到的
   * （`bool([1,2,3])` 該是 True 而我們印 False）。
   *
   * > **一個「其餘一律 false」的退路，在容器進來的那天變成一個錯的答案。**
   *
   * ⚠️ 這一條**兩個語言都適用**：C++ 的 `if (v.size())` 走的是數字，
   * 而空容器在任何語言裡都是 false、非空都是 true。
   */
  toBool(val: RuntimeValue): boolean {
    if (typeof val.value === 'boolean') return val.value
    if (typeof val.value === 'number') return val.value !== 0
    if (typeof val.value === 'string') return val.value.length > 0
    if (Array.isArray(val.value)) return val.value.length > 0
    if (val.value instanceof Map) return val.value.size > 0
    return false
  }

  coerceType(val: RuntimeValue, targetType: string): RuntimeValue {
    if (val.type === targetType) return val
    switch (targetType) {
      case 'int': return { type: 'int', value: Math.trunc(this.toNumber(val)) }
      case 'float':
      case 'double': return { type: targetType as import('./types').RuntimeType, value: this.toNumber(val) }
      case 'bool': return { type: 'bool', value: this.toBool(val) }
      case 'string': return { type: 'string', value: valueToString(val) }
      // ⚠️ **不能用 `valueToString(val).charAt(0)`。** 數值來源會變成
      // 「66 → "66" → "6"」——`char c = 66` 印出 `6` 而不是 `B`。
      // 這與 `std/cctype/executors.ts` 的 `charOf` 是同一個坑，
      // 那裡修過了而核心沒有：**修一條路時要問「同一個缺陷在別的路上長什麼樣」。**
      //
      // ⚠️⚠️ 判準必須是 `typeof value === 'number'`，**不是 `toNumber()` 有沒有值**。
      // 第一版寫成後者，而 `toNumber({type:'string',value:'a'})` 回傳 **0**（不是 NaN）
      // ——於是 `char s[8]="a"` 的每個字元都變成 NUL，`strcat` 當場回歸。
      // `std/cctype/executors.ts` 的 `charOf` 用的就是前者：**照抄已驗證的形狀，
      // 不要自己換一個判準。**
      case 'char': {
        if (typeof val.value === 'number') return { type: 'char', value: String.fromCharCode(val.value) }
        return { type: 'char', value: valueToString(val).charAt(0) || '' }
      }
      default: return val
    }
  }

  failCin(): void { this.cinFailed = true }

  /**
   * Read a single whitespace-delimited token for cin >>. Shares buffer with scanf.
   *
   * 🔴 **空行是空白，不是輸入的結尾。** 這裡本來讀到一個空行就回 `null`，
   * 於是 `["", "5"]` 這種輸入讓 `cin >> a` 什麼都讀不到——而真 C++ 的 `>>`
   * 會跳過所有前導空白（換行也是空白）繼續找 token。
   *
   * 在 failbit 變成黏著的**之前**這只是「少讀一筆」；之後它會**整條流卡死**。
   * 兩個缺陷單獨看都不致命，合起來才是。
   */
  readCinToken(): string | null {
    for (;;) {
      if (this.scanfTokenBuffer.length > 0) {
        return this.scanfTokenBuffer.shift()!
      }
      const line = this.io.read()
      if (line === null) return null
      const tokens = line.trim().split(/\s+/).filter(t => t.length > 0)
      if (tokens.length === 0) continue // 空行：跳過，繼續找
      if (tokens.length > 1) {
        this.scanfTokenBuffer.push(...tokens.slice(1))
      }
      return tokens[0]
    }
  }

  /** Read a single whitespace-delimited token for scanf. Splits lines into tokens. */
  readScanfToken(): string | null {
    if (this.scanfTokenBuffer.length > 0) {
      return this.scanfTokenBuffer.shift()!
    }
    const line = this.io.read()
    if (line === null) return null
    const tokens = line.trim().split(/\s+/).filter(t => t.length > 0)
    if (tokens.length === 0) return null
    if (tokens.length > 1) {
      this.scanfTokenBuffer.push(...tokens.slice(1))
    }
    return tokens[0]
  }

  // --- Step recording ---

  private async recordStepInfo(node: SemanticNode): Promise<void> {
    if (!this.recordSteps) return
    const component = node.componentId
    // ⚠️ 這裡原本有一行 `if (component.includes(':')) return`——用「有沒有冒號」
    // 當「是不是語言專屬」的判準。命名空間遷移（103）之後**每一顆身分都有冒號**，
    // 那一行變成「什麼都不記錄」，症狀是單步除錯完全失效。
    //
    // 它本來就是多餘的：真正的閘門是下面的 `debug_step` 標註。
    // **拿身分的形狀當判斷，就是把命名慣例當成契約。**
    //
    // 「哪些概念算一個除錯步驟」由概念自己標註，不由核心層的清單決定。
    // 那是視圖層的關心（除錯器要在哪裡停），核心層不該認得語言專屬的名字。
    // 缺標註 → 不停，與原本「清單外不停」一致。
    if (!hasAnnotation(component, 'debug_step')) return

    const scopeSnapshot = this.snapshotScope()

    const step: StepInfo = {
      node,
      nodeId: node.id,
      sourceRange: node.metadata?.sourceRange
        ? { start: node.metadata.sourceRange.startLine, end: node.metadata.sourceRange.endLine }
        : null,
      outputLength: this.io.getOutput().length,
      scopeSnapshot,
    }
    this.stepRecords.push(step)

    if (this.stepRecordCallback) {
      await this.stepRecordCallback(step)
    }
  }
}
