import type { SemanticNode } from '../core/types'
import { createNode } from '../core/semantic-tree'
import type { RuntimeValue, RuntimeType, FunctionDef, ExecutionStatus, StepInfo } from './types'
import { defaultValue, valueToString, parseInputValue } from './types'
import { RuntimeError, RUNTIME_ERRORS } from './errors'
import { Scope } from './scope'
import { IOSystem } from './io'

/** Break/Continue 訊號（非錯誤，用於流程控制） */
class BreakSignal { readonly _brand = 'break' }
class ContinueSignal { readonly _brand = 'continue' }
class ReturnSignal {
  value: RuntimeValue
  constructor(value: RuntimeValue) { this.value = value }
}

interface InterpreterOptions {
  maxSteps?: number
}

export class SemanticInterpreter {
  private scope: Scope = new Scope()
  private io: IOSystem = new IOSystem()
  private functions = new Map<string, FunctionDef>()
  private status: ExecutionStatus = 'idle'
  private steps = 0
  private maxSteps: number
  private stepRecords: StepInfo[] = []
  private recordSteps = false
  private inputProvider: (() => Promise<string>) | null = null
  private outputCallback: ((text: string) => void) | null = null

  constructor(options: InterpreterOptions = {}) {
    this.maxSteps = options.maxSteps ?? 100000
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

  // --- 核心分派 ---

  private async executeNode(node: SemanticNode): Promise<RuntimeValue | void> {
    this.countStep()
    const concept = node.concept

    // 語言特有概念：靜默略過
    if (concept.includes(':')) return

    switch (concept) {
      case 'program': return this.execProgram(node)
      case 'number_literal': return this.execNumberLiteral(node)
      case 'string_literal': return this.execStringLiteral(node)
      case 'var_declare': return this.execVarDeclare(node)
      case 'var_assign': return this.execVarAssign(node)
      case 'var_ref': return this.execVarRef(node)
      case 'arithmetic': return this.execArithmetic(node)
      case 'compare': return this.execCompare(node)
      case 'logic': return this.execLogic(node)
      case 'logic_not': return this.execLogicNot(node)
      case 'if': return this.execIf(node)
      case 'count_loop': return this.execCountLoop(node)
      case 'while_loop': return this.execWhileLoop(node)
      case 'break': throw new BreakSignal()
      case 'continue': throw new ContinueSignal()
      case 'func_def': return this.execFuncDef(node)
      case 'func_call': return this.execFuncCall(node)
      case 'return': return this.execReturn(node)
      case 'print': return this.execPrint(node)
      case 'input': return this.execInput(node)
      case 'endl': return { type: 'string', value: '\n' }
      case 'array_declare': return this.execArrayDeclare(node)
      case 'array_access': return this.execArrayAccess(node)
      case 'cpp_increment': return this.execIncrement(node)
      case 'negate': return this.execNegate(node)
      case 'compound_assign': return this.execCompoundAssign(node)
      default: return // 未知概念靜默略過
    }
  }

  private countStep(): void {
    this.steps++
    if (this.steps > this.maxSteps) {
      throw new RuntimeError(RUNTIME_ERRORS.MAX_STEPS_EXCEEDED)
    }
  }

  // --- 基礎概念 (T016) ---

  private async execProgram(node: SemanticNode): Promise<void> {
    const body = node.children.body ?? []
    await this.executeBody(body)
    // C/C++ 慣例：若定義了 main 函式，自動呼叫
    if (this.functions.has('main')) {
      await this.execFuncCall(createNode('func_call', { name: 'main' }, { args: [] }))
    }
  }

  private async executeBody(nodes: SemanticNode[]): Promise<void> {
    for (const child of nodes) {
      await this.executeNode(child)
      this.recordStepInfo(child)
    }
  }

  private recordStepInfo(node: SemanticNode): void {
    if (!this.recordSteps) return
    // Only record for statement-level concepts
    const concept = node.concept
    if (concept.includes(':')) return
    const statementConcepts = new Set([
      'var_declare', 'var_assign', 'print', 'if', 'count_loop',
      'while_loop', 'func_def', 'func_call', 'return', 'break', 'continue',
    ])
    if (!statementConcepts.has(concept)) return

    // Snapshot scope variables
    const scopeSnapshot: { name: string; type: string; value: string }[] = []
    for (const [name, val] of this.scope.getAll()) {
      scopeSnapshot.push({ name, type: val.type, value: valueToString(val) })
    }

    this.stepRecords.push({
      node,
      blockId: node.metadata?.blockId ?? null,
      sourceRange: node.metadata?.sourceRange ?? null,
      outputLength: this.io.getOutput().length,
      scopeSnapshot,
    })
  }

  private execNumberLiteral(node: SemanticNode): RuntimeValue {
    const raw = String(node.properties.value)
    const num = Number(raw)
    if (raw.includes('.')) {
      return { type: 'double', value: num }
    }
    return { type: 'int', value: Math.trunc(num) }
  }

  private execStringLiteral(node: SemanticNode): RuntimeValue {
    return { type: 'string', value: String(node.properties.value) }
  }

  private async execVarDeclare(node: SemanticNode): Promise<void> {
    const name = String(node.properties.name)
    const type = String(node.properties.type || 'int')
    let val: RuntimeValue

    const init = node.children.initializer
    if (init && init.length > 0) {
      val = await this.evaluate(init[0])
      // 型別轉換
      val = this.coerceType(val, type)
    } else {
      val = defaultValue(type)
    }

    this.scope.declare(name, val)
  }

  private async execVarAssign(node: SemanticNode): Promise<void> {
    const name = String(node.properties.name)
    const valueNodes = node.children.value
    if (!valueNodes || valueNodes.length === 0) return
    const val = await this.evaluate(valueNodes[0])
    this.scope.set(name, val)
  }

  private execVarRef(node: SemanticNode): RuntimeValue {
    const name = String(node.properties.name)
    return this.scope.get(name)
  }

  // --- 運算概念 (T017) ---

  private async execArithmetic(node: SemanticNode): Promise<RuntimeValue> {
    const op = String(node.properties.operator)
    const left = await this.evaluate(node.children.left[0])
    const right = await this.evaluate(node.children.right[0])

    const lv = this.toNumber(left)
    const rv = this.toNumber(right)

    let result: number
    switch (op) {
      case '+': result = lv + rv; break
      case '-': result = lv - rv; break
      case '*': result = lv * rv; break
      case '/':
        if (rv === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO)
        result = lv / rv
        break
      case '%':
        if (rv === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO)
        result = lv % rv
        break
      default: result = 0
    }

    // 若兩邊都是整數，結果也為整數（整數截斷）
    if (left.type === 'int' && right.type === 'int') {
      return { type: 'int', value: Math.trunc(result) }
    }
    return { type: 'double', value: result }
  }

  private async execCompare(node: SemanticNode): Promise<RuntimeValue> {
    const op = String(node.properties.operator)
    const left = await this.evaluate(node.children.left[0])
    const right = await this.evaluate(node.children.right[0])

    const lv = this.toNumber(left)
    const rv = this.toNumber(right)

    let result: boolean
    switch (op) {
      case '<': result = lv < rv; break
      case '>': result = lv > rv; break
      case '<=': result = lv <= rv; break
      case '>=': result = lv >= rv; break
      case '==': result = lv === rv; break
      case '!=': result = lv !== rv; break
      default: result = false
    }

    return { type: 'bool', value: result }
  }

  private async execLogic(node: SemanticNode): Promise<RuntimeValue> {
    const op = String(node.properties.operator)
    const left = await this.evaluate(node.children.left[0])

    if (op === '&&') {
      if (!this.toBool(left)) return { type: 'bool', value: false }
      const right = await this.evaluate(node.children.right[0])
      return { type: 'bool', value: this.toBool(right) }
    }
    if (op === '||') {
      if (this.toBool(left)) return { type: 'bool', value: true }
      const right = await this.evaluate(node.children.right[0])
      return { type: 'bool', value: this.toBool(right) }
    }

    return { type: 'bool', value: false }
  }

  private async execLogicNot(node: SemanticNode): Promise<RuntimeValue> {
    const operand = await this.evaluate(node.children.operand[0])
    return { type: 'bool', value: !this.toBool(operand) }
  }

  // --- 遞增遞減 / 負數 / 複合賦值 ---

  private execIncrement(node: SemanticNode): void {
    const name = String(node.properties.name)
    const op = String(node.properties.operator)
    const current = this.scope.get(name)
    const val = this.toNumber(current)
    const newVal = op === '++' ? val + 1 : val - 1
    const result: RuntimeValue = current.type === 'int'
      ? { type: 'int', value: Math.trunc(newVal) }
      : { type: 'double', value: newVal }
    this.scope.set(name, result)
  }

  private async execNegate(node: SemanticNode): Promise<RuntimeValue> {
    const operand = await this.evaluate(node.children.value[0])
    const val = this.toNumber(operand)
    return operand.type === 'int'
      ? { type: 'int', value: -Math.trunc(val) }
      : { type: 'double', value: -val }
  }

  private async execCompoundAssign(node: SemanticNode): Promise<void> {
    const name = String(node.properties.name)
    const op = String(node.properties.operator)
    const current = this.scope.get(name)
    const rhs = await this.evaluate(node.children.value[0])
    const lv = this.toNumber(current)
    const rv = this.toNumber(rhs)
    let result: number
    switch (op) {
      case '+=': result = lv + rv; break
      case '-=': result = lv - rv; break
      case '*=': result = lv * rv; break
      case '/=':
        if (rv === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO)
        result = lv / rv; break
      case '%=':
        if (rv === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO)
        result = lv % rv; break
      default: result = lv
    }
    if (current.type === 'int' && rhs.type === 'int') {
      this.scope.set(name, { type: 'int', value: Math.trunc(result) })
    } else {
      this.scope.set(name, { type: 'double', value: result })
    }
  }

  // --- 流程控制 (T018) ---

  private async execIf(node: SemanticNode): Promise<void> {
    const condition = await this.evaluate(node.children.condition[0])

    if (this.toBool(condition)) {
      await this.executeBody(node.children.then_body ?? [])
    } else {
      await this.executeBody(node.children.else_body ?? [])
    }
  }

  private async execCountLoop(node: SemanticNode): Promise<void> {
    const varName = String(node.properties.var_name)
    const from = this.toNumber(await this.evaluate(node.children.from[0]))
    const to = this.toNumber(await this.evaluate(node.children.to[0]))
    const body = node.children.body ?? []

    // 建立子 scope，迴圈變數在子 scope 中宣告（避免巢狀迴圈重複宣告）
    const parentScope = this.scope
    this.scope = parentScope.createChild()
    this.scope.declare(varName, { type: 'int', value: from })

    for (let i = from; i <= to; i++) {
      this.scope.set(varName, { type: 'int', value: i })
      try {
        await this.executeBody(body)
      } catch (signal) {
        if (signal instanceof BreakSignal) break
        if (signal instanceof ContinueSignal) continue
        this.scope = parentScope
        throw signal
      }
    }
    this.scope = parentScope
  }

  private async execWhileLoop(node: SemanticNode): Promise<void> {
    const body = node.children.body ?? []

    // 建立子 scope，每次迭代內的宣告不會外洩
    const parentScope = this.scope
    while (true) {
      this.scope = parentScope.createChild()
      const condition = await this.evaluate(node.children.condition[0])
      if (!this.toBool(condition)) break

      try {
        await this.executeBody(body)
      } catch (signal) {
        if (signal instanceof BreakSignal) break
        if (signal instanceof ContinueSignal) continue
        this.scope = parentScope
        throw signal
      }
    }
    this.scope = parentScope
  }

  // --- 函式概念 (T019) ---

  private execFuncDef(node: SemanticNode): void {
    const name = String(node.properties.name)
    const returnType = String(node.properties.return_type || 'void')
    const rawParams = node.properties.params
    let params: { type: string; name: string }[] = []
    if (Array.isArray(rawParams)) {
      // params from blockly-panel: ["int x", "float y", ...]
      params = rawParams.map((p: unknown) => {
        const s = String(p)
        const spaceIdx = s.indexOf(' ')
        return spaceIdx >= 0
          ? { type: s.slice(0, spaceIdx), name: s.slice(spaceIdx + 1) }
          : { type: 'int', name: s }
      })
    } else if (typeof rawParams === 'string' && rawParams.startsWith('[')) {
      try { params = JSON.parse(rawParams) } catch { params = [] }
    }
    this.functions.set(name, {
      name,
      params,
      returnType,
      body: node.children.body ?? [],
    })
  }

  private async execFuncCall(node: SemanticNode): Promise<RuntimeValue> {
    const name = String(node.properties.name)
    const funcDef = this.functions.get(name)
    if (!funcDef) {
      throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, { '%1': name })
    }

    const args = node.children.args ?? []
    const argValues: RuntimeValue[] = []
    for (const argNode of args) {
      argValues.push(await this.evaluate(argNode))
    }

    // 建立函式作用域
    const parentScope = this.scope
    this.scope = new Scope(parentScope)

    // 綁定參數
    for (let i = 0; i < funcDef.params.length; i++) {
      const param = funcDef.params[i]
      const val = i < argValues.length ? argValues[i] : defaultValue(param.type)
      this.scope.declare(param.name, val)
    }

    let returnValue: RuntimeValue = defaultValue(funcDef.returnType)

    try {
      await this.executeBody(funcDef.body)
    } catch (signal) {
      if (signal instanceof ReturnSignal) {
        returnValue = signal.value
      } else {
        this.scope = parentScope
        throw signal
      }
    }

    this.scope = parentScope
    return returnValue
  }

