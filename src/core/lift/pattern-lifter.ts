import type { SemanticNode, BlockSpec, LiftPattern, FieldMapping, AstPattern } from '../types'
import type { AstNode, LiftContext } from './types'
import { createNode } from '../semantic-tree'

interface PatternEntry {
  conceptId: string
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
}

/**
 * JSON-driven pattern lifter engine.
 * Lifts AST nodes to SemanticNodes using patterns loaded from JSON definitions.
 */
export class PatternLifter {
  private patterns = new Map<string, PatternEntry[]>()

  /** Load patterns from BlockSpec JSON definitions (simple/constrained patterns) */
  loadBlockSpecs(specs: BlockSpec[]): void {
    for (const spec of specs) {
      const ap = spec.astPattern
      if (!ap || ap.nodeType.startsWith('_')) continue

      const entry: PatternEntry = {
        conceptId: spec.concept?.conceptId ?? spec.id,
        patternType: ap.patternType ?? (ap.constraints.length > 0 ? 'constrained' : 'simple'),
        priority: this.calcPriority(ap.patternType ?? 'simple', ap.constraints?.length ?? 0, 0),
        constraints: ap.constraints,
        fieldMappings: ap.fieldMappings,
        operatorDispatch: ap.operatorDispatch,
        chain: ap.chain,
        composite: ap.composite,
        unwrapChild: ap.unwrapChild,
        contextTransform: ap.contextTransform,
        multiResult: ap.multiResult,
      }

      this.addPattern(ap.nodeType, entry)
    }
  }

  /** Load patterns from lift-patterns.json (complex patterns: chain, composite, operatorDispatch, etc.) */
  loadLiftPatterns(patterns: LiftPattern[]): void {
    for (const lp of patterns) {
      const entry: PatternEntry = {
        conceptId: lp.concept?.conceptId ?? '',
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
    const entries = this.patterns.get(node.type)
    if (!entries) return null

    for (const entry of entries) {
      const result = this.tryMatch(node, entry, ctx)
      if (result) return result
    }
    return null
  }

  private tryMatch(node: AstNode, entry: PatternEntry, ctx: LiftContext): SemanticNode | null {
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

    return createNode(entry.conceptId, props, children)
  }

  // ── Operator Dispatch ──

  private matchOperatorDispatch(node: AstNode, entry: PatternEntry, ctx: LiftContext): SemanticNode | null {
    const dispatch = entry.operatorDispatch
    if (!dispatch) return null

    const opValue = this.resolveAstField(node, dispatch.operatorField)
    if (!opValue) return null

    // Find which concept this operator maps to
    let targetConcept: string | null = null
    for (const [ops, concept] of Object.entries(dispatch.routes)) {
      const opList = ops.split(',').map(o => o.trim())
      if (opList.includes(opValue)) {
        targetConcept = concept
        break
      }
    }
    if (!targetConcept) return null

    const props: Record<string, string> = {}
    const children: Record<string, SemanticNode[]> = {}

    const mappings = dispatch.fieldMappings ?? entry.fieldMappings ?? []
    for (const fm of mappings) {
      this.extractField(node, fm, ctx, props, children)
    }

    return createNode(targetConcept, props, children)
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
        if (chainDef.rootMatch?.text && leftChild.text === chainDef.rootMatch.text) {
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
    if (chainDef.rootMatch?.text && leftMost?.text !== chainDef.rootMatch.text) {
      return null
    }

    // Lift collected nodes
    const liftedValues: SemanticNode[] = []
    for (const child of collected) {
      const lifted = ctx.lift(child)
      if (lifted) liftedValues.push(lifted)
    }

    return createNode(entry.conceptId, {}, { values: liftedValues })
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
              const bodyChildren = target.namedChildren
              children[semName] = ctx.liftChildren(bodyChildren)
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

    return createNode(entry.conceptId, props, children)
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
      if (lifted.concept === rule.fromConcept) {
        return createNode(rule.toConcept, { ...lifted.properties }, { ...lifted.children })
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
      const child = node.childForFieldName(c.field)
      if (!child) return false
      if (c.text && child.text !== c.text) return false
      if (c.nodeType && child.type !== c.nodeType) return false
    }
    return true
  }

  /** Resolve a field reference: 'fieldName' → childForFieldName, '$text' → node.text, '$operator' → first unnamed child */
  private resolveAstField(node: AstNode, ast: string): string | null {
    if (ast === '$text') return node.text
    if (ast === '$operator') {
      // Find first unnamed child (operator token)
      const op = node.children.find(c => !c.isNamed)
      return op?.text ?? null
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
        const val = this.resolveAstField(node, fm.ast)
        if (val !== null) props[fm.semantic] = val
        break
      }
      case 'lift': {
        const child = fm.ast.startsWith('$') ? null : node.childForFieldName(fm.ast)
        if (child) {
          const lifted = ctx.lift(child)
          if (lifted) children[fm.semantic] = [lifted]
        }
        break
      }
      case 'liftBody': {
        const child = node.childForFieldName(fm.ast)
        if (child) {
          children[fm.semantic] = ctx.liftChildren(child.namedChildren)
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
          }
        }
        break
      }
    }
  }
}
