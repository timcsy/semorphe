import type { SemanticNode, BlockSpec, LiftPattern, FieldMapping, AstPattern } from '../types'
import type { AstNode, LiftContext } from './types'
import { createNode } from '../semantic-tree'
import type { TransformRegistry } from '../registry/transform-registry'
import type { LiftStrategyRegistry } from '../registry/lift-strategy-registry'
import { componentLiftPatterns } from '../component/lift-patterns'
import { isElseIfChainable } from '../component/traits'

interface PatternEntry {
  /** 這一筆寫給哪個文法。🔴 沒有預設值——見 `LiftPattern.grammar`。 */
  grammar: string
  componentId: string
  patternType: string
  priority: number
  constraints: AstPattern['constraints']
  fieldMappings?: FieldMapping[]
  operatorDispatch?: AstPattern['operatorDispatch']
  chain?: AstPattern['chain']
  composite?: AstPattern['composite']
  unwrapChild?: AstPattern['unwrapChild']
  contextTransform?: AstPattern['contextTransform']
  multiResult?: AstPattern['multiResult']
  extract?: LiftPattern['extract']
  liftStrategy?: string
}

/**
 * JSON-driven pattern lifter engine.
 * Lifts AST nodes to SemanticNodes using patterns loaded from JSON definitions.
 */
export class PatternLifter {
  /**
   * 鏈的根對不對得上——**而限定名稱算同一個**。
   *
   * `std::cout` 與 `cout` **是同一個實體**，差別只是命名空間風格
   * （而這個專案的 `StylePreset` 本來就有 `namespace_style` 這一格）。
   *
   * 🔴 第一版是精確比對，於是：
   *
   * ```
   * cout << 1;        🟢 clean
   * std::cout << 1;   🔴 unresolved ＋ raw_code
   * std::string s;    🟢 clean      ← 所以不是「限定名稱」全壞
   * ```
   *
   * ⚠️ 而它**不是新的**：`std::cout` 一直投影不了，只是既有語料
   * 幾乎都寫 `using namespace std;`，所以它從來沒有現形
   * ——直到 2026-08-17 有人在測試裡寫了一段帶 `std::` 的程式。
   *
   * > **一個缺口如果只在「大家都不那樣寫」的地方，
   * > 它會一直在，而且沒有人會發現。**
   *
   * 只比對**最後一段**：`std::cout` ✅、`foo::cout` ✅、`mycout` ❌。
   */
  private matchesChainRoot(text: string | undefined, want: string): boolean {
    if (text === undefined) return false
    return text === want || text.endsWith(`::${want}`)
  }

  private patterns = new Map<string, PatternEntry[]>()
  /**
   * 目前在辨識哪個文法。**產品路徑一律明說**（組裝點從語言套件讀）。
   *
   * ⚠️ `null` ＝ 不過濾，那是 spec 167 之前的行為。留著它的唯一理由是
   * **113 個 C++ 測試檔共用的 `createTestLifter`**——而那個助手自己也明說了
   * `tree-sitter-cpp`，所以今天沒有任何一條產品路徑靠這個預設。
   *
   * 🔴 **而「組裝點有沒有明說」由護欄看著**（`audit-lift-grammar`），
   * 不是靠這裡拋錯——拋錯會讓那 113 個測試變成這一刀的範圍。
   */
  private activeGrammar: string | null = null
  private transformRegistry: TransformRegistry | null = null
  private liftStrategyRegistry: LiftStrategyRegistry | null = null

  /**
   * 指定現在在辨識哪個文法——**只有這個文法的 pattern 會參與比對**。
   *
   * 🔴 在此之前 `python:if` 與 `cpp:if` 掛在同一個 `if_statement` 上，
   * 而**勝負由 `priority` 決定——那是一個沒有人設計過的排序**。
   */
  setGrammar(grammar: string): void {
    this.activeGrammar = grammar
  }

  setTransformRegistry(registry: TransformRegistry): void {
    this.transformRegistry = registry
  }

  setLiftStrategyRegistry(registry: LiftStrategyRegistry): void {
    this.liftStrategyRegistry = registry
  }