  private async execReturn(node: SemanticNode): Promise<void> {
    const valueNodes = node.children.value
    if (valueNodes && valueNodes.length > 0) {
      const val = await this.evaluate(valueNodes[0])
      throw new ReturnSignal(val)
    }
    throw new ReturnSignal(defaultValue('void'))
  }

  // --- I/O 和陣列 (T020) ---

  private async execPrint(node: SemanticNode): Promise<void> {
    const values = node.children.values ?? []

    for (const valNode of values) {
      const val = await this.evaluate(valNode)
      if (val.type === 'string' && val.value === '\n') {
        this.io.writeNewline()
      } else {
        this.io.write(valueToString(val))
      }
    }
  }

  private async execInput(node: SemanticNode): Promise<RuntimeValue> {
    const targetVar = node.properties.variable ? String(node.properties.variable) : null
    let targetType = String(node.properties.type || 'string')

    // If variable is specified, infer type from existing variable
    if (targetVar) {
      try {
        const existing = this.scope.get(targetVar)
        targetType = existing.type
      } catch { /* variable might not exist yet */ }
    }

    let raw = this.io.read()
    if (raw === null && this.inputProvider) {
      raw = await this.inputProvider()
    }
    if (raw === null) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'input exhausted' })
    }
    const val = parseInputValue(raw, targetType) ?? defaultValue(targetType)

    // cin >> var: assign value to the target variable
    if (targetVar) {
      this.scope.set(targetVar, val)
    }

    return val
  }

  private execArrayDeclare(node: SemanticNode): void {
    const name = String(node.properties.name)
    const type = String(node.properties.type || 'int')
    const size = Number(node.properties.size || 0)

    const elements: RuntimeValue[] = []
    for (let i = 0; i < size; i++) {
      elements.push(defaultValue(type))
    }

    this.scope.declare(name, { type: 'array', value: elements })
  }

  private async execArrayAccess(node: SemanticNode): Promise<RuntimeValue> {
    const name = String(node.properties.name)
    const indexNodes = node.children.index
    if (!indexNodes || indexNodes.length === 0) {
      return defaultValue('int')
    }

    const indexVal = await this.evaluate(indexNodes[0])
    const index = this.toNumber(indexVal)
    const arr = this.scope.get(name)

    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }

    if (index < 0 || index >= arr.value.length) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
    }

    return arr.value[index]
  }

  // --- 輔助方法 ---

  private async evaluate(node: SemanticNode): Promise<RuntimeValue> {
    const result = await this.executeNode(node)
    if (result && typeof result === 'object' && 'type' in result) {
      return result as RuntimeValue
    }
    return defaultValue('void')
  }

  private toNumber(val: RuntimeValue): number {
    if (typeof val.value === 'number') return val.value
    if (typeof val.value === 'boolean') return val.value ? 1 : 0
    if (typeof val.value === 'string') return Number(val.value) || 0
    return 0
  }

  private toBool(val: RuntimeValue): boolean {
    if (typeof val.value === 'boolean') return val.value
    if (typeof val.value === 'number') return val.value !== 0
    if (typeof val.value === 'string') return val.value.length > 0
    return false
  }

  private coerceType(val: RuntimeValue, targetType: string): RuntimeValue {
    if (val.type === targetType) return val
    switch (targetType) {
      case 'int': return { type: 'int', value: Math.trunc(this.toNumber(val)) }
      case 'float':
      case 'double': return { type: targetType as RuntimeType, value: this.toNumber(val) }
      case 'bool': return { type: 'bool', value: this.toBool(val) }
      case 'string': return { type: 'string', value: valueToString(val) }
      case 'char': return { type: 'char', value: valueToString(val).charAt(0) || '' }
      default: return val
    }
  }
}
