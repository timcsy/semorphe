/**
 * **每一課的「程式碼 ↔ 積木」對照**——產生給課文靜態頁用的。
 *
 * ## 🔴 它解的是使用者 2026-09-04 提的那件事
 *
 * > 「我比較在意的是程式碼跟積木或是節點的對照，
 * >  **目前使用者幾乎沒有辦法從課程了解積木長怎樣**」
 *
 * 而查證的結果是：**編輯器裡那個對照早就做好了**（點一顆積木 → 程式碼那幾行
 * 反白 ＋ 流程圖那個節點亮，`app.ts` 的 `linkNode`）——缺的是
 * **沒有編輯器的那些讀者**（手機上、上課前、搜尋進來的）。
 *
 * ## 🟢 而理論說「並排」不夠
 *
 * 多重表徵（Ainsworth 的 DeFT）最反直覺的一條：
 *
 * > **兩個表徵並排放著，不會自己教會任何人它們是同一個東西。**
 *
 * 學習者需要**被支持著做那個翻譯**。所以產出的不是一張圖，是一份
 * **逐行的對應**——靜態頁上滑過一行程式碼，對應的那塊積木就亮起來。
 *
 * ## ⚠️ 為什麼是腳本產生，不是手工截圖
 *
 * ```
 * 手工截圖   死的。程式碼改了它不會變，而【它與課文不一樣的那天沒有人會知道】
 * 這一支     活的。它記下產生時用的那段程式碼的雜湊，
 *            而護欄拿它跟 lesson.md 現在的〈完成的樣子〉比 —— 過期就紅
 * ```
 *
 * > **一張手工截的圖是死的；一份腳本產的對照是活的——課文改了它會紅。**
 *
 * ⚠️ 它與 `record-clips` 同一個家（`tools/demo/`）而不在 `e2e/`：
 * 它慢，而且它**產生東西**，不驗證東西。
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const ROOT = path.resolve(process.cwd())
const OUT = path.join(ROOT, 'assets/blockmaps')

interface LessonCase { id: string; code: string }

/** 掃出每一課，以及它〈完成的樣子〉那段程式碼——**與 e2e 同一個抽取點**。 */
function collect(): LessonCase[] {
  const root = path.join(ROOT, 'lessons')
  const out: LessonCase[] = []
  for (const track of fs.readdirSync(root, { withFileTypes: true })) {
    if (!track.isDirectory()) continue
    for (const dir of fs.readdirSync(path.join(root, track.name), { withFileTypes: true })) {
      if (!dir.isDirectory()) continue
      const p = path.join(root, track.name, dir.name)
      if (!fs.existsSync(path.join(p, 'lesson.json'))) continue
      const md = fs.readFileSync(path.join(p, 'lesson.md'), 'utf8')
      const code = md.split('## 完成的樣子')[1]?.split('\n## ')[0]
        ?.match(/```[a-z]*\n([\s\S]+?)\n```/)?.[1]
      if (code === undefined) throw new Error(`${track.name}/${dir.name} 抽不出「完成的樣子」`)
      out.push({ id: `${track.name}/${dir.name}`, code })
    }
  }
  return out
}

const CASES = collect()

test('★ 入口條件——真的掃到課了', () => {
  expect(CASES.length, '🔴 一堂課都沒掃到 → 這一支什麼都沒產').toBeGreaterThan(0)
})

/**
 * 🔴 **★ 入口條件：瀏覽器拿到的是【剛才建出來的】那一份。**
 *
 * ⚠️ 這一條是 2026-09-05 那一整天最貴的教訓：`playwright.demo.config.ts` 的
 * `reuseExistingServer: true` 讓 Playwright 接上**還沒收掉的舊 preview**，
 * 於是同一個缺陷被驗成「修好了」一次、又被驗成「沒修好」一次。
 *
 * > **一次「我剛剛量到它好了」的量測，如果沒有先確認量的是新的那一份，
 * > 它會讓一個沒修好的東西帶著「已修復」的標籤上線。**
 *
 * 判準：`dist/index.html` 裡的 entry 檔名，要與伺服器送出來的那一個相同。
 */
test('★ 入口條件——伺服器送的是剛建出來的那一份', async ({ page }) => {
  const onDisk = fs.readFileSync(path.join(ROOT, 'dist/index.html'), 'utf8')
    .match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0]
  expect(onDisk, '🔴 dist/index.html 裡找不到 entry——建置壞了？').toBeTruthy()
  await page.goto('/')
  const served = (await page.content()).match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0]
  expect(
    served,
    '🔴 **伺服器送的不是剛才建出來的那一份**——多半是舊的 preview 還活著。\n' +
      '   先 `pkill -f "vite preview"`，再重跑。\n' +
      `   dist：${onDisk}　伺服器：${served}`,
  ).toBe(onDisk)
})

