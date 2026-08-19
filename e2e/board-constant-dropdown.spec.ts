/**
 * spec 148：**腳位常數的下拉列的是【目前這塊板子】的常數。**
 *
 * ## 🔴 為什麼這一支必須是 e2e
 *
 * 這一刀改的是**選項怎麼算出來**，而那條路要走完
 * `語言套件宣告 → BlockRegistrar → Blockly 的 FieldDropdown → 目前的目標`。
 * **單元測試量得到選項函式，量不到那條路有沒有接上**
 * ——而這個專案已經撞過四次「機制有了沒人接上」。
 *
 * ## ⚠️ 它的能力邊界（照 `toolbox.spec.ts` 的規矩寫出來）
 *
 * ```
 * 這支擋得住   選項沒跟著板子換、換板子把既有的值改掉、非硬體目標被波及
 * 這支擋不住   下拉「打得開但畫得不對」（那是渲染，不是這一刀改的東西）
 * ```
 */
import { test, expect } from '@playwright/test'
import { freshApp } from './helpers'

/** 走 UI 的目標選擇器——⚠️ 不要自己呼叫 `handleTargetChange`，那會跳過選擇器那一半。 */
async function selectTarget(page: import('@playwright/test').Page, id: string): Promise<void> {
  const sel = page.locator('select.topic-dropdown')
  await sel.selectOption(id)
  await expect(sel).toHaveValue(id)
}

/** 這顆積木此刻的下拉選項——走 Blockly 真的會用的那條路（`getOptions`）。 */
async function pinConstantOptions(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    // ⚠️ **`window.Blockly` 在打包後的 app 裡不存在**（`src/i18n/messages.ts:11` 記過）
    //    ——工作區的入口是 `__app.blocklyPanel.workspace`。
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const ws = (window as any).__app?.blocklyPanel?.workspace
    if (!ws) throw new Error('拿不到工作區')
    const block = ws.newBlock('cpp_pin_constant')
    const field = block.getField('VALUE')
    const opts = field.getOptions(false).map((o: string[]) => o[1])
    block.dispose(false)
    return opts as string[]
  })
}

test.describe('spec 148 · 下拉跟著板子走', () => {
  test('🔴 四塊板子四份名單，而它們各自與板子相符', async ({ page }) => {
    await freshApp(page)

    // ★ 錨點：先證明【拿得到選項】，否則下面每一條都在比對空陣列
    await selectTarget(page, 'arduino-uno')
    const uno = await pinConstantOptions(page)
    expect(uno.length, '拿不到任何選項——多半是積木沒註冊').toBeGreaterThan(5)
    expect(uno, 'Uno 少了 A0').toContain('A0')
    expect(uno, 'Uno 少了 A7（它的 variant 是 eightanaloginputs）').toContain('A7')
    expect(uno, 'Uno 不該有 ESP8266 的 D1').not.toContain('D1')

    await selectTarget(page, 'esp32')
    const esp32 = await pinConstantOptions(page)
    expect(esp32, 'ESP32 少了 A0（它是 36）').toContain('A0')
    expect(esp32, 'ESP32 少了 A19').toContain('A19')
    // 🔴 `nodemcu-32s/pins_arduino.h` 真的沒有定義 A1／A2
    expect(esp32, 'ESP32 多了它沒有的 A1').not.toContain('A1')

    await selectTarget(page, 'esp32c3')
    const c3 = await pinConstantOptions(page)
    expect(c3, 'C3 少了 A5').toContain('A5')
    expect(c3, 'C3 多了它沒有的 A10').not.toContain('A10')

    await selectTarget(page, 'wemos-d1-mini')
    const d1 = await pinConstantOptions(page)
    expect(d1, 'D1 mini 少了 D 系的名字').toContain('D1')
    expect(d1, 'D1 mini 少了它唯一的類比腳 A0').toContain('A0')
    expect(d1, 'ESP8266 只有一個類比輸入，不該有 A1').not.toContain('A1')

    // 🔴 四份名單真的互不相同——否則上面可能都在讀同一份
    const sigs = new Set([uno, esp32, c3, d1].map((o) => o.join(',')))
    expect(sigs.size, '四塊板子拿到同一份名單').toBe(4)
  })

  test('🔴 沒有板子的目標，選項與今天逐字相同', async ({ page }) => {
    await freshApp(page)
    await selectTarget(page, 'cpp')
    expect(await pinConstantOptions(page)).toEqual(['HIGH', 'LOW', 'OUTPUT', 'INPUT', 'INPUT_PULLUP'])
  })

  test('🔴 換板子不得改掉畫布上已經放好的值', async ({ page }) => {
    await freshApp(page)
    // 🔴 **值要在【這塊板子不認得它】的時候設進去**——那才是真實情境
    //    （在 Uno 存的檔，在 C3 底下打開）。
    //    ⚠️ 第一版是在 Uno 設好再切到 C3，而**那一版是假綠的**：
    //    Blockly 只在【設值】時驗證，切目標不會重驗，所以把驗證器改壞了它照樣過。
    await selectTarget(page, 'esp32c3')
    const c3opts = await pinConstantOptions(page)
    expect(c3opts, '前置不成立：C3 竟然有 A6').not.toContain('A6')

    const kept = await page.evaluate(() => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const ws = (window as any).__app.blocklyPanel.workspace
      const block = ws.newBlock('cpp_pin_constant')
      block.setFieldValue('A6', 'VALUE')   // C3 沒有 A6——它必須被【留著】
      const v = block.getFieldValue('VALUE') as string
      block.dispose(false)
      return v
    })
    // > 一個會把它不認得的值換掉的下拉，等於在使用者沒看的時候改掉他的程式。
    expect(kept, 'C3 沒有 A6，而那顆積木被靜默改成別的值了').toBe('A6')
  })
})
