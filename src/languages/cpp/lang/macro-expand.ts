/**
 * **帶參數的巨集（`#define rep(i,n) for(...)`）——展開它，而不改掉學生寫的字。**
 *
 * ## 🪦 這不是那座墓碑（`history/014`）
 *
 * 那座墓碑否決的是「**實作一個 C preprocessor**」，理由逐字：
 * 「重新實現 C preprocessor 的正確性成本極高」——**那句話仍然成立**
 *（`#` 字串化、`##` 連接、可變引數、遞迴、與條件編譯的交互，語料各 0 處）。
 *
 * ⚠️ 而它的括號裡還有一句：「**學生程式碼不會用框架巨集**」
 * ——2026-09-20 量語料把它證偽了：218 支學生程式裡 **4 支**用函式形巨集，
 * 而且**只有一種形狀**（展開成一個 `for` 的表頭）。
 *
 * > **一個以「使用者不會這樣寫」為理由的決定，
 * > 它的有效期等於那句話沒有被量過的時間。**
 *
 * 這個檔做的是**一條有唯一讀法的樹修復**，不是一個前處理器：
 * 巨集在同一個翻譯單元裡定義過時，C 的展開結果**是唯一的**，不是啟發式。
 *
 * ## 🔴 為什麼非修不可——今天的產出是【靜默錯的】
 *
 * tree-sitter 對 `rep(i,m) s += i;` **不給 ERROR**，它給一棵看起來合法的樹：
 * 兩個並列的語句（一個呼叫、一個運算式）。於是辨識把它們併成一顆
 * `cpp:var_assign_compound`，而**`s` 整個蒸發**：
 *
 * ```
 * 學生寫的   rep(i,m) s += i;      產回去   rep(i, m) += i;    🔴 s 不見了
 * ```
 *
 * 執行那一路是誠實的（`#define` 那一行報 `UNRECOGNIZED_CODE`），
 * **而程式碼那一路不是**。
 *
 * > **「這個東西我們不支援」如果只在【執行】那一路出聲，
 * > 那麼【程式碼】那一路的沉默就是一個錯的答案。**
 *
 * ## 一字不差：原文的拼法存進 `layoutHints`
 *
 * `metadata.layoutHints` 的檔頭逐字：「投影記住它，積木看不到它」。
 * 這裡存 `macroHeader: "rep(i,m)"`（**使用處的原文**），產生器照它印回去。
 *
 * 🔴 **而「積木改過之後這一格會不在」在這個消費者身上是【安全性質】**，
 * 不只是可接受的損失：迴圈的界線一旦在積木那側被改過，再印 `rep(i,m)` 就是謊話。
 *
 * ## ⚠️ 接手的條件——缺一就回 `null`（契約①）
 *
 * ```
 * ① 那個名字在【同一個翻譯單元】裡被 preproc_function_def 定義過
 * ② 代入引數之後那段文字【解得乾淨】（沒有 ERROR）
 * ③ 展開出來的最外層是一顆【收得下 macroHeader 的】元件
 *    ——性狀 `macroHeaderHost`，不是身分
 * ```
 *
 * 🔴 **刻意沒有中途站**：一個「認得出巨集而還原不回去」的中間態，
 * 產出的是**看起來對而少東西**的樹——那正是上面那個病。
 */
import type { SemanticNode } from '../../../core/types'
import type { AstNode, LiftContext } from '../../../core/lift/types'
import { declareAstRepair } from '../../../core/lift/ast-repairs'
import { createNode } from '../../../core/semantic-tree'
import { componentTraits } from '../../../core/component/traits'
import { parserFor } from './misparse'
import { buildRawCode } from '../../../components/cpp/raw_code/lift'

/** 一個函式形巨集：名字、參數名、展開文字。 */
interface FuncMacro {
  params: string[]
  body: string
}

/** 每一棵樹掃一次就好——同一次 lift 會問很多遍。 */
const MACROS = new WeakMap<object, Map<string, FuncMacro>>()

