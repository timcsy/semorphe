import { commentSyntax } from '../comment-syntax'
import type { SemanticNode, DegradationCause } from '../types'
import type { AstNode, NodeLifter, LiftContext } from './types'
import { createNode } from '../semantic-tree'
import { LiftContextData } from './lift-context'
import { PatternLifter } from './pattern-lifter'

export class Lifter {
  private lifters = new Map<string, NodeLifter>()
  private patternLifter: PatternLifter | null = null
  private astNodeConceptMap: Map<string, string> | null = null

  register(nodeType: string, lifter: NodeLifter): void {
    this.lifters.set(nodeType, lifter)
  }

  /** Set the JSON-driven pattern lifter engine */
  setPatternLifter(pl: PatternLifter): void {
    this.patternLifter = pl
  }

  /** Set AST nodeType → conceptId mapping for unsupported detection */
  setAstNodeConceptMap(map: Map<string, string>): void {
    this.astNodeConceptMap = map
  }

  lift(node: AstNode): SemanticNode | null {
    return this.liftWithContext(node, new LiftContextData())
  }

  /**
   * 把辨識出來的宣告寫進脈絡。
   *
   * ⚠️ **這個機制一直都在，而在此之前零呼叫者。** `declare` / `getType` /
   * `pushScope` / `lookup` 四個方法從沒被用過，於是辨識層那句「為了避免
   * 型別消歧問題」讀起來像「做不到」——而它其實只是沒插電。
   * 見 `knowledge/concepts/執行機構.md`「機制有了，沒人接上」第五個實例。
   */
  private recordDeclaration(r: SemanticNode, data: LiftContextData): void {
    const name = r.properties?.name
    if (name === undefined) return
    // 型別的來源依概念而異：一般宣告放在 `type`，容器宣告的專屬概念名本身
    // 就帶著型別（`cpp_string_declare` → string）。後者更可靠。
    const fromConcept = /^cpp_(\w+?)_declare$/.exec(r.concept ?? '')?.[1]
    const type = fromConcept ?? (r.properties?.type !== undefined ? String(r.properties.type) : undefined)
    if (type) data.declare(String(name), type)
  }

  /** Lift with an existing context (for recursive calls that share scope) */
  liftWithContext(node: AstNode, contextData: LiftContextData): SemanticNode | null {
    // 複合敘述（`{ … }`）是一個作用域。
    //
    // ⚠️ 掛在**入口**而不是某一條辨識路徑上——第一版掛在「部分可辨識」那條
    // 後備路徑，而複合敘述早被前面的 pattern 處理掉了，於是那段程式從來
    // 沒跑過。遮蔽的測試因此仍然紅著，而其餘五支都綠——**那正是「只驗一個
    // 方向」會漏掉的東西**。
    if (node.type === 'compound_statement') {
      contextData.pushScope()
      try {
        return this.liftInner(node, contextData)
      } finally {
        contextData.popScope()
      }
    }
    return this.liftInner(node, contextData)
  }

