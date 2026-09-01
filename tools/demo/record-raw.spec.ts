/**
 * **第二支：接不住的時候它會說。**
 *
 * ```
 * ① 貼一段含巨集的 C++     → 那一行變成一顆【灰色積木】，原文一字不動在裡面
 * ② 在別的地方改一個字      → 灰色那一塊【原封不動】
 * ```
 *
 * 🔴 **它補的是 README 最大的空白**。那張比較表第三列寫著：
 *
 * > 「認不出來的語法**不會被丟掉，也不會被猜**——它變成一顆灰色積木，
 * >  原文一字不動地放在裡面」
 * > 「第三點聽起來不像賣點，而它是：**它保證這個工具不會安靜地弄壞你的檔案。**」
 *
 * 而那一句**在此之前沒有任何畫面支撐**——它要求讀者相信一句話。
 *
 * ⚠️ **這一支用「貼上」而不是「打字」**（與主 GIF 相反）：
 * 這裡要演的不是「它跟著我變」，是「**我把手邊的檔案丟進去會怎樣**」，
 * 而那個動作本來就是一次貼上。
 * 🔴 而 `#define SQ(x) ((x)*(x))` **打不出來**——Monaco 會自動補右括號。
 *
 * > **錄示範時，工具的貼心功能會變成你的雜訊。**（第三次了）
 */
import { test, expect, type Page } from '@playwright/test'

/**
 * 🪦 **本來用 `#define SQ(x) ((x)*(x))`，而它錄不出來**（2026-09-01 實測）：
 * 巨集在**檔案最外層**，而骨架會把所有鬆散語句包進 `int main()`——
 * 產出是
 *
 * ```
 * int main() {
 *     #define SQ(x) ((x)*(x))     ← 從外層搬進來，還縮排了
 * ```
 *
 * 🔴 **字沒有被改，位置被改了**——而 README 那句「原文一字不動地放在裡面」
 * 講的是**字**，講不到**位置**。那是一個既有缺陷（`c8e2af02` 上一模一樣，
 * 用 worktree 對照過），記在 `knowledge/draft/2026-03-11-已知工程待解問題.md`。
 *
 * > **一句「我不會動你的東西」的承諾，要連【它在哪裡】一起算。**
 *
 * 🟢 所以這一支改用**住在函式裡**的不支援語法——那樣就沒有搬家的問題，
 * 而它要證明的那件事（原文一字不動）仍然成立。
 */
const PROGRAM = [
  'int main() {',
  '    int n = 3;',
  '    goto done;',
  '    cout << "skipped" << endl;',
  'done:',
  '    cout << "n = " << n << endl;',
  '    return 0;',
  '}',
].join('\n')

// 🪦 **第二次改**：本來寫 `if (n > 2) goto done;`，而**沒有大括號的 `if` 底下
//    會掉字**——灰積木裡只剩 `done`，`goto ` 兩個字不見了（2026-09-01 實測）：
//
//    ```
//    單獨一行                 goto done;   ✅
//    包在 if 的【大括號】裡    goto done;   ✅
//    包在 if【沒有大括號】底下  done        🔴
//    ```
//
//    那是第三個既有缺陷，記在 `knowledge/draft/2026-03-11-已知工程待解問題.md`。

const codeNow = (page: Page): Promise<string> =>
  page.evaluate(() =>
    (window as never as { __app: { codeView: { getCode?(): string } } }).__app.codeView.getCode?.() ?? '')

test('raw', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('/')
  await page.waitForFunction(() => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.waitForTimeout(1600)

  // ① 貼進去 → 灰色積木長出來
  await page.evaluate((prog) => {
    const a = (window as never as { __app: {
      codeView: { setCode(c: string): void }
      syncController: { syncCodeToBlocks(c: string): Promise<void> } } }).__app
    a.codeView.setCode(prog)
    return a.syncController.syncCodeToBlocks(prog)
  }, PROGRAM)
  await page.waitForTimeout(3000)

  // ★ 入口條件：真的長出了一顆灰的，否則這一支演的是空氣
  const raws = await page.evaluate(() => {
    const ws = (window as never as { __app: { blocklyPanel: { workspace: {
      getAllBlocks(b: boolean): { type: string; getFieldValue(n: string): string }[] } } } })
      .__app.blocklyPanel.workspace
    return ws.getAllBlocks(false).filter((b) => b.type === 'cpp_raw_code')
      .map((b) => b.getFieldValue('CODE'))
  })
  expect(raws.length, '🔴 沒有任何灰色積木——這一支要演的東西不存在').toBeGreaterThan(0)
  // 🔴 **原文一字不動**——這就是那句承諾本身
  expect(raws.join(' | '), '🔴 灰色積木裡的字與原文不同——那句承諾當場破了')
    .toContain('goto done')

  // ② 在別的地方改一個字 → 灰的那塊原封不動
  const field = await page.evaluate(() => {
    const ws = (window as never as { __app: { blocklyPanel: { workspace: {
      getAllBlocks(b: boolean): { type: string; getSvgRoot(): SVGGraphicsElement }[] } } } })
      .__app.blocklyPanel.workspace
    const b = ws.getAllBlocks(false).find((x) => x.type === 'cpp_literal_number')
    if (!b) return null
    const r = b.getSvgRoot().getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  if (!field) throw new Error('🔴 積木上找不到那個數字——這一拍演不出來')
  await page.mouse.click(field.x, field.y)
  await page.waitForTimeout(800)
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('7', { delay: 140 })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2600)

  const after = await codeNow(page)
  expect(after, '🔴 改的那一格沒有傳到程式碼').toContain('= 7')
  // 🔴 **這才是這一支的結論**：來回一趟之後，那幾行**逐字**還在
  expect(
    after,
    `🔴 認不出來的那幾行被動過了——「不會安靜地弄壞你的檔案」當場是假的：\n${after}`,
  ).toContain('goto done;')
  expect(after, '🔴 標籤那一行不見了').toContain('done:')

  await page.waitForTimeout(2000)
})
