/**
 * 把一則診斷投影到**程式碼那一側的座標**。
 *
 * ## 為什麼抽出來
 *
 * 這段邏輯原本只活在 `ui/panels/monaco-panel.ts` 的兩個私有方法裡。
 * 而 2026-08-25「診斷 → IDE 的 Problems」那一刀需要**第二個程式碼視圖**
 * 做同一件事——擴充裡那個沒有畫布的 `VscodeCodeView`。
 *
 * > **一段邏輯在第二個地方被需要的時候，
 * > 抄過去與抽出來的成本差不多；而它們的第三次差很多。**
 *
 * 🔴 而它**面板中立**：不認識 Monaco，也不認識 Blockly
 * ——訊息查的是 `i18n/messages`，不是 `Blockly.Msg`。
 * ⚠️ 那一格是踩過的：舊寫法查 `window.Blockly?.Msg`，而打包後那個東西
 * 不存在，於是**一直走 fallback**，把 `DIAG_MISSING_CONDITION` 這串代號
 * 當訊息顯示給使用者（2026-08-14 由 e2e 抓到）。
 */
import { formatMessage } from '../../i18n/messages'
import type { CodeMapping } from './code-generator'
import type { SemanticNode } from '../types'
import type { Diagnostic } from '../diagnostics'

function containsNodeId(node: SemanticNode, targetId: string): boolean {
  if (node.id === targetId) return true
  for (const children of Object.values(node.children)) {
    for (const child of children) if (containsNodeId(child, targetId)) return true
  }
  return false
}

function findAncestorWithCodeMapping(
  mappings: readonly CodeMapping[], node: SemanticNode, targetId: string,
): string | null {
  if (!containsNodeId(node, targetId)) return null
  for (const children of Object.values(node.children)) {
    for (const child of children) {
      const found = findAncestorWithCodeMapping(mappings, child, targetId)
      if (found) return found
    }
  }
  return mappings.some((m) => m.nodeId === node.id) ? node.id : null
}

/**
 * nodeId → 行區間。
 *
 * ⚠️ 表達式節點自己沒有對映，往上找**最近有對映的祖先**。
 * 🔴 而找不到時回 `undefined`——**不要退回第 1 行**：
 *
 * > **一個指錯地方的波浪比沒有波浪更糟：它會讓學生去看一段沒有問題的程式碼。**
 */
export function mappingFor(
  mappings: readonly CodeMapping[], tree: SemanticNode | null, nodeId: string,
): CodeMapping | undefined {
  const direct = mappings.find((x) => x.nodeId === nodeId)
  if (direct) return direct
  if (!tree) return undefined
  const ancestorId = findAncestorWithCodeMapping(mappings, tree, nodeId)
  return ancestorId ? mappings.find((x) => x.nodeId === ancestorId) : undefined
}

/**
 * **程式碼側**把一則診斷組成訊息。
 *
 * 這裡的收件人正在看原始碼，所以措辭偏編譯器——而積木側刻意不一樣
 * （使用者 2026-08-12 逐字：「越像實際編譯器吐出的訊息越好……
 * **不過積木側可以不一樣**」）。**那就是第二條軸，而它只有面板這一條。**
 */
export function codeDiagnosticMessage(d: Diagnostic): string {
  return formatMessage(`DIAG_${d.rule}_CODE`, d.params) ?? formatMessage('DIAG_UNKNOWN') ?? ''
}

/** 一則診斷投影到程式碼座標之後的樣子。⚠️ 行、欄都是 **0-based**。 */
export interface CodeDiagnostic {
  startLine: number
  startColumn: number
  endLine: number
  /** `null` ＝ 到行尾。⚠️ **視圖那側才知道行尾在哪**，這裡不猜。 */
  endColumn: number | null
  severity: 'warning' | 'error'
  message: string
}

/**
 * 把一批診斷投影到程式碼座標。
 *
 * 🔴 **對映不到的直接丟掉**（不是退回第 1 行，見 `mappingFor`）。
 */
export function projectDiagnostics(
  diagnostics: readonly Diagnostic[],
  mappings: readonly CodeMapping[],
  tree: SemanticNode | null,
): CodeDiagnostic[] {
  const out: CodeDiagnostic[] = []
  for (const d of diagnostics) {
    const m = mappingFor(mappings, tree, d.nodeId)
    if (!m) continue
    const message = codeDiagnosticMessage(d)
    // 🔴 **缺口有確定的位置——波浪就該縮到那裡**（spec 143）。
    // ⚠️ 而寬度至少 1 欄：一個缺掉的 token 佔零個字元，
    //    `start === end` 的標記畫不出來——那會讓「修好了」與「畫不出來」長得一樣。
    out.push(d.at
      ? { startLine: d.at.line, startColumn: d.at.column, endLine: d.at.line, endColumn: d.at.column + 1, severity: d.severity, message }
      : { startLine: m.startLine, startColumn: 0, endLine: m.endLine, endColumn: null, severity: d.severity, message })
  }
  return out
}