  /** Check if any pattern exists for the given AST node type */
  hasPatternForNodeType(nodeType: string): boolean {
    this.mergeIntoCapsule()
    return this.entriesFor(nodeType).length > 0
  }

  /**
   * 取出**屬於目前文法**的 pattern。
   *
   * ⚠️ 這是這一刀唯一的過濾點——`tryLift` 與 `hasPatternForNodeType` 都走它，
   * 否則「有沒有 pattern」與「用哪一筆 pattern」會給出不一致的答案。
   */
  private entriesFor(nodeType: string): PatternEntry[] {
    const all = this.patterns.get(nodeType) ?? []
    if (this.activeGrammar === null) return all
    return all.filter((e) => e.grammar === this.activeGrammar)
  }

  /** Load patterns from BlockSpec JSON definitions (simple/constrained patterns).
   *  skipNodeTypes: set of AST node types to skip (handled by hand-written lifters or lift-patterns.json) */
  loadBlockSpecs(specs: BlockSpec[], skipNodeTypes?: Set<string> | ReadonlyMap<string, ReadonlySet<string>>): void {
    for (const spec of specs) {
      const ap = spec.astPattern
      if (!ap || ap.nodeType.startsWith('_')) continue
      // ⚠️ **跳過清單是【文法】的性質**：一份 Set 會把 C++ 的清單套在所有語言上，
      // 而那正是 spec 167 在治的病。傳 Map 時只有同文法的那份算數。
      const skip = skipNodeTypes instanceof Map
        ? skipNodeTypes.get(ap.grammar)
        : (skipNodeTypes as Set<string> | undefined)
      if (skip?.has(ap.nodeType)) continue

      const entry: PatternEntry = {
        grammar: ap.grammar,
        componentId: spec.componentMapping?.componentId ?? spec.id,
        patternType: ap.patternType ?? (ap.constraints.length > 0 ? 'constrained' : 'simple'),
        priority: this.calcPriority(ap.patternType ?? 'simple', ap.constraints?.length ?? 0, 0) - 5,
        constraints: ap.constraints,
        fieldMappings: ap.fieldMappings,
        operatorDispatch: ap.operatorDispatch,
        chain: ap.chain,
        composite: ap.composite,
        unwrapChild: ap.unwrapChild,
        contextTransform: ap.contextTransform,
        multiResult: ap.multiResult,
        liftStrategy: ap.liftStrategy,
      }

      this.addPattern(ap.nodeType, entry)
    }
  }

  /** 膠囊的 pattern 只併一次。 */
  private mergedCapsules = false

  /**
   * **惰性併入膠囊自帶的 pattern**——放在**比對的入口**，不放在任何組裝點。
   *
   * ⚠️ 不能在 `loadLiftPatterns` 時併：**8 個測試檔各自組裝 lifter**
   * （對照：113 個用共用的 `createTestLifter`），它們不會呼叫任何登錄。
   * **修 8 個呼叫點不如把呼叫點變成 0 個**——而 glob 直讀讓這件事成立。
   *
   * 見 `history/044`：那次把 pattern 寫成登錄呼叫，壞了兩次。
   */
  private mergeIntoCapsule(): void {
    if (this.mergedCapsules) return
    this.mergedCapsules = true
    this.loadLiftPatterns(componentLiftPatterns() as LiftPattern[])
  }

  /** Load patterns from lift-patterns.json (complex patterns: chain, composite, operatorDispatch, etc.) */
  loadLiftPatterns(patterns: LiftPattern[]): void {
    for (const lp of patterns) {
      const entry: PatternEntry = {
        grammar: lp.grammar,
        componentId: lp.component?.componentId ?? '',
        patternType: lp.patternType ?? 'simple',
        priority: this.calcPriority(lp.patternType ?? 'simple', lp.constraints?.length ?? 0, lp.priority ?? 0),
        constraints: lp.constraints ?? [],
        fieldMappings: lp.fieldMappings,
        operatorDispatch: lp.operatorDispatch,
        chain: lp.chain,
        composite: lp.composite,
        unwrapChild: lp.unwrapChild,
        contextTransform: lp.contextTransform,
        multiResult: lp.multiResult,
        extract: lp.extract,
        liftStrategy: lp.liftStrategy,
      }

      this.addPattern(lp.astNodeType, entry)
    }
  }

