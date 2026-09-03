/**
 * **README 的〈課程〉那一段動畫。**
 *
 * 腳本（每一拍都要看得懂，所以中間有刻意的停頓）：
 *
 * ```
 * ① 課程索引              6 條軌道、66 堂課
 * ② 點「C++ 入門」         那一條軌道的課表
 * ③ 點一堂課               課文——【純 HTML，秒開】，捲一段給人看內容
 * ④ 捲到底                「在編輯器打開這一課」＋ 上一課／下一課
 * ⑤ 進編輯器               工具箱只剩這一課要的、鷹架是淡的
 * ⑥ 照課文打一段            積木長出來——**這一拍是「做」那一半的證據**
 * ⑦ 打開章節選單           「📖 看這一課的課文」——回得去讀
 * ```
 *
 * ⚠️ **第六拍不是裝飾**：剛開一頁的畫布是空的（骨架在程式碼裡，而畫布要等
 * 第一次 lift——既有行為，2026-09-03 量到）。示範停在空畫布上會像壞掉。
 *
 * 🔴 **這一支要演的是「讀 ↔ 做」的來回**，不是課文長什麼樣。
 * 課文誰都會寫；而「讀到一半可以直接動手、動手到一半可以回去讀」是這個工具的事。
 *
 * ⚠️ **第五拍用 `goto` 而不是真的按那顆按鈕**：那顆是 `target="_blank"`，
 * 按下去會開新分頁，而**影片是一個分頁一支**——按了之後就錄不到了。
 * 網址是同一個（`lessonDocHref` 的反向：`/?lesson=<id>`），所以演的事情沒有變。
 */
import { test, expect, type Page } from '@playwright/test'

const LESSON = 'cpp-beginner/11-for迴圈'
const LESSON_URL = '/lessons/cpp-beginner/11-for%E8%BF%B4%E5%9C%88/'

const settle = (page: Page, ms: number): Promise<void> => page.waitForTimeout(ms)

test('lessons', async ({ page }) => {
  test.setTimeout(180_000)

  // ① 課程索引
  await page.goto('/lessons/')
  await settle(page, 1800)
  // 🔴 **錄製器要驗自己的產出**——一段「看起來壞掉」的示範比沒有示範更糟。
  await expect(page.locator('.cards a').first()).toBeVisible()
  expect(await page.locator('.cards a').count(), '🔴 索引上一條軌道都沒有').toBeGreaterThan(3)

  // ② 一條軌道
  await page.locator('.cards a').first().hover()
  await settle(page, 700)
  await page.locator('.cards a').first().click()
  await settle(page, 1600)
  expect(await page.locator('.cards a').count(), '🔴 課表是空的').toBeGreaterThan(5)

  // ③ 一堂課——捲一段，讓人看到它真的是課文
  await page.goto(LESSON_URL)
  await settle(page, 1500)
  expect(await page.locator('h1').innerText()).toContain('for')
  await page.mouse.wheel(0, 900)
  await settle(page, 1400)
  await page.mouse.wheel(0, 1400)
  await settle(page, 1400)

  // ④ 捲到底：CTA ＋ 上一課／下一課
  await page.locator('.lesson-nav').scrollIntoViewIfNeeded()
  await settle(page, 1500)
  await page.locator('a.open').scrollIntoViewIfNeeded()
  await page.locator('a.open').hover()
  await settle(page, 1600)

  // ⑤ 進編輯器（見檔頭：這裡不按按鈕，走同一個網址）
  await page.goto(`/?lesson=${encodeURIComponent(LESSON)}`)
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await settle(page, 2600)
  const cats = await page.locator('.blocklyToolboxCategory').allInnerTexts()
  expect(cats.length, '🔴 工具箱是空的——這一段錄出來會像壞掉').toBeGreaterThan(1)
  expect(cats.length, '🔴 工具箱沒有被這一課收窄，演不出重點').toBeLessThan(9)

  // ⑥ 照課文打一段——積木長出來
  //
  // 🔴 **在既有的骨架【裡面】打，不要把它洗掉**（2026-09-03 錄壞兩次）：
  //
  //    ```
  //    setCode('') 再打整段     → `return 0;` 不見了（補丁器只補得回 include／using）
  //    Control+End 接在後面     → `for` 落在 `main` 【外面】
  //    游標放在 `return 0;` 行首 → `return 0;` 被推進迴圈裡
  //    ```
  //
  // > **一段示範如果把工具的骨架弄壞了，讀者看到的不是「這個工具很好用」，
  // > 是「這個工具會把我的程式弄壞」。**
  //
  // 🟢 正解：游標放到 `int main() {` 的**行尾**，Enter 開一行新的往裡面寫。
  await page.locator('.monaco-editor').first().click()
  await page.keyboard.press('Control+Home')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await settle(page, 400)
  await page.keyboard.type('for (int i = 1; i <= 5; i++) {', { delay: 26 })
  await page.keyboard.press('Enter')
  await page.keyboard.type('cout << i << endl;', { delay: 26 })
  await settle(page, 2800)
  const n = await page.evaluate(() => (window as never as {
    __app: { blocklyPanel: { workspace: { getAllBlocks(o: boolean): unknown[] } } }
  }).__app.blocklyPanel.workspace.getAllBlocks(true).length)
  expect(n, '🔴 打完字積木沒長出來——這一段錄出來會像壞掉').toBeGreaterThan(3)
  const code = await page.evaluate(() =>
    (window as never as { __app: { codeView: { getCode(): string } } }).__app.codeView.getCode())
  // 🔴 `for` 要在 `main` **裡面**，而 `return 0;` 要**還在**（見上面那三次錄壞）
  expect(code.replace(/\s+/g, ' '), '🔴 迴圈掉到 main 外面了')
    .toMatch(/int main\(\) \{ for \(/)
  expect(code, '🔴 骨架的 `return 0;` 被洗掉了').toContain('return 0;')
  expect(code.replace(/\s+/g, ' '), '🔴 `return 0;` 被推進迴圈裡了')
    .toMatch(/\} return 0; \}/)
  await settle(page, 1400)

  // ⑦ 章節選單：回得去讀
  await page.locator('[data-control-id="lesson"]').click()
  await settle(page, 1800)
  await expect(page.locator('.quick-pick-item[data-value^="doc:"]')).toHaveCount(1)
  await settle(page, 1400)
})
