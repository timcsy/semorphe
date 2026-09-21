/**
 * **「跟著做」每一步的積木圖**——過程圖，不是完成品。
 *
 * ## 🔴 它從哪來（2026-09-21）
 *
 * 一班學生上完 C++ 入門前幾課，兩個人各自要圖：
 *
 * > 建議:每個動作都應該有一個成品圖，因為光是文字很難理解。
 * > 可以學到許多東西，但是沒有太多圖片有點難以理解。
 *
 * 授課老師轉述時把它講準了：
 *
 * > 兩個學生要圖，我想應該是要連**跟著做的過程中拉積木的圖**也要給，
 * > 不是只有完成品。
 *
 * 而 `record-blockmaps` 產的正是「只有完成品」——一課一張，坐在
 * 〈完成的樣子〉底下。這一支補的是**中間那幾步**。
 *
 * ## ⚠️ 先量過才做的兩件事
 *
 * ```
 * 那些片段不是完整的程式  69 課 289 段裡，完整程式只有 11 段
 * 而它們畫得出乾淨的積木  lift 層：185 段 C++ 裡 178 段零逃生艙（96%）
 *                        瀏覽器：抽樣 6 段（含 Python）全部零灰塊
 * ```
 *
 * 🔴 **而判準不是那個抽樣，是這一支自己當場看到的**：
 * 畫出灰色方塊（`raw_code`／`raw_expression`／`unresolved`）的片段
 * **不寫出去**，並列進報表。
 *
 * > **一張示範「你這一步要拉什麼」的圖，如果畫出來的是一塊灰的，
 * > 它示範的是這個工具做不到那件事。**
 *
 * ## ⚠️ 鷹架跟著課程走——與 `record-blockmaps` 同一個決定
 *
 * 不強制全露。理由逐字抄那一支：「一張『示範這一課長什麼樣』的圖，
 * 如果不照那一課的組態產，它示範的就是另一課。」
 *
 * ## 它與 `record-blockmaps` 共用什麼
 *
 * ```
 * 抽 SVG 的那 200 行   tools/demo/capture-blockmap.ts   ← 唯一一份
 * 片段從哪裡來         tools/build-lessons/step-fragments.ts  ← 唯一一份
 * ```
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { engineHash } from '../blockmap/engine-hash'
import { captureBlockmap } from './capture-blockmap'
import { allStepFragments, stepMapFile } from '../build-lessons/step-fragments'
import { parseSkeleton, type Skeleton } from '../../src/core/skeleton'
import { DEGRADATION_VISUALS } from '../../src/core/blocks/category-colors'

const ROOT = path.resolve(process.cwd())
const OUT = path.join(ROOT, 'assets/blockmaps/steps')
/** 🔴 畫不乾淨的那幾段**留在這裡**——報表看得到，而護欄數著它。 */
const SKIPPED = path.join(OUT, '_skipped.json')

const CASES = allStepFragments(ROOT)

test('★ 入口條件——真的掃到片段了', () => {
  expect(CASES.length, '🔴 一段都沒掃到 → 這一支什麼都沒產').toBeGreaterThan(200)
})

/** 🔴 與 `record-blockmaps` 同一條：伺服器送的要是剛建出來的那一份。 */
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

/** 灰色方塊的積木型別長什麼樣——**問名字**，因為這一段跑在瀏覽器裡。 */
const GREY = /raw_code|raw_expression|unresolved/

/**
 * 🔴 **降級的顏色問宣告要，不要在這裡抄一份十六進位。**
 *
 * `DEGRADATION_VISUALS` 是產品自己那一份（`core/blocks/category-colors.ts`）；
 * 抄一份的話，它改色那天這一支會安靜地不再認得降級。
 */
const DEGRADED_COLOURS = Object.values(DEGRADATION_VISUALS)
  .map((v) => v.colour?.toLowerCase()).filter((c): c is string => typeof c === 'string')

/**
 * 骨架的宣告——**直接讀那幾份 JSON**。
 *
 * ⚠️ 不 `import '../../src/languages/cpp/skeletons'`：那一支用
 * `import x from './main.json'`，而 **Playwright 的 ESM loader 要求
 * `with { type: 'json' }`**（Vite／Vitest 不要求）。
 * 同一份宣告、同一支 `parseSkeleton`，只是換一條讀進來的路。
 */
