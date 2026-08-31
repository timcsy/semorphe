/**
 * spec 150：**JSON 下拉不得靜默改掉學生的值。**
 *
 * ## 🔴 這一支怎麼來的
 *
 * 驗收 spec 150 時開瀏覽器貼 `#include <WiFi.h>`，而積木上出現的是
 * **`stdio.h`**——`cpp_include` 的 `HEADER` 是一個 JSON `field_dropdown`，
 * 清單裡 20 個標頭沒有 `WiFi.h`，**Blockly 把它換成第一項**。
 *
 * > **一個會把它不認得的值換掉的下拉，等於在使用者沒看的時候改掉他的程式。**
 *
 * ⚠️ 而它**不會拋錯、不會警告**，只是學生的 `#include` 變成另一個標頭。
 * 🟢 正解（`createOpenDropdown` 的 `doClassValidation_`）早就在專案裡，
 * 只是原本只有命令式註冊的那幾顆在用。
 *
 * ## ⚠️ 能力邊界
 *
 * 這支守的是 `cpp_include`。**其他 JSON 下拉共用同一個修法**，
 * 而這支只點名這一顆——它是唯一實測撞到的。
 */
import { test, expect } from '@playwright/test'
import { freshApp, selectTarget } from './helpers'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test('🔴 清單裡沒有的標頭要【留著】，不得被換成第一項', async ({ page }) => {
  await freshApp(page)
  await selectTarget(page, 'esp32')
  await page.evaluate(async () => {
    await navigator.clipboard.writeText(
      '#include <WiFi.h>\n\nvoid setup() {\n  WiFi.begin("a", "b");\n}\n\nvoid loop() {\n}\n')
  })
  await page.getByRole('button', { name: /覆蓋貼上/ }).click()
  // 🔴 **就緒條件要等【那一顆】，不是「積木變多了」**（2026-08-31 修）。
  //    原本等的是 `getAllBlocks().length > 1`，而 Arduino 骨架本身就會先長出
  //    `setup`／`loop` 兩顆——那個條件被**骨架**滿足，於是還沒等到 `#include`
  //    就去讀欄位，讀到 `no include block`。
  //
  // > **一個「東西變多了」的就緒條件，會被任何一種變多滿足
  // > ——包括不是你在等的那一種。**
  await expect
    .poll(() => page.evaluate(() =>
      /* eslint-disable @typescript-eslint/no-explicit-any */
      ((window as any).__app?.blocklyPanel?.workspace?.getAllBlocks(false) ?? [])
        .some((b: any) => b.type === 'cpp_include')))
    .toBe(true)

  const header = await page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const ws = (window as any).__app.blocklyPanel.workspace
    const b = ws.getAllBlocks(false).find((x: any) => x.type === 'cpp_include')
    return b ? (b.getFieldValue('HEADER') as string) : 'no include block'
  })
  // ★ 錨點兼判準：`stdio.h` 正是清單的第一項——它是「被換掉」的指紋
  expect(header, '學生的 <WiFi.h> 被靜默換成清單的第一項').toBe('WiFi.h')
})
