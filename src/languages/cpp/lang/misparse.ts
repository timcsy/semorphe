/**
 * **解析器自己解錯的那幾種形狀，以及怎麼把樹修回來。**
 *
 * ## 🔴 這個檔在說一件不舒服的事
 *
 * 這個專案的每一層都假設「tree-sitter 給的樹是對的」——lift 只問「這棵樹是什麼意思」。
 * 而 2026-09-19 量語料時抓到**兩種**它解錯的形狀：
 *
 * ```
 * 寫的              tree-sitter 給的                C++ 說的
 * !K--              (!K)--                          !(K--)          後置遞減綁得比 ! 緊
 * a < b && c > -d   template_function<…> - d        (a<b) && (c>-d)  a 不是樣板
 * ```
 *
 * > **一個「解析器解錯了」的缺陷，長得與「我 lift 錯了」一模一樣
 * > ——而往下追的每一層都是對的。**
 *
 * ## ⚠️ 判準：**修得起來才修**，而且要證明得出它恆真
 *
 * 這裡**不做啟發式**。兩條規則各有一個「它不可能是別的意思」的證明：
 *
 * ```
 * ① (!K)--／(-K)--／(~K)-- 在 C++ 裡【根本不合法】
 *    後置 ++／-- 的運算元必須是可改的左值，而 !／-／~ 的結果是純右值。
 *    ⟹ 看到這個形狀，唯一合法的讀法就是 !(K--)。
 *
 * ② 樣板名是一個【宣告過的變數】時，它不可能是樣板。
 *    ⟹ 那個 `<` 是小於號。
 * ```
 *
 * ## 🔴 ② 為什麼用「重解」而不是「重組」
 *
 * 重組（自己算優先級）試過，而它在第三個 `&&` 上就錯：
 *
 * ```
 * a < b && c && d > -x
 *   E = b && c && d 的頂層切點在【最後一個】 &&（左結合）
 *   重組 ⟹ (a < (b&&c)) && (d > -x)      ← 錯
 *   真正的 ⟹ ((a<b) && c) && (d > -x)
 * ```
 *
 * > **自己算一次優先級，等於在解析器旁邊養第二份文法——
 * > 而兩份文法不一致的那一天，紅的不會是這裡。**
 *
 * 🟢 處方是**讓 tree-sitter 再解一次**，而我只加一對**不可能改變語義**的括號：
 * 把那個名字包起來。括號運算式不能當樣板名，於是它只剩一種讀法。
 *
 * ## ⚠️ ② 的觸發位置踩過一次坑
 *
 * 第一版寫「`binary_expression` 的**左**子節點是 `template_function`」
 * ——而語料的 `AP325/7/7_3.cpp` 是這樣：
 *
 * ```cpp
 * return (i>=0 && i<m && j>=0 && j<n);
 *                 └──── 這一段被當成樣板，而它在 `&&` 的【右】邊
 * ```
 *
 * 後面那個 `=0` 於是變成**指定值**，整句被 lift 成「把 0 指給一個邏輯運算」。
 * 那一版跑完語料，這支照樣紅——而它紅的訊息與修之前一模一樣。
 *
 * > **一條「左子節點是 X」的規則，量到的是我舉的那個例子的形狀，不是那個病。**
 *
 * 🟢 現在的判準是：**這個運算式底下有沒有一顆可疑的樣板**，而修復做在
 * **最外層的那個運算式**上（父節點不再是運算式的那一顆）。
 *
 * ## ⚠️ 而括號**不可以留在使用者的程式裡**
 *
 * `cpp_unwrap_parens` 把括號拆掉並記成 `layoutHints.parenthesized`，
 * 產生器再照它放回去。那條樣式自己的 `_why` 逐字寫著
 * 「只拆不記的話…**而那不是使用者寫的東西**」——反過來也成立：
 * **我插進去而使用者沒寫的括號，記著就是替他加了一對。**
 *
 * 所以修復要負責擦掉自己的痕跡，而**擦的依據是位置不是名字**：
 * `ans < eps && ans > -eps` 裡那個名字出現兩次。
 */
import { Parser } from 'web-tree-sitter'
import type { SemanticNode } from '../../../core/types'
import type { AstNode, LiftContext } from '../../../core/lift/types'
import { declareAstRepair } from '../../../core/lift/ast-repairs'

// ── ① 後置遞增／遞減被解成「套在一元運算外面」 ──

/**
 * @returns 修得動的話回 `{ unaryOp, inner }`（`inner` 是該被遞減的那個節點），
 *          否則 `null`。
 */
