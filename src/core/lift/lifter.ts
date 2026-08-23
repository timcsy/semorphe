import { commentSyntax } from '../comment-syntax'
import type { SyntaxGap } from '../diagnostics'
import type { SemanticNode, DegradationCause } from '../types'
import type { AstNode, NodeLifter, LiftContext } from './types'
import { createNode } from '../semantic-tree'
import { LiftContextData } from './lift-context'
import { PatternLifter } from './pattern-lifter'
import { liftPostProcessors } from './post-processors'
// ⚠️ 共用檔呼叫膠囊匯出的**建構子**——身分字串只留在膠囊裡一處。
// 🔴 **不再 import 語言套件**（spec 155）——身分由語言套件宣告。
//    P9 原文逐字：「拔掉 C++……**無 `languages/cpp/` import**」。
import { buildStandaloneBlock } from '../standalone-block'

export class Lifter {
  /** `文法\u0000節點型別` → 手寫 lifter。**鍵帶文法**，見 `registerFor`。 */
  private lifters = new Map<string, NodeLifter>()
  /** 目前註冊中的文法——`registerFor` 開，`register` 讀。 */
  private registeringGrammar: string | null = null
  /** 目前辨識中的文法。`null` ＝ 不過濾（spec 167 之前的行為）。 */
  private activeGrammar: string | null = null
  private patternLifter: PatternLifter | null = null
  private astNodeComponentMap: Map<string, string> | null = null

  /**
   * 在**指定文法**底下註冊一批手寫 lifter。
   *
   * 🔴 **spec 167**：手寫 lifter 原本直接以 `nodeType` 當鍵，
   * 於是 `registerCppLifters` 註冊的 `for_statement` **也接走了 Python 的 for**
   * ——而它不經過 `PatternLifter`，所以**文法過濾看不到它**。
   *
   * > **一條繞過過濾器的路，會讓過濾器的報告變成一份【它看得到的範圍內】的報告。**
   */
  registerFor(grammar: string, register: () => void): void {
    const prev = this.registeringGrammar
    this.registeringGrammar = grammar
    try { register() } finally { this.registeringGrammar = prev }
  }

  /** 指定現在在辨識哪個文法——只有這個文法的手寫 lifter 會被查到。 */
  setGrammar(grammar: string): void {
    this.activeGrammar = grammar
  }

  register(nodeType: string, lifter: NodeLifter): void {
    this.lifters.set(this.key(this.registeringGrammar, nodeType), lifter)
  }

  private key(grammar: string | null, nodeType: string): string {
    return grammar === null ? nodeType : `${grammar}\u0000${nodeType}`
  }

  /** 查手寫 lifter——**先問目前文法，沒有再問「沒標文法」那批**。 */
  private lifterFor(nodeType: string): NodeLifter | undefined {
    if (this.activeGrammar !== null) {
      const hit = this.lifters.get(this.key(this.activeGrammar, nodeType))
      if (hit) return hit
      // ⚠️ 有活躍文法時，**不得回退到別的文法**——那正是這一刀在治的病。
      // 只回退到「沒標文法」那批（測試裡手動註冊的）。
      return this.lifters.get(nodeType)
    }
    return this.lifters.get(nodeType) ?? [...this.lifters.entries()]
      .find(([k]) => k.endsWith(`\u0000${nodeType}`))?.[1]
  }

  /** Set the JSON-driven pattern lifter engine */
  setPatternLifter(pl: PatternLifter): void {
    this.patternLifter = pl
  }

  /** Set AST nodeType → componentId mapping for unsupported detection */
  setAstNodeComponentMap(map: Map<string, string>): void {
    this.astNodeComponentMap = map
  }

  lift(node: AstNode): SemanticNode | null {
    return this.liftWithContext(node, new LiftContextData())
  }

