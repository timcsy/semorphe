/**
 * **自動補的 `#include`，兩條路要畫出同一件事。**
 *
 * ## 🔴 這一支怎麼來的（2026-09-15）
 *
 * 使用者轉述第 5 課（「程式從哪開始」——那一課在教 `#include`）：
 *
 * > 「`#include` 好像**不會在拉 `cout` 的時候出來**，如果自己把 include
 * >   積木拉出來，又會是**不能調整的 `stdio.h`**」
 *
 * 量出來是**三個各自獨立的缺陷**疊在一起：
 *
 * ```
 * ① 拉 cout 沒出現   程式碼那側有 #include <iostream>，積木那側【沒有那顆積木】
 *                    ——積木面板刻意不重畫自己的編輯，而那顆不是它畫的
 * ② 是 stdio.h       工具箱那顆的下拉第一個選項是 stdio.h（元件宣告的 default 是 iostream）
 * ③ 不能調整         放到該放的位置就被鎖成骨架——判定問的是【身分】不是【誰放的】
 * ```
 *
 * ## 🟢 而②③是同一件事，使用者一句話就溶掉了
 *
 * > 「我覺得正確的做法應該是，**ghost 的積木不用出現在工具箱**」
 *
 * 拿不到，就沒有「拉出來是 `stdio.h`」，也沒有「拉出來鎖住」。
 *
 * > **工具箱裡不該有「拿出來也動不了」的積木。**
 *
 * ⚠️ 而那一刀補的是一條**已經存在而漏了一種情況**的規則：工具箱本來就收窄成
 * 「這一課宣告的」，理由逐字寫著「第 1 課不教 `#include`，學生不該拖得到它」
 * ——**而第 5 課教它**，於是它進去了。
 *
 * > **「一課宣告了它」與「學生該拿得到它」是兩件事
 * > ——而一張表同時扛這兩個工作的時候，教到它的那一課就是破口。**
 *
 * ⚠️ **綁深度不綁身分**：`editable`（深度 2+）下鷹架動得了，那時它該在工具箱裡。
 */
import { test, expect, type Page } from '@playwright/test'

const LESSON = 'cpp-beginner/05-程式從哪開始'