  private addPattern(nodeType: string, entry: PatternEntry): void {
    const list = this.patterns.get(nodeType) ?? []
    list.push(entry)
    // Sort by priority descending (higher priority first)
    list.sort((a, b) => b.priority - a.priority)
    this.patterns.set(nodeType, list)
  }

  private calcPriority(patternType: string, constraintCount: number, explicitPriority: number): number {
    // Base priority by type
    const basePriority: Record<string, number> = {
      composite: 100,
      chain: 90,
      operatorDispatch: 80,
      contextTransform: 70,
      multiResult: 60,
      constrained: 50,
      unwrap: 40,
      simple: 10,
    }
    const base = basePriority[patternType] ?? 10
    return base + constraintCount * 5 + explicitPriority
  }

  /** Try to lift an AST node using loaded patterns. Returns null if no pattern matches. */
  tryLift(node: AstNode, ctx: LiftContext): SemanticNode | null {
    this.mergeIntoCapsule()
    const entries = this.entriesFor(node.type)
    if (entries.length === 0) return null

    for (const entry of entries) {
      const result = this.tryMatch(node, entry, ctx)
      if (result) return result
    }
    return null
  }

  private tryMatch(node: AstNode, entry: PatternEntry, ctx: LiftContext): SemanticNode | null {
    // Check constraints before anything else (gates liftStrategy too)
    if (entry.constraints && entry.constraints.length > 0) {
      if (!this.checkConstraints(node, entry.constraints)) return null
    }

    // Layer 3: liftStrategy takes priority over pattern matching
    if (entry.liftStrategy && this.liftStrategyRegistry) {
      const strategyFn = this.liftStrategyRegistry.get(entry.liftStrategy)
      if (strategyFn) {
        try {
          const result = strategyFn(node, ctx)
          // Strategy is authoritative: if it returns null, skip this pattern entirely
          // (don't fall through to auto-derive matching)
          return result
        } catch {
          // Strategy threw — skip this pattern
          return null
        }
      }
      // 🔴 **宣告了策略卻找不到它 → 這一筆樣式【整個不算】，不往下走。**
      //
      // 原本這裡只 `console.warn` 然後落到下面的 `matchSimple`——而那會
      // **無條件**建出這個身分的節點，也就是做出與策略意圖**相反**的事：
      // 策略的存在本來就是因為「要跑真邏輯才判得出來」。
      //
      // 2026-08-18 被一顆掛在 `translation_unit` 上的策略引爆：某支測試沒有
      // 登錄膠囊的策略表，於是**每一支程式的根節點**都被判成那顆概念，
      // 31 支測試一起紅。⚠️ 而在此之前它已經無聲地錯了很久——既有的 11 顆
      // 膠囊策略在同一支測試裡也都落到 `matchSimple`，只是它們的節點型別
      // （`enum_specifier`／`lambda_expression`…）剛好沒在那些程式裡出現。
      //
      // > **一個警告完卻做出相反行為的分支，比沒有警告更糟——
      // > 它讓「壞了」看起來像「注意一下」。**
      console.warn(`[PatternLifter] liftStrategy "${entry.liftStrategy}" not found in registry`)
      return null
    }

    switch (entry.patternType) {
      case 'simple':
      case 'constrained':
        return this.matchSimple(node, entry, ctx)
      case 'operatorDispatch':
        return this.matchOperatorDispatch(node, entry, ctx)
      case 'chain':
        return this.matchChain(node, entry, ctx)
      case 'composite':
        return this.matchComposite(node, entry, ctx)
      case 'unwrap':
        return this.matchUnwrap(node, entry, ctx)
      case 'contextTransform':
        return this.matchContextTransform(node, entry, ctx)
      case 'multiResult':
        return this.matchMultiResult(node, entry, ctx)
      default:
        return this.matchSimple(node, entry, ctx)
    }
  }

  // ── Simple / Constrained ──

