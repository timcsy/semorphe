/**
 * **把工作區上的積木抽成一張獨立可用的 SVG**——`record-blockmaps` 與
 * `record-step-blockmaps` 共用的那一支。
 *
 * ## 🔴 它為什麼住在這裡（2026-09-21）
 *
 * 這 200 行原本**長在 `record-blockmaps.spec.ts` 裡面**。做「過程圖」
 * （步驟片段各一張）時要用同一套抽法，而複製第二份就是這個 repo
 * 付過三次學費的那個形狀：
 *
 * > **兩邊分開住的話，它們遲早會不一樣——而症狀不是報錯，是安靜的不一致。**
 *
 * ⚠️ 它是**整支函式被丟進 `page.evaluate`** 的，所以
 * **不得引用模組層的任何東西**（閉包不會被序列化過去）。
 * 需要的常數一律寫在函式裡面。
 *
 * ## 它做的事（逐條都有血的來歷，見函式內註解）
 *
 * ```
 * ① 每一塊積木對到程式碼的哪幾行（`codeRangeForNode`）
 * ② 一塊積木一個號碼，而那個號碼是它【開始】的那一行
 * ③ 把 `.blocklyBlockCanvas` clone 出來，內聯文字／欄位底色／淡化樣式
 * ④ class 與沒人指向的 id 全部拿掉（體積 ＋ 一頁兩張圖時的 id 重複）
 * ⑤ 號碼畫在積木左邊的槽裡，viewBox 左邊多留 30
 * ```
 */
export interface CapturedBlockmap {
  blocks: { id: string; startLine: number; endLine: number }[]
  svg: string
  badgeLines?: number[]
}

/**
 * 🔴 **丟進 `page.evaluate` 的就是這一支**，所以它是一個
 * **自給自足**的函式：不 import、不閉包、不用模組層常數。
 */
/**
 * 🔴 **號碼要對回【讀者看得到的那幾行】。**
 *
 * `record-blockmaps` 送進編輯器的是整份程式，於是位移是 0、行數不設限
 * ——那是預設值，它的行為與這一段被抽出來之前**逐字相同**。
 *
 * ⚠️ 而 `record-step-blockmaps` 送進去的是**一段片段**，而編輯器會
 * **在它前面補鷹架、甚至把它包進 `int main(){…}`**（實測：第 1 課那一段
 * `cout` 同步之後變成 6 行，片段落在第 4 行且多了縮排）。
 *
 * ```
 * 不校正   課文那一格印著 1 2 3，而積木上的號碼是 3 4 5   🔴 配對整個錯掉
 * 校正後   兩邊都是 1 2 3，而鷹架那幾塊【沒有號碼】      🟢 它們不是這一步的事
 * ```
 *
 * > **一份對照表的號碼，要錨在【讀者手上那一份】的行號，
 * > 不是錨在我們餵進去的那一份。**
 */
export interface CaptureWindow {
  /**
   * 🔴 **編輯器行號 → 課文片段行號**，一張逐行的表（見 `tools/demo/line-map.ts`）。
   *
   * ⚠️ 這裡原本是 `firstLine` 一個**單一位移**，而位移假設兩份文字逐行一對一。
   * 產生器會吃掉片段裡的空行 ⟹ 空行之後每一行都錯位，於是
   * 「badge 落在空行」與「badge 超出行數」同時發生（2026-09-29 使用者回報）。
   *
   * > **兩份文字之間的對應，只有在它們逐行一樣的時候才是一個減法。**
   */
  lineMap: Record<number, number>
  /** 課文片段有幾行——超出的一律夾住 */
  lineCount: number
}

