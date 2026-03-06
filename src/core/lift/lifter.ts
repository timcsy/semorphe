import type { SemanticNode } from '../types'
import type { AstNode, NodeLifter, LiftContext } from './types'
import { createNode } from '../semantic-tree'
import { LiftContextData } from './lift-context'

export class Lifter {
  private lifters = new Map<string, NodeLifter>()

  register(nodeType: string, lifter: NodeLifter): void {
    this.lifters.set(nodeType, lifter)
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

    const lifter = this.lifters.get(node.type)
    if (lifter) {
      const result = lifter(node, ctx)
      if (result) {
        // Level 2: attach source range metadata
        if (!result.metadata) result.metadata = {}
        if (!result.metadata.sourceRange) {
          result.metadata.sourceRange = {
            startLine: node.startPosition.row,
            startColumn: node.startPosition.column,
            endLine: node.endPosition.row,
            endColumn: node.endPosition.column,
          }
        }
        return result
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