  /**
   * 把辨識出來的宣告寫進脈絡。
   *
   * ⚠️ **這個機制一直都在，而在此之前零呼叫者。** `declare` / `getType` /
   * `pushScope` / `lookup` 四個方法從沒被用過，於是辨識層那句「為了避免
   * 型別消歧問題」讀起來像「做不到」——而它其實只是沒插電。
   * 見 `knowledge/concepts/執行機構.md`「機制有了，沒人接上」第五個實例。
   */
  private recordDeclaration(r: SemanticNode, data: LiftContextData): void {
    const name = r.properties?.name
    if (name === undefined) return
    // 型別的來源依概念而異：一般宣告放在 `type`，容器宣告的專屬概念名本身
    // 就帶著型別（`cpp:string_declare` → string）。後者更可靠。
    //
    // ⚠️ **正則裡的身分形狀，掃描器看不到。** 命名空間遷移（103）時這一行
    // 還寫著 `/^cpp_(\w+?)_declare$/`，而它不是字串字面——AST 掃描器只看
    // 字串節點，於是它安靜地不再匹配，症狀是「字串的 clear 被辨識成通用容器版」。
    //
    // 順手把 `cpp` 也拿掉：scope 不該寫死在核心（P9）。任何 scope 的
    // `<x>_declare` 都適用同一條規則。
    const fromComponent = /^[a-z]+:(\w+?)_declare$/.exec(r.componentId ?? '')?.[1]
    const type = fromComponent ?? (r.properties?.type !== undefined ? String(r.properties.type) : undefined)
    if (type) data.declare(String(name), type)
  }

  /** Lift with an existing context (for recursive calls that share scope) */
  liftWithContext(node: AstNode, contextData: LiftContextData): SemanticNode | null {
    // 複合敘述（`{ … }`）是一個作用域。
    //
    // ⚠️ 掛在**入口**而不是某一條辨識路徑上——第一版掛在「部分可辨識」那條
    // 後備路徑，而複合敘述早被前面的 pattern 處理掉了，於是那段程式從來
    // 沒跑過。遮蔽的測試因此仍然紅著，而其餘五支都綠——**那正是「只驗一個
    // 方向」會漏掉的東西**。
    if (node.type === 'compound_statement') {
      contextData.pushScope()
      try {
        return this.liftInner(node, contextData)
      } finally {
        contextData.popScope()
      }
    }
    return this.liftInner(node, contextData)
  }

