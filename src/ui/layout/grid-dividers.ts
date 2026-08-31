/**
 * **可拖的格線**——編輯區改成 CSS Grid 之後，分隔線就是格與格之間的那條縫。
 *
 * ## 🪦 它取代了什麼
 *
 * `SplitPane`（2 個面板、1 條分隔線、用 inline `width: calc(50% - 2px)` 表示比例）。
 * 那個形狀撐不到「十字」：四格兩列兩欄，分隔線有**三條**，而且是二維的。
 *
 * 🔴 而它還留下一個實測撞過的病（`e2e/layout-preset-width.spec.ts`）：
 *
 * > **兩個地方寫同一個 inline 樣式，後寫的那個不知道自己在覆蓋一份狀態。**
 *
 * `SplitPane` 寫面板的 `width`，`applyLayout` 為了還原也寫 `width`
 * ——那一欄於是縮成內容寬度，2000px 的視窗裡只剩 213px。
 *
 * 🟢 **grid 沒有那個病**：比例只住在**容器**的 `grid-template-columns`／`-rows` 上，
 * 面板本身一個字都不寫。**只有一個地方寫那份狀態。**
 *
 * ## 這個模組不做什麼
 *
 * - **不決定有幾格、哪一格放什麼**——那是版面宣告的事（`core/host/layout-presets.ts`）。
 *   它只讀容器**當下**的軌道數，然後在每一條縫上放一個把手。
 * - **不記住比例**——切版面就回到該版面的預設（spec 168 的假設段）。
 */

type Axis = 'columns' | 'rows'

const trackProp = (axis: Axis): 'gridTemplateColumns' | 'gridTemplateRows' =>
  axis === 'columns' ? 'gridTemplateColumns' : 'gridTemplateRows'

/** 讀出當下的軌道大小（px），`getComputedStyle` 給的已經是解析過的值。 */
function tracks(el: HTMLElement, axis: Axis): number[] {
  const v = getComputedStyle(el)[trackProp(axis)]
  return v.split(' ').map((x) => parseFloat(x)).filter((x) => !Number.isNaN(x))
}

/**
 * 在容器的每一條內縫上放一個把手。
 *
 * ⚠️ **可以重複呼叫**：換版面之後軌道數會變，舊的把手要先清掉。
 * 回傳一支「重新鋪一次」的函式。
 */
export function installGridDividers(container: HTMLElement): () => void {
  const handles: HTMLElement[] = []

  const clear = (): void => {
    for (const h of handles) h.remove()
    handles.length = 0
  }

  const drag = (axis: Axis, index: number, startEvt: PointerEvent): void => {
    const sizes = tracks(container, axis)
    // ⚠️ 軌道大小為 0 的格子是**這個版面沒有用到的層**——不得被拖出來
    if (sizes[index] === 0 || sizes[index + 1] === 0) return
    const start = axis === 'columns' ? startEvt.clientX : startEvt.clientY
    const a0 = sizes[index], b0 = sizes[index + 1]
    const move = (e: PointerEvent): void => {
      const d = (axis === 'columns' ? e.clientX : e.clientY) - start
      const a = Math.max(80, a0 + d), b = Math.max(80, b0 - d)
      const next = sizes.map((s, i) => (i === index ? a : i === index + 1 ? b : s))
      // 🔴 比例寫在**容器**上，面板一個字都不寫——見檔頭的 🪦 那一段
      container.style[trackProp(axis)] = next.map((s) => `${s}px`).join(' ')
      window.dispatchEvent(new Event('resize'))
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.cursor = ''
      layout()
    }
    document.body.style.cursor = axis === 'columns' ? 'col-resize' : 'row-resize'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /** 依當下的軌道重新鋪把手。 */
  const layout = (): void => {
    clear()
    const rect = container.getBoundingClientRect()
    for (const axis of ['columns', 'rows'] as const) {
      const sizes = tracks(container, axis)
      let offset = 0
      for (let i = 0; i < sizes.length - 1; i++) {
        offset += sizes[i]
        // ⚠️ 兩邊有一邊是 0（＝這個版面沒用到那一層）就不放把手
        if (sizes[i] === 0 || sizes[i + 1] === 0) continue
        const h = document.createElement('div')
        h.className = `grid-divider grid-divider-${axis}`
        h.style.position = 'absolute'
        if (axis === 'columns') {
          h.style.left = `${offset - 2}px`; h.style.top = '0'
          h.style.width = '4px'; h.style.height = `${rect.height}px`
        } else {
          h.style.top = `${offset - 2}px`; h.style.left = '0'
          h.style.height = '4px'; h.style.width = `${rect.width}px`
        }
        const idx = i
        h.addEventListener('pointerdown', (e) => { e.preventDefault(); drag(axis, idx, e) })
        container.appendChild(h)
        handles.push(h)
      }
    }
  }

  layout()
  return layout
}
