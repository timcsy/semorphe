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

export function registerMacroExpansion(): void {
  declareAstRepair(repairMacroStatements)
}