  private liftInner(node: AstNode, contextData: LiftContextData): SemanticNode | null {
    const ctx: LiftContext = {
      lift: (n) => this.liftWithContext(n, contextData),
      liftChildren: (nodes) => this.liftStatementsWithContext(nodes, contextData),
      data: contextData,
    }

    const addSourceRange = (r: SemanticNode): void => {
      // 宣告記錄掛在這裡，因為**三個回傳點都經過它**——掛在個別回傳點會漏。
      this.recordDeclaration(r, contextData)
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
      // Preserve raw source text for expression fallback rendering
      if (!r.metadata.rawCode && node.text) {
        r.metadata.rawCode = node.text
      }
    }

    /**
     * 標上信心——**而語法錯誤要先出聲**。
     *
     * ## 🔴 它原本無條件標 `high`（2026-08-14 修）
     *
     * `int x = @@@;` 的 AST 長這樣：
     *
     * ```
     * declaration [hasError]
     *   primitive_type ⟪int⟫
     *   identifier ⟪x⟫
     *   ERROR ⟪= @@@⟫        ← 沒有人看它
     * ```
     *
     * lift 只走它認得的子節點，於是產出一顆**乾淨的 `cpp:var_declare`，
     * 信心 `high`**——那個 `@@@` 整個消失，而且沒有任何訊號。
     *
     * > **一段語法錯誤的程式碼被 lift 成一棵看起來完全健康的樹
     * > ——那正是這個專案追了一整年的靜默降級，發生在辨識的入口。**
     *
     * ⚠️ **標最內層那一顆，不標祖先**：`translation_unit` 也 `hasError`，
     * 每一層都標的話整棵樹都是壞的，而**「哪裡壞了」這個資訊就沒了**
     * ——那正是這個標記存在的理由。
     *
     * 判準是「子樹裡有 ERROR，**而還沒有任何被 lift 出來的子節點認領它**」。
     * lift 是**子先於父**的，所以走到父層時子層的標記已經在了。
     *
     * ⚠️ 第一版判「**直接**子節點是不是 ERROR」，而 `int x = 1`（少分號）的
     * ERROR 掛在 `init_declarator` 上——**那不是一個被 lift 的節點**，
     * 於是最常見的語法錯誤剛好漏掉。**判準要對著「被 lift 的那一層」，
     * 不是對著 AST 的任意一層。**
     */
    const setConfidenceHigh = (r: SemanticNode): void => {
      if (!r.metadata) r.metadata = {}
      if (this.hasErrorDescendant(node)) {
        // ⚠️ **遞迴查子孫，不只直接子節點**：`var_declare` 掛在
        // `program → func_def → body` 底下三層，只看直接子節點的話
        // `cpp:program` 會被重複標上——而那讓「哪裡壞了」又變成「整棵樹壞了」。
        const claimedBy = (n: SemanticNode): boolean =>
          n.metadata?.degradationCause === 'syntax_error' ||
          Object.values(n.children ?? {}).flat().some((c) => c && claimedBy(c))
        const claimed = Object.values(r.children ?? {}).flat().some((c) => c && claimedBy(c))
        if (!claimed) {
          r.metadata.confidence = 'inferred'
          r.metadata.degradationCause = 'syntax_error'
          // 記下**壞掉的那一段原文**——投影要靠它告訴使用者是哪裡。
          //
          // ⚠️ **用這個節點的完整原文，不是解析器切出來的 ERROR 片段。**
          // 以前優先用 ERROR 的文字，而 `int x = 1` 少分號時那個片段是「1」
          // ——積木上顯示「照抄原文的：1」，技術上正確而**教學上沒用**。
          //
          // 而沒有 ERROR 節點的那兩種形狀本來就會落到 `node.text`
          // ——這裡是**把有 ERROR 節點的那種統一過去**，不是新規則。
          r.metadata.rawCode = node.text
          // 🔴 解析器指名的缺口——**有就帶，沒有就完全不提**（spec 143 FR-004）。
          const gaps = this.collectSyntaxGaps(node)
          if (gaps.length > 0) r.metadata.syntaxGaps = gaps
          return
        }
      }
      if (!r.metadata.confidence) r.metadata.confidence = 'high'
    }

    // Single pipeline: PatternLifter first, hand-written fallback
    if (this.patternLifter) {
      const patternResult = this.patternLifter.tryLift(node, ctx)
      if (patternResult) {
        // ⚠️ 這裡原本有一段「`func_call_expr` 在敘述位置 → 改判成 `func_call`」。
        // **B 項把那一對合併成一個身分之後，它沒有東西可做了**——兩個位置本來
        // 就是同一個概念，位置的差別由**形態**表達（`ctx.isExpression` 與 role 軸）。
        // 這段後處理是雙重身分的代價，身分合併之後代價一併消失。
        // 語言套件宣告的後處理——**判準只有語言套件知道**的改判走這裡。
        //
        // 觸發它的例子是 `>>`：`num >> i`（位移）與 `in >> a`（串流讀取）
        // 語法完全相同，分得出來的唯一依據是根變數的型別，而型別名是 C++ 的。
        // 核心不認得任何型別名——判準推進來，見 `post-processors.ts`。
        //
        // 位置與上面那個 `func_call_expr → func_call` 相同、理由相同：宣告式
        // 的 pattern 查不到辨識脈絡，所以改判只能發生在 pattern 跑完之後。
        for (const postProcess of liftPostProcessors()) {
          const converted = postProcess(patternResult, ctx)
          if (converted) {
            addSourceRange(converted)
            setConfidenceHigh(converted)
            return converted
          }
        }
        addSourceRange(patternResult)
        setConfidenceHigh(patternResult)
        return patternResult
      }
    }

    const lifter = this.lifterFor(node.type)
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
      if (liftedChildren.length > 0 && liftedChildren.some(c => c.componentId !== 'raw_code')) {
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
      // 🔴 同上：有缺口才帶。⚠️ 這裡的節點**本身**就是降級的那一顆，
      //    所以缺口一定屬於它，不會像上面那樣要先判斷「誰認領」。
      ...(this.collectSyntaxGaps(node).length > 0
        ? { syntaxGaps: this.collectSyntaxGaps(node) }
        : {}),
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
            // 剝除註解符號的規則已搬進語言套件——核心不該知道 `//` 長什麼樣
            text: commentSyntax().strip(node.text),
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
      //
      // ⚠️ **但獨立的 `{ … }` 不能展平——它自己就是一個作用域。**
      //
      // `if (c) { a; b; }` 的 compound 是那個結構的 body，展平是對的。
      // 而 `int main(){ { int x=1; } }` 裡那一對大括號**是一個作用域**：
      // 展平之後 `x` 掛到外層，於是它活太久。
      //
      // ```cpp
      // int main() { { int x = 1; } cout << x; }   // 真編譯器：編譯錯誤
      //                                            // 展平之後：印出 1
      // ```
      //
      // > **一個作用域少了，症狀不是「變數不見」而是「變數活太久」
      // > ——而活太久不會報錯。**
      //
      // 判準看**父節點**：獨立區塊的父也是 compound_statement；
      // 結構的 body 的父是 `if_statement`／`while_statement`／
      // `function_definition`… 而那正是該展平的那些。
      // 🔴 **掛在標頭那一行的註解**（`if a:  # 為什麼`）——2026-08-23。
      //
      // 它是那個語句的**子節點**（不是兄弟），所以上面那段「同一列 → 接在前一句」
      // 完全看不到它，而各家策略也不會去撿——結果是**整條安靜地消失**。
      //
      // ⚠️ 判準是**同一列**，不是「第幾個子節點」：
      // `if a:  # x` 的註解與 `if` 同列，而 `else` 子句裡的註解不是
      // （那一支由那顆元件自己的策略處理，因為只有它知道那是第幾支）。
      this.attachHeaderComments(node, lifted)

      if (lifted.componentId === '_compound') {
        const standalone = node.type === 'compound_statement' && node.parent?.type === 'compound_statement'
        if (standalone) results.push(buildStandaloneBlock(lifted.children.body ?? []))
        else results.push(...(lifted.children.body ?? []))
      } else {
        results.push(lifted)
      }
    }
    return results
  }