async function boot(page: Page): Promise<void> {
  await page.goto(`/?lesson=${encodeURIComponent(LESSON)}`)
  await page.waitForFunction(
    () => Boolean((window as unknown as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForFunction(
    () => Boolean((window as unknown as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.waitForTimeout(3000)
}

interface Shot {
  code: string
  truth: string[]
  includes: { header: string; ghost: boolean; editable: boolean }[]
}

interface Blk {
  type: string
  getFieldValue(n: string): string
  isEditable(): boolean
  isDeletable(): boolean
  isMovable(): boolean
  getSvgRoot(): SVGElement
}
interface AppWindow {
  __app: {
    codeView: { getCode?(): string }
    syncController: { getCurrentTree?(): { slots?: Record<string, { componentId: string }[]> } | null }
    blocklyPanel: { workspace: { getAllBlocks(ordered: boolean): Blk[] } }
  }
}

const shot = (page: Page): Promise<Shot> => page.evaluate(() => {
  const app = (window as unknown as AppWindow).__app
  return {
    code: app.codeView.getCode?.() ?? '',
    truth: (app.syncController.getCurrentTree?.()?.slots?.body ?? []).map((n) => n.componentId),
    includes: app.blocklyPanel.workspace.getAllBlocks(false)
      .filter((b) => b.type === 'cpp_include')
      .map((b) => ({
        header: b.getFieldValue('HEADER'),
        ghost: b.getSvgRoot().classList.contains('ghost-block'),
        editable: b.isEditable(),
      })),
  }
})

/** 工具箱裡拿得到的每一塊積木的字。 */
async function toolboxContents(page: Page): Promise<string[]> {
  const cats = page.locator('.blocklyToolboxCategory')
  const n = await cats.count()
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    await cats.nth(i).click()
    await page.waitForTimeout(500)
    const items = page.locator('.blocklyFlyout .blocklyDraggable, .blocklyToolboxFlyout .blocklyDraggable')
    const k = await items.count()
    for (let j = 0; j < k; j++) out.push((await items.nth(j).textContent() ?? '').replace(/\s+/g, ' ').trim())
  }
  return out
}

/** 從工具箱的某一類，把某一顆拖到畫布上。 */
async function dragOut(page: Page, category: string, label: string, at: [number, number]): Promise<void> {
  await page.locator('.blocklyToolboxCategory', { hasText: category }).click()
  await page.waitForTimeout(700)
  const item = page.locator('.blocklyFlyout .blocklyDraggable, .blocklyToolboxFlyout .blocklyDraggable')
    .filter({ hasText: label }).first()
  const from = await item.boundingBox()
  const canvas = await page.locator('.blocklySvg').first().boundingBox()
  if (!from || !canvas) throw new Error(`🔴 抓不到座標（${category}／${label}）`)
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(canvas.x + canvas.width * at[0], canvas.y + canvas.height * at[1], { steps: 20 })
  await page.mouse.up()
  await page.waitForTimeout(4500)
}

test('① 拉一顆「印出」出來，積木那側也要看得到那顆淡的 #include', async ({ page }) => {
  test.setTimeout(180_000)
  await boot(page)
  expect((await shot(page)).includes, '起點不該有 include').toHaveLength(0)

  await dragOut(page, '輸入/輸出', '印出', [0.6, 0.7])
  const s = await shot(page)

  expect(s.code, '🔴 程式碼那側要有 #include <iostream>').toContain('#include <iostream>')
  // 🔴 這一條是使用者回報的那一句：「不會在拉 cout 的時候出來」
  expect(s.includes, '🔴 積木那側也要有那顆——兩個投影不得說不一樣的話').toHaveLength(1)
  expect(s.includes[0].header).toBe('iostream')
  expect(s.includes[0].ghost, '🔴 自動補的要是淡的').toBe(true)

  // ⚠️ 而它**不得進真相樹**：推導出來的東西只活在顯示樹上
  expect(s.truth, '🔴 自動補的不該變成「這支程式寫著的東西」').not.toContain('cpp:include')
})

test('② 拿不到——ghost 的積木不該出現在工具箱裡', async ({ page }) => {
  test.setTimeout(180_000)
  await boot(page)
  const box = await toolboxContents(page)
  // 🔴 使用者：「ghost 的積木不用出現在工具箱」——拿不到就沒有後面那兩個問題
  expect(box.join(' '), '🔴 淡的 `#include` 不該拿得到').not.toContain('引入函式庫')
  expect(box.join(' '), '🔴 淡的 `using namespace` 也一樣').not.toContain('使用命名空間')
  // ⚠️ **而別的積木要還在**——整個工具箱空掉也會讓上面兩條綠
  expect(box.join(' '), '🔴 這一課該給的積木不見了').toContain('印出')
})

test('③ 而鷹架切成「可編輯」之後，它們要回來', async ({ page }) => {
  test.setTimeout(180_000)
  await boot(page)
  // 🔴 **判準綁的是深度不是身分**：鷹架動得了的時候，學生就該拿得到它
  //    ——少了這一條，「不給」會從一個判斷退化成一條黑名單。
  const r = await page.evaluate(() => {
    const app = (window as unknown as { __app: {
      scaffoldDepth: number
      buildToolboxInner(): unknown
    } }).__app
    app.scaffoldDepth = 2
    const t = JSON.stringify(app.buildToolboxInner())
    return { include: t.includes('cpp_include'), using: t.includes('cpp_using_namespace') }
  })
  expect(r, '🔴 可編輯的鷹架該拿得到').toEqual({ include: true, using: true })
})

test('骨架那一行還是淡的——⚠️ 這是上面三刀的反面', async ({ page }) => {
  test.setTimeout(180_000)
  await boot(page)
  const r = await page.evaluate(() => (window as unknown as AppWindow).__app
    .blocklyPanel.workspace.getAllBlocks(false)
    .filter((b) => b.type === 'cpp_using_namespace')
    .map((b) => b.getSvgRoot().classList.contains('ghost-block')))
  // 🔴 `using namespace std;` **是**骨架宣告的那一行（`skeletons/main.json`）
  //    ——把「誰放的」判錯的第一版讓它變成實心的，而探針當場抓到
  expect(r, '🔴 骨架宣告的那一行要是淡的').toEqual([true])
})
