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
 * 格與格之間那條縫有多寬。
 *
 * 🔴 **把手要住在縫裡，不是蓋在內容上**（2026-09-01）。第一版沒有 `gap`，
 * 於是兩欄**貼在一起**、把手是一層 4px 的浮層——它壓掉每一欄各 2px 的內容
 * （積木的工具箱、程式碼的最後一欄字）。
 *
 * > **一條「分隔」兩個東西的線，如果它們之間沒有空隙，
 * > 那條線分隔的方式就是【蓋掉一點兩邊】。**
 */
function gapOf(el: HTMLElement, axis: Axis): number {
  const v = getComputedStyle(el)[axis === 'columns' ? 'columnGap' : 'rowGap']
  const n = parseFloat(v)
  return Number.isNaN(n) ? 0 : n
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

  const drag = (axis: Axis, boundary: number, startEvt: PointerEvent): void => {
    const sizes = tracks(container, axis)
    // 🔴 **把手的序號數的是「縫」，而軌道裡可能有 0**（＝這個版面沒用到的層）。
    //    直接拿序號當軌道索引，會在有隱藏欄的版面上拖錯一欄。
    const live = sizes.map((v, i) => [v, i] as const).filter(([v]) => v > 0).map(([, i]) => i)
    const index = live[boundary]
    if (index === undefined || live[boundary + 1] === undefined) return
    const start = axis === 'columns' ? startEvt.clientX : startEvt.clientY
    const a0 = sizes[index], b0 = sizes[live[boundary + 1]]
    const move = (e: PointerEvent): void => {
      const d = (axis === 'columns' ? e.clientX : e.clientY) - start
      const a = Math.max(80, a0 + d), b = Math.max(80, b0 - d)
      const after = live[boundary + 1]
      const next = sizes.map((s, i) => (i === index ? a : i === after ? b : s))
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

  /**
   * 依**格子實際的位置**重新鋪把手。
   *
   * 🔴 **不讀 `getComputedStyle` 的軌道**（2026-09-01 實測）。原本讀
   * `gridTemplateColumns`，而切到三欄之後它**連兩層 `requestAnimationFrame`
   * 之後都還回上一個版面的 `733px 733px`**——把手於是永遠停在對照的位置。
   *
   * > **`getComputedStyle` 的軌道值要等版面解析完才是新的，
   * > 而「什麼時候算完」不是呼叫端說了算。**
   *
   * 🟢 `getBoundingClientRect()` 沒有這個問題：它**強制**版面算完才回答。
   * 所以縫在哪，就問格子自己在哪——**每一個內部左緣的前面，就是一條直縫**。
   */
  const layout = (): void => {
    clear()
    const box = container.getBoundingClientRect()
    const cells = Array.from(container.children)
      .filter((c) => !c.classList.contains('grid-divider'))
      .map((c) => c.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
    if (cells.length === 0) return

    const edges = (get: (r: DOMRect) => number, origin: number): number[] =>
      [...new Set(cells.map((r) => Math.round(get(r) - origin)))].filter((v) => v > 1).sort((a, b) => a - b)

    for (const axis of ['columns', 'rows'] as const) {
      const gap = gapOf(container, axis)
      if (gap <= 0) continue
      const starts = axis === 'columns'
        ? edges((r) => r.left, box.left)
        : edges((r) => r.top, box.top)
      for (const start of starts) {
        const h = document.createElement('div')
        h.className = `grid-divider grid-divider-${axis}`
        h.style.position = 'absolute'
        // 🟢 把手**剛好蓋住那條縫**——不多不少，一個像素的內容都不會被壓到
        if (axis === 'columns') {
          h.style.left = `${start - gap}px`; h.style.top = '0'
          h.style.width = `${gap}px`; h.style.height = `${box.height}px`
        } else {
          h.style.top = `${start - gap}px`; h.style.left = '0'
          h.style.height = `${gap}px`; h.style.width = `${box.width}px`
        }
        const idx = starts.indexOf(start)
        h.addEventListener('pointerdown', (e) => { e.preventDefault(); drag(axis, idx, e) })
        container.appendChild(h)
        handles.push(h)
      }
    }
  }

  layout()

  /**
   * 🔴 **版面算完才鋪把手**（2026-09-01 實測）。
   *
   * 在此之前是「`applyLayout` 之後 `requestAnimationFrame` 裡鋪」——而那時
   * `getComputedStyle(container).gridTemplateColumns` 給的**還是上一個版面的軌道**
   * （切到三欄之後仍然讀到 `733px 733px`，實測連兩層 rAF 都不夠）。
   *
   * > **`requestAnimationFrame` 保證的是「在下一次繪製之前」，
   * > 不是「在版面算完之後」——而只有後者能讀到解析過的軌道。**
   *
   * 🟢 `ResizeObserver` 保證的正是後者。而它順手修掉第二件事：
   * **視窗縮放時把手本來不會跟著動**（軌道變了、把手還停在舊座標）。
   */
  const ro = new ResizeObserver(() => layout())
  ro.observe(container)
  for (const child of Array.from(container.children)) {
    if (!(child as HTMLElement).classList.contains('grid-divider')) ro.observe(child)
  }

  return layout
}
