import type { SemanticNode } from '../types'
import type { AstNode, NodeLifter, LiftContext } from './types'
import { createNode } from '../semantic-tree'
import { LiftContextData } from './lift-context'
import { PatternLifter } from './pattern-lifter'

export class Lifter {
  private lifters = new Map<string, NodeLifter>()
  private patternLifter: PatternLifter | null = null

  register(nodeType: string, lifter: NodeLifter): void {
    this.lifters.set(nodeType, lifter)
  }

  /** Set the JSON-driven pattern lifter engine */
  setPatternLifter(pl: PatternLifter): void {
    this.patternLifter = pl
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
        r.metadata.sourceRange = {
          startLine: node.startPosition.row,
          startColumn: node.startPosition.column,
          endLine: node.endPosition.row,
          endColumn: node.endPosition.column,
        }
      }
    }

    // Single pipeline: PatternLifter first, hand-written fallback
    if (this.patternLifter) {
      const patternResult = this.patternLifter.tryLift(node, ctx)
      if (patternResult) {
        // Post-process: func_call_expr in statement context → func_call
        if (patternResult.concept === 'func_call_expr' && node.type === 'expression_statement') {
          const converted = createNode('func_call', patternResult.properties, patternResult.children)
          addSourceRange(converted)
          return converted
        }
        addSourceRange(patternResult)
        return patternResult
      }
    }

    const lifter = this.lifters.get(node.type)
    if (lifter) {
      const handWrittenResult = lifter(node, ctx)
      if (handWrittenResult) {
        addSourceRange(handWrittenResult)
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
        unresolved.metadata = {
          rawCode: node.text,
          confidence: 'inferred',
          sourceRange: {
            startLine: node.startPosition.row,
            startColumn: node.startPosition.column,
            endLine: node.endPosition.row,
            endColumn: node.endPosition.column,
          },
        }
        return unresolved
      }
    }

    // Level 4: degrade to raw_code
    const raw = createNode('raw_code', {})
    raw.metadata = {
      rawCode: node.text,
      sourceRange: {
        startLine: node.startPosition.row,
        startColumn: node.startPosition.column,
        endLine: node.endPosition.row,
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
      const lifted = this.liftWithContext(node, contextData)
      if (!lifted) continue
      // Flatten _compound nodes (one AST node → multiple semantic nodes)
      if (lifted.concept === '_compound') {
        results.push(...(lifted.children.body ?? []))
      } else {
        results.push(lifted)
      }
    }
    return results
  }
}
