/**
 * **改完程式碼馬上按執行，跑的是改過的那一份**（2026-11-07：e2e 把固定等待換成等條件之後量到的競態）。
 *
 * 程式碼的變更要經過去抖（800ms）與同步才進到樹裡；在那之前按下執行，原本拿到的是**舊的那一棵**
 * ——學生跑到的不是他看到的程式。執行器開跑前會先把還沒落地的編輯做完（`flushPendingEdits`）。
 * 對照（2026-11-07）：沒有這個修正的建置，貼上後立刻執行跑出空白（預設的空程式）；有修正的印出貼上的那一份。
 */
import { test, expect } from '@playwright/test'
import { freshApp, skipPredictionIfAsked } from './helpers'

test('★ 改完程式碼不等、立刻執行：輸出是改過的那一份', async ({ page }) => {
  test.setTimeout(90_000)
  await freshApp(page)
  // ⚠️ 不用 `codeView.setCode`：程式化寫入不發變更事件（不會同步），那不是學生做的事。
  //    也不用「全選＋貼上」：整輪跑時焦點不一定在編輯器上，全選落空就變成接在後面（`main` 重複定義——2026-11-07 量到）。
  //    改成對編輯器下一次「整份替換」的編輯：與打字同一條路（發變更事件、走去抖），而且不依賴焦點。
  const setCode = async (c: string): Promise<void> => {
    await page.evaluate((code) => {
      const ed = (window as never as { __app: { codeView: { editor: { getModel(): { getFullModelRange(): unknown }; executeEdits(src: string, edits: unknown[]): void } } } }).__app.codeView.editor
      ed.executeEdits('e2e', [{ range: ed.getModel().getFullModelRange(), text: code }])
    }, c)
    await expect.poll(() => page.evaluate(() => (window as never as { __app: { codeView: { getCode(): string } } }).__app.codeView.getCode())).toBe(c)
  }
  const prog = (word: string) => `#include <iostream>\nusing namespace std;\nint main() {\n    cout << "${word}" << endl;\n    return 0;\n}\n`
  // 正向錨點：第一份照常跑得出來
  await setCode(prog('first'))
  await page.locator('#run-btn').click()
  await skipPredictionIfAsked(page)
  await expect(page.locator('.console-output')).toContainText('first', { timeout: 30_000 })
  // 🔴 改了之後【不等】就按——去抖還沒到
  await setCode(prog('second'))
  await page.locator('#run-btn').click()
  await skipPredictionIfAsked(page)
  await expect(page.locator('.console-output')).toContainText('second', { timeout: 30_000 })
})
