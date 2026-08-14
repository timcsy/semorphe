import type { SemanticNode } from './types'

/**
 * 一則診斷。
 *
 * ## 🔴 錨點是 `nodeId`，不是 `blockId`（2026-08-14 換的）
 *
 * ```
 * 錨在 blockId  →  只有積木視圖看得到；Monaco 不認識 blockId
 * 錨在 nodeId   →  每個視圖自己投影：積木高亮、程式碼波浪、未來的 2D 元件發紅
 * ```
 *
 * ⚠️ **這與 `execution:at-node` 改造前的狀態一模一樣**——執行位置原本也是靠
 * `blockId` 傳的，改成 nodeId 廣播之後程式碼視圖才拿得到
 * （`history/051`）。**處方直接抄，不自己換一個判準。**
 */
export interface Diagnostic {
  /** 語義節點的 id——**唯一真實那一側**。各視圖自己把它投影成自己看得懂的位置。 */
  nodeId: string
  severity: 'warning' | 'error'
  /**
   * **是哪一條規則**——身分，不是訊息。
   *
   * 🔴 2026-08-14 從 `message` 換過來（階段 6.6 驗收④）。舊欄位叫 `message`
   * 而裝的是一個 i18n key，於是**兩個面板只能查同一張表 → 說同一句話**。
   * 使用者逐字：「越像實際編譯器吐出的訊息越好……**不過積木側可以不一樣**」。
   *
   * ⚠️ **舊欄位是刪掉的，不是留著相容**——那一刀讓 tsc 把每一個產出端與
   * 消費端都指出來，而不是讓漏改的地方在執行期靜默。
   */
  rule: string
  /**
   * 這次觸發時**規則已經知道**的資訊。可以是空的。
   *
   * 各面板自己決定用不用、用哪幾個——**一個參數被某個面板忽略是正常的**，
   * 那正是「兩個面板組出不同訊息」的機制本身。
   */
  params: Record<string, string | number>
  /**
   * 這則診斷是**誰**判定的。⚠️ **不是給人看的標籤。**
   *
   * ```
   * component   學生的樹不合元件的宣告      我們宣告的規則，可完備
   * parser      學生打錯字                  解析器判定的，我們不猜
   * ```
   *
   * 它決定三件事：**誰該修**、**這個數字能不能要求歸零**、
   * 以及**是誰的問題**——最後一項是 `history/062` 那筆錯格的結構性解法。
   *
   * ⚠️ **必要欄位，不是選用**：選用等於允許「不說是誰的問題」，
   * 而那正是本輪要治的病。
   *
   * ⚠️ **只放今天真的有產出端的值**。`compiler`（委派編譯器）與
   * `runtime`（執行期觀察）都還沒有產出端——constitution I：不為假設性未來預留。
   */
  source: DiagnosticSource
}

/** 診斷的判定來源。⚠️ 字面聯集而非列舉物件——加一個值就是改一行，而 tsc 會指出所有比對處。 */
export type DiagnosticSource = 'component' | 'parser'

/**
 * **走哪一條通道**——而這兩個集合必須剛好把 `DegradationCause` 分完。
 *
 * ```
 * 重疊  →  同一件事顯示兩次（一條紅波浪 ＋ 一條灰提示疊在同一行）
 * 遺漏  →  某一種降級原因兩邊都不顯示，而它會安靜地消失
 * ```
 *
 * ⚠️ **只有 `syntax_error` 是使用者的問題。** 另外兩種是「我們還沒長到」，
 * 它們刻意**不長得像錯誤**——一起搬走的話，學生會看到
 * 「你的程式有 12 個錯誤」而其中 11 個是我們的問題。
 *
 * 不變式由 `tests/unit/core/diagnostics-from-tree.test.ts` 釘住。
 */
export const DIAGNOSTIC_CAUSES: readonly string[] = ['syntax_error']

/** 留在殘差通道的降級原因（Info 級、另一個 marker owner）。 */
export function isResidualCause(cause: string | undefined): boolean {
  return cause === 'unsupported' || cause === 'nonstandard_but_valid'
}

export interface DiagnosticBlock {
  id: string
  /**
   * 這顆積木對應的語義節點。
   *
   * ⚠️ **規則今天仍然吃積木**（空插槽、欄位值是積木側的形狀），
   * 而**產出的錨點是語義的**——轉換在呼叫端（`getBlockIdToNodeIdMap()`）。
   * 把規則搬到語義樹是下一步，不在這一輪的範圍裡。
   */
  nodeId: string
  type: string
  getFieldValue(name: string): string | null
  getInputTargetBlock(name: string): DiagnosticBlock | null
  getInput(name: string): unknown | null
}