const SKELETONS = new Map<string, Skeleton>()
function skeletonOf(id: string): Skeleton | undefined {
  if (SKELETONS.size === 0) {
    const langs = path.join(ROOT, 'src/languages')
    for (const lang of fs.readdirSync(langs, { withFileTypes: true })) {
      const dir = path.join(langs, lang.name, 'skeletons')
      if (!lang.isDirectory() || !fs.existsSync(dir)) continue
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.json')) continue
        const sk = parseSkeleton(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
        SKELETONS.set(sk.id, sk)
      }
    }
    // ★ 自我否證：一份都沒讀到 ⟹ 下面每一次「放進進入點」都會安靜地讓開
    if (SKELETONS.size === 0) throw new Error('🔴 一份骨架宣告都沒讀到——路徑壞了')
  }
  return SKELETONS.get(id)
}

/**
 * **把一段片段放進它該在的地方。**
 *
 * ## 🔴 它從哪來（2026-09-21，第一輪產完之後量到的）
 *
 * 第一輪 277 張圖裡，**30 張帶著紅色的 `syntax_error` 積木**（11%）
 * ——而完成品那 69 張是 **0**。
 *
 * 原因不是課程，是**我的抽取**：`cout << "Hello!" << endl;` 單獨餵進去，
 * 在檔案層級確實不是合法的 C++，於是產品**誠實地**把它標紅。
 * 而課文裡那一步，學生是把它打在 `main` 裡面的。
 *
 * > **一段程式碼「是不是錯的」要看它在哪裡——
 * > 而把它從那個地方抽出來量，量到的是抽取本身。**
 *
 * ⚠️ 🔴 **包法問產品自己**：課程用哪一份骨架由 `__app.currentSkeletonId` 說，
 * 那份骨架的進入點長什麼樣由它的宣告說（`entryFunctions[].open`／`.close`）。
 * **不要在這裡寫一張「cpp 用 main、arduino 用 setup」的表**
 * ——這個 repo 為手寫清單付過三次學費。
 */
function wrapInEntry(code: string, skeletonId: string): string | null {
  const shell = skeletonOf(skeletonId)
  const entry = shell?.entryFunctions.find((f) => f.hostsBody)
  if (shell === undefined || entry === undefined) return null
  if (entry.open.length === 0) return null   // Arduino 的本體是學生寫的，骨架不生它
  const body = code.split('\n').map((l) => (l.trim() === '' ? l : `    ${l}`)).join('\n')
  return [...entry.open.map((l) => l.code), body, ...entry.close.map((l) => l.code)].join('\n')
}

