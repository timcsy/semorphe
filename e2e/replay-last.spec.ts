/**
 * **重播上一次**（vision〈執行的誠實〉）——用上一次打過的輸入再跑一次；不是預設行為。
 *
 * ```
 * ① 執行、打 21 → 42
 * ② 再按執行 → 又要打（預設不重播）
 * ③ 按主控台的 ↻ → 不用打，直接 42，主控台照樣回顯 21
 * ```
 */
import { test, expect } from '@playwright/test'
import { freshApp, useAsSource, treeHas, selectMode } from './helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
const READ = '#include <iostream>\nusing namespace std;\nint main() {\n    int n;\n    cin >> n;\n    cout << n * 2 << endl;\n    return 0;\n}\n'

test('重播上一次：不用再打輸入，結果一樣；預設的執行照樣要打', async ({ page }) => {
  await freshApp(page)
  await page.evaluate((c) => (window as any).__app.codeView.setCode(c), READ)
  await useAsSource(page, '程式碼')
  await treeHas(page, 'cpp:input')
  await selectMode(page, 'run')
  const input = page.locator('.console-inline-input')
  await expect(input).toBeVisible({ timeout: 30_000 })
  await input.fill('21')
  await input.press('Enter')
  await expect(page.locator('.console-output')).toContainText('42')

  // 預設的執行：照樣要打
  await page.locator('#run-btn').click()
  await expect(input, '🔴 重播不能是預設行為——學生按執行期待的是重新打').toBeVisible({ timeout: 30_000 })
  await page.locator('.debug-stop').click()

  // ↻：不用打
  await page.locator('.bottom-panel-action-btn[data-action="replay"]').click()
  await expect(page.locator('.console-output')).toContainText('42', { timeout: 30_000 })
  await expect(page.locator('.console-output')).toContainText('21')
  await expect(input).toHaveCount(0)
})