/** Data-driven diagnostic rule definition. */
export interface DiagnosticRule {
  blockTypes: string[]
  check: 'hasInput' | 'varDeclareNames'
  inputName?: string
  severity: 'warning' | 'error'
  /** 規則的身分。⚠️ 這個欄位以前叫 `message`——**而它從來就不是訊息**。 */
  rule: string
}

/** Build a block-type→rules index for efficient lookup. */
function buildRuleIndex(rules: DiagnosticRule[]): Map<string, DiagnosticRule[]> {
  const index = new Map<string, DiagnosticRule[]>()
  for (const rule of rules) {
    for (const bt of rule.blockTypes) {
      const existing = index.get(bt)
      if (existing) existing.push(rule)
      else index.set(bt, [rule])
    }
  }
  return index
}

export function runDiagnostics(blocks: DiagnosticBlock[], rules: DiagnosticRule[] = []): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const ruleIndex = buildRuleIndex(rules)

  for (const block of blocks) {
    const blockRules = ruleIndex.get(block.type)
    if (!blockRules) continue

    for (const rule of blockRules) {
      switch (rule.check) {
        case 'hasInput':
          if (rule.inputName && !block.getInputTargetBlock(rule.inputName)) {
            // ⚠️ **規則知道缺的是哪個插槽，所以那筆資訊要跟著走。**
            // 程式碼面板用得上它（原始碼裡看不到插槽），積木面板用不上
            // （學生看得到那格是空的）——而那個不對稱正是分開組裝的目的。
            diagnostics.push({
              nodeId: block.nodeId,
              severity: rule.severity,
              rule: rule.rule,
              params: { inputName: rule.inputName },
              source: 'component',
            })
          }
          break

        case 'varDeclareNames': {
          // 🔴 **第幾個名字是空的，以前在這裡被丟掉。**
          // `int , , ;` 產出三則 nodeId 與訊息完全相同的診斷，於是
          // 積木側 `setWarningText` 後蓋前——三個問題只看得到一個。
          // 則數不變（仍是三則），改變的是**它們從此可以互相區分**。
          let i = 0
          let hasAnyVar = false
          while (true) {
            const name = block.getFieldValue(`NAME_${i}`)
            if (name === null) break
            if (!name || name.trim() === '') {
              diagnostics.push({
                nodeId: block.nodeId,
                severity: rule.severity,
                rule: rule.rule,
                // ⚠️ **1-based，而且不叫 `index`**——兩個面板都是給人看的，
                // 一個叫 `index` 的參數會讓文案作者寫出「第 0 個變數」。
                params: { position: i + 1 },
                source: 'component',
              })
            }
            hasAnyVar = true
            i++
          }
          if (!hasAnyVar) {
            const name = block.getFieldValue('NAME')
            if (!name || name.trim() === '') {
              diagnostics.push({
                nodeId: block.nodeId,
                severity: rule.severity,
                rule: rule.rule,
                params: { position: 1 },
                source: 'component',
              })
            }
          }
          break
        }
      }
    }
  }

  return diagnostics
}

/**
 * **樹是診斷的第二個產出端。**
 *
 * ## 為什麼需要它
 *
 * `runDiagnostics` 吃**積木**——而積木上看不出少了一個分號
 * （tree-sitter 復原之後那顆積木是完整的）。語法錯誤的資料在**樹**上。
 *
 * ```
 * 診斷   app.ts  吃積木  →  空插槽、欄位值
 * 這裡           吃樹    →  degradationCause === 'syntax_error'
 * ```
 *
 * ⚠️ **兩個產出端必須合併成一次 `onDiagnostics` 廣播**——
 * `setModelMarkers` 與 `setWarningText(null)` 的語義都是**全集取代**，
 * 分兩次的話第二次會清掉第一次。合併點在 `app.ts`。
 *
 * ## 🔴 只挑 `syntax_error`
 *
 * 見 `DIAGNOSTIC_CAUSES` 的說明——另外兩種是我們的問題，留在殘差通道。
 */
export function diagnosticsFromTree(tree: SemanticNode): Diagnostic[] {
  const out: Diagnostic[] = []
  const walk = (n: SemanticNode): void => {
    const cause = n.metadata?.degradationCause
    if (cause && DIAGNOSTIC_CAUSES.includes(cause)) {
      out.push({
        nodeId: n.id,
        severity: 'error',
        rule: 'SYNTAX_ERROR',
        // ⚠️ **積木側用得到、程式碼側用不到**（波浪已經指在那一行上）
        // ——那個不對稱正是兩個面板分開組裝的目的。
        params: { snippet: String(n.metadata?.rawCode ?? '') },
        source: 'parser',
      })
    }
    for (const bucket of Object.values(n.children ?? {})) for (const c of bucket ?? []) walk(c)
  }
  walk(tree)
  return out
}
