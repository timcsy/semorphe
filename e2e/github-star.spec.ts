/**
 * **在 GitHub 給星星**——一顆按鈕，而它有兩件事非釘不可。
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-30：「幫我做一個可以在 GitHub 給星星的按鈕」。
 *
 * ## 🔴 為什麼不是 GitHub 官方那顆 iframe（`ghbtns.com`）
 *
 * ```
 * 淺色的           在這個深色介面裡是一塊白補丁，而它的樣式我們改不到
 * 沒辦法退場       iframe 載不出來就是一個空洞；而我們要的是「照樣是一條連結」
 * 第三方 frame     一段別人的程式碼跑在我們的頁面上，換來的只是一個數字
 * ```
 *
 * 🟢 所以是**自己畫的**：商標**內嵌 SVG**，**零外部請求**。
 *
 * 🪦 **星星數拿掉了**（使用者：「我覺得不用把目前星星數寫出來」）——而那一刀
 * 連帶把這個專案的第一個外部請求收掉了：有數字就要打 `api.github.com`，
 * 第四十五條（離線可用）就得從「硬性零」改寫成「只准是裝飾」＋ 一支
 * 「把那個主機擋掉還要能用」＋ 一個具名豁免 ＋ 一份快取。**現在它一個字都不用動。**
 *
 * > **一個看起來只是「少顯示一個數字」的決定，
 * > 收掉的是一整條相依、一次判準改寫、與一份快取。**
 *
 * ## ⚠️ 而它做不到「按一下就加星」
 *
 * GitHub 沒有免登入的加星網址。所以它是一條**誠實的連結**
 * ——與 `app-shell.ts` 那句同一條規則：
 *
 * > **一個長得一樣而按下去沒反應的按鈕，比沒有那顆按鈕更糟
 * > ——因為它讓「像」變成一個謊。**
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測那個網址真的存在**——那要連外，而這個專案的護欄不准。
 * - **不檢測 VSCode 那側沒有它**——那由 `host-contract` 的
 *   「`features` 裡為 false 的 ＝ `featureReasons` 的鍵」擋著。
 */
import { test, expect } from '@playwright/test'
import { freshApp } from './helpers'

test('★ GitHub 星星：連得出去，而【不】發任何外部請求', async ({ page }) => {
  const external: string[] = []
  page.on('request', (r) => {
    const u = r.url()
    if (!u.startsWith('http://localhost') && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u)
  })

  await freshApp(page)
  await page.waitForTimeout(2000)

  const star = page.locator('.github-star')
  // ★ 入口條件——真的有那顆，否則下面每一條都是空過的
  await expect(star, '🔴 找不到星星按鈕').toHaveCount(1)
  await expect(star, '🔴 它在 DOM 裡而看不見——那與沒有它是同一件事').toBeVisible()

  expect(
    await star.getAttribute('href'),
    '🔴 它指到別的地方了',
  ).toBe('https://github.com/timcsy/semorphe')

  // 🔴 **開新分頁**——這是一個編輯器，把使用者的工作蓋掉去看 GitHub 是不能接受的
  expect(await star.getAttribute('target'), '🔴 它會把使用者正在做的東西蓋掉').toBe('_blank')
  // 🔴 **`noopener`**：少了它，被開的那一頁拿得到 `window.opener`
  expect(
    await star.getAttribute('rel'),
    '🔴 少了 noopener——被開的那一頁動得了這一頁',
  ).toContain('noopener')

  // 🔴 **商標要是內嵌的**——一個外連的圖換來的是同一個圖形，
  //    而代價是離線時那顆按鈕變成破圖。
  await expect(
    star.locator('svg.github-star-mark path'),
    '🔴 GitHub 的商標不見了，或它不是內嵌的 SVG',
  ).toHaveCount(1)

  // 🔴 **硬性零：它不得讓這個 app 多發一個外部請求。**
  //    這是第四十五條（離線可用）在這顆按鈕上的投影——
  //    ⚠️ 官方那顆 iframe widget、或一張外連的商標圖，都會在這裡當場紅。
  expect(
    external,
    '🔴 加了一顆按鈕而 app 開始連外了——離線可用是這個專案的硬條件：\n' +
      '⚠️ 修法是**拿掉那個外部資源**（商標內嵌、不要星星數），\n' +
      '不是把這一條放寬。',
  ).toEqual([])
})
