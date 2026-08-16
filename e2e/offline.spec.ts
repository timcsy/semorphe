/**
 * **第四十五條護欄**：跑起來之後，不得向任何外部主機要東西。
 *
 * ## 它從哪來
 *
 * 2026-08-15 的委派編譯器探針（`draft/語義診斷系統`）順手掀出來的：
 *
 * ```
 * https://blockly-demo.appspot.com/static/media/sprites.png
 * ```
 *
 * **semorphe 今天的每一個使用者，都在向 Google 的 demo 伺服器要一張圖。**
 * 🔴 而離線時那些圖示（縮放鈕、垃圾桶）會壞掉
 * ——**沒有人發現，因為它壞得很安靜**：圖示只是變成破圖，功能還在。
 *
 * > **「離線可用」這句話今天不完全成立，而它壞得不夠大聲。**
 *
 * ⚠️ 而它是被**另一件事**抓到的：測 COEP（委派編譯器的前置）時，
 * `require-corp` 把那張圖擋掉，破圖才變得看得見。
 *
 * > **一個探針最有價值的產出，常常不是它要驗的那件事。**
 *
 * ## 為什麼量測單位是「發出去的請求」，不是「原始碼裡的網址」
 *
 * 靜態掃網址會誤報一整片：SVG 的 `xmlns`、註解裡的連結、
 * schema 的識別字串——它們**長得像網址而不是請求**。
 *
 * > **誤報的風險不是靠判準寫嚴來消除的，是靠量測單位選對來消除的。**
 *
 * 而「這個請求有沒有真的發出去」沒有誤報的空間：發了就是發了。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果「攔截到的請求總數」低於下限，代表攔截器沒有掛上，
 * > 這份報表不算數——不是「外部請求歸零了」。**
 *
 * 錨在**請求總數**（合成量）上：修好一個外部請求**不會讓總請求數變少**
 * （那張圖改成自託管之後，它仍然是一個請求）。
 * 🔴 **刻意不錨在「外部請求數」**——那正是這條護欄要推向零的東西。
 *
 * ## 硬性零
 *
 * `build-guardrail` 6.8 的三個問題：
 *
 * ```
 * 留一筆規範還成立嗎？   ❌ 「離線可用」留一個外部相依就是假的
 * 修一筆要付多少？       便宜——把檔案搬進 public/，改一個設定
 * 別台機器一樣嗎？       ✅ 攔截在瀏覽器裡，不靠外部工具
 * ```
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測建置期的外部相依**（npm 安裝、CI 抓套件）——那不影響使用者離線
 * - **不檢測「離線時功能對不對」**——它只檢測「有沒有向外要東西」。
 *   ⚠️ 一個把外部資源**內嵌成 base64** 的做法會讓這條綠而體積爆掉，
 *   那是另一件事。
 * - **不檢測 devtools／擴充功能發出的請求**——那些不是我們的。
 */
import { test, expect } from '@playwright/test'

/** 這一頁自己的主機。其餘都是外部。 */
const SELF = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//

test('★ 跑起來之後，不得向任何外部主機要東西', async ({ page }) => {
  const all: string[] = []
  const external: string[] = []

  page.on('request', (req) => {
    const url = req.url()
    all.push(url)
    if (url.startsWith('data:') || url.startsWith('blob:') || SELF.test(url)) return
    external.push(`${req.resourceType()}  ${url}`)
  })

  await page.goto('/')
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 30_000 },
  )
  // 讓延遲載入的東西有機會出手（Blockly 的 sprite 是在工作區建好之後才要的）
  await page.waitForTimeout(2500)

  // ★ 入口條件——錨在**請求總數**（合成量），見檔頭的自我否證
  expect(
    all.length,
    `只攔到 ${all.length} 個請求 → 攔截器沒掛上，這份報表不算數。` +
      `⚠️ 這不代表「外部請求歸零了」。`,
  ).toBeGreaterThan(5)

  expect(
    [...new Set(external)],
    '🔴 有請求跑到外部主機——「離線可用」這句話因此不成立。\n' +
      '⚠️ 而這種缺陷壞得很安靜：圖示變破圖、字型換一種，功能都還在，\n' +
      '所以沒有人會回報它。**把資源搬進 public/。**',
  ).toEqual([])
})