  private liftInner(node: AstNode, contextData: LiftContextData): SemanticNode | null {
    const ctx: LiftContext = {
      lift: (n) => this.liftWithContext(n, contextData),
      liftChildren: (nodes) => this.liftStatementsWithContext(nodes, contextData),
      data: contextData,
    }

    const addSourceRange = (r: SemanticNode): void => {
      // 宣告記錄掛在這裡，因為**三個回傳點都經過它**——掛在個別回傳點會漏。
      this.recordDeclaration(r, contextData)
      if (!r.metadata) r.metadata = {}
      if (!r.metadata.sourceRange) {
        // Tree-sitter endPosition points AFTER the last character.
        // If a node ends with a newline, endPosition = {row: nextLine, column: 0}.
        // Adjust endLine to the actual last content line.
        const endLine = node.endPosition.column === 0 && node.endPosition.row > node.startPosition.row
          ? node.endPosition.row - 1
          : node.endPosition.row
        r.metadata.sourceRange = {
          startLine: node.startPosition.row,
          startColumn: node.startPosition.column,
          endLine,
          endColumn: node.endPosition.column,
        }
      }
      // Preserve raw source text for expression fallback rendering
      if (!r.metadata.rawCode && node.text) {
        r.metadata.rawCode = node.text
      }
    }

    const setConfidenceHigh = (r: SemanticNode): void => {
      if (!r.metadata) r.metadata = {}
      if (!r.metadata.confidence) r.metadata.confidence = 'high'
    }

    // Single pipeline: PatternLifter first, hand-written fallback
    if (this.patternLifter) {
      const patternResult = this.patternLifter.tryLift(node, ctx)
      if (patternResult) {
        // Post-process: func_call_expr in statement context → func_call
        if (patternResult.concept === 'func_call_expr' && node.type === 'expression_statement') {
          const converted = createNode('func_call', patternResult.properties, patternResult.children)
          addSourceRange(converted)
          setConfidenceHigh(converted)
          return converted
        }
        addSourceRange(patternResult)
        setConfidenceHigh(patternResult)
        return patternResult
      }
    }

    const lifter = this.lifters.get(node.type)
    if (lifter) {
      const handWrittenResult = lifter(node, ctx)
      if (handWrittenResult) {
        addSourceRange(handWrittenResult)
        setConfidenceHigh(handWrittenResult)
        return handWrittenResult
      }
    }

    // Level 3: check for partially-liftable structures
    if (node.namedChildren.length > 0) {
      const liftedChildren = this.liftStatementsWithContext(node.namedChildren, contextData)
      if (liftedChildren.length > 0 && liftedChildren.some(c => c.concept !== 'raw_code')) {
        // Has some meaningful sub-nodes — create unresolved node preserving children
        const unresolved = createNode('unresolved', { node_type: node.type }, {
          children: liftedChildren,
        })
        const endLine = node.endPosition.column === 0 && node.endPosition.row > node.startPosition.row
          ? node.endPosition.row - 1 : node.endPosition.row
        unresolved.metadata = {
          rawCode: node.text,
          confidence: 'inferred',
          sourceRange: {
            startLine: node.startPosition.row,
            startColumn: node.startPosition.column,
            endLine,
            endColumn: node.endPosition.column,
          },
        }
        return unresolved
      }
    }

    // Level 4: degrade to raw_code
    const raw = createNode('raw_code', {})
    const endLineRaw = node.endPosition.column === 0 && node.endPosition.row > node.startPosition.row
      ? node.endPosition.row - 1 : node.endPosition.row
    raw.metadata = {
      rawCode: node.text,
      confidence: 'raw_code',
      degradationCause: this.determineDegradationCause(node),
      sourceRange: {
        startLine: node.startPosition.row,
        startColumn: node.startPosition.column,
        endLine: endLineRaw,
        endColumn: node.endPosition.column,
      },
    }
    return raw
  }

  /** Lift a list of AST nodes into statement SemanticNodes, skipping nulls */
  liftStatements(nodes: AstNode[]): SemanticNode[] {
    return this.liftStatementsWithContext(nodes, new LiftContextData())
  }

  private liftStatementsWithContext(nodes: AstNode[], contextData: LiftContextData): SemanticNode[] {
    const results: SemanticNode[] = []
    for (const node of nodes) {
      if (!node.isNamed) continue

      // Handle comment nodes: attach as annotation or standalone
      if (node.type === 'comment') {
        const prev = results.length > 0 ? results[results.length - 1] : null
        // Same row as previous → inline annotation
        if (prev && node.startPosition.row === (prev.metadata?.sourceRange?.endLine ?? -1)) {
          if (!prev.annotations) prev.annotations = []
          prev.annotations.push({
            type: 'comment',
            // 剝除註解符號的規則已搬進語言套件——核心不該知道 `//` 長什麼樣
            text: commentSyntax().strip(node.text),
            position: 'inline',
          })
          continue
        }
        // Otherwise → standalone comment node (handled by pattern lifter or fallback)
      }

      const lifted = this.liftWithContext(node, contextData)
      if (!lifted) continue

      // Check if next node is a same-row comment (look-ahead for inline annotation)
      // This is handled in the comment branch above when we process the comment node

      // Flatten _compound nodes (one AST node → multiple semantic nodes)
      if (lifted.concept === '_compound') {
        results.push(...(lifted.children.body ?? []))
      } else {
        results.push(lifted)
      }
    }
    return results
  }

  /** Determine why a node was degraded to raw_code */
  private determineDegradationCause(node: AstNode): DegradationCause {
    // Check for syntax error (tree-sitter ERROR node)
    if (node.type === 'ERROR' || this.hasErrorDescendant(node)) {
      return 'syntax_error'
    }

    // Check if AST nodeType maps to a known concept
    if (this.isKnownNodeType(node.type)) {
      return 'unsupported'
    }

    // Unknown node type entirely
    return 'nonstandard_but_valid'
  }

  private hasErrorDescendant(node: AstNode): boolean {
    if (node.type === 'ERROR') return true
    for (const child of node.children) {
      if (this.hasErrorDescendant(child)) return true
    }
    return false
  }

  /** Check if an AST node type corresponds to a known concept */
  private isKnownNodeType(nodeType: string): boolean {
    // Check explicit AST→concept mapping
    if (this.astNodeConceptMap?.has(nodeType)) return true

    // Check if PatternLifter has patterns for this node type
    if (this.patternLifter?.hasPatternForNodeType(nodeType)) return true

    // Check if we have a hand-written lifter for this node type
    if (this.lifters.has(nodeType)) return true

    return false
  }
}
