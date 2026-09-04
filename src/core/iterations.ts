/**
 * **迴圈跑了幾次**——把「每一顆節點走過幾次」換算成「這顆迴圈重複了幾輪」。
 *
 * ## 🔴 為什麼不是「那顆迴圈自己的次數」
 *
 * ```
 * while 那一顆        executeNode 只走一次        → 1
 * 它身體裡的兩句      每一圈都走                  → 5
 * ```
 *
 * 迴圈**自己**只被走一次。「跑了幾次」是**身體比自己多出來的倍數**：
 *
 * ```
 * 巢狀的內層迴圈   自己 3（外層每圈一次）· 身體 12   → ×4  ← 倍數才對
 *                                                    ×12 是錯的，而學生
 *                                                    看著它想的是「我明明寫 4」
 * ```
 *
 * ## 🔴 「哪一塊是迴圈」讀宣告，不由結構猜
 *
 * `control_flow: "loop"` **早就宣告在元件裡了**（`loop_while`／`loop_for`／
 * `loop_range`／`loop_count`／`loop_do_while` 五顆）。
 *
 * 一開始我寫的是結構推導——「一個孩子跑得比自己多的節點就是重複器」。
 * 它會動，而它會把**被呼叫 5 次的函式**也標成 `×5`：那句話不假，
 * 卻不是「迴圈跑了幾次」，而使用者會拿它當後者讀。
 *
 * > **一個「剛好也對」的推導，與一個【讀宣告】的推導，
 * > 在今天的畫面上看起來一樣——直到有人加了第六種重複的東西。**
 *
 * ⚠️ 而這裡**不認得 C++**：它問的是標註，不是元件名（`宣告登記處`）。
 */
import { annotationOf } from './skip-declarations'
import { bodySlotsOf } from './component/traits'
import type { SemanticNode } from './types'

/** 這顆節點是不是一個**重複器**——⚠️ 讀宣告，不看元件名。 */
export function isLoop(node: SemanticNode): boolean {
  return annotationOf(node.componentId, 'control_flow') === 'loop'
}

/** 這棵樹裡的迴圈，依出現順序。🔴 「猜這個迴圈會跑幾次」要先知道有幾顆。 */
export function loopNodes(root: SemanticNode | null | undefined): SemanticNode[] {
  const out: SemanticNode[] = []
  const walk = (n: SemanticNode): void => {
    if (isLoop(n)) out.push(n)
    for (const list of Object.values(n.children ?? {})) {
      for (const c of list ?? []) if (c) walk(c)
    }
  }
  if (root) walk(root)
  return out
}

/** 依 id 找那一顆迴圈。⚠️ 找不到回 `undefined`——樹在執行之間被換掉是正常的。 */
export function loopNodeById(
  root: SemanticNode | null | undefined,
  nodeId: string,
): SemanticNode | undefined {
  return loopNodes(root).find((n) => n.id === nodeId)
}

/**
 * **這一顆迴圈跑了幾輪**——⚠️ 與 `iterationCounts` 的差別是**不過濾**。
 *
 * 🔴 徽章刻意只畫 `> 1` 的（`×1` 是雜訊、`×0` 由覆蓋標）；
 * 而**揭曉一個預測時，`1` 與 `0` 都是正當的答案**——
 * 「我猜 5，實際只跑了 1 次」正是最值得看到的那一種。
 *
 * > **一個為了畫面乾淨而過濾掉的數字，
 * > 在另一個消費者眼裡可能正是最重要的那一個。**
 */
export function loopRatio(
  node: SemanticNode,
  counts: ReadonlyMap<string, number>,
): number | undefined {
  if (node.id === undefined || !isLoop(node)) return undefined
  const own = counts.get(node.id) ?? 0
  if (own === 0) return undefined      // 這顆迴圈整個沒被走到（在沒進去的分支裡）
  let body = 0
  for (const slot of bodySlotsOf(node.componentId)) {
    for (const child of node.children?.[slot] ?? []) {
      if (child?.id !== undefined) body = Math.max(body, counts.get(child.id) ?? 0)
    }
  }
  return Math.floor(body / own)
}

/**
 * @param root   這一次跑的那棵樹（**顯示樹**——學生看到的就是它；`null` 就是還沒有）
 * @param counts `SemanticInterpreter.getVisitCounts()`
 * @returns 迴圈節點 id → 跑了幾輪。⚠️ **只收 > 1 的**，理由見下。
 */
export function iterationCounts(
  root: SemanticNode | null | undefined,
  counts: ReadonlyMap<string, number>,
): Map<string, number> {
  const out = new Map<string, number>()
  if (!root) return out

  const walk = (node: SemanticNode): void => {
    const kids = node.children ?? {}
    if (node.id !== undefined && isLoop(node)) {
      const own = counts.get(node.id) ?? 0
      if (own > 0) {
        // 🔴 **只看身體，不看條件**：`while (n <= 5)` 的條件也跑了 6 次
        //    （多的那一次是讓它停下來的那一次），而拿它當分子會變成 `×6`
        //    ——**多一的錯誤**，而這個功能正是要幫學生抓多一少一。
        //
        // 🪦 而第一版寫的是 `if (slot === 'condition') continue`——**一份手寫清單**，
        //    而五顆迴圈的槽名各不相同：
        //
        //    ```
        //    loop_while   condition · body
        //    loop_for     init · cond · update · body     ← 'condition' 對不上
        //    loop_count   from · to · body
        //    loop_do_while  body · cond
        //    ```
        //
        //    實測的症狀不是報錯：巢狀 `for` 標成 `×5` 與 `×4`（正確是 3 與 4）
        //    ——**一個看起來很合理的錯數字**。
        //
        // 🟢 而「哪一格裝語句」宣告裡就有（`"body": "statements"`），
        //    `bodySlotsOf` 是它唯一的讀法。⚠️ 那一支還認得物件寫法
        //    （`{ allowed: ['statement'] }`，41 顆是那樣寫的）——自己判一次會漏掉它們。
        //
        // > **一份「哪些格子裝語句」的清單，只要寫第二份，
        // > 第二份就會漏掉那 41 顆用另一種寫法宣告的。**
        const bodySlots = bodySlotsOf(node.componentId)
        let body = 0
        for (const slot of bodySlots) {
          for (const child of kids[slot] ?? []) {
            if (child?.id !== undefined) body = Math.max(body, counts.get(child.id) ?? 0)
          }
        }
        const times = Math.floor(body / own)
        // ⚠️ **只收 > 1 的**：
        //    `×1` 是雜訊（跑一輪的迴圈畫面上不需要一個標籤）；
        //    `×0`（一輪都沒進去）**已經由「執行覆蓋」標過了**——兩個機制
        //    不要對同一件事各說一次，那會讓學生數不清畫面上到底有幾個問題。
        if (times > 1) out.set(node.id, times)
      }
    }
    for (const list of Object.values(kids)) {
      for (const child of list ?? []) if (child) walk(child)
    }
  }
  walk(root)
  return out
}