export function postfixUnderUnary(node: AstNode): { unaryOp: string; inner: AstNode } | null {
  if (node.type !== 'update_expression') return null
  // 前綴形（`--!K`）不在此列：那個形狀 tree-sitter 沒有解錯，而它本來就不合法。
  const first = node.children[0]
  if (first && !first.isNamed && (first.text === '++' || first.text === '--')) return null
  const arg = node.childForFieldName('argument') ?? node.namedChildren[0]
  if (!arg || arg.type !== 'unary_expression') return null
  const unaryOp = arg.children.find((c) => !c.isNamed)?.text ?? ''
  /**
   * ⚠️ **只收那三個**。`*p--` 與 `&x--` 沒有進來過（tree-sitter 解得對），
   * 而它們的證明也不一樣：`(*p)--` **是合法的 C++**。
   * > **同一條重寫規則，對「本來就不合法」與「合法但少見」的成立理由不同。**
   */
  if (unaryOp !== '!' && unaryOp !== '-' && unaryOp !== '~') return null
  const inner = arg.childForFieldName('argument') ?? arg.namedChildren[0]
  return inner ? { unaryOp, inner } : null
}

// ── ② 小於號被當成樣板的角括號 ──

/**
 * 一個運算式節點嗎——`parenthesized_expression` 也算（它也是運算式）。
 *
 * ⚠️ **收 `undefined`**：介面宣告的是 `parent: AstNode | null`，而合成的測試節點
 * 給的是 `undefined`。照著宣告寫 `n !== null` 的症狀是 **28 支單元測試同時炸**
 *（`Cannot read properties of undefined`）——而那些測試根本不碰這條規則。
 *
 * > **一個型別宣告說「不會是 undefined」，而它管得到的只有走型別檢查的那一側
 * > ——測試的合成物件是從另一側進來的。**
 */
function isExpression(n: AstNode | null | undefined): boolean {
  return n != null && typeof n.type === 'string' && n.type.endsWith('_expression')
}

/**
 * 這個運算式底下，有沒有一顆**其實不是樣板**的 `template_function`。
 *
 * 🔴 **只回第一顆**——修完會重解，第二顆（如果有）在下一輪自然被看到。
 * 而那也是終止的保證：每一輪嚴格少掉一顆。
 */
export function suspectTemplate(node: AstNode, isVariable: (name: string) => boolean): AstNode | null {
  let hit: AstNode | null = null
  const walk = (n: AstNode): void => {
    if (hit) return
    if (n.type === 'template_function') {
      const name = n.childForFieldName('name')
      if (name && name.type === 'identifier' && isVariable(name.text)) { hit = name; return }
    }
    for (const c of n.namedChildren) walk(c)
  }
  walk(node)
  return hit
}

/** 快取：同一個語言只開一支解析器。 */
const PARSERS = new WeakMap<object, Parser>()

/**
 * 這個節點是哪個語言解出來的——拿一支同語言的解析器回來。
 *
 * ⚠️ `AstNode` 是一個結構型介面，而真正傳進來的是 web-tree-sitter 的 `Node`
 *（每一個呼叫點都 `as never` 過）。`tree.language` 只有那一側有。
 * 🔴 **拿不到就回 `null`**——那時整段照舊走降級（會出聲），
 *    **不要靜默地回原本那棵錯的樹**。
 */
function parserFor(node: AstNode): Parser | null {
  const language = (node as unknown as { tree?: { language?: unknown } }).tree?.language
  if (!language) return null
  let parser = PARSERS.get(language as object)
  if (!parser) {
    parser = new Parser()
    parser.setLanguage(language as never)
    PARSERS.set(language as object, parser)
  }
  return parser
}

/** 包住重解用的那個函式殼——長度是常數，而擦括號那一步要用它算欄位。 */
const WRAP_PREFIX = 'auto __semorphe_reparse(){ return '

/**
 * **把一段運算式文字用同一個語言重解一次**，回傳那個運算式節點。
 *
 * ⚠️ 包成一個回傳語句再解——運算式不能單獨站在翻譯單元裡。
 * ⚠️ 用 `return` 而不是 `(…);`：後者會多出一層括號，
 *    而那一層要靠「括號會被拆掉」這個【別處的性質】才無害。
 * ⚠️ **有語法錯誤就回 `null`**：一棵帶 ERROR 的樹會讓整段降級，
 *    而那比原本那棵錯的樹更難查。
 */
export function reparseExpression(node: AstNode, text: string): AstNode | null {
  const parser = parserFor(node)
  if (!parser) return null
  const wrapped = parser.parse(`${WRAP_PREFIX}${text}; }`)
  if (!wrapped || wrapped.rootNode.hasError) return null
  let found: AstNode | null = null
  const walk = (n: AstNode): void => {
    if (found) return
    if (n.type === 'return_statement') { found = n.namedChildren[0] ?? null; return }
    for (const c of n.namedChildren) walk(c)
  }
  walk(wrapped.rootNode as never)
  return found
}

// ── 登記 ──

