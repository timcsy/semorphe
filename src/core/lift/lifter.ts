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

  /** Lift with an existing context (for recursive calls that share scope) */
  liftWithContext(node: AstNode, contextData: LiftContextData): SemanticNode | null {
    const ctx: LiftContext = {
      lift: (n) => this.liftWithContext(n, contextData),
      liftChildren: (nodes) => this.liftStatementsWithContext(nodes, contextData),
      data: contextData,
    }

    const addSourceRange = (r: SemanticNode): void => {
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
            text: node.text,
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