  private matchSimple(node: AstNode, entry: PatternEntry, ctx: LiftContext): SemanticNode | null {
    if (!this.checkConstraints(node, entry.constraints)) return null

    const props: Record<string, string> = {}
    const children: Record<string, SemanticNode[]> = {}

    if (entry.fieldMappings) {
      for (const fm of entry.fieldMappings) {
        this.extractField(node, fm, ctx, props, children)
      }
    }

    return createNode(entry.componentId, props, children)
  }

  // ── Operator Dispatch ──

  private matchOperatorDispatch(node: AstNode, entry: PatternEntry, ctx: LiftContext): SemanticNode | null {
    const dispatch = entry.operatorDispatch
    if (!dispatch) return null

    const opValue = this.resolveAstField(node, dispatch.operatorField)
    if (!opValue) return null

    // Find which component this operator maps to
    let targetComponent: string | null = null
    for (const [ops, component] of Object.entries(dispatch.routes)) {
      const opList = ops.split(',').map(o => o.trim())
      if (opList.includes(opValue)) {
        targetComponent = component
        break
      }
    }
    if (!targetComponent) return null

    const props: Record<string, string> = {}
    const children: Record<string, SemanticNode[]> = {}

    const mappings = dispatch.fieldMappings ?? entry.fieldMappings ?? []
    for (const fm of mappings) {
      this.extractField(node, fm, ctx, props, children)
    }

    return createNode(targetComponent, props, children)
  }

  // ── Chain (left-recursive) ──

  private matchChain(node: AstNode, entry: PatternEntry, ctx: LiftContext): SemanticNode | null {
    const chainDef = entry.chain
    if (!chainDef) return null

    // Check if this is the outermost chain node
    const opValue = this.resolveAstField(node, '$operator')
    if (opValue !== chainDef.operator) return null

    // Walk the left-recursive chain
    const collected: AstNode[] = []
    let current: AstNode = node

    while (true) {
      const op = this.resolveAstField(current, '$operator')
      if (op !== chainDef.operator) break

      const rightChild = current.childForFieldName(chainDef.collectField)
      if (rightChild) collected.unshift(rightChild) // Prepend since we walk from outside-in

      const leftChild = current.childForFieldName('left')
      if (!leftChild) break

      if (leftChild.type === node.type) {
        current = leftChild
      } else {
        // Check if this is the root
        if (chainDef.rootMatch?.text && this.matchesChainRoot(leftChild.text, chainDef.rootMatch.text)) {
          // Found the root, done
          break
        }
        // Not the root, not a chained node - this isn't a valid chain
        return null
      }
    }

    if (collected.length === 0) return null

    // Check root match
    const leftMost = current.childForFieldName('left')
    if (chainDef.rootMatch?.text && !this.matchesChainRoot(leftMost?.text, chainDef.rootMatch.text)) {
      return null
    }

    // Lift collected nodes
    const liftedValues: SemanticNode[] = []
    for (const child of collected) {
      const lifted = ctx.lift(child)
      if (lifted) liftedValues.push(lifted)
    }

    return createNode(entry.componentId, {}, { values: liftedValues })
  }

  // ── Composite ──

  private matchComposite(node: AstNode, entry: PatternEntry, ctx: LiftContext): SemanticNode | null {
    const comp = entry.composite
    if (!comp) return null

    // Check all composite conditions
    for (const check of comp.checks) {
      const child = node.childForFieldName(check.field)
      if (!child) return null

      if (check.typeIs && child.type !== check.typeIs) return null

      if (check.operatorIn) {
        const op = this.resolveAstField(child, '$operator')
        if (!op || !check.operatorIn.includes(op)) return null
      }
    }

    // Extract properties and children
    const props: Record<string, string> = {}
    const children: Record<string, SemanticNode[]> = {}

    if (comp.extract) {
      for (const [semName, rule] of Object.entries(comp.extract)) {
        switch (rule.source) {
          case 'text': {
            const target = this.resolvePathNode(node, rule.path ?? '')
            if (target) props[semName] = target.text
            break
          }
          case 'path': {
            const target = this.resolvePathNode(node, rule.path ?? '')
            if (target) props[semName] = target.text
            break
          }
          case 'lift': {
            const target = this.resolvePathNode(node, rule.path ?? '')
            if (target) {
              const lifted = ctx.lift(target)
              if (lifted) children[semName] = [lifted]
            }
            break
          }
          case 'liftBody': {
            const target = this.resolvePathNode(node, rule.path ?? '')
            if (target) {
              const lifted = ctx.lift(target)
              if (!lifted) {
                // skip
              } else if (lifted.componentId === '_compound') {
                children[semName] = lifted.children.body ?? []
              } else {
                children[semName] = [lifted]
              }
            }
            break
          }
          case 'nodeText': {
            const target = this.resolvePathNode(node, rule.path ?? '')
            if (target) props[semName] = target.text
            break
          }
          case 'operator': {
            const target = this.resolvePathNode(node, rule.path ?? rule.field ?? '')
            if (target) {
              const op = this.resolveAstField(target, '$operator')
              if (op) props[semName] = op
            }
            break
          }
        }
      }
    }

    return createNode(entry.componentId, props, children)
  }

