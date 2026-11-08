/**
 * **C++ → Python：換目標時程式換成 Python 的寫法**（spec 219）。
 *
 * 判決相同由護欄 `tests/integration/cpp-to-python-verdict.test.ts` 驗；這裡驗**使用者看得到的那一條路**：
 * 選單換目標之後，編輯器裡是 Python；換不了的程式不動、目標回到 C++、說出原因。
 */
import { test, expect } from '@playwright/test'
import { freshApp, useAsSource, pickTarget, selectTarget, codeLines } from './helpers'

const setCpp = async (page: import('@playwright/test').Page, code: string): Promise<void> => {
  await page.evaluate((c) => (window as never as { __app: { codeView: { setCode(s: string): void } } }).__app.codeView.setCode(c), code)
  await useAsSource(page, '程式碼')
  await expect(page.locator('.blocklyDraggable').first()).toBeVisible({ timeout: 15_000 })
}

test('入門程式：換到 Python 之後編輯器裡是 Python、提示換了幾句', async ({ page }) => {
  await freshApp(page)
  await setCpp(page, '#include <iostream>\nusing namespace std;\nint main() {\n    int a, b;\n    cin >> a >> b;\n    cout << a + b << endl;\n    return 0;\n}\n')
  await pickTarget(page, 'python')
  await expect.poll(async () => (await codeLines(page)).join('\n'), { timeout: 20_000 }).toContain('print(a + b)')
  const code = (await codeLines(page)).join('\n')
  expect(code).toContain('a = int(next_token())')
  expect(code).not.toContain('cout')
  await expect(page.locator('.toast').filter({ hasText: /換成 .* 的寫法/ })).toBeVisible({ timeout: 10_000 })
})

test('換不了的程式（用了指標）：程式不動、目標回到 C++、說出原因', async ({ page }) => {
  await freshApp(page)
  await setCpp(page, '#include <iostream>\nusing namespace std;\nint main() {\n    int x = 3;\n    int* p = &x;\n    cout << *p << endl;\n    return 0;\n}\n')
  const before = await page.evaluate(() => (window as any).__app.currentTarget.id)
  // 不用 pickTarget：它等目標變成 python，而這一支的目標會退回 C++
  await selectTarget(page, 'python')
  await page.waitForFunction((want) => (window as any).__app?.currentTarget?.id === want, before, { timeout: 20_000 })
  await expect.poll(async () => (await codeLines(page)).join('\n'), { timeout: 10_000 }).toContain('int* p = &x;')
  await expect(page.locator('.toast').filter({ hasText: /還不能換成/ })).toBeVisible({ timeout: 10_000 })
})

// SC-004：換目標後 3 秒內在編輯器看到換好的 Python 程式（從點下那一項開始量；判決要暖機，第一次最慢——量的就是第一次）
test('SC-004：換目標到看到 Python 程式，3 秒內', async ({ page }) => {
  await freshApp(page)
  await setCpp(page, '#include <iostream>\nusing namespace std;\nint main() {\n    int n;\n    cin >> n;\n    cout << n * 2 << endl;\n    return 0;\n}\n')
  await page.locator('.status-item-btn[data-control-id="target"]').click()
  const t0 = Date.now()
  await page.locator('.quick-pick-item[data-value="python"]').click()
  await expect.poll(async () => (await codeLines(page)).join('\n'), { timeout: 15_000, intervals: [50] }).toContain('print(n * 2)')
  const ms = Date.now() - t0
  console.log(`SC-004：換目標到看到 Python 程式 ${ms} ms`)
  expect(ms, `${ms} ms`).toBeLessThan(3000)
})
