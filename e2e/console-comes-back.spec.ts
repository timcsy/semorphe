/**
 * **主控台關得掉，而它叫得回來——有輸出時它自己回來。**
 *
 * ## 這一支替掉了什麼
 *
 * 2026-08-26 的規則是「`state` **不得出現**在版面的預設裡」，理由逐字是
 * 「列它進來會讓面板區變成**一個可以被佈局關掉的東西**」。
 * 2026-08-31 的十字反過來要求它**每一張版面都在**。
 *
 * 🔴 而 2026-09-02（spec 171）兩者都退場了：主控台不是投影，是**執行的輸出**
 * （三維錨定——`history/198`），它是編輯區底下一條獨立的、全寬的底條。
 *
 * ⚠️ **那個真正的擔憂（「被關掉就回不來」）沒有消失，只是換了執行機構**：
 * 不是「不准關」，而是「**關得掉，但關不掉它回來的能力**」。
 *
 * > **「不准關」與「關得掉但叫得回來」守的是同一個東西，
 * > 而只有後者容得下使用者想要安靜的那一刻。**
 *
 * ## 為什麼要 e2e
 *
 * 規則本身（`revealForOutput`）有單元測試，接線有第八十一條的 I4b。
 * 而**「執行一支印東西的程式，主控台真的自己出現在畫面上」**這件事
 * 要有真的版面、真的執行器、真的 CSS——那三樣 happy-dom 都沒有。
 */
import { test, expect, type Page } from '@playwright/test'
import { useAsSource } from './helpers'

async function freshApp(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')
  await expect(page.locator('.blocklyWorkspace, .injectionDiv').first()).toBeVisible({ timeout: 30_000 })
}

/** 主控台現在展開著嗎？——判準是**內容區真的有高度**，不是有沒有那個節點。 */
const isOpen = (page: Page): Promise<boolean> => page.evaluate(() => {
  const c = document.querySelector('#bottom-container .bottom-panel-content') as HTMLElement | null
  return !!c && c.getClientRects().length > 0 && c.getBoundingClientRect().height > 0
})

/** 點分頁列上那顆分頁 ＝ 開／關（與 VSCode 的 panel 一樣）。 */
async function clickConsoleTab(page: Page): Promise<void> {
  await page.locator('#bottom-container .bottom-panel-tabs [data-tab-id="console"]').first().click()
  await page.waitForTimeout(300)
}

const helloProgram = 'int main() { cout << "叫得回來" << endl; return 0; }'

async function typeCode(page: Page, code: string): Promise<void> {
  await page.evaluate((c) => (window as never as { __app: { codeView: { setCode(s: string): void } } }).__app.codeView.setCode(c), code)
  await useAsSource(page, '程式碼')
  await expect(page.locator('.blocklyDraggable').first()).toBeVisible({ timeout: 15_000 })
}

test('★ 入口條件：主控台關得掉，也開得回來', async ({ page }) => {
  // 錨在**這條路走得通**（關 → 開），不是「它現在是開的」。
  // ⚠️ 開機時它是**開著**的（實測 35% 高）——所以第一下是關。
  await freshApp(page)
  expect(await isOpen(page), '🔴 開機主控台就是關的 → 下面每一條測的都不是那條路').toBe(true)
  await clickConsoleTab(page)
  expect(await isOpen(page), '🔴 主控台關不掉——那它不是「可以關」的').toBe(false)
  await clickConsoleTab(page)
  expect(await isOpen(page), '🔴 關掉之後再點它沒有回來').toBe(true)
})

test('🔴 關掉 → 執行一支印東西的程式 → 它自己回來，而且印出來了', async ({ page }) => {
  await freshApp(page)
  await typeCode(page, helloProgram)
  // 先確定它是關著的
  if (await isOpen(page)) await clickConsoleTab(page)
  expect(await isOpen(page), '🔴 主控台還開著 → 這支測的不是那條路').toBe(false)

  await page.locator('#run-btn').click()

  await expect(page.locator('.console-output'), '🔴 輸出印不出來')
    .toContainText('叫得回來', { timeout: 20_000 })
  expect(await isOpen(page), '🔴 有輸出而主控台沒有自己回來——使用者會以為程式沒有跑').toBe(true)
})