  // ── Unwrap ──

  private matchUnwrap(node: AstNode, entry: PatternEntry, ctx: LiftContext): SemanticNode | null {
    const childIdx = entry.unwrapChild
    if (childIdx === undefined) return null

    let child: AstNode | null = null
    if (typeof childIdx === 'number') {
      child = node.namedChildren[childIdx] ?? null
    } else {
      child = node.childForFieldName(childIdx)
    }

    if (!child) return null
    return ctx.lift(child)
  }

  // ── Context Transform ──

  private matchContextTransform(node: AstNode, entry: PatternEntry, ctx: LiftContext): SemanticNode | null {
    const ct = entry.contextTransform
    if (!ct) return null

    let child: AstNode | null = null
    if (typeof ct.liftChild === 'number') {
      child = node.namedChildren[ct.liftChild] ?? null
    } else {
      child = node.childForFieldName(ct.liftChild)
    }

    if (!child) return null
    const lifted = ctx.lift(child)
    if (!lifted) return null

    // Apply transform rules
    for (const rule of ct.transformRules) {
      if (lifted.componentId === rule.fromComponent) {
        return createNode(rule.toComponent, { ...lifted.properties }, { ...lifted.children })
      }
    }

    return lifted
  }

  // ── Multi Result ──

  private matchMultiResult(node: AstNode, entry: PatternEntry, ctx: LiftContext): SemanticNode | null {
    const mr = entry.multiResult
    if (!mr) return null

    const iterField = node.childForFieldName(mr.iterateOver)
    const items = iterField ? iterField.namedChildren : node.namedChildren

    const results: SemanticNode[] = []
    for (const item of items) {
      const lifted = ctx.lift(item)
      if (lifted) results.push(lifted)
    }

    if (mr.wrapInCompound) {
      return createNode('_compound', {}, { body: results })
    }
    return results.length === 1 ? results[0] : createNode('_compound', {}, { body: results })
  }

  // ── Helpers ──

  private checkConstraints(node: AstNode, constraints: AstPattern['constraints']): boolean {
    if (!constraints) return true
    for (const c of constraints) {
      let value: string | null = null
      if (c.field === '$text') {
        value = node.text
      } else if (c.field === '$operator') {
        const op = node.children.find((ch: AstNode) => !ch.isNamed)
        value = op?.text ?? null
      } else {
        const child = node.childForFieldName(c.field)
        if (!child) return false
        if (c.nodeType && child.type !== c.nodeType) return false
        value = child.text
      }
      if (c.text) {
        if (c.match === 'startsWith') {
          if (!value?.startsWith(c.text)) return false
        } else {
          if (value !== c.text) return false
        }
      }
    }
    return true
  }

  /** Resolve a field reference: 'fieldName' → childForFieldName, '$text' → node.text, '$operator' → first unnamed child, '$namedChildren[N]' → positional access */
  private resolveAstField(node: AstNode, ast: string): string | null {
    if (ast === '$text') return node.text
    if (ast === '$operator') {
      // Find first unnamed child (operator token)
      const op = node.children.find(c => !c.isNamed)
      return op?.text ?? null
    }
    // $namedChildren[N] — positional access to named children
    const namedChildMatch = ast.match(/^\$namedChildren\[(\d+)\]$/)
    if (namedChildMatch) {
      const idx = parseInt(namedChildMatch[1], 10)
      const child = node.namedChildren[idx]
      return child?.text ?? null
    }
    if (ast.startsWith('$')) {
      // Other special fields
      return null
    }
    const child = node.childForFieldName(ast)
    return child?.text ?? null
  }

