/**
 * **QuickPick** —— 一顆狀態列項目按下去之後出現的那張清單。
 *
 * ## 為什麼要自己做一個
 *
 * 使用者 2026-08-25：
 *
 * > 「我希望網頁版的狀態列長得跟 IDE 的盡可能一樣」「**然後選單也是學 IDE**」
 *
 * 而原本網頁版那幾顆是 `<select>`：它的清單由瀏覽器畫，位置、字型、
 * 鍵盤行為全都不歸我們管——**洗得掉骨架，洗不掉那張清單**。
 *
 * ## 🔴 它與 VSCode 那側讀的是同一份描述
 *
 * `ControlState`（`core/host/controls.ts`）：`{ label, value, options, multi }`。
 * VSCode 把它交給 `window.showQuickPick`，網頁版交給這個檔。
 *
 * > **兩邊長得一樣，不是因為有人照著抄，
 * > 是因為它們畫的是同一份東西。**
 *
 * ⚠️ **刻意不做的**：模糊比對（VSCode 有）、多段分組、圖示。
 * 這裡的清單最多十幾項，而**做一個半套的模糊比對比不做更糟**
 * ——它會在使用者以為它會的時候漏掉東西。
 */

export interface QuickPickItem {
  readonly value: string
  readonly label: string
  /** 右側的淡色說明（VSCode 的 `description`）。 */
  readonly description?: string
  readonly picked?: boolean
  /**
   * 這一項屬於哪一組——**組名換的時候，清單上會多一列標題**。
   *
   * 🔴 為什麼需要它：目標選單原本是一列 13 項的平清單，而它混著
   * **兩個不同的軸**（語言／軌道 vs 板子）。使用者 2026-08-28 看著它問
   * 「**這邊能不能重新設計整理一下？**」
   *
   * ⚠️ 標題列**不可選、不參與搜尋、不佔鍵盤導覽的位置**
   * ——一個按得下去而沒有反應的東西，比沒有它更糟。
   */
  readonly group?: string
}

export interface QuickPickOptions {
  readonly title: string
  readonly items: readonly QuickPickItem[]
  /** 多選。⚠️ 這時要按 Enter 或「確定」才送出——關掉等於取消。 */
  readonly multi?: boolean
}

/** 取消回 `null`——🔴 **與「選了空的多選」分得出來**（後者回 `[]`）。 */
export function showQuickPick(
  options: QuickPickOptions,
  onPick: (values: string[] | null) => void,
): void {
  const overlay = document.createElement('div')
  overlay.className = 'quick-pick-overlay'

  const box = document.createElement('div')
  box.className = 'quick-pick'

  const filter = document.createElement('input')
  filter.className = 'quick-pick-filter'
  filter.type = 'text'
  filter.placeholder = options.title
  filter.setAttribute('aria-label', options.title)
  box.appendChild(filter)

  const list = document.createElement('div')
  list.className = 'quick-pick-list'
  box.appendChild(list)

  const picked = new Set(options.items.filter((i) => i.picked).map((i) => i.value))
  let visible: QuickPickItem[] = [...options.items]
  let active = Math.max(0, visible.findIndex((i) => picked.has(i.value)))

  let done = false
  const close = (values: string[] | null): void => {
    if (done) return
    done = true
    document.removeEventListener('keydown', onKey, true)
    overlay.remove()
    onPick(values)
  }

  const render = (): void => {
    list.innerHTML = ''
    let lastGroup: string | undefined
    visible.forEach((item, index) => {
      // 🔴 **組名換了就插一列標題**——它不是一個項目：
      //    不可選、不參與搜尋、不佔鍵盤導覽的位置（`visible` 裡沒有它）。
      if (item.group !== undefined && item.group !== lastGroup) {
        const head = document.createElement('div')
        head.className = 'quick-pick-group'
        head.textContent = item.group
        list.appendChild(head)
      }
      lastGroup = item.group
      const row = document.createElement('div')
      row.className = 'quick-pick-item' + (index === active ? ' active' : '')
      // ⚠️ **給測試選得到的把手**：標籤會隨語系換，而值不會。
      //    🔴 沒有它的話 e2e 只能用中文標籤配對——而那是一個會隨翻譯壞掉的測試。
      row.dataset.value = item.value
      const mark = document.createElement('span')
      mark.className = 'quick-pick-mark'
      // ⚠️ 單選也標記目前值——**「哪一個是現在的」在清單裡看不出來的話**，
      //    使用者會為了確認而多開一次。
      mark.textContent = picked.has(item.value) ? (options.multi ? '☑' : '✓') : (options.multi ? '☐' : '')
      row.appendChild(mark)
      const text = document.createElement('span')
      text.className = 'quick-pick-label'
      text.textContent = item.label
      row.appendChild(text)
      if (item.description) {
        const desc = document.createElement('span')
        desc.className = 'quick-pick-desc'
        desc.textContent = item.description
        row.appendChild(desc)
      }
      row.addEventListener('mousedown', (e) => {
        e.preventDefault()
        active = index
        choose(item)
      })
      list.appendChild(row)
    })
    list.querySelector('.quick-pick-item.active')?.scrollIntoView({ block: 'nearest' })
  }

  const choose = (item: QuickPickItem): void => {
    if (!options.multi) { close([item.value]); return }
    if (picked.has(item.value)) picked.delete(item.value)
    else picked.add(item.value)
    render()
  }

  const applyFilter = (): void => {
    const q = filter.value.trim().toLowerCase()
    visible = options.items.filter((i) => i.label.toLowerCase().includes(q))
    active = 0
    render()
  }

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); close(null); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, visible.length - 1); render(); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); render(); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      // 🔴 多選按 Enter ＝ **確定**（不是「選這一項」）——與 VSCode 同。
      if (options.multi) { close([...picked]); return }
      const item = visible[active]
      if (item) choose(item)
      return
    }
    if (e.key === ' ' && options.multi && document.activeElement !== filter) {
      e.preventDefault()
      const item = visible[active]
      if (item) choose(item)
    }
  }

  filter.addEventListener('input', applyFilter)
  document.addEventListener('keydown', onKey, true)
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(null) })

  overlay.appendChild(box)
  document.body.appendChild(overlay)
  render()
  // 🔴 **行動版不自動聚焦**（使用者 2026-08-25）。
  //
  // 桌機上自動聚焦是好的：打字就能過濾。而在手機上它會**叫出虛擬鍵盤**，
  // 而鍵盤蓋掉的正是那張清單——**使用者要先收鍵盤才看得到自己要選的東西**。
  //
  // > **一個「幫你準備好打字」的貼心，在只想點一下的人身上是一道門。**
  //
  // ⚠️ 斷點與 CSS 那條**刻意相同**：版面在哪裡換，行為就在哪裡換。
  if (!window.matchMedia('(max-width: 768px)').matches) filter.focus()
}
