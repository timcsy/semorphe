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
  message: string
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
  message: string
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
            diagnostics.push({ nodeId: block.nodeId, severity: rule.severity, message: rule.message })
          }
          break

        case 'varDeclareNames': {
          let i = 0
          let hasAnyVar = false
          while (true) {
            const name = block.getFieldValue(`NAME_${i}`)
            if (name === null) break
            if (!name || name.trim() === '') {
              diagnostics.push({ nodeId: block.nodeId, severity: rule.severity, message: rule.message })
            }
            hasAnyVar = true
            i++
          }
          if (!hasAnyVar) {
            const name = block.getFieldValue('NAME')
            if (!name || name.trim() === '') {
              diagnostics.push({ nodeId: block.nodeId, severity: rule.severity, message: rule.message })
            }
          }
          break
        }
      }
    }
  }

  return diagnostics
}
