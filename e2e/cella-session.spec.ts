/**
 * **執行與除錯由 Cella 跑**（spec 183，重構階段 5b）——走真的 worker、真的 `cella-lang/dap`。
 *
 * ```
 * ① 第一次執行：除錯模組還在背景編 → 由 JS 直譯器跑，狀態列說得出為什麼（R4）
 * ② 編好之後：由 Cella 跑——輸出、中斷點停在【即將執行】的那一顆、變數、讀輸入、越界停下說明
 * ③ Cella 還不支援的程式 → 退回 JS 直譯器，標出處與原因（US3）
 * ```
 * ⚠️ 自動化瀏覽器不自動暖機（`src/main.ts`）——這裡自己呼叫 `warmUpChecker()`。
 */
import { test, expect, type Page } from '@playwright/test'
import { freshApp, useAsSource, treeHas, selectMode, setBreakpoint, lineNumberOf } from './helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
const runner = (page: Page) => page.locator('#status-runner')
const output = (page: Page) => page.locator('.console-output')

async function feed(page: Page, code: string, marker: string): Promise<void> {
  await page.evaluate((c) => (window as any).__app.codeView.setCode(c), code)
  await useAsSource(page, '程式碼')
  await treeHas(page, marker)
}

/** 跑到 Cella 接手為止（第一次除錯模組在背景編，約 20 秒；之間的執行由 JS 跑）。 */
async function runUntilCella(page: Page): Promise<void> {
  const t = Date.now()
  for (;;) {
    await expect(page.locator('#run-btn')).toBeVisible({ timeout: 30_000 })
    await page.locator('#run-btn').click()
    await expect(runner(page)).not.toHaveText('', { timeout: 30_000 })
    if ((await runner(page).getAttribute('data-provider')) === 'cella') return
    expect(await runner(page).getAttribute('title'), '退回 JS 時要說得出原因').toMatch(/Cella 沒有接/)
    if (Date.now() - t > 180_000) throw new Error('Cella 一直沒有接手')
    await page.waitForTimeout(3000)
  }
}

const LOOP = '#include <iostream>\nusing namespace std;\nint main() {\n    int total = 0;\n    for (int i = 1; i <= 3; i++) {\n        total = total + i;\n    }\n    cout << total << endl;\n    return 0;\n}\n'
const READ = '#include <iostream>\nusing namespace std;\nint main() {\n    int n;\n    cin >> n;\n    cout << n * 2 << endl;\n    return 0;\n}\n'
const OOB = '#include <iostream>\nusing namespace std;\nint main() {\n    int a[3] = {1, 2, 3};\n    int i = 5;\n    cout << a[i] << endl;\n    return 0;\n}\n'
// ⚠️ 「Cella 還不支援」的範例會一直過期——map（spec 194）、結構化繫結（第 202b 刀）都曾是這裡的例子。
//    改用依定義就不會被支援的：VLA（`int a[n]`）是 GNU 擴充、不是標準 C++，Cella 照實標 unknown（cella 2026-11-01 確認）；JS 直譯器跑得動。
//    （experience〈拿「今天還沒做的」當「不支援」的測試範例，範例的壽命以天計〉）🪦 6c 拆掉 JS 直譯器時這一支整支退場
const VLA = '#include <iostream>\nusing namespace std;\nint main() {\n    int n = 3;\n    int a[n];\n    a[0] = 1;\n    cout << a[0] + 2 << endl;\n    return 0;\n}\n'

