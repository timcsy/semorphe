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
  /**
   * **這個節點是解析器補出來的「該有而沒有」**（tree-sitter 的 MISSING）。
   *
   * ```
   * int x = 1 ⏎ int y = 2;   → MISSING「;」@ 第 2 行第 12 欄
   * ```
   *
   * 🔴 **它是缺口位置的唯一來源**。ERROR 節點指的是「這一段看不懂」，
   * 而 MISSING 指的是「**這裡少了這個東西**」——後者有確定的位置，前者沒有。
   *
   * ⚠️ 實測（spec 143 的出發點）：`whlie (x)` **不會**產生含 `whlie` 的 ERROR 節點
   * ——它是合法識別字，於是報的是後面的 MISSING `;`。
   * **所以「你是不是要打 while」拿不到那個 token，而「少了 `;`」拿得到位置。**
   *
   * ## ⚠️ 為什麼是選用的
   *
   * 理由與 `hasError` **逐字相同**：測試裡的假 AST 樹省略它，
   * 而**它們描述的正是一棵沒有缺口的樹**——讀成 `undefined`／falsy
   * 是語義正確的，不是靜默回退。
   */
  isMissing?: boolean
}

export type NodeLifter = (node: AstNode, ctx: LiftContext) => import('../types').SemanticNode | null

export interface LiftContext {
  lift: (node: AstNode) => import('../types').SemanticNode | null
  liftChildren: (nodes: AstNode[]) => import('../types').SemanticNode[]
  /** Scope-aware context for Level 2+ lifting */
  data: import('./lift-context').LiftContextData
}
