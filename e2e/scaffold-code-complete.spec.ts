/**
 * **鷹架怎麼顯示，都不得改到程式碼。**
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-28：「我想說**程式碼的部分還是要顯示完整**，
 * 但是其他視圖可以有相對應的顯示」。
 *
 * 量完之後那個分工**本來就成立**，而它成立的理由值得記下來：
 *
 * ```
 * 🔴 語義樹   print                                     ← 鷹架【不在裡面】
 * 程式碼      #include · using · main · print · return  ← 產生器在最外層補完整
 * 積木        由 scaffoldDepth 決定畫幾顆
 * ```
 *
 * 也就是說**鷹架不是語義的一部分，是投影的一部分**——
 * 而「程式碼要完整」是因為**它是要能編譯的東西**：
 * 一支少了 `int main()` 的程式不是「簡化的程式」，是**不能跑的程式**。
 *
 * > **可以少畫的是投影，不能少的是那份要拿去跑的東西。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果三種模式量到的程式碼都是空字串，代表頁面沒開起來——
 * > 這份報表不算數，不是「三種都一致」。**
 *
 * 錨在**程式碼的長度**（合成量），不是「差異數」。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測積木畫幾顆**——那是 `lesson-pins.spec.ts` 那一族。
 * - **不檢測流程視圖**——⚠️ 它今天**沒有問過鷹架該怎麼顯示**，
 *   而那是一個還沒設計的格子（使用者：「可能要做更多的設計」）。
 */
import { test, expect } from '@playwright/test'
import { freshApp, useAsSource } from './helpers'

const PROGRAM =
  '#include <iostream>\nusing namespace std;\nint main() {\n    cout << "hi" << endl;\n    return 0;\n}\n'

test('★ 三種鷹架模式，程式碼逐字相同', async ({ page }) => {
  await freshApp(page)
  await page.waitForTimeout(1800)
  await page.evaluate((c) =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView.setCode(c),
    PROGRAM)
  await useAsSource(page, '程式碼')
  await page.waitForTimeout(2000)

  const codeOf = async (): Promise<string> => page.evaluate(() =>
    (window as never as { __app: { codeView: { getCode?(): string } } }).__app.codeView.getCode?.() ?? '')

  const seen: Record<string, string> = {}
  for (const mode of ['editable', 'ghost', 'hidden'] as const) {
    await page.locator('.status-item-btn[data-control-id="scaffold"]').click()
    await page.locator(`.quick-pick-item[data-value="mode:${mode}"]`).click()
    await page.waitForTimeout(2000)
    seen[mode] = await codeOf()
  }

  // ★ 入口條件——錨在**程式碼長度**（合成量）。空的代表頁面沒開起來。
  expect(
    seen.editable.length,
    '🔴 程式碼是空的 → 頁面沒開起來，下面在比兩個空字串',
  ).toBeGreaterThan(20)

  for (const mode of ['ghost', 'hidden'] as const) {
    expect(
      seen[mode],
      `🔴 鷹架設成「${mode}」之後程式碼變了——` +
        `一支少了 \`int main()\` 的程式不是「簡化的程式」，是**不能跑的程式**。\n` +
        `  可以少畫的是投影，不能少的是那份要拿去跑的東西。`,
    ).toBe(seen.editable)
  }

  // ★ 而它必須真的還是那支完整的程式（不是三個都一樣地壞掉）
  for (const must of ['#include', 'int main(', 'return 0']) {
    expect(seen.hidden, `🔴 程式碼裡少了 \`${must}\``).toContain(must)
  }
})

test('★ 改顯示模式，不得改到語義樹', async ({ page }) => {
  // 🔴 **這一條抓到過一個真的**（2026-08-28）。
  //
  // 第一版的 `setScaffoldMode` 呼叫 `syncBlocksToCodeWithMappings()`
  // ——而那支從**積木**產生程式碼，積木畫的是**剝過鷹架的顯示樹**。
  // 於是切一次顯示模式，`currentTree` 就從
  //
  // ```
  // include · using_namespace · func_def     →     print
  // ```
  //
  // **一個「顯示設定」把唯一真實給改掉了**，而方向還是反的
  // （切成「完整」反而變少）。
  //
  // > **改投影的動作不得寫回真相。**
  //
  // ⚠️ 而它的症狀是**無聲的**：程式碼那一側看起來還好，
  // 因為產生器會把鷹架補回去——下一次同步才會發現東西不見了。
  await freshApp(page)
  await page.waitForTimeout(1800)
  await page.evaluate((c) =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView.setCode(c),
    PROGRAM)
  await useAsSource(page, '程式碼')
  await page.waitForTimeout(2000)

  const bodyOf = async (): Promise<string[]> => page.evaluate(() => {
    const t = (window as never as {
      __app: { syncController: { getCurrentTree(): { children?: { body?: { componentId?: string }[] } } | null } }
    }).__app.syncController.getCurrentTree()
    return (t?.children?.body ?? []).map((n) => n.componentId ?? '')
  })

  const before = await bodyOf()
  // ★ 入口條件——錨在**樹的節點數**（合成量）。空的代表同步沒完成。
  expect(before.length, '🔴 語義樹是空的 → 同步沒完成，下面在比兩個空陣列').toBeGreaterThanOrEqual(2)
  // ⚠️ 而它必須真的含著鷹架——否則這一條驗的是一棵本來就沒有鷹架的樹
  expect(
    before.filter((c) => /include|using_namespace/.test(c)).length,
    '🔴 這棵樹裡本來就沒有鷹架 → 下面「不得改到」驗不出東西',
  ).toBeGreaterThan(0)

  for (const mode of ['editable', 'hidden', 'ghost'] as const) {
    await page.locator('.status-item-btn[data-control-id="scaffold"]').click()
    await page.locator(`.quick-pick-item[data-value="mode:${mode}"]`).click()
    await page.waitForTimeout(2000)
    expect(
      await bodyOf(),
      `🔴 切成「${mode}」之後語義樹變了——**改投影的動作寫回了真相**`,
    ).toEqual(before)
  }
})
