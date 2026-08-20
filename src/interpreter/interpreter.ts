import { StructRegistry } from './struct-types'
import type { BoardPinModel } from '../core/types'
import type { SemanticNode } from '../core/types'
import { isSkipped, hasAnnotation, declareSkips, declareAnnotations } from '../core/skip-declarations'
import { allLanguageExecutors, allBuiltinConstants, isBuiltinName } from '../core/language-executors'
import { universalConcepts } from '../core/universal'
import type { RuntimeValue, FunctionDef, ExecutionStatus, StepInfo } from './types'
import { defaultValue, valueToString } from './types'
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
  for (const c of universalConcepts as unknown as {
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
  private status: ExecutionStatus = 'idle'
  private steps = 0
  private maxSteps: number
  /** 這一次執行在哪一塊板子上——⚠️ **公開**，因為直譯器自己就是 `ExecutionContext`。 */
  board?: BoardPinModel
  private stepRecords: StepInfo[] = []
  private recordSteps = false
  private inputProvider: (() => Promise<string>) | null = null
  private outputCallback: ((text: string) => void) | null = null
  private aborted = false
  private abortReject: ((reason: RuntimeError) => void) | null = null
  private waitingCallback: ((nodeId: string | null) => void) | null = null
  private stepRecordCallback: ((step: StepInfo) => Promise<void>) | null = null
  private unknownConceptHandler: ((concept: string) => Promise<'skip' | 'abort'>) | null = null
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
    const reg = (concept: string, executor: import('./executor-registry').ComponentExecutor) =>
      this.executorRegistry.register(concept, executor)
    registerMutationExecutors(reg)


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
    // `cpp_include_local` 曾在同一份清單裡，但它有真的宣告（concepts.json
    // 的 `skipPaths: ['execute']`），而下面的 `isSkipped` 會讀它。那一筆是
    // 053 之後的殘留，已刪除——不是搬過去。

    // algorithm concepts — noop for sort/reverse/fill (operate on containers, not interpreter values)

    // min/max — evaluate children and return the smaller/larger

    // stdlib advanced expressions

    // ⚠️ **這一段必須在建構式的最後。**
    //
    // 語言套件對**自己的概念**有最終發言權。放在前面的話，核心層後面那些
    // 佔位用的空操作會把語言的真實作蓋掉——這個專案已經被同一件事咬過三次
    // （`static_cast` 輸出 void、四個轉型被清單覆蓋、條件編譯的 body 不跑）。
    //
    // 註冊表是「後註冊的贏」，所以順序就是優先權。見 knowledge/history/020。
    for (const { concept, executor } of allLanguageExecutors()) reg(concept, executor as never)
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
    if (!this.inputProvider) return Promise.resolve(null)
    if (this.aborted) return Promise.reject(new RuntimeError(RUNTIME_ERRORS.ABORTED))
    this.waitingCallback?.(this.currentNode?.id ?? null)
    return new Promise<string | null>((resolve, reject) => {
      this.abortReject = reject
      this.inputProvider!().then(val => {
        this.abortReject = null
        if (val === '\x04') resolve(null)
        else resolve(val)
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

  /** Register a handler for unknown concepts. Returns 'skip' to continue or 'abort' to stop. */
  setUnknownConceptHandler(handler: ((concept: string) => Promise<'skip' | 'abort'>) | null): void {
    this.unknownConceptHandler = handler
  }

  setInputProvider(provider: (() => Promise<string>) | null): void {
    this.inputProvider = provider
  }

  /** Register a callback for real-time output (called on each write/newline) */
  setOutputCallback(callback: ((text: string) => void) | null): void {
    this.outputCallback = callback
    this.io.onOutput(callback)

  }

  async execute(program: SemanticNode, stdin: string[] = []): Promise<void> {
    this.scope = new Scope()
    this.io = new IOSystem(stdin)
    if (this.outputCallback) this.io.onOutput(this.outputCallback)
    this.functions = new Map()
    this.steps = 0
    this.status = 'running'
    this.aborted = false
    this.abortReject = null

    this.scanfTokenBuffer = []

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
  getExecutor(concept: string): ((node: SemanticNode, ctx: ExecutionContext) => unknown) | undefined {
    return this.executorRegistry.get(concept)
  }

  /** 被註冊超過一次的概念——勝負由載入順序決定的那些 */
  duplicateRegistrations(): { concept: string; count: number }[] {
    return this.executorRegistry.duplicates()
  }

  async executeNode(node: SemanticNode): Promise<RuntimeValue | void> {
    await this.countStep()
    this.currentNode = node
    const concept = node.componentId

    const executor = this.executorRegistry.get(concept)
    if (executor) {
      // ── 概念自己宣告「我引入一個作用域」，核心讀它
      //
      // `introduces_scope` 這個標註**存在，而沒有任何東西在讀它**——那是
      // `concepts/執行機構.md`「機制有了，沒人接上」講的形狀，而這裡藏的是
      // 一個真的語義錯誤：分支裡宣告的變數會外洩到外層。
      //
      // 寫死「if 和 if_else 要建子作用域」也能修，但那會是**第三份**寫死的
      // 清單（前兩份已經在這個階段換成宣告了）。核心讀宣告，語言套件推宣告。
      if (hasAnnotation(concept, 'introduces_scope')) {
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
    if (isSkipped(concept, 'execute')) return

    // 未知概念：通知使用者決定跳過或停止
    if (this.unknownConceptHandler) {
      const action = await this.unknownConceptHandler(concept)
      if (action === 'abort') {
        throw new RuntimeError(RUNTIME_ERRORS.UNKNOWN_CONCEPT, { concept })
      }
      // 'skip' — 繼續執行
      return
    }
    // 無 handler 時預設報錯
    throw new RuntimeError(RUNTIME_ERRORS.UNKNOWN_CONCEPT, {
      concept,
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

  toBool(val: RuntimeValue): boolean {
    if (typeof val.value === 'boolean') return val.value
    if (typeof val.value === 'number') return val.value !== 0
    if (typeof val.value === 'string') return val.value.length > 0
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

  /** Read a single whitespace-delimited token for cin >>. Shares buffer with scanf. */
  readCinToken(): string | null {
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
    const concept = node.componentId
    // ⚠️ 這裡原本有一行 `if (concept.includes(':')) return`——用「有沒有冒號」
    // 當「是不是語言專屬」的判準。命名空間遷移（103）之後**每一顆身分都有冒號**，
    // 那一行變成「什麼都不記錄」，症狀是單步除錯完全失效。
    //
    // 它本來就是多餘的：真正的閘門是下面的 `debug_step` 標註。
    // **拿身分的形狀當判斷，就是把命名慣例當成契約。**
    //
    // 「哪些概念算一個除錯步驟」由概念自己標註，不由核心層的清單決定。
    // 那是視圖層的關心（除錯器要在哪裡停），核心層不該認得語言專屬的名字。
    // 缺標註 → 不停，與原本「清單外不停」一致。
    if (!hasAnnotation(concept, 'debug_step')) return

    const scopeSnapshot: { name: string; type: string; value: string }[] = []
    for (const [name, val] of this.scope.getAll()) {
      if (isBuiltinName(name)) continue
      scopeSnapshot.push({ name, type: val.type, value: valueToString(val) })
    }

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
