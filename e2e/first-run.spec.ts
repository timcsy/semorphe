/**
 * **第九十條護欄**：第一次打開這個網站的人，可以直接用。
 *
 * ## 它從哪來
 *
 * 2026-08-31 使用者回報：
 *
 * > 「semorphe 在一開始打開的時候畫面是空的，拉積木也沒反應，
 * >  我是**去載入範例**才開始有反應。」
 *
 * 實測到的形狀：
 *
 * ```
 * 開機    code:""  blocks:0  staleReason:'not-rendered'
 * 拉一顆  code:""  blocks:1  staleReason:'not-rendered'   ← 積木進去了，程式碼沒動
 * ```
 *
 * 根因在 `ui/app.ts` 的 `restoreState()`：沒有存檔時它**直接 return**，
 * 於是開機那一次同步從來沒跑過。而 `hasRendered` 只在匯流排畫過樹時變 true，
 * 所以 `staleReason` 永遠停在 `'not-rendered'`，每一次積木編輯都被殘態守衛
 * 擋掉——**而那道守衛刻意不出聲**（它以為自己在開機的過渡狀態裡）。
 *
 * > **一道「等畫過再說」的閘，遇到「永遠不會被畫」的情況時，
 * > 不會變成錯誤——它會變成一個安靜的死結。**
 *
 * ## 🔴 為什麼 5961 支單元測試 ＋ 220 支 e2e 全綠
 *
 * **每一支 e2e 都先做點什麼**——載入範例、貼一段程式碼、選一堂課。
 * 而那些動作全都會讓匯流排畫一次樹，於是**閘在被測到之前就解除了**。
 *
 * ```
 * 既有 e2e 測的是   「做了 X 之後，Y 對不對」
 * 沒有人測的是      「什麼都還沒做的時候」
 * ```
 *
 * > **一個只在「使用者還沒做任何事」時成立的缺陷，
 * > 會被每一支「先做點什麼」的測試跳過去。**
 *
 * 所以這支的第一個動作**必須**是拉積木，不得先載入任何東西。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果工具箱的分類數是 0，代表 app 根本沒載起來，這份結果不算數
 * > ——不是「第一次打開就能用」。**
 *
 * 錨在**分類數**（合成量：工具箱宣告了幾個分類）。它不會因為這個缺陷
 * 被修好而變小，也不會因為缺陷復發而變大。
 * 🔴 **刻意不錨在「程式碼長度」**——那正是要推上去的東西。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測程式碼的內容對不對**——只問「它有沒有動」
 * - **不檢測其他起手式**（選課、切目標）——那些既有 e2e 有覆蓋
 * - ⚠️ **不檢測 `refused` 那條路**：存檔載不進來時凍住是**刻意的**
 *   （不讓一次自動存檔蓋掉救得回來的東西）。兩條早退看起來一樣，
 *   而它們的最壞情況相反——把它們寫成同一條會製造一個真正的資料遺失。
 */
import { test, expect } from '@playwright/test'

test('★ 第一次打開（沒有任何存檔）就拉得動積木', async ({ page }) => {
  // 🔴 **不呼叫任何 helper**——helpers 多半會先設好狀態，而那正是要避開的。
  await page.goto('/')
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 30_000 },
  )
  await page.waitForTimeout(4000)

  // ★ 入口條件——錨在合成量，見檔頭的自我否證
  const categories = await page.locator('.blocklyToolboxCategory').count()
  expect(
    categories,
    '🔴 工具箱一個分類都沒有 → app 沒載起來，這份結果不算數。⚠️ 不代表「開機就能用」。',
  ).toBeGreaterThan(0)

  // ★ 存檔真的是空的——否則這支測的是「還原」，不是「第一次打開」
  expect(
    await page.evaluate(() => Object.keys(localStorage).length),
    '🔴 localStorage 不是空的 → 這一次不是「第一次打開」',
  ).toBe(0)

  const before = await page.evaluate(() => {
    const app = (window as never as Record<string, any>).__app
    return { code: app?.codeView?.getCode?.() ?? '', stale: app?.blocklyPanel?.staleReason ?? null }
  })

  // 🔴 **開機就要有骨架**——空白畫面是使用者回報的第一句話
  expect(
    before.code.length,
    `🔴 開機的程式碼是空的——使用者看到的是一片空白。實際：${JSON.stringify(before.code)}`,
  ).toBeGreaterThan(0)

  // 🔴 而**閘必須已經解除**：它是「拉積木沒反應」的直接原因
  expect(
    before.stale,
    '🔴 開機後 staleReason 還是殘的 → 積木的每一次編輯都會被靜靜擋掉',
  ).toBeNull()

  // ── 真的拉一顆下來 ────────────────────────────────────────
  await page.locator('.blocklyToolboxCategory').first().click()
  await page.waitForTimeout(900)
  const flyout = page.locator('.blocklyFlyout .blocklyDraggable')
  expect(await flyout.count(), '🔴 flyout 裡沒有積木').toBeGreaterThan(0)

  const box = await flyout.first().boundingBox()
  expect(box, '🔴 量不到第一顆積木的位置').not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.move(box!.x + 400, box!.y + 160, { steps: 25 })
  await page.mouse.up()
  await page.waitForTimeout(2500)

  const after = await page.evaluate(() => {
    const app = (window as never as Record<string, any>).__app
    return {
      code: app?.codeView?.getCode?.() ?? '',
      blocks: app?.blocklyPanel?.workspace?.getAllBlocks?.(false)?.length ?? -1,
    }
  })

  // ★ 積木真的落到工作區了——沒有這一條的話，下面那條可能是「根本沒拉成功」
  expect(after.blocks, '🔴 積木沒有落進工作區 → 這一次量的不是同步，是拖曳').toBeGreaterThan(0)

  // 🔴 **這才是使用者說的那句話**：「拉積木也沒反應」
  expect(
    after.code,
    '🔴 積木進了工作區而程式碼沒有跟著變——這正是使用者回報的症狀，' +
      '而它【不會】留下任何錯誤訊息（守衛只寫一行 console.debug）',
  ).not.toBe(before.code)
})
