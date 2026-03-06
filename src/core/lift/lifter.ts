import type { SemanticNode } from '../types'
import type { AstNode, NodeLifter, LiftContext } from './types'
import { createNode } from '../semantic-tree'
import { LiftContextData } from './lift-context'
import { PatternLifter } from './pattern-lifter'

export class Lifter {
  private lifters = new Map<string, NodeLifter>()
  private patternLifter: PatternLifter | null = null
  private handWrittenPriority = new Set<string>()

  register(nodeType: string, lifter: NodeLifter): void {
    this.lifters.set(nodeType, lifter)
  }

  /** Mark node types where hand-written lifters should run before PatternLifter */
  preferHandWritten(nodeTypes: string[]): void {
    for (const t of nodeTypes) this.handWrittenPriority.add(t)
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

    const useHandWrittenFirst = this.handWrittenPriority.has(node.type)

    // Level 1a / 1b ordering depends on whether hand-written has priority
    const tryPattern = (): SemanticNode | null => {
      if (!this.patternLifter) return null
      const r = this.patternLifter.tryLift(node, ctx)
      if (r) {
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
      return r
    }

    const tryHandWritten = (): SemanticNode | null => {
      const lifter = this.lifters.get(node.type)
      if (!lifter) return null
      const r = lifter(node, ctx)
      if (r) {
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
      return r
    }

    const first = useHandWrittenFirst ? tryHandWritten : tryPattern
    const second = useHandWrittenFirst ? tryPattern : tryHandWritten

    const result1 = first()
    if (result1) return result1
    const result2 = second()
    if (result2) return result2

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