/**
 * 這棵樹裡定義過哪些函式形巨集。
 *
 * ⚠️ **範圍是【整個翻譯單元】而不是「這一行之前」**——C 的巨集有作用順序，
 * 而一個定義在使用之後的巨集在真實程式裡不會出現（編不過）。
 * 不模擬那個順序是刻意的：模擬它要記行號，而那會讓這條規則從
 * 「唯一讀法」變成「我對順序的理解」。
 */
function macrosOf(node: AstNode): Map<string, FuncMacro> {
  const tree = (node as unknown as { tree?: object }).tree
  if (!tree) return new Map()
  const hit = MACROS.get(tree)
  if (hit) return hit
  const out = new Map<string, FuncMacro>()
  const root = (tree as { rootNode?: AstNode }).rootNode
  if (root) {
    const walk = (n: AstNode): void => {
      if (n.type === 'preproc_function_def') {
        const name = n.childForFieldName('name')?.text
        const params = n.childForFieldName('parameters')
        const body = n.childForFieldName('value')?.text
        if (name && params && body !== undefined) {
          out.set(name, {
            params: params.namedChildren.map((c) => c.text),
            body,
          })
        }
        return
      }
      for (const c of n.namedChildren) walk(c)
    }
    walk(root)
  }
  MACROS.set(tree, out)
  return out
}

/**
 * 從一段文字的**開頭**認一個巨集呼叫——認不到回 `null`。
 *
 * 🔴 **`expanded` 可能是 `null`，而那與「認不到」不是同一件事**：
 * 「這個名字是一個已知的巨集」與「這一次代得進去」是兩題。
 * 引數個數不對時**仍然要認得它**——認不得的話那一句會掉回一般的辨識，
 * 而那正是會靜默少一個名字的那條路。
 */
interface Prefix { header: string; expanded: string | null; rest: string }

/**
 * 🔴 **判別走【文字】，不走那棵樹——而那不是偷懶，是因為那棵樹是錯的。**
 *
 * tree-sitter 對同一個巨集用法給出的形狀**隨它後面接什麼而變**（實測）：
 *
 * ```
 * rep(i,m) s += i;      →  一個 expression_statement（assignment_expression，左邊是那個呼叫）
 * rep(i,m) cin >> a;    →  兩個並列的 expression_statement
 * rep(k,4){ … }         →  一個 expression_statement ＋ 一個 compound_statement
 * ```
 *
 * > **一棵解錯的樹，它的每一個子節點都會被正確地辨識成錯誤的東西
 * > ——而照那些子節點去認形狀，等於把解析器的錯當成規格。**
 *
 * 而預處理器本來就在**文字**那一層工作，所以這裡與它同一層。
 */
function matchMacroPrefix(text: string, macros: Map<string, FuncMacro>): Prefix | null {
  const m = /^\s*([A-Za-z_]\w*)\s*\(/.exec(text)
  if (!m) return null
  const macro = macros.get(m[1])
  if (!macro) return null
  const open = m[0].length - 1
  const close = matchingParen(text, open)
  if (close < 0) return null
  const args = splitTopLevel(text.slice(open + 1, close))
  // ⚠️ **原文照抄**（含學生打在名字與括號之間的空白），因為它要被原樣印回去
  const nameStart = m[0].indexOf(m[1])
  return {
    header: text.slice(nameStart, close + 1),
    expanded: substitute(macro, args),
    rest: text.slice(close + 1),
  }
}

/** 從 `open` 那個左括號找到它的右括號。找不到回 `-1`。 */
function matchingParen(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const ch = text[i]
    if (ch === "'" || ch === '"') { i = skipQuoted(text, i); continue }
    if (ch === '(') depth++
    else if (ch === ')') { depth--; if (depth === 0) return i }
  }
  return -1
}

/** 跳過一段被引號包住的東西，回傳結尾引號的位置。 */
function skipQuoted(text: string, start: number): number {
  const q = text[start]
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue }
    if (text[i] === q) return i
  }
  return text.length
}

