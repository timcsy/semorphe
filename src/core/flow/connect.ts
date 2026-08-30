/**
 * **在流程視圖上拉一條線**——而**大多數的線是畫不出來的**。
 *
 * ## 為什麼這一支要先於「拉線」那個功能
 *
 * `draft/語義樹只有樹沒有邊 §六` 逐字：
 *
 * > **接線圖是那個閘門**：它一進來就必須回答 A／B，**而不是繞過去**
 * > （繞過去的方法很誘人：把接線存進 `metadata`。
 * >  那會讓邊變成一個沒有型別的角落）
 *
 * 🔴 語義樹**只有樹，沒有邊**。所以在流程視圖上拉的線，
 * 只有一種是真的：**「讓這一顆變成那一格的子節點」**。
 * 其餘的（兄弟連兄弟、連到自己的祖先、連到一個沒有宣告的位置）
 * **不是「還沒支援」，是【表達不出來】**。
 *
 * > **一個表達不出來的東西，誠實的處置是說出來，不是找個角落塞進去。**
 *
 * ⚠️ 而它為什麼非得在 (c) 拉線之前做完：
 * 先做拉線的話，「這條線存哪」會在寫 UI 的時候被順手決定，
 * 而**最順手的地方就是 `metadata`**。
 *
 * ## 拒絕要說得出理由
 *
 * `history/017` 逐字：「一道檢查一旦會**拒絕**，就必須同時回答
 * **被拒絕的東西去哪了**。」——這裡的答案是「哪裡都沒去，而原因是這個」。
 */
import type { SemanticNode } from '../types'
import { slotsOf, roleOf } from '../component/traits'

/** 拒絕的理由——**封閉詞彙**。加值的門檻見 `concepts/執行機構.md:279`。 */
export type RefusalReason =
  /** 那一格不是這顆元件宣告過的位置 */
  | 'no-such-slot'
  /** 會接成一個環（連到自己的祖先，或連到自己） */
  | 'would-cycle'
  /** 兩顆都不是對方的位置——**語義樹沒有「兄弟之間的線」這種東西** */
  | 'not-parent-child'
  /** 那一格要的是語句，而來的是運算式（或反過來） */
  | 'wrong-kind'
  /**
   * **被搬的那一顆是骨架**——`ghost` 模式下它的關係鎖著。
   *
   * 🔴 使用者 2026-08-30：「我是希望**淡的還是能移動**，只不過**彼此關係不能變**」。
   *
   * ⚠️ 而這與積木那側禁的**不是同一件事**：
   *
   * ```
   * 積木視圖   位置【就是】結構——拖一塊積木會改變程式
   * 流程視圖   位置只是【排版】——拖一顆節點程式一個字都不會變（存進 flowLayout）
   * ```
   *
   * > **同一句「不能動」，在兩個視圖上禁的不是同一件事。**
   *
   * 🟢 所以流程視圖鎖的是**這裡**（關係），而**拖曳照樣可以**。
   * ⚠️ 而學生把自己的節點接**進**骨架仍然合法——鎖的是「骨架被搬走」，
   *    不是「骨架不能有新的孩子」。
   */
  | 'scaffold-locked'

export type ConnectVerdict =
  | { ok: true; slot: string }
  | { ok: false; reason: RefusalReason }

/** 這顆節點的子樹裡有沒有那個 id（用來擋環）。 */
function contains(node: SemanticNode, id: string): boolean {
  if (node.id === id) return true
  for (const bucket of Object.values(node.children ?? {})) {
    for (const c of bucket ?? []) if (contains(c, id)) return true
  }
  return false
}

function findNode(root: SemanticNode, id: string): SemanticNode | null {
  if (root.id === id) return root
  for (const bucket of Object.values(root.children ?? {})) {
    for (const c of bucket ?? []) {
      const hit = findNode(c, id)
      if (hit) return hit
    }
  }
  return null
}

/**
 * **可不可以把 `sourceId` 接到 `targetId` 的 `slot` 上。**
 *
 * ⚠️ 它**只判斷，不改樹**——`ok` 的話呼叫端才動手。
 * 分開的理由是這個專案反覆學到的一條：
 * **一個又判斷又修改的函式，在拒絕的那條路上會留下改到一半的狀態。**
 */
