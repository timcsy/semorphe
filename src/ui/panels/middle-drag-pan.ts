/**
 * **中鍵拖曳＝推畫面，不管游標底下壓著什麼。**
 *
 * ## 🔴 「拖背景就能平移」在滿版的工作區上是空話
 *
 * 學生回饋（2026-09-10，附截圖）：一段 DFS 的積木橫向長到出畫面，
 * 逐字「**有時候遇到這種其實蠻難滑的**」。
 *
 * ⚠️ 而 Blockly **早就能拖背景平移**——問題是那張畫面上**背景不存在**：
 * 每一個像素都是積木，於是「先找一塊空白」這一步本身就失敗了。
 *
 * > **一個要求使用者先找到空白處的手勢，在畫面最滿的時候最沒有用
 * > ——而那正是他最需要平移的時候。**
 *
 * 🟢 中鍵好在它**不問游標底下是什麼**：Figma、CAD、遊戲引擎共用同一個手勢。
 * 而空白鍵加拖曳不適合這裡——使用者隨時可能正在某個欄位裡打字。
 *
 * ## ⚠️ 三個瀏覽器那一側的坑（都必須擋，且都只有中鍵有）
 *
 * ```
 * Windows Chrome   中鍵按下 → 自動捲動那顆圓形游標，會跟這裡打架
 * Linux / X11      中鍵 → 貼上主選取區
 * 任何平台         中鍵放開 → auxclick，壓在連結上就開新分頁
 * ```
 *
 * 擋法是在 **capture 階段**攔 `pointerdown`／`mousedown`／`auxclick` 並
 * `preventDefault()`。⚠️ **capture 是關鍵**：Blockly 的手勢也綁在下面，
 * 讓它收到中鍵的話它會**開始拖那顆積木**——那正是要避免的事。
 */

/**
 * 這一支只需要工作區的三件事。
 *
 * 🔴 **刻意不收 `WorkspaceSvg`**：這樣測試不必造一個 Blockly，
 * 而這個檔案也就管不到別的東西。
 */
export interface PannableViewport {
  scrollX: number
  scrollY: number
  scroll(x: number, y: number): void
  /** 正在拖積木時不接手——那是使用者的另一個手勢。 */
  isDragging?(): boolean
}

/** 平移進行中時掛在容器上，讓游標變成「抓著」。 */
export const PANNING_CLASS = 'is-middle-panning'

/**
 * 把中鍵平移裝到一塊容器上。
 *
 * @param container 注入區。事件裝在它身上（capture），所以整塊都吃得到。
 * @param viewport **一支函式而不是一個值**——渲染器切換會把工作區整個換掉，
 *   而這裡的監聽器活得比它久。拿值的話會平移到一個已經 dispose 的工作區。
 * @returns 解除安裝。
 */
export function enableMiddleDragPan(
  container: HTMLElement,
  viewport: () => PannableViewport | null,
): () => void {
  /** 進行中的那一次。`null` ＝ 沒有在平移。 */
  let active: {
    pointerId: number
    fromX: number
    fromY: number
    scrollX: number
    scrollY: number
  } | null = null

  const stop = (): void => {
    if (!active) return
    active = null
    container.classList.remove(PANNING_CLASS)
  }

  const onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 1) return
    // ⚠️ 不管接不接手，中鍵的預設行為都要擋掉（自動捲動／貼上）。
    e.preventDefault()
    // 🔴 **工具箱的抽屜不算**：它是**另一個**工作區，而且自己會捲。
    //    在那裡中鍵拖曳卻看到主畫布在動，讀起來是壞掉了。
    if ((e.target as Element | null)?.closest?.('.blocklyFlyout')) return
    const ws = viewport()
    if (!ws) return
    // 正在拖積木 → 讓那個手勢自己走完，這裡不插隊。
    if (ws.isDragging?.()) return
    // 🔴 Blockly 的手勢也綁在下面，收到中鍵它會【開始拖那顆積木】。
    e.stopPropagation()
    active = { pointerId: e.pointerId, fromX: e.clientX, fromY: e.clientY, scrollX: ws.scrollX, scrollY: ws.scrollY }
    container.classList.add(PANNING_CLASS)
  }

  const onPointerMove = (e: PointerEvent): void => {
    if (!active || e.pointerId !== active.pointerId) return
    const ws = viewport()
    if (!ws) { stop(); return }
    // 🔴 與 Blockly 自己的 `WorkspaceDragger` 同一條式子：起點的捲動量 ＋ 位移。
    //    寫成別的（例如逐格累加）會在 `scroll()` 撞到邊界夾住之後開始漂。
    ws.scroll(active.scrollX + (e.clientX - active.fromX), active.scrollY + (e.clientY - active.fromY))
  }

  const onPointerUp = (e: PointerEvent): void => {
    if (!active || e.pointerId !== active.pointerId) return
    stop()
  }

  /** 中鍵放開之後那一發——壓在連結上會開新分頁。 */
  const onAuxClick = (e: MouseEvent): void => {
    if (e.button === 1) e.preventDefault()
  }

  /**
   * ⚠️ `pointerdown` 被 `preventDefault` 之後**理應**不會再有相容的
   * `mousedown`——而那是規範說的，不是每一版瀏覽器做到的。
   * 自動捲動壞掉的代價（畫面上多一顆圓形游標，兩套平移互踩）夠難查，
   * 值得再擋一次。
   */
  const onMouseDown = (e: MouseEvent): void => {
    if (e.button === 1) e.preventDefault()
  }

  container.addEventListener('pointerdown', onPointerDown, { capture: true })
  container.addEventListener('mousedown', onMouseDown, { capture: true })
  container.addEventListener('auxclick', onAuxClick, { capture: true })
  // 🔴 移動與放開掛在 `window`：手指滑出容器（甚至滑出視窗）時，
  //    掛在容器上的監聽器收不到 `pointerup`，那一次平移就**永遠不會結束**。
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  window.addEventListener('blur', stop)

  return () => {
    stop()
    container.removeEventListener('pointerdown', onPointerDown, { capture: true })
    container.removeEventListener('mousedown', onMouseDown, { capture: true })
    container.removeEventListener('auxclick', onAuxClick, { capture: true })
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    window.removeEventListener('blur', stop)
  }
}