/**
 * 照**括號深度**把引數串切開。
 *
 * ⚠️ 直接 `split(',')` 會在 `rep(i, f(a,b))` 上切錯，而切錯**不會報錯**
 * ——它會給出一個引數個數看起來對而內容錯位的展開。
 * 語料 0 處用到它，而**寫錯的代價是一個錯的答案**，所以要寫對。
 */
function splitTopLevel(inner: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (ch === "'" || ch === '"') {
      const end = skipQuoted(inner, i)
      cur += inner.slice(i, end + 1)
      i = end
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim() !== '' || out.length > 0) out.push(cur.trim())
  return out
}

/** 把引數代進巨集體——**整個識別字才算**，不碰名字的一部分。 */
function substitute(macro: FuncMacro, args: string[]): string | null {
  if (args.length !== macro.params.length) return null
  let out = ''
  const src = macro.body
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (/[A-Za-z_]/.test(ch)) {
      let j = i
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++
      const word = src.slice(i, j)
      const k = macro.params.indexOf(word)
      out += k >= 0 ? args[k] : word
      i = j
      continue
    }
    out += ch
    i++
  }
  return out
}

/** 包住重解用的那個函式殼——語句不能單獨站在翻譯單元裡。 */
const WRAP_PREFIX = 'void __semorphe_macro(){ '

/**
 * 把一段**語句**文字用同一個語言重解一次，回傳那幾個語句節點。
 *
 * ⚠️ **有語法錯誤就回 `null`**——與 `misparse.ts` 的 `reparseExpression` 同一條理由：
 * 一棵帶 ERROR 的樹會讓整段降級，而那比原本那棵錯的樹更難查。
 */
function reparseStatements(node: AstNode, text: string): AstNode[] | null {
  const parser = parserFor(node)
  if (!parser) return null
  const tree = parser.parse(`${WRAP_PREFIX}${text} }`)
  if (!tree || tree.rootNode.hasError) return null
  /**
   * 🔴 **重解出來的那棵樹裡沒有 `#define` 行**——把巨集表帶過去。
   *
   * 少了這一行的症狀**只在巢狀的第二趟出現**（2026-09-20 實測）：
   *
   * ```
   * 第一趟   rep(i,n) rep(j,n) s += i*j;   兩個表頭是【並列的語句】，一次吃完 🟢
   * 第二趟   rep(i,n) { rep(j,n) { … } }   內層在【重解出來的那棵樹裡】
   *          而那棵樹查不到 rep ⟹ 不展開 ⟹ 它被當成一個【函式定義】
   *          產出 `void rep(j, n) { … }`   🔴 不動點就破在這裡
   * ```
   *
   * > **一個「把文字重解一次」的機制，重解出來的那棵樹少了原本那棵的上下文
   * > ——而少的那一塊只在第二趟才被查。**
   */
  MACROS.set(tree as unknown as object, macrosOf(node))
  let body: AstNode | null = null
  const walk = (n: AstNode): void => {
    if (body) return
    if (n.type === 'compound_statement') { body = n; return }
    for (const c of n.namedChildren) walk(c)
  }
  walk(tree.rootNode as never)
  const found = body as AstNode | null
  return found ? found.namedChildren : null
}

/** 這顆元件收不收得下「原文是用巨集寫的」這件事——**問性狀，不問身分**。 */
function hostsMacroHeader(componentId: string): boolean {
  return componentTraits(componentId)?.macroHeaderHost === true
}

/**
 * 把巨集的拼法一層一層掛回去。
 *
 * `rep(i,m) rep(j,n) stmt;` 展開成兩層迴圈，而**外層對第一個表頭**。
 * ⚠️ 對不上就回 `false`——那時整段讓開，不要留一個**掛了一半**的樹。
 */
