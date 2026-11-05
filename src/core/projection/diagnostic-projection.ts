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
  for (const slots of Object.values(node.slots)) {
    for (const child of slots) if (containsNodeId(child, targetId)) return true
  }
  return false
}

function findAncestorWithCodeMapping(
  mappings: readonly CodeMapping[], node: SemanticNode, targetId: string,
): string | null {
  if (!containsNodeId(node, targetId)) return null
  for (const slots of Object.values(node.slots)) {
    for (const child of slots) {
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
 * 組文案用的參數：判決的種類（`kind`）換成人看得懂的名稱（`kindLabel`，`DIAG_KIND_<種類>`）。
 * 🔴 **兩側都不顯示 Cella 的 reason 原文**（使用者 2026-11-05：「Cella 和其他編譯器的錯誤訊息本身就不一樣，拼寫成好懂的中文」）
 *    ——reason 只留在參數裡給開發者看，文案一律由種類與結構化的參數組。
 */
export function diagnosticParams(params: Record<string, string | number>): Record<string, string | number> {
  // 有「大小」就算出最後一格的編號（差一錯最用得上：「最後一格是 2」）——呈現的換算，不是事實
  const size = Number(params.size)
  const out = params.size !== undefined && Number.isInteger(size) && size > 0 ? { ...params, last: String(size - 1) } : params
  if (typeof out.kind !== 'string') return out
  return { ...out, kindLabel: formatMessage(`DIAG_KIND_${out.kind}`) ?? formatMessage('DIAG_KIND_UNKNOWN') ?? out.kind }
}

/**
 * **程式碼側**把一則診斷組成訊息。
 *
 * 這裡的收件人正在看原始碼，所以措辭偏編譯器的簡潔（帶標準的條號）——而積木側刻意不一樣（教學的）。
 * 🪦 2026-08-12 那句「越像實際編譯器吐出的訊息越好」：2026-11-05 使用者改定——兩側都說好懂的中文，不給原文
 *    （判決來自 Cella，而 Cella 的原文本來就不是學生日後會在編譯器上看到的那一句）。
 */
export function codeDiagnosticMessage(d: Diagnostic): string {
  return diagnosticWithLayers(d.rule, 'CODE', diagnosticParams(d.params))
}

/**
 * **詳細資訊**（錯誤訊息第五步）：標準的條號（`C++17 [expr.add]p4`）——對學生是行話，不放進第一眼的那一句；
 * 宿主把它放在標記的 `code`（Monaco 的 hover、VSCode 的 Problems 都要滑鼠移過去或展開才看到）。沒有就是 `undefined`。
 */
export function codeDiagnosticDetail(d: Diagnostic): string | undefined {
  const clause = d.params?.clause
  return typeof clause === 'string' && clause.trim() !== '' ? clause : undefined
}

/**
 * 一則診斷的文字：**指得出名的時候用指名的那一句**（`DIAG_<規則>_<側>_AT`，帶 `{subject}`——spec 218），否則用原本那一句。
 * ⚠️ 兩側共用（積木側在 `panels/blocks/view.ts`）：判準只在這裡寫一次。
 */
export function diagnosticText(rule: string, side: 'BLOCK' | 'CODE', params: Record<string, string | number>): string {
  // 候選由細到粗：規則＋子類別（`what`，Cella 細分的那一層）→ 規則本身；每一層先試指名的（`_AT`）。
  // 🔴 有沒填上的格（`{line}`、`{expected}`…）就換下一個候選——學生不會看到 `{…}`。
  const what = typeof params.what === 'string' ? `_${params.what.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}` : ''
  // 每一層由細到粗：指名＋帶值（`_AT_VAL`）→ 指名 → 帶值（`_VAL`）→ 原句。帶值的那幾句用 Cella 執行期給的數字（索引、大小、步數……，
  // cella 0.1.202611051127 起）；值不齊（指標、空容器照實不帶）就有沒填上的格，自動換下一個——不必另外判斷誰有值。
  const level = (base: string): string[] => [`${base}_${side}_AT_VAL`, `${base}_${side}_AT`, `${base}_${side}_VAL`, `${base}_${side}`]
  const keys = [...(what ? level(`DIAG_${rule}${what}`) : []), ...level(`DIAG_${rule}`)]
  for (const k of keys) {
    if (/_AT(_VAL)?$/.test(k) && params.subject === undefined) continue
    const text = formatMessage(k, params)
    if (text !== null && !/\{\w+\}/.test(text)) return text
  }
  return formatMessage(`DIAG_${rule}_${side}`, params) ?? formatMessage('DIAG_UNKNOWN') ?? ''
}

/**
 * **第二、三層：為什麼／試試看**（錯誤訊息看得懂、改得動；使用者 2026-11-05 定 A：第一層一句話，點開看後兩層）。
 *
 * 候選與第一層同一條鏈：規則＋子類別（`what`）→ 規則本身；沒有就沒有（回空陣列，不湊一句）。
 * 宿主把它接在第一層那一句後面：積木側是點開驚嘆號的那個框，程式碼側是滑鼠移到波浪上的那個框。
 */
export function diagnosticLayers(rule: string, params: Record<string, string | number>): string[] {
  const what = typeof params.what === 'string' ? `_${params.what.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}` : ''
  const pick = (layer: 'WHY' | 'TRY'): string | null => {
    for (const k of [...(what ? [`DIAG_${rule}${what}_${layer}`] : []), `DIAG_${rule}_${layer}`]) {
      const text = formatMessage(k, params)
      if (text !== null && !/\{\w+\}/.test(text)) return formatMessage(`DIAG_LAYER_${layer}`, { text }) ?? text
    }
    return null
  }
  return [pick('WHY'), pick('TRY')].filter((x): x is string => x !== null)
}

/** 一則診斷，三層合成一段（第一層在第一行——列表只顯示第一行的宿主，看到的就是那一句）。 */
export function diagnosticWithLayers(rule: string, side: 'BLOCK' | 'CODE', params: Record<string, string | number>): string {
  return [diagnosticText(rule, side, params), ...diagnosticLayers(rule, params)].join('\n')
}

/** 一則診斷投影到程式碼座標之後的樣子。⚠️ 行、欄都是 **0-based**。 */
export interface CodeDiagnostic {
  startLine: number
  startColumn: number
  endLine: number
  /** `null` ＝ 到行尾。⚠️ **視圖那側才知道行尾在哪**，這裡不猜。 */
  endColumn: number | null
  severity: 'warning' | 'error' | 'info'
  message: string
  /** 詳細資訊（標準的條號）——不在第一眼的那一句裡，見 `codeDiagnosticDetail`。 */
  detail?: string
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
    const detail = codeDiagnosticDetail(d)
    // 🔴 **缺口有確定的位置——波浪就該縮到那裡**（spec 143）。
    // ⚠️ 而寬度至少 1 欄：一個缺掉的 token 佔零個字元，
    //    `start === end` 的標記畫不出來——那會讓「修好了」與「畫不出來」長得一樣。
    out.push(d.at
      ? { startLine: d.at.line, startColumn: d.at.column, endLine: d.at.line, endColumn: d.at.column + 1, severity: d.severity, message, ...(detail ? { detail } : {}) }
      : { startLine: m.startLine, startColumn: 0, endLine: m.endLine, endColumn: null, severity: d.severity, message, ...(detail ? { detail } : {}) })
  }
  return out
}
