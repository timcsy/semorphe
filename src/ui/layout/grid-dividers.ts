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
 * 這條**位置**在 `at` 的縫，分開的是哪兩條軌道？
 *
 * ## 🔴 為什麼不能用「這是第幾條縫」
 *
 * 2026-09-01，使用者在 VSCode 裡回報「**這拉不動**」——而網頁版好好的。
 *
 * 差別是：VSCode 沒有程式碼欄與主控台（它們在 IDE 自己那裡），
 * 於是那兩條軌道是 **0px**。而 0px 軌道**兩側都有 gap**，所以：
 *
 * ```
 * 軌道   0px    1fr(流程)   1fr(積木)      ← 三欄，在 VSCode
 * 縫    │  │  │           │           │
 *       └──┴──┴─ 這一條在容器左緣後面 4px，被當成「第 0 條縫」
 *                          └─ 使用者真正抓的那一條，是「第 1 條縫」
 * ```
 *
 * 舊寫法拿序號去查「第 n 條有內容的軌道」：第 0 條縫→拖 1↔2（**對的那一對，
 * 而把手在錯的地方**）；第 1 條縫→查到 2 與「沒有下一條」→ **直接 return**。
 *
 * ⚠️ 於是畫面上唯一看得見的那條線 **hover 會變藍、按下去什麼都不做**。
 *
 * > **一個「第幾個」的索引，只在【被數的東西與被指的東西一一對應時】才成立
 * > ——而一條寬度為零的軌道，會在縫的那一側多出一條縫。**
 *
 * 🟢 位置沒有這個問題：把每條軌道的起點算出來，`at` 落在誰的起點上，
 * 那條縫就在它前面。
 *
 * @param sizes 每條軌道的 px 寬（可能有 0）
 * @param gap   軌道之間的縫寬
 * @param at    這條縫右／下那一格的起點，相對於容器
 * @returns `[前一條, 後一條]` 的軌道索引；找不到可拖的一對就回 `null`
 */
export function boundaryAt(sizes: number[], gap: number, at: number): [number, number] | null {
  let offset = 0
  for (let i = 0; i < sizes.length; i++) {
    // 容差 1px：`getBoundingClientRect` 給的是小數，而我們比對的是四捨五入過的值。
    if (Math.abs(offset - at) <= 1 && i > 0) {
      // 🔴 0px 的軌道**不是**可拖的一邊——往前找到真正有內容的那一條。
      let before = i - 1
      while (before >= 0 && sizes[before] <= 0) before--
      let after = i
      while (after < sizes.length && sizes[after] <= 0) after++
      if (before < 0 || after >= sizes.length) return null
      return [before, after]
    }
    offset += sizes[i] + gap
  }
  return null
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

  const drag = (axis: Axis, at: number, startEvt: PointerEvent): void => {
    const sizes = tracks(container, axis)
    const pair = boundaryAt(sizes, gapOf(container, axis), at)
    if (!pair) return
    const [index, after] = pair
    const start = axis === 'columns' ? startEvt.clientX : startEvt.clientY
    const a0 = sizes[index], b0 = sizes[after]
    const move = (e: PointerEvent): void => {
      const d = (axis === 'columns' ? e.clientX : e.clientY) - start
      const a = Math.max(80, a0 + d), b = Math.max(80, b0 - d)
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
   * 🔴 **一格一格看，不是「整條列／整條欄」**（2026-09-01 第二版）。
   *
   * 第一版對每一個內部邊界畫一條**橫跨整個容器**的線——而在「對照」裡
   * 積木是**跨兩列**的，它上面根本沒有縫，那條線卻從它中間穿過去。
   * 使用者：「那條水平線還是沒有處理好」。
   *
   * > **一條分隔線的長度，等於那條縫真正存在的長度
   * > ——而跨格的地方，縫是不存在的。**
   *
   * 🟢 逐格看就自然對了：**只有「這一格的上緣不是容器上緣」才在它上面放一條**，
   * 而跨兩列的格子上緣就是容器上緣，所以它上面不會有線。
   *
   * ⚠️ 位置一樣的把手要**合併**（相鄰兩格共用同一條縫），否則會疊出兩層。
   *
   * 🔴 **不讀 `getComputedStyle` 的軌道**：切版面之後它連兩層 `requestAnimationFrame`
   * 都還回上一個版面的值。`getBoundingClientRect()` 沒有這個問題——它**強制**
   * 版面算完才回答。
   */
  const layout = (): void => {
    clear()
    const box = container.getBoundingClientRect()
    const gapC = gapOf(container, 'columns')
    const gapR = gapOf(container, 'rows')
    const cells = Array.from(container.children)
      .filter((c) => !c.classList.contains('grid-divider'))
      .map((c) => c.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
    if (cells.length === 0) return

    /** 位置 → 這條縫要覆蓋的範圍（相鄰的格子會被合併成一段）。 */
    type Seam = { at: number; from: number; to: number }
    const collect = (
      edge: (r: DOMRect) => number, from: (r: DOMRect) => number, to: (r: DOMRect) => number,
      originEdge: number, originSpan: number,
    ): Seam[] => {
      const by = new Map<number, Seam>()
      for (const r of cells) {
        const at = Math.round(edge(r) - originEdge)
        if (at <= 1) continue     // 貼著容器邊緣 ＝ 不是內部的縫
        const f = Math.round(from(r) - originSpan), t = Math.round(to(r) - originSpan)
        const cur = by.get(at)
        if (cur) { cur.from = Math.min(cur.from, f); cur.to = Math.max(cur.to, t) }
        else by.set(at, { at, from: f, to: t })
      }
      return [...by.values()].sort((a, b) => a.at - b.at)
    }

    const put = (axis: Axis, seams: Seam[], gap: number): void => {
      const sizes = tracks(container, axis)
      for (const seam of seams) {
        // 🔴 **拖不動的縫就不要放把手**。一條 0px 的軌道會在容器邊緣後面留下
        //    一條「縫」，而它兩側沒有兩個拖得動的東西。
        //
        // > **一條 hover 會變色而按下去沒反應的線，比沒有那條線更糟
        // > ——它讓「可以拖」變成一個謊。**（與 `vscode-profile.ts` 那條同一句）
        if (!boundaryAt(sizes, gap, seam.at)) continue
        const h = document.createElement('div')
        h.className = `grid-divider grid-divider-${axis}`
        h.style.position = 'absolute'
        // 🟢 把手**剛好蓋住那條縫**——不多不少，一個像素的內容都不會被壓到
        if (axis === 'columns') {
          h.style.left = `${seam.at - gap}px`; h.style.width = `${gap}px`
          h.style.top = `${seam.from}px`; h.style.height = `${seam.to - seam.from}px`
        } else {
          h.style.top = `${seam.at - gap}px`; h.style.height = `${gap}px`
          h.style.left = `${seam.from}px`; h.style.width = `${seam.to - seam.from}px`
        }
        h.addEventListener('pointerdown', (e) => { e.preventDefault(); drag(axis, seam.at, e) })
        container.appendChild(h)
        handles.push(h)
      }
    }

    if (gapC > 0) put('columns', collect((r) => r.left, (r) => r.top, (r) => r.bottom, box.left, box.top), gapC)
    if (gapR > 0) put('rows', collect((r) => r.top, (r) => r.left, (r) => r.right, box.top, box.left), gapR)
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
