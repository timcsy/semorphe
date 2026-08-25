/**
 * 網頁版狀態列上的**控制項**。
 *
 * ## 它與 VSCode 那側是同一份描述的兩個投影
 *
 * ```
 * ControlState  ──→  vscode.window.createStatusBarItem ＋ showQuickPick   （IDE）
 *               ──→  這個檔：一顆文字按鈕 ＋ showQuickPick                （網頁版）
 * ```
 *
 * 使用者 2026-08-25：「我希望網頁版的狀態列長得跟 IDE 的盡可能一樣」。
 *
 * > **兩邊長得一樣，不是因為有人照著抄，
 * > 是因為它們畫的是同一份東西。**
 *
 * ⚠️ 所以這個檔**不認得**目標／風格／語系是什麼——它只認得
 * 「一顆有標籤、有值域的 picker」。要加第五顆 picker 不必動這裡。
 */
import { showQuickPick } from '../toolbar/quick-pick'
import type { ControlState, ControlInvoke } from '../../core/host/controls'

/**
 * 打開一顆控制項的清單。🔴 **狀態列與設定表共用這一支**。
 */
function openPicker(state: ControlState, onInvoke: (invoke: ControlInvoke) => void): void {
  const options = state.options ?? []
  // 🔴 沒有值域就**不要開一張空清單**——空清單看起來像壞掉。
  //    ⚠️ 與 `vscode/panel.ts` 的 `pickControl` 同一條。
  if (options.length === 0) return
  showQuickPick(
    {
      title: state.title,
      multi: state.multi,
      items: options.map((o) => ({
        value: o.value,
        label: o.label,
        picked: state.multi ? state.picked?.includes(o.value) : o.value === state.value,
        description: !state.multi && o.value === state.value ? '目前' : undefined,
      })),
    },
    (values) => {
      if (values === null) return          // 取消
      if (state.multi) onInvoke({ id: state.id, values })
      else if (values[0] !== undefined) onInvoke({ id: state.id, value: values[0] })
    },
  )
}

/**
 * 把狀態列上的控制項畫出來（每次整份重畫）。
 *
 * 🔴 **整份重畫而不是逐項更新**——這些項目一輪最多五顆，
 * 而一份會漂移的差異更新遠比一份小小的整份昂貴。
 */
export function renderStatusControls(
  container: HTMLElement,
  states: readonly ControlState[],
  onInvoke: (invoke: ControlInvoke) => void,
): void {
  container.innerHTML = ''
  for (const state of states) {
    const btn = document.createElement('button')
    btn.className = 'status-item-btn'
    btn.dataset.controlId = state.id
    btn.textContent = state.label
    btn.title = state.title
    btn.addEventListener('click', () => openPicker(state, onInvoke))
    container.appendChild(btn)
  }
}

/**
 * 行動版的設定 —— **一張往下鑽的 QuickPick**。
 *
 * ## 🔴 為什麼不是「從上面掉下來的選單」
 *
 * 第一版是漢堡選單從工具列往下展開，裡面是一排「名字 ＋ 目前的值」，
 * 點一列再從**底部**彈出 QuickPick。使用者 2026-08-25：
 * 「**目前行動版的選單，我覺得使用者體驗不好**」。
 *
 * 兩個具體的毛病：
 *
 * ```
 * 位置   從【上面】掉下來，而拇指在下面
 * 一致   點完一列跳出【另一種樣式】的清單——同一次操作換了兩種介面
 * ```
 *
 * > **一次操作裡換兩種介面，使用者要重新找一次「按哪裡」。**
 *
 * 現在兩層都是同一個 QuickPick：第一層列出控制項（名字 ＋ 目前的值），
 * 選一個進第二層挑值。**同一個元件、同一個位置、同一組鍵盤行為。**
 *
 * ⚠️ 而「名字 ＋ 目前的值」沒有丟——它是 QuickPick 的 `description`。
 */
export function openSettings(
  states: readonly ControlState[],
  onInvoke: (invoke: ControlInvoke) => void,
): void {
  const pickable = states.filter((s) => (s.options ?? []).length > 0)
  if (pickable.length === 0) return
  showQuickPick(
    {
      title: '設定',
      items: pickable.map((s) => ({ value: s.id, label: s.title, description: s.label })),
    },
    (values) => {
      if (values === null) return
      const state = pickable.find((s) => s.id === values[0])
      if (state) openPicker(state, onInvoke)
    },
  )
}
