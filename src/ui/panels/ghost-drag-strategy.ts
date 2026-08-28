/**
 * **鷹架黏死在原地**——拖走學生的積木時，夾在裡面的鷹架**留在容器裡**。
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-28：「腳手架是淡的固定的，`return 0;` 要顯示淡的，
 * **但是不能被跟著拖動的**」＋「**我可能拖的不是只有一個積木喔**」。
 *
 * ## 🔴 前面三條路都是錯的，而每一條錯在不同的地方
 *
 * ```
 * ① 事件監聽「被拖走就放回去」   記父節點 → 拖走上面那塊時它【沒有變】
 * ② 同上，改記「該在誰肚子裡」   放回去時容器是空的 → return 0 整個消失
 * ③ ghost 模式直接不畫它         拖不到就帶不走，而【使用者要它看得見】
 * ④ Blockly 的 healStack        它把【後面整串】都留下——而學生的積木該跟著走
 * ```
 *
 * > **同一個地方修四次而每次壞在不同的點，那是設計不對的訊號。**
 *
 * ## 🟢 正解：拖曳開始前，先把鷹架從那一串裡【摘出來】
 *
 * ```
 * 拖之前   [cout A] → [cout B] → [return 0(鷹架)]
 * 摘出來   [cout A] → [cout B]        容器尾端：[return 0]
 * 拖曳     兩塊 cout 一起走 ✓          鷹架沒動 ✓
 * ```
 *
 * ⚠️ 而**摘與接都不進復原堆疊**——那不是使用者的一步，
 * 是系統在維持一個它自己宣告過的不變量。
 */
import * as Blockly from 'blockly'

type Strategy = ReturnType<Blockly.BlockSvg['getDragStrategy']>

/**
 * 這顆鷹架**該接回哪裡**——回傳一個「接了就對」的連接點。
 *
 * 🔴 第一版問的是「它在哪個**容器**裡」，而那個問法漏掉**最外層**：
 * 使用者 2026-08-28 貼了 `using namespace std; int x; int main(){…}`，
 * 拖走 `int x` 時 `main` 整顆跟著出去了——因為最外層**沒有容器**，
 * 那個函式回 `null`，於是那顆鷹架根本沒被摘出來。
 *
 * > **「它在誰的肚子裡」與「它該接在誰後面」不是同一個問題，
 * > 而最外層只有後者答得出來。**
 *
 * 🟢 改成問後者，兩種情形就變成同一條規則：
 *
 * ```
 * 往上走，【跳過學生的積木】：
 *   碰到容器的語句插槽  → 錨在那個插槽      （main { … return }）
 *   碰到另一顆鷹架      → 錨在它的 next     （using std; → int x; → main）
 *   什麼都沒有          → 沒有錨點，放回原位
 * ```
 */
function anchorOf(g: Blockly.Block, isGhost: (id: string) => boolean): Blockly.Connection | null {
  let cur: Blockly.Block = g
  for (;;) {
    const up = cur.previousConnection?.targetConnection
    if (!up) return null
    // 語句插槽（`getParentInput()` 有值）→ 它是容器，錨就是這個插槽
    if (up.getParentInput()) return up
    const prev = up.getSourceBlock()
    if (!prev) return null
    if (isGhost(prev.id)) return up   // 上面那顆也是鷹架 → 錨在它後面
    cur = prev                        // 學生的積木——跳過去繼續往上
  }
}

/** 從錨點走到**那一串的尾端**，接在那裡。 */
function appendAfter(block: Blockly.Block, anchor: Blockly.Connection): void {
  let conn: Blockly.Connection = anchor
  for (;;) {
    const next = conn.targetBlock()
    if (!next?.nextConnection) break
    conn = next.nextConnection
  }
  if (block.previousConnection && !conn.targetConnection) {
    conn.connect(block.previousConnection)
  }
}

function withoutUndo(fn: () => void): void {
  const prev = Blockly.Events.getRecordUndo()
  Blockly.Events.setRecordUndo(false)
  try { fn() } finally { Blockly.Events.setRecordUndo(prev) }
}