function attachHeaders(top: SemanticNode, headers: string[]): boolean {
  let cur: SemanticNode | undefined = top
  for (const header of headers) {
    if (!cur || !hostsMacroHeader(cur.componentId)) return false
    if (!cur.metadata) cur.metadata = {}
    cur.metadata.layoutHints = { ...(cur.metadata.layoutHints ?? {}), macroHeader: header }
    cur = (cur.slots?.body ?? [])[0]
  }
  return true
}

/**
 * **語句列裡的巨集呼叫**——修復掛在 `compound_statement` 上。
 *
 * 🔴 **為什麼不掛在那個呼叫上**：展開的形狀**跨兩個兄弟節點**
 *（呼叫 ＋ 下一句），而掛在呼叫上的話，下一句會被**再 lift 一次**。
 */
function repairMacroStatements(node: AstNode, ctx: LiftContext): SemanticNode | null {
  if (node.type !== 'compound_statement') return null
  /**
   * ⚠️ **獨立的區塊讓開**：`{ … }` 單獨站著時辨識期待的是另一顆元件，
   * 而這裡回的是 `_compound`（語句列的中間產物）。語料 0 處，不猜。
   */
  if (node.parent?.type === 'compound_statement') return null

  const macros = macrosOf(node)
  if (macros.size === 0) return null
  const stmts = node.namedChildren
  if (!stmts.some((s) => matchMacroPrefix(s.text, macros))) return null

  const body: SemanticNode[] = []
  let i = 0
  while (i < stmts.length) {
    if (!matchMacroPrefix(stmts[i].text, macros)) {
      const lifted = ctx.lift(stmts[i])
      if (lifted) body.push(lifted)
      i++
      continue
    }
    /**
     * 連續的巨集表頭一次吃完（`rep(i,m) rep(j,n) …`）。
     * 🔴 **契約③（不得遞迴）靠【構造】保證**：展開出來的文字裡不會再有巨集呼叫
     *（巨集體是一個 `for` 表頭），所以修好的樹不會被這條規則認領第二次。
     */
    const headers: string[] = []
    const expansions: string[] = []
    let j = i
    let cur = stmts[j].text
    let ok = true
    for (;;) {
      const pre = matchMacroPrefix(cur, macros)
      if (!pre) break
      headers.push(pre.header)
      if (pre.expanded === null) { ok = false; break }   // 引數個數不對 ⟹ 代不進去，誠實降級
      expansions.push(pre.expanded)
      cur = pre.rest
      // 這一句被表頭用完了 ⟹ 迴圈的主體是【下一句】
      if (cur.trim() === '') {
        if (j + 1 >= stmts.length) { ok = false; break }
        j++
        cur = stmts[j].text
      }
    }
    const made = ok ? expandInto(node, ctx, expansions, cur, headers) : null
    /**
     * 🔴 **證不出來的時候【誠實降級】，不是讓開。**（2026-09-20，第三關量到的）
     *
     * 「讓開」聽起來安全，而它不是：tree-sitter 對
     * `go(i,n) s += i;` 給的是一棵**看起來合法而少一個名字**的樹，
     * 於是產回去是 `go(i, n) += i;`——**`s` 不見了，而且不出聲**。
     *
     * ```
     * 讓開      go(i, n) += i;          🔴 少一個名字，靜默
     * 誠實降級  go(i,n) s += i;         🟢 一字不差，而執行時會說「這段我不認得」
     * ```
     *
     * > **「讓開」與「誠實降級」的差別，不在我做了多少，
     * > 在使用者的程式碼有沒有被改掉。**
     *
     * ⚠️ **只在「開頭是一個【已知的】巨集呼叫」時降級**——一個不認得的名字
     *    本來就是一個函式呼叫，把它降級會弄壞一整族正常的程式。
     */
    if (made) {
      body.push(made)
    } else {
      const raw = buildRawCode(stmts.slice(i, j + 1).map((s2) => s2.text).join(' '))
      raw.metadata = { ...(raw.metadata ?? {}), rawCode: stmts.slice(i, j + 1).map((s2) => s2.text).join(' ') }
      body.push(raw)
    }
    i = j + 1
  }
  return createNode('_compound', {}, { body })
}

