/**
 * **「加速」要跳過哪些節點**——從語意樹算，不從某一個視圖算（spec 205 T008，2026-11-03）。
 *
 * ## 為什麼搬到這裡
 * 原本由積木面板算（`blockly-panel.ts` 的 `nodesInAncestorScope`：往上找包住它的積木、收那塊積木底下的積木對到的節點）。
 * JS 直譯器以**敘述**為單位單步，停下的節點都有自己的積木，所以那樣算得對。Cella 以**節點**為單位（`granularity: 'node'`）——
 * 會停在 `total + i`、`i <= 3` 這類在積木上是**內嵌欄位**、沒有自己積木的節點上：它們不在收集到的清單裡，
 * 於是「加速跳出整個迴圈」每一圈都在它們身上停下來（e2e debug.spec 量到：加速之後還停在第三圈）。
 *
 * > **「跳過哪些節點」是語意樹上的事；用某一個視圖的對照表來算，視圖畫不出來的節點就漏掉了。**
 *
 * ## 層數的意思：第 n 層＝往外數第 n 個「把它放在**敘述清單槽**裡的祖先」（迴圈、if、函式……）
 * 「加速」＝**跳過整層**：第 1 層是包住目前位置的最內層（在迴圈體裡就是那個迴圈，連同它的條件與遞增）。
 * ⚠️ 原本第 1 層＝「只有目前這一顆」——JS 直譯器以敘述為單位，目前這一顆就是一整句；Cella 以節點為單位，
 *    目前這一顆可能只是 `total + i` 裡的 `i`，跳過它等於沒跳。「只跳過這一顆的重複」另有「跳出」那顆鈕（`handleStepOut`）。
 * 停在一顆自己有敘述清單槽的節點（迴圈本身）上時，它自己算第 1 層。
 * 哪一格是敘述清單由元件的宣告回答（`slotsOf` 的 `isBody`），這裡不認得任何身分。數不到那麼多層時取最外面那個。
 */
import type { SemanticNode } from './types'
import { slotsOf } from './component/traits'

export function nodesInEnclosingScope(tree: SemanticNode | null | undefined, nodeId: string, level: number): string[] {
  if (!tree || level < 1) return [nodeId]
  // 根到目標的路徑：每一格記「從上一顆經過哪個槽下來」
  const path: { node: SemanticNode; via: string | null }[] = []
  const find = (n: SemanticNode, via: string | null): boolean => {
    path.push({ node: n, via })
    if (n.id === nodeId) return true
    for (const [slot, kids] of Object.entries(n.slots ?? {})) for (const c of kids) if (find(c, slot)) return true
    path.pop()
    return false
  }
  if (!find(tree, null)) return [nodeId]
  let target: SemanticNode = path[path.length - 1].node
  let count = 0
  // 停在一顆**自己就有敘述清單槽**的節點上（迴圈、if 本身——Cella 進迴圈之前先停在迴圈這一顆）：它自己就是第 1 層。
  // ⚠️ 2026-11-03 e2e 量到：不算它的話，第 1 層變成包住迴圈的 main，加速一按整支跑完。
  if (slotsOf(target.componentId).some((s) => s.isBody)) count++
  for (let i = path.length - 2; i >= 0 && count < level; i--) {
    const via = path[i + 1].via
    const isBody = slotsOf(path[i].node.componentId).some((s) => s.slot === via && s.isBody)
    if (isBody) { target = path[i].node; count++ }
  }
  const out: string[] = []
  const collect = (n: SemanticNode): void => { out.push(n.id); for (const kids of Object.values(n.slots ?? {})) kids.forEach(collect) }
  collect(target)
  return out
}
