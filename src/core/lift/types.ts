/** Minimal interface for tree-sitter AST nodes */
export interface AstNode {
  type: string
  text: string
  isNamed: boolean
  children: AstNode[]
  namedChildren: AstNode[]
  childForFieldName(name: string): AstNode | null
  /**
   * 父節點與起始位移。
   *
   * 這兩個原本不在介面裡，而 lifters 需要它們——於是那幾處寫成 `any`。
   * **`any` 藏住的是「這個抽象不完整」，不是「型別難寫」。** 補進來之後
   * 那 12 個 `any` 全部消失。見 specs/057-single-source-input-names
   */
  parent: AstNode | null
  startIndex: number
  startPosition: { row: number; column: number }
  endPosition: { row: number; column: number }
}

export type NodeLifter = (node: AstNode, ctx: LiftContext) => import('../types').SemanticNode | null

export interface LiftContext {
  lift: (node: AstNode) => import('../types').SemanticNode | null
  liftChildren: (nodes: AstNode[]) => import('../types').SemanticNode[]
  /** Scope-aware context for Level 2+ lifting */
  data: import('./lift-context').LiftContextData
}
