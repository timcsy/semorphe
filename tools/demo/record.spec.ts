/**
 * **README 第一屏那段五秒動畫。**
 *
 * 腳本（每一拍都要看得懂，所以中間有刻意的停頓）：
 *
 * ```
 * ① 貼一段真的 C++          → 積木長出來
 * ② 在【積木】上改一個字     → 程式碼跟著變
 * ③ 切到流程                → 同一支程式，第三種畫法
 * ```
 *
 * ⚠️ **打字用真的 `type()`，不用 `setCode()`**：後者一瞬間就完成，
 * 而觀眾要看到的正是「它在跟著我變」。
 */
import { test } from '@playwright/test'

/**
 * 🔴 **不打結尾的 `}`**——Monaco 會自動補上右括號。
 *
 * 第一版把整段（含 `}`）打進去，結果是**多出來的括號**：畫面上出現
 * 「1 個語法錯誤」與一顆 `直接寫程式碼：}}`——**一段讓產品看起來壞掉的示範**。
 *
 * > **錄示範時，工具的貼心功能會變成你的雜訊。**
 *
 * ⚠️ 而括號**在同一行**時沒事（Monaco 會「打過去」而不是再插一個）；
 * 出事的是**跨行**的那些——所以這裡只打到最後一行有內容的地方為止。
 */
const PROGRAM = [
  'int main() {',
  // 🔴 **不要自己打縮排**——編輯器在 `{` 之後會自動縮排，
  //    而打進去的四個空白會疊在上面，變成八個。
  //    症狀是「每一行前面多了一層」，而它**不會報錯**。
  //
  // > **錄示範時，工具的貼心功能會變成你的雜訊。**（第二次了）
  'int n = 3;',
  'cout << "Hello!" << endl;',
  'return 0;',
].join('\n')

test('demo', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.waitForTimeout(1500)

  // ① 打字
  await page.evaluate(() =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView.setCode(''))
  await page.waitForTimeout(600)
  const editor = page.locator('.monaco-editor').first()
  await editor.click()
  await page.keyboard.type(PROGRAM, { delay: 20 })
  await page.waitForTimeout(2400)   // 讓積木長出來、讓觀眾看到

  // 🔴 **錄製器要驗自己的產出**——一段「看起來壞掉」的示範比沒有示範更糟。
  //    ⚠️ 而它是靜靜壞的：影片照樣錄得出來，只是畫面上有一行紅字。
  const bad = await page.evaluate(() => {
    const code = (window as never as { __app: { codeView: { getCode?(): string } } })
      .__app.codeView.getCode?.() ?? ''
    return {
      code,
      extraBrace: /\}\s*\}/.test(code.trim().replace(/\n/g, ' ')),
      raw: document.body.innerText.includes('直接寫程式碼'),
      err: /語法錯誤|syntax error/i.test(document.body.innerText),
      // 🔴 **縮排疊了兩層**——這支示範最深只有一層（`main` 的本體），
      //    所以任何一行前面有 8 個以上的空白就是疊到了。
      overIndent: code.split('\n').filter((l) => /^ {8,}\S/.test(l)),
    }
  })
  if (bad.extraBrace || bad.raw || bad.err || bad.overIndent.length > 0) {
    throw new Error(
      `🔴 這一段錄出來是【壞的】，不要拿去當示範：\n` +
      `   多餘的括號 ${bad.extraBrace} · 灰色積木 ${bad.raw} · 語法錯誤 ${bad.err}\n` +
      `   縮排疊了兩層 ${bad.overIndent.length} 行：${JSON.stringify(bad.overIndent)}\n` +
      `   實際產出：\n${bad.code}`)
  }

  // ② 在積木上改一個字 → 程式碼跟著變
  const field = await page.evaluate(() => {
    const ws = (window as never as { __app: { blocklyPanel: { workspace: {
      getAllBlocks(b: boolean): { type: string; getSvgRoot(): SVGGraphicsElement }[] } } } })
      .__app.blocklyPanel.workspace
    const b = ws.getAllBlocks(false).find((x) => x.type === 'cpp_literal_string')
    if (!b) return null
    const r = b.getSvgRoot().getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  if (field) {
    await page.mouse.click(field.x, field.y)
    await page.waitForTimeout(700)
    // 🔴 **`ControlOrMeta`**——macOS 上 `Control+A` 在輸入框裡是「移到行首」，
    //    不是全選。第一版因此錄出「嗨，世界Hello!」：新字**接在舊字前面**。
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('嗨，世界', { delay: 100 })
    await page.keyboard.press('Enter')
    await page.waitForTimeout(2000)

    // 🔴 同樣要驗：改完之後程式碼裡**只有**新字串
    const after = await page.evaluate(() =>
      (window as never as { __app: { codeView: { getCode?(): string } } }).__app.codeView.getCode?.() ?? '')
    if (!after.includes('"嗨，世界"')) {
      throw new Error(`🔴 欄位沒有被【取代】，錄出來的是一段看起來壞掉的示範：\n${after}`)
    }
  }

  // ③ 切到流程
  await page.locator('[data-tab="flow"], button', { hasText: /^流程$/ }).first().click()
  await page.waitForTimeout(2600)
})
