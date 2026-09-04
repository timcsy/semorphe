/**
 * **三個「要拉哪裡」的短片段**——給課文頁用的，不是給 README 用的。
 *
 * ```
 * clip-drag     從工具箱拖一顆積木進畫布 → 程式碼那邊當場多一行
 * clip-compare  切成「對照」——一次看得到程式碼與積木
 * clip-run      按執行 → 底下的主控台印出來
 * ```
 *
 * ## 🔴 它們與 `record.spec.ts` 的差別
 *
 * ```
 * 示範（demo）   給【還沒決定要不要用】的人看 —— 20 秒，講「這是什麼」
 * 片段（clip）   給【正在上課而卡住】的人看   —— 3 秒，講「這一下要按哪裡」
 * ```
 *
 * ⚠️ 所以片段**要短、要慢、而且要看得到游標**（`withCursor`）。
 * 而「短」是硬要求：課文頁現在 7.5KB／零外部請求，那是它的體驗基礎
 * （見 `draft/2026-09-04-操作說明要會過期就變紅`）。
 *
 * ## 🟢 而它們是【會紅的文件】
 *
 * 每一支最後都驗自己的產出。按鈕搬家、選擇器改名、拖曳失效——錄出來是壞的那天
 * 這裡會紅，而不是等到某個學生照著做卻做不出來。
 *
 * > **一張手工截的圖是死的；一支腳本錄的片段是活的——按鈕搬家時它會紅。**
 */
import { test, expect, type Page } from '@playwright/test'
import { withCursor } from './with-cursor'

const settle = (page: Page, ms: number): Promise<void> => page.waitForTimeout(ms)

async function boot(page: Page): Promise<void> {
  await withCursor(page)
  await page.goto('/')
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await settle(page, 1400)
}

const blockCount = (page: Page): Promise<number> => page.evaluate(() =>
  (window as never as { __app: { blocklyPanel: { workspace: { getAllBlocks(o: boolean): unknown[] } } } })
    .__app.blocklyPanel.workspace.getAllBlocks(true).length)

const codeNow = (page: Page): Promise<string> => page.evaluate(() =>
  (window as never as { __app: { codeView: { getCode?(): string } } }).__app.codeView.getCode?.() ?? '')

/**
 * 給這一頁一段程式——🔴 **用打的，不要用 `setCode`**。
 *
 * 實測（2026-09-04）：剛開的一頁 `setCode(…)` 之後**積木是 0 顆**，
 * 而打字之後是 3 顆。根因是那個已知缺陷（首次開啟時畫布沒被畫過，
 * 殘態守衛把同步擋掉了——`draft/已知工程待解問題`）。
 *
 * > **一個「程式化地塞內容」的捷徑，繞過的往往正是使用者會走的那條路
 * > ——而那條路上的缺陷，捷徑看不到。**
 */
/**
 * 在**既有骨架裡面**打一段本體。
 *
 * 🪦 第一版是「點編輯器 → 直接打 `int main() { … }`」，而錄出來是**兩個 `int main()`**
 * ——編輯器裡本來就有一個（骨架），游標停在哪就從哪插入。
 *
 * 🔴 **這是 2026-09-03 才記過的同一課**（`record-lessons.spec.ts` 的檔頭）：
 * > 一段示範如果把工具的骨架弄壞了，讀者看到的不是「這個工具很好用」，
 * > 是「這個工具會把我的程式弄壞」。
 * 而我在新腳本裡**又踩了一次**——所以這一支下面有一條斷言盯著它。
 *
 * 做法：游標移到 `int main() {` 的**行尾**，Enter 開一行往裡面寫。
 */
async function typeBody(page: Page, body: string): Promise<void> {
  await page.locator('.monaco-editor').first().click()
  await page.keyboard.press('Control+Home')
  await page.keyboard.press('ArrowDown')      // → `int main() {`
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await settle(page, 300)
  await page.keyboard.type(body, { delay: 14 })
  await settle(page, 2600)
  // 🔴 骨架只准有一個
  const code = await codeNow(page)
  expect((code.match(/int main\(\)/g) ?? []).length,
    `🔴 骨架被打壞了——出現了不只一個 main：\n${code}`).toBe(1)
  expect(code, '🔴 `return 0;` 不見了').toContain('return 0;')
}

