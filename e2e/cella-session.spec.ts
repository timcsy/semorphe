/**
 * **執行與除錯由 Cella 跑**（spec 183，重構階段 5b）——走真的 worker、真的 `cella-lang/dap`。
 *
 * ```
 * ① 第一次執行：還在準備 → 說「準備中」、好了自動開跑（spec 205 T003；之前是由 JS 直譯器先跑）
 * ② 由 Cella 跑——輸出、中斷點停在【即將執行】的那一顆、變數、讀輸入、越界停下說明
 * ③ Cella 還不支援的程式 → 照實說、指回那一行，沒有退路（spec 205 T008；之前是退回 JS 直譯器）
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

/**
 * 按一次執行，等 Cella 跑（spec 205 T008 之後只有 Cella：還在準備時說「準備中」、好了自動開跑——不必再反覆按）。
 * ⚠️ 選模式那一下可能已經開跑了（見 `selectMode`）——那時執行鈕是藏著的，就不再按。
 */
async function runUntilCella(page: Page): Promise<void> {
  if (await page.locator('#run-btn').isVisible()) await page.locator('#run-btn').click()
  await expect(runner(page)).toHaveAttribute('data-provider', 'cella', { timeout: 180_000 })
}

const LOOP = '#include <iostream>\nusing namespace std;\nint main() {\n    int total = 0;\n    for (int i = 1; i <= 3; i++) {\n        total = total + i;\n    }\n    cout << total << endl;\n    return 0;\n}\n'
const READ = '#include <iostream>\nusing namespace std;\nint main() {\n    int n;\n    cin >> n;\n    cout << n * 2 << endl;\n    return 0;\n}\n'
const OOB = '#include <iostream>\nusing namespace std;\nint main() {\n    int a[3] = {1, 2, 3};\n    int i = 5;\n    cout << a[i] << endl;\n    return 0;\n}\n'
// ⚠️ 「Cella 還不支援」的範例會一直過期——map（spec 194）、結構化繫結（第 202b 刀）、VLA（Cella 0.1.202611030133 起跑得動）都曾是這裡的例子。
//    改用**依定義就不會被支援的**：內嵌組語（`asm`）——它是平台的機器碼，P6 照原樣保留、降級成原文（experience〈拿「今天還沒做的」當「不支援」的測試範例，範例的壽命以天計〉）。
const ASM = '#include <iostream>\nusing namespace std;\nint main() {\n    int n = 3;\n    asm volatile("nop");\n    cout << n << endl;\n    return 0;\n}\n'

test('執行與除錯由 Cella 跑：輸出、中斷點、變數、讀輸入、越界停下', async ({ page }) => {
  test.setTimeout(400_000)
  await freshApp(page)
  await page.evaluate(() => (window as any).__app.warmUpChecker())
  await expect(page.locator('#status-check')).toHaveAttribute('data-state', 'ready', { timeout: 180_000 })

  await feed(page, LOOP, 'cpp:print')
  await selectMode(page, 'run')   // 這一下就跑了一次（還在準備時說「準備中」，好了自動開跑）
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

test('Cella 還不支援的程式：照實說還不支援、指回那一行——沒有退路（spec 205 T008）', async ({ page }) => {
  await freshApp(page)
  await page.evaluate(() => (window as any).__app.warmUpChecker())
  await expect(page.locator('#status-check')).toHaveAttribute('data-state', 'ready', { timeout: 180_000 })
  await feed(page, ASM, 'cpp:print')
  await selectMode(page, 'run')
  // JS 直譯器拿掉之後，內嵌組語不會再「照樣跑出 3」——Cella 照實說還不支援
  await expect(output(page)).toContainText('還不支援', { timeout: 60_000 })
  await expect(output(page)).not.toContainText('3\n')
  await expect(runner(page)).not.toHaveAttribute('data-provider', 'js-interpreter')
})

/**
 * 準備中（spec 205 T003）：沒暖機就按執行——不是「沒有可用的執行器」，是說一次「準備中」、好了自動開跑。
 */
test('沒暖機就按執行：說「準備中」，好了自動開跑（spec 205 T003）', async ({ page }) => {
  test.setTimeout(240_000)
  await freshApp(page)
  await feed(page, LOOP, 'cpp:print')
  await selectMode(page, 'run')
  // 「準備中」在狀態列，不在輸出裡（輸出是學生的程式印的東西）
  await expect(page.locator('.console-status')).toHaveText(/準備中/, { timeout: 30_000 })
  await expect(output(page)).toContainText('6', { timeout: 180_000 })
  await expect(output(page), '輸出裡只有程式印的東西').not.toContainText('準備中')
  await expect(runner(page)).toHaveAttribute('data-provider', 'cella')
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
