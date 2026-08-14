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