/** 切一張版面——與 `record.spec.ts` 同一支，⚠️ 等 `data-layout` 真的變了再往下。 */
async function pickLayout(page: Page, id: string): Promise<void> {
  await page.locator('#status-controls .status-item-btn[data-control-id="layout"]').click()
  await settle(page, 700)
  await page.locator(`.quick-pick-item[data-value="${id}"]`).click()
  await page.waitForFunction((v) => document.body.getAttribute('data-layout') === v, id)
}

test('clip-drag', async ({ page }) => {
  test.setTimeout(120_000)
  await boot(page)
  await pickLayout(page, 'compare')
  await settle(page, 1200)

  const before = await blockCount(page)

  // ① 打開「輸入/輸出」那一類——⚠️ 用文字找分類，不用位置：順序會變
  const category = page.locator('.blocklyToolboxCategory', { hasText: '輸入/輸出' }).first()
  await category.hover()
  await settle(page, 700)
  await category.click()
  await settle(page, 1100)

  // ② 從彈出的那一列裡挑【輸出】那一顆
  //    🔴 **不要用 `.first()`**：實測第一顆是「換行」（`endl`），
  //    拖出來會變成一行 `endl;`——一個示範「怎麼用」的片段，示範錯的東西比沒有更糟。
  const blocks = page.locator('.blocklyFlyout .blocklyDraggable')
  const texts = await blocks.evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()))
  const idx = texts.findIndex((t) => t.startsWith('輸出'))
  expect(idx, `🔴 工具箱裡找不到「輸出」（量到：${texts.slice(0, 4).join('／')}）`).toBeGreaterThan(-1)

  const from = await blocks.nth(idx).boundingBox()
  const canvas = await page.locator('#blockly-panel').boundingBox()
  expect(from && canvas, '🔴 量不到位置').toBeTruthy()

  await page.mouse.move(from!.x + 34, from!.y + 14, { steps: 18 })
  await settle(page, 700)
  await page.mouse.down()
  await settle(page, 250)
  await page.mouse.move(canvas!.x + canvas!.width * 0.42, canvas!.y + 170, { steps: 30 })
  await settle(page, 450)
  await page.mouse.up()
  await settle(page, 2400)

  // 🔴 錄製器驗自己的產出
  expect(await blockCount(page), '🔴 拖進去沒有變成積木').toBeGreaterThan(before)
  expect(await codeNow(page), '🔴 積木進去了而程式碼沒有跟上——這一段在示範一個壞掉的功能')
    .toMatch(/cout|printf/)
  await settle(page, 1000)
})

test('clip-compare', async ({ page }) => {
  test.setTimeout(120_000)
  await boot(page)
  // 先給一點內容，不然切版面時兩格都是空的，看不出「對照」在對什麼
  await typeBody(page, 'cout << "Hi" << endl;')

  await pickLayout(page, 'focus')
  await settle(page, 1400)
  await pickLayout(page, 'compare')
  await settle(page, 1800)

  const cols = await page.evaluate(() =>
    ['code-column', 'flow-column', 'blocks-column']
      .filter((id) => getComputedStyle(document.getElementById(id)!).display !== 'none'))
  expect(cols, '🔴「對照」沒有變成程式碼＋積木兩格').toEqual(['code-column', 'blocks-column'])
  await settle(page, 900)
})

test('clip-run', async ({ page }) => {
  test.setTimeout(120_000)
  await boot(page)
  await typeBody(page, 'cout << "Hello" << endl;')

  const run = page.locator('#run-btn')
  await run.hover()
  await settle(page, 800)
  await run.click()
  await settle(page, 3000)

  // 🔴 主控台真的印出來了嗎——不然這一段在教一顆按了沒事的按鈕
  const out = await page.locator('#bottom-container').innerText()
  expect(out, `🔴 執行完主控台沒有輸出（量到：${out.slice(0, 60)}）`).toContain('Hello')
  await settle(page, 900)
})
