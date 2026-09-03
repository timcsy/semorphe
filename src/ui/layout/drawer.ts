/**
 * **抽屜**——從右邊滑進來的一張動作清單（☰ 那一顆）。
 *
 * ## 🔴 它為什麼不是一個 QuickPick
 *
 * 使用者 2026-09-03：「我希望 ☰ 可以開啟 drawer」。而那不只是好看：
 *
 * ```
 * QuickPick   一張【選一個就關掉】的清單——它的語氣是「你要哪一個？」
 * 抽屜        一個【留在那裡】的面板——它的語氣是「這裡有這些東西」
 * ```
 *
 * ☰ 裝的是**動作**（課程／匯出／匯入），它們不是彼此的選項
 * ——而 ⚙ 裝的設定才是（每一格只能有一個值）。**兩種意圖，兩種形狀。**
 *
 * ⚠️ 這一支**不做行動版判斷**：誰要開它由呼叫端決定
 *（`app-shell` 只在有 `mobileLayout` 時畫那顆 ☰）。第一百條護欄的同一條紀律。
 */

export interface DrawerItem {
  readonly id: string
  readonly label: string
  readonly description?: string
  /** 前面那個圖示（emoji 或單一字元）。省略就不畫。 */
  readonly icon?: string
  /**
   * 圖示是一段 SVG 路徑時給這個（`d` 屬性 ＋ viewBox 邊長）。
   *
   * ⚠️ **給 `d` 不給整段 HTML**：抽屜自己 `createElementNS` 建節點，
   * 於是這裡不會有 `innerHTML`——一個「圖示」不該是一個注入點。
   */
  readonly iconPath?: { readonly d: string; readonly size: number }
  /** 在它上面畫一條分隔線——用來把「這個專案」與「對作品做什麼」分開。 */
  readonly dividerBefore?: boolean
  readonly run: () => void
}

/** 目前開著的那一個——⚠️ 同時只准有一個，不然背景會疊兩層。 */
let open: (() => void) | null = null

export function openDrawer(title: string, items: readonly DrawerItem[]): void {
  if (items.length === 0) return
  open?.()

  const backdrop = document.createElement('div')
  backdrop.className = 'drawer-backdrop'
  const panel = document.createElement('aside')
  panel.className = 'drawer'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', title)

  const head = document.createElement('div')
  head.className = 'drawer-head'
  const h = document.createElement('span')
  h.textContent = title
  const closeBtn = document.createElement('button')
  closeBtn.className = 'drawer-close'
  closeBtn.title = '關閉'
  closeBtn.textContent = '✕'
  head.append(h, closeBtn)
  panel.appendChild(head)

  for (const item of items) {
    const row = document.createElement('button')
    row.className = item.dividerBefore === true ? 'drawer-item drawer-item-divided' : 'drawer-item'
    row.dataset.action = item.id
    row.innerHTML = ''
    if (item.iconPath !== undefined) {
      const NS = 'http://www.w3.org/2000/svg'
      const svg = document.createElementNS(NS, 'svg')
      svg.setAttribute('viewBox', `0 0 ${item.iconPath.size} ${item.iconPath.size}`)
      svg.setAttribute('aria-hidden', 'true')
      svg.setAttribute('class', 'drawer-item-icon drawer-item-mark')
      const path = document.createElementNS(NS, 'path')
      path.setAttribute('d', item.iconPath.d)
      path.setAttribute('fill', 'currentColor')
      svg.appendChild(path)
      row.appendChild(svg)
    } else if (item.icon !== undefined) {
      const ic = document.createElement('span')
      ic.className = 'drawer-item-icon'
      ic.textContent = item.icon
      row.appendChild(ic)
    }
    const text = document.createElement('span')
    text.className = 'drawer-item-text'
    const label = document.createElement('span')
    label.className = 'drawer-item-label'
    label.textContent = item.label
    text.appendChild(label)
    if (item.description !== undefined) {
      const desc = document.createElement('span')
      desc.className = 'drawer-item-desc'
      desc.textContent = item.description
      text.appendChild(desc)
    }
    row.appendChild(text)
    // ⚠️ 先關再跑：那幾個動作會開檔案對話框／新分頁，
    //    抽屜還開著的話它會蓋在上面。
    row.addEventListener('click', () => { close(); item.run() })
    panel.appendChild(row)
  }

  backdrop.appendChild(panel)
  document.body.appendChild(backdrop)

  const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close() }
  function close(): void {
    if (open === null) return
    open = null
    document.removeEventListener('keydown', onKey)
    backdrop.classList.remove('open')
    // ⚠️ 等滑出去的動畫跑完再拆——直接 remove 會看到它瞬間消失。
    setTimeout(() => backdrop.remove(), 200)
  }
  open = close

  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close() })
  closeBtn.addEventListener('click', close)
  document.addEventListener('keydown', onKey)
  // 🔴 **下一幀才加 `.open`**——同一幀加的話沒有起始狀態，transition 不會跑。
  requestAnimationFrame(() => backdrop.classList.add('open'))
}
