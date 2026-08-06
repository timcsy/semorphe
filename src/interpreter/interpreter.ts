import type { SemanticNode } from '../core/types'
import { isSkipped, hasAnnotation, declareSkips, declareAnnotations } from '../core/skip-declarations'
import { allLanguageExecutors, allBuiltinConstants, isBuiltinName } from '../core/language-executors'
import universalConcepts from '../blocks/semantics/universal-concepts.json'
import type { RuntimeValue, FunctionDef, ExecutionStatus, StepInfo } from './types'
import { defaultValue, valueToString } from './types'
import { RuntimeError, RUNTIME_ERRORS } from './errors'
import { Scope } from './scope'
import { IOSystem } from './io'
import { ConceptExecutorRegistry, type ExecutionContext } from './executor-registry'
import { registerLiteralExecutors } from './executors/literals'
import { registerVariableExecutors } from './executors/variables'
import { registerOperatorExecutors } from './executors/operators'
import { registerControlFlowExecutors } from './executors/control-flow'
import { registerFunctionExecutors } from './executors/functions'
import { registerIoExecutors } from './executors/io'
import { registerArrayExecutors } from './executors/arrays'
import { registerMutationExecutors } from './executors/mutations'

interface InterpreterOptions {
  maxSteps?: number
}

/** universal 概念的宣告與標註——只載入一次 */
let universalLoaded = false
function loadUniversalDeclarations(): void {
  if (universalLoaded) return
  universalLoaded = true
  for (const c of universalConcepts as unknown as {
    conceptId: string
    skipReasons?: Record<string, string>
    annotations?: Record<string, unknown>
  }[]) {
    if (c.skipReasons && Object.keys(c.skipReasons).length > 0) {
      declareSkips(c.conceptId, c.skipReasons as never)
    }
    if (c.annotations && Object.keys(c.annotations).length > 0) {
      declareAnnotations(c.conceptId, c.annotations)
    }
  }
}

export class SemanticInterpreter implements ExecutionContext {
  scope: Scope = new Scope()
  io: IOSystem = new IOSystem()
  functions = new Map<string, FunctionDef>()
  pointerTargets = new Map<string, Scope>()
  scanfTokenBuffer: string[] = []
  private status: ExecutionStatus = 'idle'
  private steps = 0
  private maxSteps: number
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
  private executorRegistry: ConceptExecutorRegistry

  constructor(options: InterpreterOptions = {}) {
    this.maxSteps = options.maxSteps ?? 100000
    // universal 概念是核心自己的資料（中立性護欄明確排除 universal 層），
    // 所以核心可以自行載入它們的宣告與標註。語言專屬的那些由語言套件推進來。
    loadUniversalDeclarations()
    this.executorRegistry = new ConceptExecutorRegistry()
    const reg = (concept: string, executor: import('./executor-registry').ConceptExecutor) =>
      this.executorRegistry.register(concept, executor)
    registerLiteralExecutors(reg)
    registerVariableExecutors(reg)
    registerOperatorExecutors(reg)
    registerControlFlowExecutors(reg)
    registerFunctionExecutors(reg)
    registerIoExecutors(reg)
    registerArrayExecutors(reg)
    registerMutationExecutors(reg)

    // 語言套件推進來的執行器——核心不知道有哪些語言，只知道有人推東西進來
    for (const { concept, executor } of allLanguageExecutors()) reg(concept, executor as never)

    // cstdlib functions

    // cctype functions
    for (const [concept, fn] of Object.entries({
      cpp_isalpha: (c: string) => /[a-zA-Z]/.test(c),
      cpp_isdigit: (c: string) => /[0-9]/.test(c),
      cpp_toupper: (c: string) => c.toUpperCase(),
      cpp_tolower: (c: string) => c.toLowerCase(),
    } as Record<string, (c: string) => boolean | string>)) {
      reg(concept, async (node, ctx) => {
        const v = node.children.value?.[0]
        if (!v) return { type: 'int' as const, value: 0 }
        const val = await ctx.evaluate(v)
        const ch = String(val.value).charAt(0)
        const result = fn(ch)
        if (typeof result === 'boolean') return { type: 'int' as const, value: result ? 1 : 0 }
        return { type: 'char' as const, value: result }
      })
    }

    // swap

    // ⚠️ 已知缺口，**不是**「刻意不執行」
    //
    // 這些概念實測跑起來**結果是錯的**（十個是物件導向，直譯器不支援它）。
    // 它們留在這裡當空操作，是因為改成報錯會讓原本印得出東西的程式整個停掉
    // ——見 knowledge/history/017「加嚴一個檢查可能比不檢查更糟」。
    //
    // 它們**不得**取得 `skipPaths` 宣告；完備性報表仍把它們算成殼，
    // `tests/integration/noop-classification.test.ts` 每次跑都會把它們印出來。
    // 逐一分類與依據見 specs/053-declare-noop-execute/classification.md。
    //
    // 真正的歸屬是語言套件，不是核心層——那需要先把執行器搬過去（階段 6.5 P2）。
    const noop: import('./executor-registry').ConceptExecutor = async () => {}
    for (const c of [
      'cpp_ifdef', 'cpp_ifndef',
      'cpp_include_local', 'cpp_raw_code', 'cpp_raw_expression',
      'cpp_class_def', 'cpp_struct_declare', 'cpp_constructor', 'cpp_destructor',
      'cpp_virtual_method', 'cpp_pure_virtual', 'cpp_override_method',
      'cpp_operator_overload', 'cpp_namespace_def', 'cpp_lambda',
    ]) {
      reg(c, noop)
    }

    // algorithm concepts — noop for sort/reverse/fill (operate on containers, not interpreter values)

    // min/max — evaluate children and return the smaller/larger

    // stdlib advanced expressions
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
    const concept = node.concept

    const executor = this.executorRegistry.get(concept)
    if (executor) {
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
    if (typeof val.value === 'number') return val.value
    if (typeof val.value === 'boolean') return val.value ? 1 : 0
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
      case 'char': return { type: 'char', value: valueToString(val).charAt(0) || '' }
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
    const concept = node.concept
    if (concept.includes(':')) return
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