/**
 * **兩條規則的登記。**
 *
 * ⚠️ 它們走的是「換一棵樹」的掛鉤（`core/lift/ast-repairs.ts`），
 * 而不是任何一顆元件的 lift——理由是**時機**：
 *
 * ```
 * 元件的 lift        樣式辨識【之後】才輪到手寫的        → 那時樹已經被讀錯了
 * 樣式（JSON）       表達不出「這個名字宣告過嗎」的肯定形 → 詞彙裡只有 notDeclared
 * 換一棵樹           在所有辨識之前                       → 🟢
 * ```
 *
 * 🔴 **實測過中間那一步才知道**：第一版把修復寫進 `binary_expression` 的手寫
 * lifter，而它**一次都沒有被叫到**——`cpp/arithmetic/lift-pattern.json` 先
 * 認領走了 `template_function - d`。單元測試會綠（規則函式自己是對的），
 * 而語料一支都沒修好。
 *
 * > **一個掛在「手寫 lifter」上的修復，修的是那些沒有樣式認領的節點
 * > ——而解析器解錯的地方，樣式照樣認領得很順。**
 */
export function registerMisparseRepairs(): void {
  /** ① `!K--` → `!(K--)`：重解成一棵把括號補在對的地方的樹。 */
  declareAstRepair((node: AstNode, ctx: LiftContext): SemanticNode | null => {
    const under = postfixUnderUnary(node)
    if (!under) return null
    /**
     * ⚠️ 用**重解**而不是自己組節點——自己組的話就要自己維護一份
     * 「哪個符號是哪顆元件」的分派表，而那份表會在加第六個運算子的那天落後。
     */
    const op = node.children.find((c) => !c.isNamed && (c.text === '++' || c.text === '--'))?.text
    if (!op) return null
    const inserted = `${under.unaryOp}(`
    const fixed = reparseExpression(node, `${inserted}${under.inner.text}${op})`)
    if (!fixed) return null
    const lifted = ctx.lift(fixed)
    /**
     * 🔴 **把我插進去的那對括號擦掉**——原文是 `!K--`，沒有括號。
     * C++ 的後置 `--` 本來就綁得比 `!` 緊，所以產生器照優先級也不會補。
     */
    if (lifted) stripParenHintAt(lifted, 0, WRAP_PREFIX.length + inserted.length)
    return lifted
  })

  /** ② `a < b && c > -d`：那個名字是變數的話，`<` 是小於號。 */
  declareAstRepair((node: AstNode, ctx: LiftContext): SemanticNode | null => {
    // 只在**最外層**的運算式上動手——見檔頭「觸發位置踩過一次坑」。
    if (!isExpression(node) || isExpression(node.parent)) return null
    /**
     * ⚠️ **便宜的前置判斷**：這條規則要走整棵子樹，而它掛在「每一個節點都問一次」
     * 的掛鉤上。沒有角括號就不可能有樣板——一次字串搜尋換掉一次子樹走訪。
     * 🔴 而它**不是判準**（判準在 `suspectTemplate`）：只是先擋掉不可能的那些。
     */
    if (!node.text.includes('<')) return null
    // 🔴 **宣告過才算可疑**——查不到就讓開（它可能真的是樣板）。
    const name = suspectTemplate(node, (n) => ctx.data.getType(n) !== null)
    if (!name) return null

    const at = name.startIndex - node.startIndex
    if (at < 0 || at >= node.text.length) return null
    const patched = `${node.text.slice(0, at)}(${name.text})${node.text.slice(at + name.text.length)}`
    const fixed = reparseExpression(node, patched)
    if (!fixed) return null
    /**
     * ⚠️ 重解出來還有同一顆可疑樣板的話就**不要用它**——那代表判斷錯了，
     * 而回一棵「我以為修好了」的樹比回原本那棵更難查。
     * （它同時是**終止保證**：每一輪嚴格少掉一顆。）
     */
    if (suspectTemplate(fixed, (n) => n === name.text)) return null
    const lifted = ctx.lift(fixed)
    if (lifted) stripParenHintAt(lifted, 0, WRAP_PREFIX.length + at + 1)
    return lifted
  })
}

/**
 * 把**那個位置上**的節點身上的「這裡本來有括號」註記拿掉。
 *
 * 🔴 **依據是位置不是名字**（2026-09-19）：`ans < eps && ans > -eps` 裡
 * 那個名字出現兩次，而我插的括號只在其中一個上面。照名字擦會擦錯一個
 * ——而那個錯的症狀是**另一個位置憑空多出一對括號**，不是紅。
 *
 * ⚠️ 座標是**重解後那個殼**的座標（單行，所以列永遠是 0）。
 */
function stripParenHintAt(root: SemanticNode, line: number, column: number): boolean {
  const r = root.metadata?.sourceRange
  if (r && r.startLine === line && r.startColumn === column
      && root.metadata?.layoutHints?.parenthesized === true) {
    delete root.metadata.layoutHints.parenthesized
    return true
  }
  for (const kids of Object.values(root.slots ?? {})) {
    for (const k of kids) if (stripParenHintAt(k, line, column)) return true
  }
  return false
}
