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
  /**
   * **這個節點底下有沒有語法錯誤。**
   *
   * ⚠️ 解析器有**兩種**標記錯誤的方式，而這是第二種：
   *
   * ```
   * int x = 1 ⏎ cout << x;   → declaration → init_declarator → ERROR ⟪1⟫   實體節點
   * int x = 1 ⏎ return 0;    → declaration [hasError]，【沒有 ERROR 節點】   旗標
   * ```
   *
   * 只認得前者的話，**「下一行是什麼」決定了漏分號會不會被抓到**
   * ——而那對學生毫無意義（2026-08-14，spec `121`）。
   *
   * ## ⚠️ 為什麼是選用的
   *
   * 測試裡的假 AST 樹省略它——而**它們描述的正是一棵沒有錯誤的樹**，
   * 讀成 `undefined`／falsy 是語義正確的，不是靜默回退。
   *
   * ⚠️ 而改成必要欄位在這裡**沒有保護力**：`tests/` 不在 `tsconfig` 的
   * `include` 裡（見 `knowledge/experience.md`「刪掉欄位讓型別檢查去找」）。
   */
  hasError?: boolean
}

export type NodeLifter = (node: AstNode, ctx: LiftContext) => import('../types').SemanticNode | null

export interface LiftContext {
  lift: (node: AstNode) => import('../types').SemanticNode | null
  liftChildren: (nodes: AstNode[]) => import('../types').SemanticNode[]
  /** Scope-aware context for Level 2+ lifting */
  data: import('./lift-context').LiftContextData
}