test('🔴 關掉 → 切版面 → 它【不准】被打開', async ({ page }) => {
  // ⚠️ 這是另一半：「自己回來」只准由**輸出**觸發。
  //    版面切換去動它的話，使用者關掉它的意思就被系統推翻了（FR-006）。
  await freshApp(page)
  if (await isOpen(page)) await clickConsoleTab(page)
  expect(await isOpen(page)).toBe(false)

  for (const id of ['focus', 'compare', 'three-column']) {
    await page.locator('#status-controls .status-item-btn[data-control-id="layout"]').click()
    await expect(page.locator('.quick-pick-overlay')).toHaveCount(1)
    await page.locator(`.quick-pick-item[data-value="${id}"]`).click()
    await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
    await page.waitForFunction((v) => document.body.getAttribute('data-layout') === v, id)
    expect(await isOpen(page), `🔴 切到「${id}」把主控台打開了——那是使用者關掉的`).toBe(false)
  }
})

test('🔴 版面選單裡的「顯示／隱藏主控台面板」真的開得起來也關得掉', async ({ page }) => {
  // 使用者 2026-09-02：「我想要加一個『顯示/隱藏下方面板』的功能
  // （加在單欄、對照、三欄的下方）」。
  //
  // ⚠️ 而它**不是第四張版面**：三張版面說的是編輯區怎麼排，而主控台是
  //    編輯區底下那條獨立的底條（spec 171）。這一條驗的是它真的接上了開關。
  await freshApp(page)
  expect(await isOpen(page), '🔴 開機主控台就是關的 → 這支測的不是那條路').toBe(true)

  const pickToggle = async (): Promise<void> => {
    await page.locator('#status-controls .status-item-btn[data-control-id="layout"]').click()
    await expect(page.locator('.quick-pick-overlay')).toHaveCount(1)
    await page.locator('.quick-pick-item[data-value="__toggle-console"]').click()
    await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
    await page.waitForTimeout(300)
  }

  await pickToggle()
  expect(await isOpen(page), '🔴 選了「顯示／隱藏」而它沒有關掉').toBe(false)
  await pickToggle()
  expect(await isOpen(page), '🔴 再選一次而它沒有回來——那不是開關，是「關掉」').toBe(true)
})

test('⚠️ 而它不得被當成一張版面——按了之後版面的名字不准變', async ({ page }) => {
  // 🔴 少了這一條，一個把 `__console-toggle` 當成 preset id 的實作也會綠：
  //    畫面上主控台收起來了，而狀態列上那顆會顯示一個**不存在的版面名字**。
  await freshApp(page)
  const before = await page.locator('#status-controls .status-item-btn[data-control-id="layout"]').innerText()
  await page.locator('#status-controls .status-item-btn[data-control-id="layout"]').click()
  await page.locator('.quick-pick-item[data-value="__toggle-console"]').click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
  await page.waitForTimeout(300)
  expect(await page.locator('#status-controls .status-item-btn[data-control-id="layout"]').innerText(),
    '🔴 版面的名字被開關改掉了').toBe(before)
  expect(await page.evaluate(() => document.body.getAttribute('data-layout')),
    '🔴 `data-layout` 被開關改掉了').toBe('compare')
})

test('🔴 標籤說的是【按下去會發生什麼】——開著寫「隱藏」，關著寫「顯示」', async ({ page }) => {
  // 使用者 2026-09-02：「如果現在已經是開著的，就是『隱藏…面板』」。
  //
  // > **一個開關如果兩種狀態都叫同一個名字，
  // > 使用者要按下去才知道它剛才是開還是關。**
  await freshApp(page)
  const labelOf = async (v: string): Promise<string> => {
    await page.locator('#status-controls .status-item-btn[data-control-id="layout"]').click()
    await expect(page.locator('.quick-pick-overlay')).toHaveCount(1)
    const t = await page.locator(`.quick-pick-item[data-value="${v}"]`).innerText()
    await page.keyboard.press('Escape')
    await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
    return t
  }
  // 開機時主控台是開著的、變數沒有
  expect(await labelOf('__toggle-console'), '🔴 開著卻寫「顯示」').toContain('隱藏')
  expect(await labelOf('__toggle-variables'), '🔴 沒開卻寫「隱藏」').toContain('顯示')

  // 切到變數那一頁 → 兩個標籤要對調
  await page.locator('#status-controls .status-item-btn[data-control-id="layout"]').click()
  await page.locator('.quick-pick-item[data-value="__toggle-variables"]').click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
  await page.waitForTimeout(300)
  expect(await labelOf('__toggle-variables'), '🔴 切過去了而它還寫「顯示」').toContain('隱藏')
  expect(await labelOf('__toggle-console'), '🔴 主控台那一頁被蓋掉了而它還寫「隱藏」').toContain('顯示')
})