/**
 * 把「代入之後的那段文字」重解、辨識、並把原文的拼法掛回去。
 * **證不出來就回 `null`**——呼叫端會改走誠實降級。
 */
function expandInto(
  node: AstNode, ctx: LiftContext, expansions: string[], bodyText: string, headers: string[],
): SemanticNode | null {
  const reparsed = reparseStatements(node, `${expansions.join(' ')} ${bodyText}`)
  if (!reparsed || reparsed.length !== 1) return null
  const lifted = ctx.lift(reparsed[0])
  if (!lifted) return null
  if (containsDegraded(lifted)) return null
  if (!attachHeaders(lifted, headers)) return null
  return lifted
}

/** 展開出來的樹裡有沒有降級節點——有就整段誠實降級（**刻意沒有中途站**）。 */
function containsDegraded(n: SemanticNode): boolean {
  if (n.componentId === 'raw_code' || n.componentId === 'unresolved') return true
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) if (containsDegraded(k)) return true
  return false
}

// ── 巨集體不是一個值的【物件形】巨集 ────────────────────────────────

/**
 * 這棵樹裡的物件形巨集（`#define z -'0'`）——名字 → 展開文字。
 *
 * ⚠️ **與上面那張表刻意分開**：函式形（`preproc_function_def`）要記參數名，
 * 物件形（`preproc_def`）只有一段文字。合成一張的話，每一個消費者都要先問
 * 「這一筆是哪一種」——而那正是「一張表服務兩件事」的形狀。
 */
const OBJ_MACROS = new WeakMap<object, Map<string, string>>()

function objectMacrosOf(node: AstNode): Map<string, string> {
  const tree = (node as unknown as { tree?: object }).tree
  if (!tree) return new Map()
  const hit = OBJ_MACROS.get(tree)
  if (hit) return hit
  const out = new Map<string, string>()
  const root = (tree as { rootNode?: AstNode }).rootNode
  if (root) {
    const walk = (n: AstNode): void => {
      if (n.type === 'preproc_def') {
        const name = n.childForFieldName('name')?.text
        const body = n.childForFieldName('value')?.text
        if (name && body !== undefined && body.trim() !== '') out.set(name, body.trim())
        return
      }
      for (const c of n.namedChildren) walk(c)
    }
    walk(root)
  }
  OBJ_MACROS.set(tree as unknown as object, out)
  return out
}

/** 把一段文字當成一個**運算式**重解一次；有語法錯誤就回 `null`。 */
function reparseAsExpression(node: AstNode, text: string): AstNode | null {
  const parser = parserFor(node)
  if (!parser) return null
  const tree = parser.parse(`void __semorphe_frag(){ ${text}; }`)
  if (!tree || tree.rootNode.hasError) return null
  // 重解出來的樹少了 `#define` 行——兩張巨集表都要帶過去（見上面那段的教訓）
  MACROS.set(tree as unknown as object, macrosOf(node))
  OBJ_MACROS.set(tree as unknown as object, objectMacrosOf(node))
  let found: AstNode | null = null
  const walk = (n: AstNode): void => {
    if (found) return
    if (n.type === 'expression_statement') { found = n.namedChildren[0] ?? null; return }
    for (const c of n.namedChildren) walk(c)
  }
  walk(tree.rootNode as never)
  return found
}

