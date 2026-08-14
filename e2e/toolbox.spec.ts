/**
 * **工具箱的每一個分類都要渲染得完整。**
 *
 * ## 這一支怎麼來的（2026-08-14）
 *
 * 三顆宣告積木從宣告式改成命令式註冊之後，`cpp_vector_declare` 的
 * `setColour(CATEGORY_COLORS.containers)` 拿到 `undefined`
 * （正確的鍵是 `cpp_containers`），Blockly 在那一顆拋錯，
 * **整個 flyout 渲染到那裡就中斷**——使用者打開「陣列與列表」只看到一顆積木。
 *
 * 而**全套 4100 個測試與 6 支 e2e 全是綠的**：
 * 沒有任何一支打開過工具箱分類。
 *
 * > **一顆積木的 `init` 拋錯，症狀不在那顆積木上，
 * > 而是它後面的所有積木都不見了——而「不見了」沒有錯誤訊息。**
 *
 * ## 🔴 而它的能力邊界是實測出來的，不是推測的
 *
 * 寫完之後把那個 bug **放回去跑了一次**（`build-guardrail` 第 9 步）：
 * **它仍然是綠的。**
 *
 * 原因是 e2e 起的是**初學 C++**，而 `cpp_vector_declare` 不在那個關卡的
 * 工具箱裡——出事那顆積木根本沒被渲染。
 *
 * ```
 * 這支擋得住   初學者工具箱裡的積木 init 拋錯
 * 這支擋不住   只出現在更後面關卡（或別的 Topic）的積木
 * ```
 *
 * ⚠️ **所以它今天是一道窄的防線，而窄在哪裡寫在這裡。**
 * 要擴大得讓 e2e 走過多個 Topic——而那是另一件事，不要讓這支假裝它做了。
 *
 * > **一個第一次跑就綠的檢查，與一個什麼都沒量到的檢查產出相同
 * > ——除非有人去問「它抓得到它該抓的那個嗎」。**
 *
 * ## 🔴 而它今天是**假陽性**——2026-08-14 在瀏覽器裡量到的
 *
 * 使用者的環境裡，**每一個分類的 flyout 都只渲染出 1 顆積木**
 * （「陣列與列表」該有 33 顆），而這支測試**是綠的**。兩個原因：
 *
 * 1. 它起的是全新狀態（`localStorage.clear()`），只有 **5 個分類**
 *    ——使用者開了關卡之後的 **12 分類世界它從來沒進去過**
 * 2. `blocks.first()` 的可見性檢查可能抓到**上一個 flyout 的殘留**
 *    （Blockly 重用 DOM）
 *
 * > **一支測試綠，不是它有效的證據——它可能量的是另一個世界。**
 *
 * → 調查與線索見 `knowledge/draft/2026-08-14-工具箱flyout只渲染一顆.md`。
 * **在那個 draft 關掉之前，不要把這支的綠當成工具箱是好的。**
 */
import { test, expect, type Page } from '@playwright/test'

async function freshApp(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')
  await expect(page.locator('.blocklyWorkspace, .injectionDiv').first()).toBeVisible({ timeout: 30_000 })
}

test('每個工具箱分類都渲染得出積木——一顆 init 拋錯會讓它後面的全部消失', async ({ page }) => {
  await freshApp(page)

  // ⚠️ **選擇器要驗過**：第一版寫 `.blocklyTreeRow`，而入口條件當場擋下
  // ——那個 class 在這個版本的 Blockly 不存在。**沒有入口條件這支會空過**
  // （0 個分類 → 迴圈不跑 → `thin` 是空的 → 綠）。
  // ⚠️ **等工具箱自己出現**，不要只等 workspace——工具箱是稍後建的。
  // 第一版沒等，`count()` 拿到 0，而**入口條件當場擋下**
  // （0 個分類 → 迴圈不跑 → `thin` 是空的 → 這支會綠得像通過了）。
  const categories = page.locator('.blocklyToolboxCategory')
  await expect(categories.first()).toBeVisible({ timeout: 30_000 })
  const count = await categories.count()
  // ★ 入口條件：錨在**分類數**（合成量），不錨在「有沒有壞掉」。
  //
  // ⚠️ 門檻是 3 而不是 5——e2e 起的是**初學 C++**，關卡少，分類就少（實測 5 個）。
  // 第一版寫 `> 5` 而訊息寫「一個分類都沒有」，於是它紅的時候**訊息在說謊**
  // （實際是 5 個）。**一個把原因寫死的斷言訊息，會把讀的人送去查錯的東西。**
  expect(count, `工具箱只有 ${count} 個分類 → 它沒載入完，這支測試不算數`).toBeGreaterThan(2)

  const thin: string[] = []
  for (let i = 0; i < count; i++) {
    const row = categories.nth(i)
    const name = (await row.innerText()).trim()
    await row.click()
    // flyout 裡的積木
    const blocks = page.locator('.blocklyFlyout .blocklyDraggable, .blocklyToolboxFlyout .blocklyDraggable')
    await expect(blocks.first()).toBeVisible({ timeout: 10_000 })
    const n = await blocks.count()
    // ⚠️ 判準是「**至少兩顆**」而不是「至少一顆」：中斷的症狀正是
    // 「渲染到出事那一顆就停」，而那通常留下 1 顆。
    // 真的只有一顆積木的分類今天不存在——若將來出現，這個門檻要連同理由一起改。
    if (n < 2) thin.push(`${name}：只有 ${n} 顆`)
  }

  expect(
    thin,
    '這些分類的積木少得可疑——最可能的成因是某顆積木的 init 拋錯，' +
      '而 Blockly 會安靜地停在那裡：\n  ' + thin.join('\n  '),
  ).toEqual([])
})
