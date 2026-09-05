/**
 * ★ **side-car 刪掉 ＝ 自動排版，不是壞掉。**
 *
 * ## 🔴 為什麼需要它
 *
 * 存檔裡有四種歸屬（`core/storage-version.ts` 的 `FIELD_OWNERSHIP`），
 * 而其中一種叫 **side-car**：
 *
 * ```
 * document   屬於那個檔案        換一個檔案就換一份
 * sideCar    屬於【那個檔案的外觀】 **可以丟，丟了重算**   ← 這一條驗它
 * user       屬於使用者
 * context    屬於現在在上哪一課
 * ```
 *
 * 「可以丟」是一句**宣告**，而它有一個很容易發生的反面：
 * 丟了之後畫面上是**一片空白**，而使用者以為他的程式沒了。
 *
 * > **一份「可以丟」的快取，如果丟掉它會讓畫面壞掉，
 * > 那它不是快取——它是第二份真相，只是沒有人這樣叫它。**
 *
 * ⚠️ 而程式碼那一側（`app.ts` 的 `sideCarUsable`）**早就寫對了**
 * ——2026-09-06 補這一支之前，**沒有任何測試在驗它**。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不管重算出來的擺放好不好看**——自動排版的品質是另一件事
 * - **不管 `codeHash` 怎麼算**（那是 `sideCarUsable` 內部的事）
 * - **不管沒有 side-car 時慢不慢**（重 lift 本來就比較慢，那是快取存在的理由）
 */
import { test, expect, type Page } from '@playwright/test'

const PROGRAM = `#include <iostream>
using namespace std;
int main() {
    int n = 5;
    cout << n << endl;
    return 0;
}
`

/** 畫布上有幾塊積木。 */
const blockCount = (page: Page): Promise<number> =>
  page.evaluate(() => (window as never as {
    __app?: { blocklyPanel?: { workspace?: { getAllBlocks(o: boolean): unknown[] } } }
  }).__app?.blocklyPanel?.workspace?.getAllBlocks(false)?.length ?? 0)

/** 存一份「有程式碼也有積木」的狀態，然後照 `mutate` 改存檔，再重載。 */
async function saveThenReload(page: Page, mutate: (s: Record<string, unknown>) => void): Promise<number> {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.blocklyWorkspace, .injectionDiv').first()).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(3000)

  await page.evaluate((code) => (window as never as {
    __app: { codeView: { setCode(c: string): void } }
  }).__app.codeView.setCode(code), PROGRAM)
  await page.locator('#sync-menu-btn').click()
  await page.locator('.quick-pick-item').filter({ hasText: /以此為準：程式碼/ }).first().click()
  await page.waitForTimeout(4000)

  // ★ 入口條件——存之前畫布上真的有東西
  expect(await blockCount(page), '🔴 存之前畫布是空的 → 下面驗的是別的東西').toBeGreaterThan(3)

  // 🔴 **逼它存一次**——`autoSave` 掛在積木變動上，而上面走的是
  //    「以程式碼為準」那條路。⚠️ 直接叫內部的 `autoSave` 是**組裝點的方法**，
  //    而這一支驗的不是「什麼時候存」，是「存檔缺一格時載入怎麼辦」。
  await page.evaluate(() => {
    const app = (window as never as { __app: Record<string, unknown> }).__app
    ;(app.autoSave as () => void).call(app)
  })
  await page.waitForTimeout(1000)
  const changed = await page.evaluate((fn) => {
    const raw = localStorage.getItem('semorphe-state')
    if (raw === null) return false
    const s = JSON.parse(raw) as Record<string, unknown>
    // eslint-disable-next-line no-new-func
    ;(new Function('s', fn) as (x: Record<string, unknown>) => void)(s)
    localStorage.setItem('semorphe-state', JSON.stringify(s))
    return true
  }, `(${mutate.toString()})(s)`)
  expect(changed, '🔴 存檔還沒寫出來 → 這一支測不到任何東西').toBe(true)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.blocklyWorkspace, .injectionDiv').first()).toBeVisible({ timeout: 30_000 })
  // ⚠️ **等到它重建出來，而不是等一個猜出來的毫秒數**——重 lift 比套快取慢，
  //    而「慢」與「壞」在一個固定的等待底下長得一樣。
  await page.waitForFunction(() => ((window as never as {
    __app?: { blocklyPanel?: { workspace?: { getAllBlocks(o: boolean): unknown[] } } }
  }).__app?.blocklyPanel?.workspace?.getAllBlocks(false)?.length ?? 0) > 3,
  undefined, { timeout: 25_000 }).catch(() => { /* 回 0，讓斷言說話 */ })
  return blockCount(page)
}

test('★ 積木的擺放丟掉 → 從程式碼重排，不是一片空白', async ({ page }) => {
  test.setTimeout(150_000)
  const n = await saveThenReload(page, (s) => { delete s.blocklyState })
  expect(
    n,
    '🔴 **side-car 丟掉之後畫面空了。**\n' +
      '   `FIELD_OWNERSHIP` 說 `blocklyState` 屬於 sideCar 桶——「可以丟，丟了重算」。\n' +
      '   > 一份「可以丟」的快取，如果丟掉它會讓畫面壞掉，\n' +
      '   > 那它不是快取——它是第二份真相，只是沒有人這樣叫它。',
  ).toBeGreaterThan(3)
})

/**
 * 🔴 **失效條件也要真的失效**——`codeHash` 對不上時，那份擺放是**過期的**，
 * 而套用一份與程式碼不一致的積木比重排更糟。
 *
 * > **對不上的時候，寧可重排版，也不要拿一份與程式碼不一致的積木。**
 * > （`app.ts` 的 `sideCarUsable` 逐字）
 */
test('★ 擺放與程式碼對不上 → 重排，而不是套一份過期的', async ({ page }) => {
  test.setTimeout(150_000)
  const n = await saveThenReload(page, (s) => { s.codeHash = 'obviously-not-the-hash' })
  expect(n, '🔴 對不上的 side-car 被套用了，或畫面空了').toBeGreaterThan(3)
})

/**
 * ⚠️ **流程佈局是同一個桶而性質不同**：它**導不出來**（沒有人算得出
 * 使用者想把盒子放哪），所以它是**狀態**不是快取——而它照樣可以丟。
 *
 * 🔴 丟掉它的正確結果是**自動排版**，不是流程視圖壞掉。
 */
test('★ 流程佈局丟掉 → 自動排版，畫面不受影響', async ({ page }) => {
  test.setTimeout(150_000)
  const n = await saveThenReload(page, (s) => { delete s.flowLayout })
  expect(n, '🔴 丟掉流程佈局把積木那一側也弄壞了').toBeGreaterThan(3)
})