/**
 * 🔴 **巨集體不是一個值的物件形巨集**（2026-09-20，語料 `w/APCS/j607_trash`）。
 *
 * ```cpp
 * #define z -'0'
 * x = x*10 + (s[i]z);      // 展開之後是 (s[i] - '0')
 * ```
 *
 * `cpp:define` 那條路把它記進**別名表**（名字 → 名字），而 `-'0'` 不是一個名字，
 * 它是**一段運算子片段**。於是 tree-sitter 在那個位置給一個 `ERROR` 節點：
 *
 * ```
 * parenthesized_expression ⚠hasError
 *   subscript_expression  «s[0]»
 *   ERROR ⚠hasError       «z»       ← 巨集名整個變成一個錯誤節點
 * ```
 *
 * 而在這一刀之前它**兩路都錯，其中一路是安靜的**：
 *
 * ```
 * 執行    (s[0]z) 算成 52（把 z 整個忽略）   🔴 錯，而且不出聲
 * 產回去  (s[0]z) → (s[0])                  🔴 z 靜默消失
 * ```
 *
 * > **一個「這一段我看不懂」的節點，如果兩條投影都不說，
 * > 那它就不是降級，是一個錯的答案。**
 *
 * ## 接手的條件（缺一就回 `null`，走原本那一路）
 *
 * ① 這個節點 `hasError`，而它的**直屬**子節點裡有 `ERROR`
 * ② **每一個** `ERROR` 的文字都剛好是一個已知的物件形巨集名
 *    ——不認得的名字本來就是一個錯誤，把它換掉會弄壞一整族診斷
 * ③ 代入之後那段文字**解得乾淨**
 * ④ 代入之後的樹**認得出來**（不是 raw_code／unresolved）
 *
 * ## 產出一字不差怎麼做到的
 *
 * 🟢 `layoutHints.verbatim` ＋ `metadata.rawCode` **本來就在**
 *（`generateExpression` 的第一個分支，`"abc" "def"` 那條線在用）
 * ——這裡只是接上它。⚠️ 而「積木改過之後這一格會不在」在這個消費者身上
 * 同樣是一個**安全性質**：運算式一旦在積木那側被改過，再印 `(s[i]z)` 就是謊話。
 */
/**
 * 把一段文字裡**引號外**的完整識別字換成它的巨集展開。
 *
 * ⚠️ **引號裡的不換**：`cout << "z"` 裡那個 `z` 是一個字元，不是一個巨集名。
 * 🔴 而「完整識別字」要靠前後字元判——`zz` 裡有一個 `z`，而它不是那個巨集。
 */
function substituteObjectMacros(text: string, macros: Map<string, string>): { out: string; hits: number } {
  const isWord = (c: string | undefined): boolean => c !== undefined && /[A-Za-z0-9_]/.test(c)
  let out = ''
  let hits = 0
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === "'" || ch === '"') {
      const end = skipQuoted(text, i)
      out += text.slice(i, end)
      i = end
      continue
    }
    if (/[A-Za-z_]/.test(ch) && !isWord(text[i - 1])) {
      let j = i
      while (j < text.length && isWord(text[j])) j++
      const word = text.slice(i, j)
      const body = macros.get(word)
      if (body !== undefined) {
        out += ` ${body} `
        hits++
      } else {
        out += word
      }
      i = j
      continue
    }
    out += ch
    i++
  }
  return { out, hits }
}