for (const c of CASES) {
  test(`產生 ${c.lesson} 第 ${c.index} 段`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.addInitScript(() => window.localStorage.clear())
    await page.goto(`/?lesson=${encodeURIComponent(c.lesson)}`)
    await page.waitForFunction(
      () => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
      undefined, { timeout: 60_000 })
    await page.waitForTimeout(2000)

    /**
     * 餵一份程式碼進去、同步、看它長成什麼積木。
     *
     * 回傳的三格都是**產品自己的判斷**：積木的身分、積木的顏色
     *（降級視覺由 `DEGRADATION_VISUALS` 決定）、同步之後編輯器裡的全文。
     */
    const feed = async (code: string): Promise<{ types: string[]; colours: string[]; synced: string }> => {
      await page.evaluate((c2) =>
        (window as never as { __app: { codeView: { setCode(c: string): void } } })
          .__app.codeView.setCode(c2), code)
      // ⚠️ **與 e2e 走同一個入口**（使用者真的按得到的那一顆）——理由見 `record-blockmaps`。
      await page.locator('#sync-menu-btn').click()
      await page.locator('.quick-pick-item').filter({ hasText: /以此為準：程式碼/ }).first().click()
      await page.waitForTimeout(2500)
      return page.evaluate(() => {
        const app = (window as never as Record<string, never>).__app as unknown as {
          blocklyPanel: { workspace: { getAllBlocks(o: boolean): { type: string; getColour(): string }[] } }
          codeView: { getCode(): string }
        }
        const bs = app.blocklyPanel.workspace.getAllBlocks(false)
        return {
          types: bs.map((b) => b.type),
          colours: bs.map((b) => b.getColour().toLowerCase()),
          synced: app.codeView.getCode(),
        }
      })
    }

    /** 這一輪畫出來的東西**能不能給學生看**——回傳不行的理由，或 `null`。 */
    const unusable = (r: { types: string[]; colours: string[] }): string | null => {
      if (r.types.length === 0) return '一塊積木都沒有'
      const grey = [...new Set(r.types.filter((t) => GREY.test(t)))]
      if (grey.length > 0) return `灰色方塊：${grey.join(' ')}`
      const deg = r.colours.filter((c2) => DEGRADED_COLOURS.includes(c2))
      if (deg.length > 0) return `降級著色：${[...new Set(deg)].join(' ')}`
      return null
    }

    let r = await feed(c.code)
    let why = unusable(r)
    if (why !== null) {
      // 🔴 **再試一次：把它放進進入點裡**（見 `wrapInEntry` 的檔頭）。
      //    ⚠️ 骨架是**這一課自己選的**那一份，由應用說，不是我們猜的。
      const skeletonId = await page.evaluate(() =>
        (window as never as { __app: { currentSkeletonId?: string } }).__app.currentSkeletonId ?? '')
      const wrapped = wrapInEntry(c.code, skeletonId)
      if (wrapped !== null) {
        const r2 = await feed(wrapped)
        const why2 = unusable(r2)
        if (why2 === null) { r = r2; why = null }
        else why = `${why}（放進 ${skeletonId} 的進入點再試一次：${why2}）`
      }
    }

    fs.mkdirSync(OUT, { recursive: true })
    const file = path.join(OUT, stepMapFile(c))
    if (why !== null) {
      // 🔴 **不寫出去，而要留下痕跡**——一段安靜地沒有圖，與一段
      //    「我們判斷它不該有圖」長得一模一樣。
      if (fs.existsSync(file)) fs.rmSync(file)
      const list: Record<string, string> = fs.existsSync(SKIPPED)
        ? JSON.parse(fs.readFileSync(SKIPPED, 'utf8')) : {}
      list[stepMapFile(c)] = why
      fs.writeFileSync(SKIPPED, JSON.stringify(list, null, 2) + '\n')
      test.info().annotations.push({ type: '跳過', description: why })
      return
    }

    // 🔴 **編輯器不會原封不動收下那段片段**（實測）：
    //
    // ```
    // 第 8 課  int n = 10; …        → 前面補兩行鷹架，片段落在第 3 行
    // 第 1 課  cout << "哈囉";      → 補鷹架【再包進 int main(){…}】，落在第 4 行且多了縮排
    // Python   for i in range(3):   → 一個字都沒動
    // ```
    //
    // 所以位移要**當場量**，不能假設它是 0——也不能假設它是 2。
    // ⚠️ 比對用 `trim()`：包進 `main` 那一路會加縮排。
    const synced = r.synced
    const want = c.code.split('\n').find((l) => l.trim() !== '')?.trim() ?? ''
    const firstLine = synced.split('\n').findIndex((l) => l.trim() === want) + 1
    // ★ 自我否證：找不到那一行 ⟹ 同步把它換掉了，這張圖對不回課文，不要寫出去
    expect(firstLine, `🔴 ${c.lesson}#${c.index}：同步之後找不到片段的第一行——對不回課文`).toBeGreaterThan(0)

    const got = await page.evaluate(captureBlockmap,
      { firstLine, lineCount: c.code.split('\n').length })
    // ★ 自我否證：一塊都對不到 ⟹ 產出是一張沒有用的圖，不要寫出去
    expect(got.blocks.length, `🔴 ${c.lesson}#${c.index}：一塊積木都對不到程式碼`).toBeGreaterThan(0)
    expect(got.svg.length, `🔴 ${c.lesson}#${c.index}：抽不出積木的 SVG`).toBeGreaterThan(200)

    fs.writeFileSync(file, JSON.stringify({
      lesson: c.lesson,
      index: c.index,
      section: c.section,
      badgeLines: got.badgeLines,
      // 🔴 過期就變紅的載體——護欄拿它跟課文現在那一段比。
      codeHash: crypto.createHash('sha256').update(c.code).digest('hex').slice(0, 16),
      code: c.code,
      engineHash: engineHash(ROOT),
      blocks: got.blocks,
      svg: got.svg,
    }, null, 0) + '\n')
    // 🟢 上一輪被跳過、這一輪畫得出來了 → 名單要跟著縮
    if (fs.existsSync(SKIPPED)) {
      const list: Record<string, string> = JSON.parse(fs.readFileSync(SKIPPED, 'utf8'))
      if (stepMapFile(c) in list) {
        delete list[stepMapFile(c)]
        fs.writeFileSync(SKIPPED, JSON.stringify(list, null, 2) + '\n')
      }
    }
  })
}
