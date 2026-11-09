/**
 * **Python → C++：換目標時程式換成 C++ 的寫法**（spec 225）。
 *
 * 判決相同由護欄 `tests/integration/python-to-cpp-verdict.test.ts` 驗；這裡驗**使用者看得到的那一條路**：
 * 型別來自 Cella 在一份輸入上觀察到的；第一行說型別是照這組輸入推的；換不了的程式不動、目標回到 Python、說出原因。
 */
import { test, expect, type Page } from '@playwright/test'
import { freshApp, useAsSource, pickTarget, selectTarget, codeLines } from './helpers'

const setPython = async (page: Page, code: string): Promise<void> => {
  await pickTarget(page, 'python')
  await page.evaluate((c) => (window as any).__app.codeView.setCode(c), code)
  await useAsSource(page, '程式碼')
  await expect(page.locator('.blocklyDraggable').first()).toBeVisible({ timeout: 15_000 })
}
const toCpp = async (page: Page, target: string): Promise<void> => { await selectTarget(page, 'cpp'); await page.waitForFunction((want) => (window as any).__app?.currentTarget?.id === want, target, { timeout: 30_000 }) }

test('不讀輸入的程式：換到 C++、第一行說型別是照這次執行看到的、提示換了幾句', async ({ page }) => {
  await freshApp(page)
  await setPython(page, 'n = 3\nprint(n + 1)\n')
  await pickTarget(page, 'cpp')
  await expect.poll(async () => (await codeLines(page)).join('\n'), { timeout: 30_000 }).toContain('cout << n + 1')
  const code = await codeLines(page)
  expect(code[0]).toBe('// 變數的型別是照這次執行看到的；換一組輸入，型別可能不同')
  expect(code.join('\n')).toContain('long long n;')
  await expect(page.locator('.toast').filter({ hasText: /換成 .* 的寫法/ })).toBeVisible({ timeout: 10_000 })
})

test('讀輸入而沒有輸入：程式不動、目標回到 Python、說需要一份輸入', async ({ page }) => {
  await freshApp(page)
  await setPython(page, 'n = int(input())\nprint(n + 1)\n')
  await toCpp(page, 'python')
  await expect.poll(async () => (await codeLines(page)).join('\n'), { timeout: 20_000 }).toContain('n = int(input())')
  await expect(page.locator('.toast').filter({ hasText: /一份輸入/ })).toBeVisible({ timeout: 10_000 })
})

test('型別說不準（這份輸入下沒跑到的一段）：程式不動、說出原因', async ({ page }) => {
  await freshApp(page)
  await setPython(page, 'n = 3\nif n > 5:\n    print("big")\n')
  await toCpp(page, 'python')
  await expect.poll(async () => (await codeLines(page)).join('\n'), { timeout: 20_000 }).toContain('if n > 5:')
  await expect(page.locator('.toast').filter({ hasText: /沒有跑到/ })).toBeVisible({ timeout: 10_000 })
})