test('執行與除錯由 Cella 跑：輸出、中斷點、變數、讀輸入、越界停下', async ({ page }) => {
  test.setTimeout(400_000)
  await freshApp(page)
  await page.evaluate(() => (window as any).__app.warmUpChecker())
  await expect(page.locator('#status-check')).toHaveAttribute('data-state', 'ready', { timeout: 180_000 })

  await feed(page, LOOP, 'cpp:print')
  await selectMode(page, 'run')   // 這一下就跑了一次（多半由 JS：除錯模組從這時才開始編）
  await runUntilCella(page)
  await expect(output(page)).toContainText('6')

  // 讀輸入：停下來等，打一行之後繼續
  await feed(page, READ, 'cpp:input')
  await selectMode(page, 'run')
  const input = page.locator('.console-inline-input')
  await expect(input).toBeVisible({ timeout: 30_000 })
  await input.fill('21')
  await input.press('Enter')
  await expect(output(page)).toContainText('42', { timeout: 30_000 })
  await expect(runner(page)).toHaveAttribute('data-provider', 'cella')

  // 越界：停在那一塊，說明附條文，不印假數字
  await feed(page, OOB, 'cpp:array_at')
  await page.locator('#run-btn').click()
  await expect(output(page)).toContainText(/陣列.*外面/, { timeout: 30_000 })
  await expect(output(page)).toContainText('C++17')
  await expect(runner(page)).toHaveAttribute('data-provider', 'cella')

  // ⚠️ 中斷點放最後：它掛在【行】上，換程式之後還在（設在第 6 行就會停在下一支程式的第 6 行）
  await feed(page, LOOP, 'cpp:print')
  // 中斷點：停在【即將執行】的那一顆——迴圈體第一次時 total 還是 0
  await setBreakpoint(page, await lineNumberOf(page, 'total = total + i'))
  await selectMode(page, 'debug')   // ⚠️ 選模式就會開跑（與 debug.spec 同）
  await expect(page.locator('.console-status')).toHaveText(/已暫停|Paused/, { timeout: 30_000 })
  await expect(runner(page)).toHaveAttribute('data-provider', 'cella')
  await expect(page.locator('tr', { has: page.locator('.var-name', { hasText: /^total$/ }) }).locator('.var-value')).toHaveText('0')
  await page.locator('.debug-stop').click()
  await expect(page.locator('#run-btn')).toBeVisible()
})

test('Cella 還不支援的程式：退回 JS 直譯器，標出處與原因', async ({ page }) => {
  await freshApp(page)
  await page.evaluate(() => (window as any).__app.warmUpChecker())
  await expect(page.locator('#status-check')).toHaveAttribute('data-state', 'ready', { timeout: 180_000 })
  await feed(page, VLA, 'cpp:array_declare')
  await selectMode(page, 'run')
  await expect(output(page)).toContainText('3', { timeout: 30_000 })
  await expect(runner(page)).toHaveAttribute('data-provider', 'js-interpreter')
  expect(await runner(page).getAttribute('title')).toMatch(/Cella 沒有接：.*(還不支援|還在準備)/)
})

/**
 * 長輸出（spec 205 T008 的驗收）：Cella 0.1.202611021533 把輸出那一路的遞迴改成迴圈——瀏覽器的 worker 裡 2 萬字也要整段印完。
 * （之前 0.1.202611020258 在本機 Node 印到 6666 字就爆 wasm 的堆疊；瀏覽器的堆疊大小跟 Node 不同，所以要在瀏覽器裡量。）
 */
const LONG = '#include <iostream>\nusing namespace std;\nint main() {\n    for (int i = 0; i < 20000; i++) {\n        cout << "x";\n    }\n    return 0;\n}\n'

test('長輸出：Cella 在瀏覽器裡印 2 萬字，整段印完', async ({ page }) => {
  test.setTimeout(400_000)
  await freshApp(page)
  await page.evaluate(() => (window as any).__app.warmUpChecker())
  await expect(page.locator('#status-check')).toHaveAttribute('data-state', 'ready', { timeout: 180_000 })
  await feed(page, LONG, 'cpp:print')
  await selectMode(page, 'run')
  await runUntilCella(page)
  await expect.poll(async () => ((await output(page).textContent()) ?? '').split('x').length - 1, { timeout: 60_000 }).toBe(20000)
})