/**
 * 🔴 **巨集體不是一個值的物件形巨集**（2026-09-20，語料 `w/APCS/j607_trash`）。
 *
 * ```cpp
 * #define z -'0'
 * x = x*10 + (s[i]z);      // 展開之後是 (s[i] - '0')
 * ```
 *
 * `cpp:define` 那條路把它記進**別名表**（名字 → 名字），而 `-'0'` 不是一個名字，
 * 它是**一段運算子片段**。於是那個位置解不出來，而在這一刀之前
 * **兩條投影都錯，而兩條都不出聲**：
 *
 * ```
 * 執行    (s[0]z) 算成 52（把 z 整個忽略）   🔴 錯，而且不出聲
 * 產回去  (s[0]z) → (s[0])                  🔴 z 靜默消失
 * ```
 *
 * > **一個「這一段我看不懂」的節點，如果兩條投影都不說，
 * > 那它就不是降級，是一個錯的答案。**
 *
 * ## 為什麼「代入」在這裡不是一個猜測
 *
 * `ast-repairs.ts` 的契約②逐字：「**只准做『這段文字唯一合法的讀法就是這個』
 * 的重寫**」。而**把一個已定義的物件形巨集換成它的展開文字，正是這個語言
 * 定義的那一步**——不是我對它的理解。所以這條規則做的是「照 C 的規矩讀一次」，
 * 而它與「猜」的差別，在於那一步寫在標準裡。
 *
 * ⚠️ 而 repo 對別名的立場（「一個別名的意義就是那個短名字；把它換掉等於把它
 * 拿掉」）**仍然成立**——所以樹上代入、而**產出照抄原文**（見下）。
 *
 * ## 接手的條件（缺一就回 `null`，走原本那一路）
 *
 * ① 這是一個**運算式**節點（`*_expression`）而且 `hasError`
 * ② 它是**最外層**那一個（父節點不是一個也帶錯的運算式）
 *    ——不分層的話同一段會被代入兩次，而外層那次拿到的是已經代過的文字
 * ③ 文字裡**真的有**一個已知的物件形巨集名（引號外、完整識別字）
 * ④ 代入之後那段文字**解得乾淨**，而且**認得出來**（不是 raw_code／unresolved）
 *
 * ## 產出一字不差怎麼做到的
 *
 * 🟢 `layoutHints.verbatim` ＋ `metadata.rawCode` **本來就在**
 *（`generateExpression` 的第一個分支，`"abc" "def"` 那條線在用）——這裡只是接上它。
 * ⚠️ 而「積木改過之後這一格會不在」在這個消費者身上同樣是一個**安全性質**：
 * 運算式一旦在積木那側被改過，再印 `(s[i]z)` 就是一句謊話。
 *
 * ## ⚠️ 一個已知的取捨：同一句裡的【值型】巨集也會被代入
 *
 * 代入是**整句一起**做的，所以 `(s[i]z) + N` 裡的 `N`（`#define N 100`）
 * 也會變成 `100`——於是**積木上看到的是 100，不是 N**。
 *
 * 🟢 而**程式碼那一側仍然一字不差**（`verbatim` 照抄原文），
 * 所以學生的檔案不會被改掉；受影響的只有積木上那一格的顯示。
 *
 * 🔴 **為什麼不只代入「造成錯誤的那一個」**：`ERROR` 蓋在哪個節點上由解析器
 * 決定（實測 `(s[0]z)` 蓋在 `z`、`(a plus1)` 蓋在 `a`），所以「哪一個造成錯誤」
 * **問不出來**——而照它去猜，等於把解析器挑錯誤位置的方式當成規格。
 *
 * ⚠️ 觸發條件很窄：那一句本來就解不開，而代入之後解得乾淨。
 * 語料 0 處（`j607_trash` 那一句裡沒有別的巨集）。
 */
function repairFragmentMacro(node: AstNode, ctx: LiftContext): SemanticNode | null {
  if (!node.hasError) return null
  if (!node.type.endsWith('_expression')) return null
  // 只在**最外層**那一個運算式上動手（與 `misparse.ts` 的第二條同一個理由）
  const p = node.parent
  if (p && p.type.endsWith('_expression') && p.hasError) return null

  const macros = objectMacrosOf(node)
  if (macros.size === 0) return null
  const { out: text, hits } = substituteObjectMacros(node.text, macros)
  if (hits === 0) return null

  const reparsed = reparseAsExpression(node, text)
  if (!reparsed) return null
  const lifted = ctx.lift(reparsed)
  if (!lifted || containsDegraded(lifted)) return null
  lifted.metadata = {
    ...(lifted.metadata ?? {}),
    rawCode: node.text,
    layoutHints: { ...(lifted.metadata?.layoutHints ?? {}), verbatim: true },
  }
  return lifted
}

export function registerMacroExpansion(): void {
  declareAstRepair(repairMacroStatements)
  /**
   * ⚠️ **排在語句那一條之後**：兩者互不重疊（一個認 `compound_statement`、
   * 一個認帶 `ERROR` 的運算式），而順序寫死比較好讀。
   */
  declareAstRepair(repairFragmentMacro)
}
