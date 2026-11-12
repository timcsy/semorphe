/**
 * **只在程式碼那側打字，重新整理之後還在**（第 429 刀）。
 *
 * 428 的瀏覽器實測順帶發現、在主幹重現：Python 目標下貼上程式、等 9 秒，`semorphe-state` 的 code 仍是空的、
 * 時間戳不動——`autoSave` 只掛在積木變動上，而程式碼→積木同步那一輪的積木事件在 `_codeToBlocksInProgress` 提早 return。
 * 學生在程式碼那側打完、重新整理 ⟹ 程式不見。
 * 第二個：還原只換了外殼（`scaffold.setSkeleton`），沒走 `adoptSkeleton` ⟹ `currentSkeletonId` 停在 C++ 的 `main`，
 * 之後的同步把 `int main() {…}` 接到 Python 程式後面。
 *
 * ⚠️ 既有的重新整理測試（`sidecar-droppable`、`flow-layout-persists`）都**自己呼叫 `autoSave()`**——
 * 那驗的是「存了之後怎麼載」，問不出「有沒有存」。這一支刻意不呼叫。
 */
import { test, expect } from '@playwright/test'
import { appKeepingStorage, pickTarget, editsSettled, codeLines } from './helpers'

const codeOf = (page: import('@playwright/test').Page): Promise<string> =>
  page.evaluate(() => (window as never as { __app: { codeView: { getCode(): string } } }).__app.codeView.getCode())

test('Python：只在程式碼那側打字，重新整理之後程式與骨架都還在', async ({ page }) => {
  await appKeepingStorage(page)
  await pickTarget(page, 'python')
  const skeleton = await page.evaluate(() => (window as never as { __app: { currentSkeletonId: string } }).__app.currentSkeletonId)
  expect(skeleton, '入口條件：切到 Python 之後骨架不是 C++ 的 main').not.toBe('main')

  // ⚠️ 換到 Python 時預設程式會非同步換寫法——等它做完，否則晚到的換寫法會蓋掉下面貼的（同 `python-to-cpp.spec.ts`）
  await expect.poll(async () => (await codeLines(page)).join('\n'), { timeout: 30_000 }).not.toContain('main')
  await expect(page.locator('.toast').filter({ hasText: /換成 .* 的寫法/ })).toBeVisible({ timeout: 15_000 })
  await editsSettled(page)

  // 走編輯器自己的貼上（Monaco 的變更事件 → 去抖 → 同步），不是 `setCode`、也不呼叫 `autoSave`
  await page.evaluate(() => {
    const ed = (window as never as { __app: { codeView: { editor: { setSelection(r: unknown): void; getModel(): { getFullModelRange(): unknown }; trigger(s: string, h: string, p: unknown): void; focus(): void } } } }).__app.codeView.editor
    ed.focus()
    ed.setSelection(ed.getModel().getFullModelRange())
    ed.trigger('keyboard', 'paste', { text: 'x = 7\nprint(x * 6)\n' })
  })
  await expect.poll(() => codeOf(page), { timeout: 15_000 }).toContain('print(x * 6)')
  await editsSettled(page)

  await page.reload()
  await page.waitForFunction(() => Boolean((window as never as { __appReady?: boolean }).__appReady), undefined, { timeout: 30_000 })
  await editsSettled(page)

  const after = await codeOf(page)
  expect(after, '🔴 重新整理之後程式不見了——程式碼那側的編輯沒有存').toContain('x = 7')
  expect(after).toContain('print(x * 6)')
  expect(after, '🔴 Python 程式後面接出 C++ 的骨架').not.toContain('int main')
  expect(await page.evaluate(() => (window as never as { __app: { currentSkeletonId: string } }).__app.currentSkeletonId),
    '🔴 還原之後骨架停在 C++ 的 main').toBe(skeleton)
})