for (const c of CASES) {
  test(`產生 ${c.id} 的對照`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.addInitScript(() => window.localStorage.clear())
    await page.goto(`/?lesson=${encodeURIComponent(c.id)}`)
    await page.waitForFunction(
      () => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
      undefined, { timeout: 60_000 })
    await page.waitForTimeout(2000)

    // 🔴 **鷹架跟著課程走，不要強制全露**（2026-09-05 使用者指出）。
    //
    //    第一版在這裡呼叫 `setScaffoldMode('editable')`，理由是「課文頁要讓人
    //    看到完整的程式」。而那讓圖與課文**互相矛盾**：C++ 第 1 課的圖上畫著
    //    五塊積木，而它正下方那一行寫著「**積木上你只會看到一塊**」。
    //
    // > **一張「示範這一課長什麼樣」的圖，如果不照那一課的組態產，
    // > 它示範的就是另一課。**
    //
    // ⚠️ 六條軌道裡三條是 `ghost`（淡的）、三條是 `editable`，而個別課還會覆寫。
    //    照著它走，圖上就會出現「淡的鷹架」——那正是學生打開時看到的。

    await page.evaluate((code) =>
      (window as never as { __app: { codeView: { setCode(c: string): void } } })
        .__app.codeView.setCode(code), c.code)
    // 「以程式碼為準」同步一次——⚠️ **與 e2e 走同一個入口**（`#sync-menu-btn`），
    //    因為那是使用者真的按得到的那一顆；自己戳內部 API 的話，
    //    按鈕搬家的那天這一支還是綠的，而課文頁的圖已經是舊的了。
    await page.locator('#sync-menu-btn').click()
    await page.locator('.quick-pick-item').filter({ hasText: /以此為準：程式碼/ }).first().click()
    await page.waitForTimeout(3000)

    // 🟢 **不再需要任何來回**（2026-09-05 使用者：「完成的樣子要和對照一致」）。
    //
    //    鷹架那幾行（`#include`／`using namespace`）已經寫進 66 課的
    //    〈完成的樣子〉了，所以送進去的就是最終那一份——對應表的行號、
    //    左半顯示的文字、課文裡的程式碼，**三者是同一份**。
    //
    // 🪦 中間那一版做了兩次額外同步（積木→程式碼、再程式碼→積木）來補上鷹架，
    //    而它把積木的**格式正規化**也一起帶進來了
    //    （`char s[20] = "hello";` → `= {"hello"};`）——於是課文與圖不再逐字相同。
    //
    // > **與其讓兩份東西「盡量像」，不如讓它們是同一份。**

    const got = await page.evaluate(() => {
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
      for (const b of ws.getAllBlocks(false)) {
        const nodeId = app.blocklyPanel.getNodeIdForBlockId(b.id)
        if (!nodeId) continue
        const r = app.syncController.codeRangeForNode(nodeId)
        if (!r) continue
        blocks.push({ id: b.id, startLine: r.startLine + 1, endLine: r.endLine + 1 })
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
      const maxLine = blocks.reduce((m, b) => Math.max(m, b.endLine), 0)
      // 🔴 **一顆積木只有一個號碼，而那個號碼是它【開始】的那一行。**
      //
      // ⚠️ 第一版是每一行各標一次、後蓋前，於是 `main`（涵蓋 1–8 行）
      //    被標成 ⑧——那是它**收尾的大括號**那一行。學生看著 ⑧ 去找第 8 行，
      //    找到的是一個 `}`。
      //
      // > **一個涵蓋多行的東西，它的號碼是【它從哪裡開始】，
      // > 不是「最後一次提到它的地方」。**
      const firstLine = new Map<string, number>()
      for (let line = 1; line <= maxLine; line++) {
        const hit = blocks.filter((b) => b.startLine <= line && line <= b.endLine)
        if (hit.length === 0) continue
        const span = Math.min(...hit.map((b) => b.endLine - b.startLine))
        const inner = hit.filter((b) => b.endLine - b.startLine === span)
        // 最靠外的那一顆 ＝ 位置最左上的那一顆（巢狀的孩子一定更靠右）
        let best = inner[0]
        for (const b of inner) {
          const a = at.get(b.id), c = at.get(best.id)
          if (a && c && (a.x < c.x || (a.x === c.x && a.y < c.y))) best = b
        }
        if (!firstLine.has(best.id)) firstLine.set(best.id, line)
      }
      for (const [id, line] of firstLine) {
        const xy = at.get(id)
        if (xy) badges.push({ line, x: xy.x, y: xy.y })
      }

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
    })

    // ★ 自我否證：一塊都對不到 ⟹ 產出是一張沒有用的圖，不要寫出去
    expect(got.blocks.length, `🔴 ${c.id}：一塊積木都對不到程式碼`).toBeGreaterThan(0)
    expect(got.svg.length, `🔴 ${c.id}：抽不出積木的 SVG`).toBeGreaterThan(200)

    fs.mkdirSync(OUT, { recursive: true })
    const file = path.join(OUT, `${c.id.replace('/', '__')}.json`)
    fs.writeFileSync(file, JSON.stringify({
      lesson: c.id,
      // 🔴 **哪幾行有號碼**——課文頁左半只把這幾行的號碼標成「可以配對的」。
      //    ⚠️ 這份判斷算在這裡一次，頁面那側不再算第二次。
      badgeLines: got.badgeLines,
      // 🔴 **記下產生時用的那段程式碼的雜湊**——護欄拿它跟課文現在的比。
      //    這是「會過期就變紅」那條規矩的載體。
      codeHash: crypto.createHash('sha256').update(c.code).digest('hex').slice(0, 16),
      // 🔴 **把那段程式碼一起存下來**：頁面左半要逐行標號，而它必須是
      //    **產生這張圖的那一份**——去課文裡再抽一次就是第二個抽取點，
      //    而兩份遲早會不一樣。
      code: c.code,
      blocks: got.blocks,
      svg: got.svg,
    }, null, 0) + '\n')
  })
}