  /** Resolve a dotted path like "initializer.declarator.text" */
  private resolvePathNode(node: AstNode, path: string): AstNode | null {
    if (!path) return node
    const parts = path.split('.')
    let current: AstNode | null = node

    for (const part of parts) {
      if (!current) return null
      if (part === 'text') return current // Special: return current node (caller reads .text)
      current = current.childForFieldName(part) ?? current.namedChildren.find(c => c.type === part) ?? null
    }
    return current
  }

  private extractField(
    node: AstNode,
    fm: FieldMapping,
    ctx: LiftContext,
    props: Record<string, string>,
    children: Record<string, SemanticNode[]>,
  ): void {
    switch (fm.extract) {
      case 'text': {
        let val = this.resolveAstField(node, fm.ast)
        // Layer 2: apply transform if specified
        if (val !== null && fm.transform && this.transformRegistry) {
          const transformFn = this.transformRegistry.get(fm.transform)
          if (transformFn) {
            try { val = transformFn(val) } catch { /* use original value */ }
          } else {
            console.warn(`[PatternLifter] transform "${fm.transform}" not found in registry`)
          }
        }
        if (val !== null) props[fm.semantic] = val
        break
      }
      case 'lift': {
        // Support $namedChildren[N] for lift mode
        const namedChildMatch = fm.ast.match(/^\$namedChildren\[(\d+)\]$/)
        let child: AstNode | null = null
        if (namedChildMatch) {
          const idx = parseInt(namedChildMatch[1], 10)
          child = node.namedChildren[idx] ?? null
        } else if (!fm.ast.startsWith('$')) {
          child = node.childForFieldName(fm.ast)
        }
        if (child) {
          const lifted = ctx.lift(child)
          if (lifted) children[fm.semantic] = [lifted]
          else children[fm.semantic] = []
        } else {
          children[fm.semantic] = []
        }
        break
      }
      case 'liftBody': {
        const child = node.childForFieldName(fm.ast)
        if (child) {
          // Try lifting the node itself first. This correctly handles:
          // - compound_statement → _compound → unwrap to body
          // - return_statement → return node
          // - expression_statement → unwrapped expression
          // For wrapper nodes (else_clause) that have no lift handler,
          // fall back to lifting their children.
          const lifted = ctx.lift(child)
          if (lifted && lifted.componentId === '_compound') {
            children[fm.semantic] = lifted.children.body ?? []
          } else if (lifted && lifted.componentId !== 'raw_code' && lifted.componentId !== 'unresolved') {
            children[fm.semantic] = [lifted]
          } else {
            // Fallback: lift named children (handles else_clause, etc.)
            const liftedChildren = ctx.liftChildren(child.namedChildren)
            // Mark direct "else if" chains: when an else_clause contains
            // a direct if_statement (not wrapped in compound_statement),
            // mark the resulting if node with isElseIf so renderer/generator
            // can distinguish from "else { if (...) {} }"
            if (child.type === 'else_clause' && child.namedChildren.length === 1
                && child.namedChildren[0].type === 'if_statement'
                && liftedChildren.length === 1 && isElseIfChainable(liftedChildren[0].componentId)) {
              liftedChildren[0].properties = { ...liftedChildren[0].properties, isElseIf: 'true' }
            }
            children[fm.semantic] = liftedChildren
          }
        } else {
          children[fm.semantic] = []
        }
        break
      }
      case 'liftChildren': {
        if (fm.ast === '$text' || fm.ast === '$children') {
          // Use all named children of the current node
          children[fm.semantic] = ctx.liftChildren(node.namedChildren)
        } else {
          const child = node.childForFieldName(fm.ast)
          if (child) {
            children[fm.semantic] = ctx.liftChildren(child.namedChildren)
          } else {
            children[fm.semantic] = []
          }
        }
        break
      }
    }
  }
}