export function tryConnect(
  root: SemanticNode,
  sourceId: string,
  targetId: string,
  slot: string,
): ConnectVerdict {
  if (sourceId === targetId) return { ok: false, reason: 'would-cycle' }
  const source = findNode(root, sourceId)
  const target = findNode(root, targetId)
  if (!source || !target) return { ok: false, reason: 'not-parent-child' }

  // 🔴 **接到自己的子孫身上 ＝ 環**。樹裡沒有環這種東西，
  //    而一個有環的「樹」會讓每一個走訪它的地方無窮迴圈。
  if (contains(source, targetId)) return { ok: false, reason: 'would-cycle' }

  const slots = slotsOf(target.componentId)
  const decl = slots.find((s) => s.slot === slot)
  if (!decl) return { ok: false, reason: 'no-such-slot' }

  // 那一格要的是語句還是值——**由宣告決定，視圖不判斷**。
  // ⚠️ 判準與 `node-graph.ts` 的接點分類同一條（`roleOf(...) !== 'expression'`）：
  //    兩處各寫一份會分岔，而分岔的症狀是「圖上接得起來，而樹裡接不上」。
  const sourceIsStatement = roleOf(source.componentId) !== 'expression'

  // 🔴 **只有「種類槽」才用種類判**（2026-08-26，e2e 抓到）。
  //
  // `declarators` 宣告成 `"cpp:var_declare"`——它是一個**具名身分**的槽，
  // 而 `isBody` 對它是 `false`（它不裝 statements），於是第一版把它當成
  // 「要一個值」，把一顆 `cpp:var_declare`（語句）判成 `wrong-kind`。
  //
  // > **「這一格裝語句還是值」與「這一格要哪一種身分」是兩個問題，
  // > 而把它們用同一個布林回答，會讓具名的槽永遠接不上。**
  //
  // → 宣告是具名身分時，**種類那一關不判**（下面那一關會判身分）。
  const isKindSlot = decl.allowed.every(
    (a) => a === 'expression' || a === 'statement' || a === 'statements',
  )
  if (isKindSlot && decl.isBody !== sourceIsStatement) {
    return { ok: false, reason: 'wrong-kind' }
  }

  // 🔴 **那一格宣告要【什麼】**（2026-08-26 補，開瀏覽器抓到）。
  //
  // 在此之前只判「語句 vs 運算式」，於是把一個數字接進 `cpp:func_def` 的
  // `params`（宣告要 `param_decl`）**接得上**，產出 `int main(int)`。
  //
  // > **一個宣告了而沒有人讀的型別，與沒有宣告是同一件事。**
  //
  // ⚠️ `expression`／`statement(s)` 是**種類**不是身分，上面那一關已經判過；
  //    這裡判的是**具名的身分**（`param_decl`、`cpp:var_declare`…）。
  const named = decl.allowed.filter((a) => a !== 'expression' && a !== 'statement' && a !== 'statements')
  if (named.length > 0 && !named.some((a) => matchesKind(source.componentId, a))) {
    return { ok: false, reason: 'wrong-kind' }
  }

  return { ok: true, slot }
}

/**
 * 這顆元件算不算宣告要的那一種。
 *
 * ⚠️ 宣告寫的可能是**帶 scope 的身分**（`cpp:var_declare`）或**裸名**（`param_decl`）
 * ——兩種都要認得，因為兩種都真的出現在膠囊裡。
 */
function matchesKind(componentId: string, allowed: string): boolean {
  if (componentId === allowed) return true
  return componentId.split(':').pop() === allowed
}

/** 拒絕的理由 → 一個 i18n 鍵。**畫面上不得出現 `not-parent-child` 這種字**。 */
export function refusalKeyOf(reason: RefusalReason): string {
  return `FLOW_REFUSE_${reason.replace(/-/g, '_').toUpperCase()}`
}

/**
 * **把一句話搬到另一句話後面**——(e) 語句重排。
 *
 * ## 為什麼它不是 `tryConnect`
 *
 * `A.__next__ → B.__in__` 讀作「**B 接在 A 後面**」。那看起來是一條線，
 * 而它**不是父子關係的改變**——A 與 B 是兄弟。
 *
 * 🔴 而它仍然表達得出來：**B 成為 A 的父親的那個身體裡、A 的下一個**。
 * 所以它不違反「語義樹只有樹沒有邊」——它只是換一個位置。
 *
 * > **一條線看起來像什麼，與它在真實裡是什麼，是兩件事。
 * > 判準永遠是後者。**
 *
 * ⚠️ 它與 `tryConnect` 分開，是因為**混在一起會讓兩邊的拒絕理由互相污染**：
 * 「不是父子」對重排來說根本不是一個問題。
 */
export type ReorderVerdict =
  | { ok: true; parentId: string; slot: string; index: number }
  | { ok: false; reason: RefusalReason }

/** 找出 `id` 的父親、它在哪一格、第幾個。 */
function locate(
  root: SemanticNode,
  id: string,
): { parent: SemanticNode; slot: string; index: number } | null {
  for (const [slot, bucket] of Object.entries(root.children ?? {})) {
    const i = (bucket ?? []).findIndex((c) => c.id === id)
    if (i >= 0) return { parent: root, slot, index: i }
    for (const c of bucket ?? []) {
      const hit = locate(c, id)
      if (hit) return hit
    }
  }
  return null
}

/**
 * **可不可以把 `movedId` 搬到 `afterId` 的後面。**
 *
 * ⚠️ 只判斷不改樹——與 `tryConnect` 同一條理由：
 * **一個又判斷又修改的函式，在拒絕的那條路上會留下改到一半的狀態。**
 */
export function tryReorder(root: SemanticNode, afterId: string, movedId: string): ReorderVerdict {
  if (afterId === movedId) return { ok: false, reason: 'would-cycle' }
  const moved = findNode(root, movedId)
  const after = findNode(root, afterId)
  if (!moved || !after) return { ok: false, reason: 'not-parent-child' }

  // 🔴 把一句話搬進**它自己的子樹**＝環。
  if (contains(moved, afterId)) return { ok: false, reason: 'would-cycle' }

  // 兩邊都必須是語句——`__next__`／`__in__` 這對接點只有語句才有，
  // ⚠️ 而這裡仍然要判，因為呼叫端可能拿別的東西進來。
  if (roleOf(moved.componentId) === 'expression' || roleOf(after.componentId) === 'expression') {
    return { ok: false, reason: 'wrong-kind' }
  }

  const spot = locate(root, afterId)
  if (!spot) return { ok: false, reason: 'not-parent-child' }
  return { ok: true, parentId: spot.parent.id, slot: spot.slot, index: spot.index + 1 }
}