  /**
   * 把「與這個語句同一列的子註解」接到它身上（`slot: 'header'`）。
   *
   * ⚠️ **只看直接子節點**：孫節點裡的註解屬於它自己那一行，
   * 而那一行由它自己的語句去接。
   */
  private attachHeaderComments(node: AstNode, lifted: SemanticNode): void {
    const row = node.startPosition.row
    for (const kid of node.namedChildren) {
      if (kid.type !== 'comment' || kid.startPosition.row !== row) continue
      if (!lifted.annotations) lifted.annotations = []
      lifted.annotations.push({
        type: 'comment',
        text: commentSyntax().strip(kid.text),
        position: 'inline',
        slot: 'header',
      })
    }
  }

  /** Determine why a node was degraded to raw_code */
  private determineDegradationCause(node: AstNode): DegradationCause {
    // Check for syntax error (tree-sitter ERROR node)
    if (node.type === 'ERROR' || this.hasErrorDescendant(node)) {
      return 'syntax_error'
    }

    // Check if AST nodeType maps to a known component
    if (this.isKnownNodeType(node.type)) {
      return 'unsupported'
    }

    // Unknown node type entirely
    return 'nonstandard_but_valid'
  }

  /**
   * 這個節點底下有沒有語法錯誤。
   *
   * ## ⚠️ 兩種表示，而我們曾經只認得一種
   *
   * ```
   * 實體節點   int x = 1 ⏎ cout << x;   → … → ERROR ⟪1⟫      ✅ 一直認得
   * 傳播旗標   int x = 1 ⏎ return 0;    → declaration [hasError]  🔴 2026-08-14 才補
   * ```
   *
   * **A 與 C 那兩種形狀（下一行是 return／另一個宣告）在解析器眼裡沒有
   * ERROR 節點**——只有旗標。而它們是**更常見**的形狀：在兩行之間漏掉分號。
   *
   * > **「下一行是什麼」決定了漏分號會不會被抓到——而那對學生毫無意義。**
   *
   * ## ⚠️ 旗標會往上傳播，而擋住它的不是這裡
   *
   * 最外層節點永遠帶著旗標。**擋住「整棵樹被標記」的是 `setConfidenceHigh`
   * 裡的 `claimed` 判斷**——它找的是「最深的**已 lift** 節點」，
   * 而旗標傳播多深都沒關係：第一個 lift 得出來的那一層就會認領它。
   *
   * 🔴 **所以那段落點邏輯不可以動。** 而合法程式不被誤標由
   * `tests/integration/audit-false-syntax-error.test.ts`（第四十三條）守著。
   */
  /**
   * **這個節點底下，解析器指名了哪些「該有而沒有」的東西。**
   *
   * ## 🔴 為什麼是 MISSING 而不是 ERROR
   *
   * 實測（spec 143 的出發點，而它把整個構想翻了過來）：
   *
   * ```
   * whlie (x < 10) {…}   ERROR 節點【不含】"whlie"——它是合法識別字，
   *                      解析器把它當運算式開頭，報的是後面的 MISSING「;」
   * int x = 1            MISSING「;」@ 第 2 行第 12 欄        ← 有確定位置
   * @@@ ###              ERROR="@@@ ### "                     ← 沒有 MISSING
   * ```
   *
   * > **`ERROR` 說的是「這一段看不懂」，`MISSING` 說的是「這裡少了這個」
   * > ——只有後者有位置，而位置正是學生要的東西。**
   *
   * ⚠️ 所以這裡**只收 MISSING**。看不懂的那些沒有缺口，
   * 而它們仍然走既有的 `SYNTAX_ERROR` 診斷——**訊息一個字不變**。
   *
   * ## ⚠️ 回傳陣列，不合併
   *
   * 一個節點底下可能少好幾個東西。合併之後「哪裡」就消失了
   * ——而「哪裡」正是這一刀加的全部。
   */
  private collectSyntaxGaps(node: AstNode): SyntaxGap[] {
    const out: SyntaxGap[] = []
    const walk = (n: AstNode): void => {
      if (n.isMissing === true) {
        out.push({ missing: n.type, line: n.startPosition.row, column: n.startPosition.column })
      }
      for (const c of n.children) walk(c)
    }
    walk(node)
    return out
  }

  private hasErrorDescendant(node: AstNode): boolean {
    if (node.type === 'ERROR') return true
    // 解析器算好的傳播旗標——比遞迴找 ERROR 更快，而且認得沒有 ERROR 節點的那一種
    if (node.hasError) return true
    for (const child of node.children) {
      if (this.hasErrorDescendant(child)) return true
    }
    return false
  }

  /** Check if an AST node type corresponds to a known component */
  private isKnownNodeType(nodeType: string): boolean {
    // Check explicit AST→component mapping
    if (this.astNodeComponentMap?.has(nodeType)) return true

    // Check if PatternLifter has patterns for this node type
    if (this.patternLifter?.hasPatternForNodeType(nodeType)) return true

    // Check if we have a hand-written lifter for this node type
    // ⚠️ 走 `lifterFor` ——否則「有沒有 lifter」會跨文法回答，
    //    而「用哪一個 lifter」不會，兩者的答案就對不起來。
    if (this.lifterFor(nodeType)) return true

    return false
  }
}
