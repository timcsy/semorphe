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
  // ⚠️ 不用 `codeView.setCode`：程式化寫入不發變更事件（不會同步），那不是學生做的事——用貼上，與真的編輯同一條路
  const setCode = async (c: string): Promise<void> => {
    await page.locator('.monaco-editor').first().click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.evaluate((code) => {
      const ta = document.querySelector('.monaco-editor textarea') as HTMLTextAreaElement
      ta.focus()
      const dt = new DataTransfer()
      dt.setData('text/plain', code)
      ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    }, c)
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
