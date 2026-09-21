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
import { engineHash } from '../blockmap/engine-hash'
import { captureBlockmap } from './capture-blockmap'

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

    const got = await page.evaluate(captureBlockmap)

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
      // 🔴 **產這張圖的那台機器長什麼樣**——見 `core/blockmap-engine-hash.ts`。
      //    ⚠️ 少了它，`field_number → field_input` 這種改動會讓 68 張圖
      //    **全部靜默過期**：課文一個字沒改，於是 `codeHash` 一路綠。
      engineHash: engineHash(ROOT),
      blocks: got.blocks,
      svg: got.svg,
    }, null, 0) + '\n')
  })
}
