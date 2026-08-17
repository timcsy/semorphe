/**
 * **選 C 風格之後，畫面上真的是 C。**
 *
 * ## 🔴 它從哪來——而它抓到了測試沒抓到的東西
 *
 * 階段 6.10 把 `c-style-parity` 從 6/10 修到 10/10。**而開瀏覽器一看**：
 *
 * ```
 * #include <iostream>        🔴 C 裡沒有這個東西
 * using namespace std;       🔴 C 裡不合法
 * bool b = 1 == 2;           而 <stdbool.h> 沒補
 * printf("%d\n", b);         ✅ 只有這一行是對的
 * ```
 *
 * 根因：`cpp:program` 有**兩條產出路徑**——有鷹架的（UI 走）與 legacy 的
 * （測試走）。**第一版只改了 legacy。**
 *
 * > **一份只走得到其中一條路徑的測試，會讓另一條路徑的缺陷全綠通過。**
 *
 * ⚠️ 而 `experience`「重構後開瀏覽器實測」正是為這一族寫的
 * ——**這一次是它抓到的**。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測產出編不編得過**——那是 `c-style-parity`（它有參照編譯器）
 * - **不檢測 C++ 那一側**——⚠️ 而「C++ 不得退步」由全套測試守著
 * - **只走一個樣本**——它守的是「兩條路徑都改到了」，不是覆蓋率
 */
import { test, expect } from '@playwright/test'

test('★ 選 C 風格 → 產出是乾淨的 C（而不是換了 printf 的 C++）', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { monacoPanel?: { editor?: unknown } } }).__app?.monacoPanel?.editor),
    undefined, { timeout: 30_000 },
  )

  await page.evaluate(() =>
    (window as never as { __app: { monacoPanel: { setCode(c: string): void } } })
      .__app.monacoPanel.setCode('int main(){ bool b = 1 == 2; cout << b << endl; return 0; }'))
  await page.getByText('程式碼→積木').click()
  await page.waitForTimeout(900)

  // ★ 入口條件：C 風格**選得到**（合成量——它 2026-08-17 才接上選單）
  const switched = await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')]
      .find((s) => [...s.options].some((o) => /C 風格|C Style/.test(o.textContent ?? '')))
    if (!sel) return false
    const opt = [...sel.options].find((o) => /C 風格|C Style/.test(o.textContent ?? ''))!
    sel.value = opt.value
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })
  expect(switched, '🔴 選單裡沒有 C 風格——它在 2026-08-17 之前只活在測試裡').toBe(true)
  await page.waitForTimeout(1500)

  const code = await page.evaluate(() =>
    (window as never as { __app: { monacoPanel: { getCode(): string } } }).__app.monacoPanel.getCode())

  // 🔴 C 裡【不存在】的東西——那不是「換個名字」，是那個東西沒有
  expect(code, '🔴 C 產出含 <iostream>——而 C 裡沒有這個標頭').not.toContain('iostream')
  expect(code, '🔴 C 產出含 using namespace std——C 裡不合法').not.toContain('using namespace')
  expect(code, '🔴 C 產出含 cout').not.toContain('cout')

  // ✅ C 需要而 C++ 不需要的
  expect(code, 'C99 的 bool 要 <stdbool.h>').toContain('stdbool.h')
  expect(code, 'printf 要 <stdio.h>').toContain('stdio.h')
  expect(code).toContain('printf')
})