export function captureBlockmap(win: CaptureWindow): CapturedBlockmap {

const app = (window as never as Record<string, never>).__app as unknown as {
  blocklyPanel: {
    workspace: {
      getAllBlocks(o: boolean): { id: string; getSvgRoot?(): SVGGElement }[]
      getParentSvg(): SVGSVGElement
    }
    getNodeIdForBlockId(id: string): string | null
  }
  syncController: { codeRangeForNode(id: string): { startLine: number; endLine: number } | null }
}
const ws = app.blocklyPanel.workspace
const blocks: { id: string; startLine: number; endLine: number }[] = []
const at = new Map<string, { x: number; y: number }>()
/** 積木 id → 它起始那一行在課文裡的行號。查不到的（合成的鷹架）不進表。 */
const anchor = new Map<string, number>()
for (const b of ws.getAllBlocks(false)) {
  const nodeId = app.blocklyPanel.getNodeIdForBlockId(b.id)
  if (!nodeId) continue
  const r = app.syncController.codeRangeForNode(nodeId)
  if (!r) continue
  // 🔴 **查表**換到課文片段的行號，並丟掉整個落在表外的那幾塊（鷹架）。
  //
  // ⚠️ 一塊積木可能跨好幾行，而那個範圍裡只有一部分在表裡（`main` 就是）。
  //    所以取**範圍內第一個查得到的**當開始、**最後一個**當結束；
  //    一個都查不到 ⟹ 它整塊都是鷹架，丟掉。
  let s0 = 0
  let e0 = 0
  for (let L = r.startLine + 1; L <= r.endLine + 1; L++) {
    const m = win.lineMap[L]
    if (m === undefined) continue
    if (s0 === 0) s0 = m
    e0 = m
  }
  if (s0 === 0) continue
  blocks.push({
    id: b.id,
    startLine: Math.max(1, Math.min(win.lineCount, s0)),
    endLine: Math.max(1, Math.min(win.lineCount, e0)),
  })
  // 🔴 **錨 ＝ 它【起始那一行】在課文裡的行號，而不是「範圍裡第一個看得到的」。**
  //    合成出來的 `int main(){…}` 的起始行在課文裡不存在 ⟹ 它沒有錨 ⟹ 不配號碼。
  const anchorLine = win.lineMap[r.startLine + 1]
  if (anchorLine !== undefined) anchor.set(b.id, anchorLine)
  const xy = (b as unknown as { getRelativeToSurfaceXY(): { x: number; y: number } })
    .getRelativeToSurfaceXY()
  at.set(b.id, { x: xy.x, y: xy.y })
}

/**
 * 🔴 **每一行的號碼，直接畫進積木裡。**
 *
 * ⚠️ 課文頁有一條硬性零：**不得載入任何 JavaScript**
 * （`audit-lesson-pages` ④，理由是「打開就在那裡」）。所以那個
 * 「滑過一行 → 那塊積木亮」的互動**做不到**，而它本來是這一塊的重點。
 *
 * 🟢 而換來的做法更好：把行號印在對應的積木旁邊，讀者用**編號**配對。
 * 那正是 split-attention 研究說的 integrated format——而它
 * **在紙上、在螢幕閱讀器裡、在沒有 JS 的地方都成立**。
 *
 * > **一個需要滑鼠才成立的對照，在紙上、在手機上、在讀螢幕的人那裡
 * > 都不成立——而編號到處都成立。**
 *
 * ⚠️ 只標**語句層級**的那一塊：一行落在好幾塊積木的範圍裡
 * （`int n = 1;` 也在 `main` 裡），全部標等於沒標。取跨度最小的那一組，
 * 再取其中**最靠外**的那一顆。
 */
const badges: { line: number; x: number; y: number }[] = []
// 🔴 **一顆積木只有一個號碼，而那個號碼是它【開始】的那一行。**
//
// ⚠️ 第一版是每一行各標一次、後蓋前，於是 `main`（涵蓋 1–8 行）
//    被標成 ⑧——那是它**收尾的大括號**那一行。學生看著 ⑧ 去找第 8 行，
//    找到的是一個 `}`。
//
// > **一個涵蓋多行的東西，它的號碼是【它從哪裡開始】，
// > 不是「最後一次提到它的地方」。**
// 🔴 **一顆積木只有在讀者看得到它起始那一行的時候，才配一個號碼。**
//
// ⚠️ 2026-09-29 之前這裡是「走過每一行，誰在這一行勝出就給它號碼」，而那讓
//    一顆**合成出來的**積木拿到號碼：`cpp-beginner/06` 第 5 段的片段是
//
//    ```
//    1  #include <cmath>
//    2  （空行）
//    3  cout << pow(2, 10) << endl;
//    ```
//
//    第 1 行 `include` 勝出拿到 ①；第 2 行是空行，只剩包在外面那顆
//    **課文裡根本沒有**的 `int main(){…}` 涵蓋它，於是它拿到 ②。
//    使用者看到的就是那個：「上面 cmath 的積木好像放錯地方」。
//
// > **一個號碼是一句「去看那一行」的指示。
// > 而它指的那一行，讀者必須看得到。**
//
// 所以現在：號碼**從錨出發**（它起始那一行），而沒有錨的積木一個號碼都不拿。
// ⚠️ 同一行有好幾顆從它開始的積木（`int n = 1;` 的宣告與它的初值）
//    ⟹ 取跨度最小的那一顆；同跨度取最靠左上的（巢狀的孩子一定更靠右）。
const pick = new Map<number, { id: string; span: number; x: number; y: number }>()
for (const b of blocks) {
  const line = anchor.get(b.id)
  if (line === undefined) continue
  const xy = at.get(b.id)
  if (!xy) continue
  const span = b.endLine - b.startLine
  const cur = pick.get(line)
  const better = cur === undefined
    || span < cur.span
    || (span === cur.span && (xy.x < cur.x || (xy.x === cur.x && xy.y < cur.y)))
  if (better) pick.set(line, { id: b.id, span, x: xy.x, y: xy.y })
}
for (const [line, p] of pick) badges.push({ line, x: p.x, y: p.y })

// ── 把積木那一層抽成一份【獨立可用】的 SVG ──────────────────
//
// ⚠️ Blockly 的樣式住在頁面的 CSS 裡，而抽出去的 SVG 沒有那份 CSS。
//    不內聯的話，文字會變成瀏覽器預設的黑色 serif、線條會消失
//    ——**看起來像壞掉，而不是像積木**。
const canvas = ws.getParentSvg().querySelector('.blocklyBlockCanvas')
if (!canvas) return { blocks, svg: '' }
const clone = canvas.cloneNode(true) as SVGGElement
clone.removeAttribute('transform')
// ⚠️ **`style` 也要拿掉**：`transform` 住在那裡（畫布被捲動過的位移），
//    只清屬性的話整張圖會偏掉——而 `viewBox` 是照原座標算的。
clone.removeAttribute('style')

// 🔴 **只有【文字】需要內聯樣式**：積木的顏色、外框、圓角，Blockly 是
//    用 SVG 屬性畫的（`fill="…"` 直接在 `<path>` 上），跟著 `cloneNode`
//    就過來了；而文字的字型與顏色住在頁面的 CSS 裡，抽出去就沒了。
//
// ⚠️ 第一版對**每一個元素**都內聯，產出 77KB——而課文頁現在整頁 7.5KB。
//
// > **把「computed style」整份倒進 SVG，是把一整套瀏覽器預設值
// > 也一起寫進去——而其中 99% 與畫面長什麼樣無關。**
const TEXT_PROPS = ['fill', 'font-family', 'font-size', 'font-weight',
  'text-anchor', 'dominant-baseline']
const srcText = canvas.querySelectorAll('text, tspan')
const dstText = clone.querySelectorAll('text, tspan')
for (let i = 0; i < srcText.length && i < dstText.length; i++) {
  const cs = getComputedStyle(srcText[i])
  const parts: string[] = []
  for (const p of TEXT_PROPS) {
    const v = cs.getPropertyValue(p)
    if (v && v !== 'none' && v !== 'normal') parts.push(`${p}:${v}`)
  }
  dstText[i].setAttribute('style', parts.join(';'))
}

// 🔴 **欄位的底色也住在 CSS 裡**——下拉與輸入格那幾塊 `rect`
//    沒有 `fill` 屬性（Blockly 用 class 上色）。不補的話它們變成**黑色**
//    ——`main`、`n` 那幾格在圖上是一塊黑，而在應用裡是白的。
//
// ⚠️ 判準是「**它自己沒有寫 `fill`**」，不是「它是不是 rect」：
//    積木本體的 `<path>` 有 `fill` 屬性（顏色是渲染器算的），
//    照著補一次只會讓檔案變大而畫面一樣。
const srcAll = canvas.querySelectorAll('rect, path, circle, polygon')
const dstAll = clone.querySelectorAll('rect, path, circle, polygon')
for (let i = 0; i < srcAll.length && i < dstAll.length; i++) {
  if (srcAll[i].hasAttribute('fill')) continue
  const cs = getComputedStyle(srcAll[i])
  const parts: string[] = []
  for (const p of ['fill', 'fill-opacity', 'stroke', 'stroke-width']) {
    const v = cs.getPropertyValue(p)
    if (v && v !== 'none' && v !== 'normal') parts.push(`${p}:${v}`)
  }
  if (parts.length > 0) dstAll[i].setAttribute('style', parts.join(';'))
}

// 🔴 **「淡的鷹架」也要跟著出來**——它住在 CSS 的 `.ghost-block > .blocklyPath`
//    （`opacity: .4` ＋ `stroke-dasharray: 4 3`），而我們等一下要把 class 拿掉。
//
// ⚠️ 這一輪掃**每一個元素**（不是只掃沒寫 fill 的那些）：淡化是掛在
//    積木本體的 `<path>` 上的，而它有 `fill` 屬性——上一輪會跳過它。
const srcEvery = canvas.querySelectorAll('*')
const dstEvery = clone.querySelectorAll('*')
for (let i = 0; i < srcEvery.length && i < dstEvery.length; i++) {
  const cs = getComputedStyle(srcEvery[i])
  const extra: string[] = []
  if (cs.opacity !== '' && cs.opacity !== '1') extra.push(`opacity:${cs.opacity}`)
  const dash = cs.getPropertyValue('stroke-dasharray')
  if (dash && dash !== 'none') extra.push(`stroke-dasharray:${dash}`)
  if (extra.length === 0) continue
  const had = dstEvery[i].getAttribute('style')
  dstEvery[i].setAttribute('style', (had ? had + ';' : '') + extra.join(';'))
}
// ⚠️ 拖曳層／泡泡層不是積木——留著只是體積
for (const sel of ['.blocklyDragSurface', '.blocklyBubbleCanvas', '.blocklyHighlightedConnectionPath']) {
  for (const el of clone.querySelectorAll(sel)) el.remove()
}

// 🔴 **class 全部拿掉**——樣式已經內聯了，那些名字在這張靜態圖裡是死重量。
//
// ⚠️ 而它同時解掉一條硬性零：`audit-lesson-pages` ④ 擋
//    「課文頁提到編輯器的包」，而那個判準是**字串比對**——
//    內聯的 SVG 裡滿滿的 `blockly*` class 名會讓它當場紅。
//
// > **一條規矩要擋的是它的【理由】所指的東西（載入那個包），
// > 而讓字面與理由不再打架的最好辦法，是把那個字面也拿掉。**
//
// 🟢 保留 `data-id`：它是「哪一塊積木」的身分，之後要對回去要靠它。
clone.removeAttribute('class')
for (const el of clone.querySelectorAll('[class]')) {
  if (el.classList.contains('bm-badge')) continue
  el.removeAttribute('class')
}

// 🔴 **沒有人指向的 `id` 也拿掉**——Blockly 給每個欄位配了一個
//    `pblock_10_field_blockly-2h` 這種自動 id。
//
//    ⚠️ 它們不只是體積：一頁上如果有兩張這種圖，**id 就重複了**
//    ——那是不合法的 HTML，而瀏覽器不會抱怨。
//
// ⚠️ 而**有人指向的不能拿**（`clip-path: url(#…)`、`<use href="#…">`）
//    ——先把被指向的收集起來，剩下的才刪。
const referenced = new Set<string>()
for (const m of clone.outerHTML.matchAll(/(?:url\(#|href="#)([^)"]+)/g)) referenced.add(m[1])
for (const el of clone.querySelectorAll('[id]')) {
  if (!referenced.has(el.id)) el.removeAttribute('id')
}

// 把號碼畫上去——⚠️ 畫在**積木左邊的槽**裡，不疊在積木身上
const NS = 'http://www.w3.org/2000/svg'
for (const b of badges) {
  const g = document.createElementNS(NS, 'g')
  g.setAttribute('class', 'bm-badge')
  g.setAttribute('transform', `translate(${Math.round(b.x - 21)},${Math.round(b.y + 4)})`)
  const c = document.createElementNS(NS, 'circle')
  c.setAttribute('cx', '8'); c.setAttribute('cy', '9'); c.setAttribute('r', '8')
  c.setAttribute('style', 'fill:#1f2937;stroke:#fff;stroke-width:1.5')
  const t = document.createElementNS(NS, 'text')
  t.setAttribute('x', '8'); t.setAttribute('y', '12.5')
  t.setAttribute('style',
    'fill:#fff;font:700 10px ui-monospace,SFMono-Regular,Menlo,monospace;text-anchor:middle')
  t.textContent = String(b.line)
  g.append(c, t)
  clone.appendChild(g)
}

const bb = (canvas as SVGGElement).getBBox()
// ⚠️ 左邊要**多留 26**：號碼畫在積木外面，不留的話它們被 viewBox 切掉
const padL = 30, pad = 8
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${Math.round(bb.x - padL)} ` +
  `${Math.round(bb.y - pad)} ${Math.round(bb.width + padL + pad)} ${Math.round(bb.height + pad * 2)}" ` +
  `role="img">${clone.outerHTML}</svg>`
return { blocks, svg, badgeLines: badges.map((b) => b.line).sort((x, y) => x - y) }
}
