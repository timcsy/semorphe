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
    btn.title = state.label
    btn.addEventListener('click', () => {
      const options = state.options ?? []
      // 🔴 沒有值域就**不要開一張空清單**——空清單看起來像壞掉。
      //    ⚠️ 與 `vscode/panel.ts` 的 `pickControl` 同一條。
      if (options.length === 0) return
      showQuickPick(
        {
          title: state.label,
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
    })
    container.appendChild(btn)
  }
}