/**
 * **鷹架自己的策略：拖不動。**
 *
 * 🔴 **不用 `block.setMovable(false)`**——那個旗標同時被 Blockly 的**連接判定**
 * 讀去了：設了它之後，學生的積木**插不進 `main` 與 `return` 之間**
 * （2026-08-28 實測：拿掉它，插入立刻成立）。
 *
 * > **一個「不能拖」的旗標，如果同時被「能不能接」讀去，
 * > 那它表達的就不只是你以為的那件事。**
 *
 * 🟢 而 `IDragStrategy.isMovable()` 只管拖曳——正好是這裡要的那一半。
 */
export function immovableDragStrategy(): Strategy {
  // 🔴 **`isMovable()` 必須留 `true`。**
  //
  // 實測（2026-08-28）：`isMovable` 回 `false`——不管是走 `setMovable(false)`
  // 還是走這個策略——**學生的積木就插不進 `main` 與 `return` 之間**。
  // Blockly 的連接判定要「把被擠掉的那塊移到別處」，而那需要它可動。
  //
  // > **「不能拖」與「不能被移動」在 Blockly 裡是同一個旗標，
  // > 而我們只要前者。**
  //
  // 🟢 所以留著可動，而把**拖曳的每一步都變成沒有動作**——
  //    使用者拖它，畫面上什麼都不會發生。
  return {
    isMovable: () => true,
    startDrag: () => {},
    drag: () => {},
    endDrag: () => {},
    revertDrag: () => {},
  } as Strategy
}

/**
 * 包一層——`startDrag` 時把接在下面的鷹架**摘出這一串**，`endDrag` 之後接回容器尾端。
 *
 * 🔴 **其餘每一支原封轉發**：這裡只多做兩個動作，不接管拖曳。
 * 接管的話，Blockly 之後每一版的行為改動都要在這裡重做一次。
 */
export function healingDragStrategy(
  inner: Strategy,
  isGhost: (blockId: string) => boolean,
  block: Blockly.BlockSvg,
): Strategy {
  let parked: { ghost: Blockly.BlockSvg; anchor: Blockly.Connection | null; at: Blockly.utils.Coordinate }[] = []

  /** 摘出去的每一顆都放回它的錨點；沒有錨點的就放回原來的位置。 */
  const restore = (): void => {
    withoutUndo(() => {
      for (const { ghost, anchor, at } of parked) {
        if (anchor) appendAfter(ghost, anchor)
        else ghost.moveTo(at)
      }
    })
    parked = []
  }
  return {
    isMovable: () => inner.isMovable(),
    startDrag(e?: PointerEvent) {
      parked = []
      // ⚠️ 走**整條 next 鏈**，不是只看下一塊——鷹架可能夾在好幾塊學生積木之後
      const found: Blockly.BlockSvg[] = []
      for (let n = block.getNextBlock(); n; n = n.getNextBlock()) {
        if (isGhost(n.id)) found.push(n as Blockly.BlockSvg)
      }
      // 🔴 **錨點要在動任何一顆之前全部算完**——第一顆被摘掉時，
      //    第二顆的「上面那顆是誰」就已經變了。
      const plan = found.map((g) => ({
        ghost: g,
        anchor: anchorOf(g, isGhost),
        at: g.getRelativeToSurfaceXY(),
      }))
      withoutUndo(() => {
        for (const p of plan) {
          // `unplug(true)`：摘掉它，而**它下面那一串接回它上面**
          //  ——那些是學生的積木，該跟著被拖走的那一塊。
          p.ghost.unplug(true)
          parked.push(p)
        }
      })
      inner.startDrag(e)
    },
    drag: (loc, e) => inner.drag(loc, e),
    endDrag(e?: PointerEvent) {
      inner.endDrag(e)
      restore()
    },
    revertDrag() {
      inner.revertDrag()
      restore()
    },
  } as Strategy
}
