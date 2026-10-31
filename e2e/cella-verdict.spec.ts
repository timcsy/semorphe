/**
 * **Cella 的判決標在那一塊**（spec 182，重構階段 5a）——判決第一次被學生看到。
 *
 * 走真的 worker、真的 Cella（不 mock）：判決的形狀與節點歸屬才是這一支要釘的。
 * ⚠️ 自動化瀏覽器不自動暖機（`src/main.ts`）——這裡自己呼叫 `warmUpChecker()`。
 *
 * ```
 * ① 越界讀取          → 狀態列「1 個問題」、程式碼紅波浪、積木上有警告圖示（不是藍的）
 * ② 還不支援的構造    → 「判不出來」、藍波浪、積木圖示是藍的（P6：系統能力不足不是學生的錯）
 * ③ 型別不合          → 接得上、那一句標錯（US4）
 * ④ 修好              → 兩側都清掉
 * ⑤ 載入失敗          → 「無法使用」＋原因；編輯照常
 * ```
 */
import { test, expect, type Page } from '@playwright/test'
import { freshApp, useAsSource, treeHas } from './helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
const status = (page: Page) => page.locator('#status-check')

async function feed(page: Page, code: string, marker: string): Promise<void> {
  await page.evaluate((c) => (window as any).__app.codeView.setCode(c), code)
  await useAsSource(page, '程式碼')
  await treeHas(page, marker)
}

const OOB = '#include <iostream>\nusing namespace std;\nint main() {\n    int a[3] = {1, 2, 3};\n    int i = 5;\n    cout << a[i] << endl;\n    return 0;\n}\n'
const UNSUPPORTED = '#include <iostream>\n#include <map>\nusing namespace std;\nint main() {\n    map<int, int> m;\n    m[1] = 2;\n    return 0;\n}\n'
const TYPE_MISMATCH = '#include <iostream>\n#include <string>\nusing namespace std;\nint main() {\n    string s = "hi";\n    int x = s;\n    cout << x << endl;\n    return 0;\n}\n'
const FIXED = '#include <iostream>\nusing namespace std;\nint main() {\n    int a[3] = {1, 2, 3};\n    cout << a[2] << endl;\n    return 0;\n}\n'

test('判決標在那一塊：有錯是紅的、判不出來是藍的、修好就消失', async ({ page }) => {
  test.setTimeout(240_000)
  await freshApp(page)
  await page.waitForTimeout(2500)   // 閒置暖機在非自動化的瀏覽器裡約 1.5 秒內會發生——等過它再看
  expect([null, 'idle'], '自動化瀏覽器下不自動載（首屏不搶頻寬）').toContain(await status(page).getAttribute('data-state'))
  await page.evaluate(() => (window as any).__app.warmUpChecker())
  await expect(status(page)).toHaveAttribute('data-state', 'ready', { timeout: 180_000 })

  await feed(page, OOB, 'cpp:array_at')
  await expect(status(page)).toHaveText(/1 個問題/, { timeout: 30_000 })
  await expect(page.locator('.squiggly-error')).not.toHaveCount(0)
  await expect(page.locator('.blocklyWarningIcon')).not.toHaveCount(0)
  await expect(page.locator('.diag-info'), '有錯的積木不能畫成「判不出來」的藍色').toHaveCount(0)

  await feed(page, UNSUPPORTED, 'cpp:map_declare')
  await expect(status(page)).toHaveText(/判不出來/, { timeout: 30_000 })
  await expect(page.locator('.squiggly-info')).not.toHaveCount(0)
  await expect(page.locator('.squiggly-error'), '判不出來不是學生的錯——不能是紅的').toHaveCount(0)
  await expect(page.locator('.diag-info')).not.toHaveCount(0)

  // US4：型別不合也接得上（程式碼照樣轉成積木），而那一句標錯
  await feed(page, TYPE_MISMATCH, 'cpp:var_ref')
  await expect(status(page)).toHaveText(/1 個問題/, { timeout: 30_000 })
  await expect(page.locator('.squiggly-error')).toHaveCount(1)

  await feed(page, FIXED, 'cpp:print')
  await expect(status(page)).toHaveText(/沒有發現問題/, { timeout: 30_000 })
  await expect(page.locator('.blocklyWarningIcon')).toHaveCount(0)
  await expect(page.locator('[class*=squiggly]')).toHaveCount(0)
})

test('「依 libc++」小標：結果依賴實作的選擇時出現、點開是中文說明、不改變綠紅（第 14 題）', async ({ page }) => {
  test.setTimeout(240_000)
  await freshApp(page)
  await page.evaluate(() => (window as any).__app.warmUpChecker())
  await expect(status(page)).toHaveAttribute('data-state', 'ready', { timeout: 180_000 })
  await feed(page, '#include <iostream>\n#include <vector>\nusing namespace std;\nint main() {\n    vector<int> v;\n    v.push_back(1);\n    v.push_back(2);\n    v.push_back(3);\n    cout << v.capacity() << endl;\n    return 0;\n}\n', 'cpp:vector_declare')
  const badge = page.locator('#status-assumes')
  await expect(badge).toBeVisible({ timeout: 30_000 })
  await expect(badge).toHaveText(/依 libc\+\+/)
  await expect(status(page), '小標不改變綠紅').toHaveText(/沒有發現問題/)
  await badge.click()
  await expect(page.locator('#status-assumes-pop')).toContainText('vector 的容量')
})

test('載入失敗：狀態說「無法使用」與原因，編輯照常', async ({ page }) => {
  await page.route('**/*.cell*', (r) => r.abort())
  await freshApp(page)
  await page.evaluate(() => (window as any).__app.warmUpChecker())
  await expect(status(page)).toHaveAttribute('data-state', 'unavailable', { timeout: 60_000 })
  await expect(status(page)).toHaveText(/無法使用/)
  expect(await status(page).getAttribute('title')).toBeTruthy()
  // 判決不在，程式碼 → 積木照常
  await feed(page, FIXED, 'cpp:print')
})
