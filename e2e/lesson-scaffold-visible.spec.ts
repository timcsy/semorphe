/**
 * **課程說鷹架是淡的，畫面上就要真的有那幾塊淡的。**
 *
 * ## 它從哪來
 *
 * 使用者 2026-09-14 讀完前五課：
 *
 * > 「我從課程點進去編輯器，雖然骨架**寫的是淡的**，但是我**實際看到卻是隱藏的**」
 *
 * 而第 5 課的課文白紙黑字承諾：
 *
 * > 「從這一課起，**積木那一邊也會把它們畫出來**——淡淡的、拖不動的那幾塊。」
 *
 * 實測抓到**兩個疊在一起的缺陷**：
 *
 * ```
 * ① 深度沒被推下去   applyLesson 設了 this.scaffoldDepth，而把它推給產生器的
 *                    那三行住在 enforceShellDepthFloor 裡——那一支在深度不是 0
 *                    的時候直接 return。狀態列說「淡的」，產生器組態還是 0。
 * ② 空畫布沒有骨架   程式碼側的骨架是【產生器在最外層補】出來的，
 *                    積木側是【樹裡有才畫得出來】——而一堂課剛打開時樹是空的。
 * ```
 *
 * ⚠️ ② 只在「還沒有任何東西」的那一刻看得見：學生一旦打出任何一行完整程式，
 * `main` 就成為真的節點，鷹架標記蓋得上去（實測 8 顆積木、5 顆淡的）。
 *
 * > **一份「兩邊都看得到」的承諾，如果兩邊各自合成它，
 * > 那它會在【還沒有東西可合成】的那一刻先破。**
 *
 * ## 這一支為什麼是 e2e 而不是單元測試
 *
 * 兩個缺陷都**只在畫面上看得見**：①的單元測試會讀 `this.scaffoldDepth`
 * 而那一格是對的；②要一個真的 Blockly 工作區才數得出「畫了幾顆」。
 *
 * 🔴 而 `npm test` 那 6764 條**一條都沒紅**——這個症狀從頭到尾是使用者發現的。
 */
import { test, expect } from '@playwright/test'

interface Snap { depth: number; all: number; ghost: number }

const snap = (page: import('@playwright/test').Page): Promise<Snap> =>
  page.evaluate(() => {
    const a = (window as never as Record<string, any>).__app
    const bs = a.blocklyPanel.workspace.getAllBlocks(false)
    return {
      depth: a.scaffoldDepth,
      all: bs.length,
      ghost: bs.filter((b: any) => b.getSvgRoot?.()?.classList.contains('ghost-block')).length,
    }
  })

async function openLesson(page: import('@playwright/test').Page, id: string): Promise<Snap> {
  await page.goto(`/?lesson=${encodeURIComponent(id)}&task=follow`)
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 30_000 })
  await page.waitForTimeout(3500)
  return snap(page)
}

test('🔴 淡的那幾課：一打開就要看得到鷹架', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  // ⚠️ 先開一堂【隱藏】的課，複現「從上一課走過來」——①就是這樣現形的
  const hidden = await openLesson(page, 'cpp-beginner/04-讀進來')
  expect(hidden.depth, '第 4 課宣告 hidden').toBe(0)
  expect(hidden.ghost, '🔴 隱藏的課不該有淡的鷹架').toBe(0)

  const ghost = await openLesson(page, 'cpp-beginner/05-程式從哪開始')
  expect(ghost.depth, '🔴 深度沒跟著課換——狀態列會說謊').toBe(1)
  expect(ghost.ghost,
    '🔴 課文承諾「積木那一邊也會把它們畫出來——淡淡的、拖不動的那幾塊」，而畫面上一塊都沒有')
    .toBeGreaterThan(0)
  expect(ghost.all, '🔴 畫出來的不只是鷹架？那就不是空畫布的起點了').toBe(ghost.ghost)
})

test('🔴 藏起來的那幾課：一打開就不該看到鷹架', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  for (const id of ['cpp-beginner/01-印出一句話', 'cpp-beginner/02-型別', 'cpp-beginner/03-變數']) {
    const s = await openLesson(page, id)
    expect(s.depth, `${id} 該是隱藏（前三課一個字都沒提 #include／main）`).toBe(0)
    expect(s.all, `🔴 ${id} 的畫布上出現了積木——那三課該是乾淨的`).toBe(0)
  }
})
