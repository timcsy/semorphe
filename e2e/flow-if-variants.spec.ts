/**
 * **「如果／否則如果」拖出來要是一條真的 else-if 鏈**——2026-08-27，
 * 使用者：「把 if 那三種變體補回去」。
 *
 * ## 為什麼只補回【兩顆】而不是三顆
 *
 * 工具箱替 `cpp_if` 列了三個入口。實測它們在積木上真的不同
 * （`extraState` 讓 `cpp_if` 長出 `ELSE`／`ELSEIF_CONDITION_0` 等插槽），
 * **而抽出來的語義樹三者完全相同**：`{condition:1, then_body:0, else_body:0}`。
 *
 * > **`extraState` 決定積木長出哪些插槽，而樹只記錄插槽裡【有什麼】。
 * > 空的插槽在樹裡不存在。**
 *
 * 流程視圖的接點是**宣告**出來的（永遠都在），所以「有沒有 else 插槽」
 * 在那裡不是一個選項——`hasElse` 那一顆與素的做同一件事，收成一顆。
 * 而 `elseifCount` 不同：它是一個**預先接好的骨架**，學生不可能猜到
 * 「把另一個 if 放進 else 裡、再標一個旗標」。
 *
 * ## ⚠️ 這支不檢測什麼
 *
 * - **不檢測積木那側的三個入口**——它們原封不動（`extraTypes` 沒有動過）
 * - **不檢測 else 裡面有東西之後的程式碼**——那是產生器的事
 */
import { test, expect } from '@playwright/test'
import { freshApp, typeAndFormat } from './helpers'

test('★ 真人滑鼠：拖「如果／否則如果」→ 樹裡是一條巢狀的 else-if 鏈', async ({ page }) => {
  await freshApp(page)
  await typeAndFormat(page, 'int main() { int a = 1; int b = 2; int c = 3; int d = 4; return 0; }')
  await page.locator('[data-tab="flow"], button', { hasText: /^流程$/ }).first().click()
  await expect(page.locator('.flow-toolbox')).toBeVisible({ timeout: 10_000 })

  await page.locator('.flow-cat').filter({ hasText: '控制' }).first().click()
  await expect(page.locator('.flow-palette')).toBeVisible({ timeout: 10_000 })

  // ★ 入口條件：那一格裡**兩顆 if**，而它們的名字看得出差別
  const chips = await page.locator('.flow-chip').allTextContents()
  const ifChips = chips.filter((t) => t.startsWith('如果'))
  expect(
    ifChips,
    `🔴 「如果」的入口數不對。實際：${chips.join('／')}\n` +
      `⚠️ 三顆代表 hasElse 沒被收掉（兩顆做同一件事）；一顆代表 elseifCount 被收掉了。`,
  ).toEqual(['如果', '如果／否則如果'])

  const countIfs = (): Promise<number> =>
    page.evaluate(() => {
      const walk = (n: { componentId: string; children: Record<string, unknown[]> }): number => {
        let c = n.componentId === 'cpp:if' ? 1 : 0
        for (const k of Object.keys(n.children ?? {})) {
          for (const kid of (n.children[k] ?? []) as never[]) c += walk(kid)
        }
        return c
      }
      return walk((window as never as { __app: { syncController: { currentTree: never } } })
        .__app.syncController.currentTree)
    })
  expect(await countIfs(), '一開始不該有 if').toBe(0)

  const chip = page.locator('.flow-chip').filter({ hasText: '如果／否則如果' }).first()
  const canvas = page.locator('.flow-canvas').first()
  const a = await chip.boundingBox()
  const c = await canvas.boundingBox()
  expect(a && c, '量不到位置 → 下面在對空氣').toBeTruthy()

  await page.mouse.move(a!.x + a!.width / 2, a!.y + a!.height / 2)
  await page.mouse.down()
  await page.mouse.move(c!.x + c!.width * 0.6, c!.y + c!.height * 0.6, { steps: 8 })
  await page.mouse.up()

  // 🔴 **兩顆** `cpp:if`：外面那顆，加上 else 裡面那顆
  await expect
    .poll(countIfs, { timeout: 8000, message: '🔴 拖出來的不是 else-if 鏈' })
    .toBe(2)

  const nested = await page.evaluate(() => {
    const walk = (n: { componentId: string; properties: Record<string, unknown>; children: Record<string, unknown[]> }): unknown => {
      if (n.componentId === 'cpp:if') {
        const inner = (n.children?.else_body ?? [])[0] as typeof n | undefined
        return { hasInner: Boolean(inner), isElseIf: inner?.properties?.isElseIf ?? null }
      }
      for (const k of Object.keys(n.children ?? {})) {
        for (const kid of (n.children[k] ?? []) as never[]) {
          const r = walk(kid)
          if (r) return r
        }
      }
      return null
    }
    return walk((window as never as { __app: { syncController: { currentTree: never } } })
      .__app.syncController.currentTree)
  })
  expect(nested, '🔴 else 那一格是空的 → 骨架沒生出來').toMatchObject({ hasInner: true })
  expect(
    (nested as { isElseIf: string }).isElseIf,
    '🔴 少了 `isElseIf`，它會被讀成一個【獨立的】 if，而程式碼會多一個 `if`',
  ).toBe('true')
})

test('★ 流程視圖做得出 else——`else_body` 要是一個接點', async ({ page }) => {
  // ## 它從哪來
  //
  // 在這一刀之前 `cpp:if` 的 `children` 只宣告了 `condition` 與 `then_body`
  // ——而 lifter 產得出 `else_body`。**宣告漏了一格**，
  // 於是流程視圖上那顆「如果」沒有 else 接點：**做不出 else**。
  //
  // > **一個沒有被宣告的位置，在靠宣告長出接點的視圖裡等於不存在。**
  await freshApp(page)
  await typeAndFormat(page, 'int main() { int x = 0; if (x > 0) { x = 1; } return 0; }')
  await page.locator('[data-tab="flow"], button', { hasText: /^流程$/ }).first().click()
  await expect(page.locator('.flow-toolbox')).toBeVisible({ timeout: 10_000 })

  const ports = page.locator('.fc-port-wirable[data-port="else_body"]')
  await expect(
    ports.first(),
    '🔴 「如果」沒有 else 接點 → 使用者在流程視圖裡做不出 else',
  ).toBeVisible({ timeout: 8000 })
})
