/**
 * **每一份範例都要真的跑得動。**
 *
 * ## 🔴 為什麼這條比宣告那條重要
 *
 * > **一個跑不動的範例，比沒有範例更糟——它是【內建的壞例子】。**
 *
 * 學生會假設官方附的東西是對的。他照著改，改壞了會以為是自己的錯。
 *
 * `audit-templates`（第八十七條）守的是宣告：載得起來、指得到目標、有程式碼。
 * 而「這段程式碼系統讀得懂嗎、跑起來出不出錯」要真的開一次瀏覽器。
 *
 * ⚠️ 這與 `lessons.spec.ts` 是同一個形狀，而**它是資料驅動的**：
 * 新增一份範例不必新增測試。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果掃到的範例少於 1 份，這支什麼都沒驗——不是「範例都好」。**
 *
 * 錨在**範例數**（合成量），不是「壞掉的份數」。
 */
import { test, expect } from '@playwright/test'
import { freshApp, useAsSource } from './helpers'
import fs from 'node:fs'
import path from 'node:path'

interface T { id: string; name: string; target: string; code: string }

function collect(): T[] {
  const dir = path.resolve(process.cwd(), 'templates')
  if (!fs.existsSync(dir)) return []
  const out: T[] = []
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue
    const meta = path.join(dir, d.name, 'template.json')
    if (!fs.existsSync(meta)) continue
    const codeFile = fs.readdirSync(path.join(dir, d.name)).find((f) => f.startsWith('code.'))
    if (!codeFile) throw new Error(`${d.name} 沒有 code.*`)
    const j = JSON.parse(fs.readFileSync(meta, 'utf8'))
    out.push({
      id: d.name, name: j.name, target: j.target,
      code: fs.readFileSync(path.join(dir, d.name, codeFile), 'utf8'),
    })
  }
  return out
}

const CASES = collect()

test('★ 入口條件——真的掃到範例了', () => {
  // ⚠️ 錨在**範例數**（合成量）。0 份 ＝ 這支什麼都沒驗，不是「都好」。
  expect(CASES.length, '🔴 一份範例都沒掃到 → 下面每一支都是空過的').toBeGreaterThanOrEqual(1)
})

for (const c of CASES) {
  test(`★ ${c.name}：套用之後系統讀得懂，而且跑起來不出錯`, async ({ page }) => {
    await freshApp(page)
    await page.waitForTimeout(1500)

    // 從**畫面上**選它——與使用者走的是同一條路
    await page.locator('.status-item-btn[data-control-id="target"]').click()
    await page.locator(`.quick-pick-item[data-value="${c.target}"]`).click()
    await page.waitForTimeout(2500)
    await page.locator('.status-item-btn[data-control-id="template"]').click()
    await page.locator(`.quick-pick-item[data-value="${c.id}"]`).click()
    // 🔴 **套用範例會蓋掉現在的內容，所以應用會先問一次**——而它
    //    **只在「現在有東西」時問**。
    //
    // 2026-08-31 之前這一步不存在：第一次打開時程式碼是空的，沒東西可蓋。
    // 開機不同步那一刀修好之後，第一次打開就有骨架，於是確認框出現了
    // ——而這支沒有回答它，遮罩就一直蓋著同步鈕，`useAsSource` 卡到逾時。
    //
    // > **一個「只在有內容時才出現」的確認框，
    // > 在測試永遠從空白開始的世界裡是看不見的。**
    //
    // ⚠️ 用 `count()` 判斷而不是硬等——不同目標的內容不一樣，
    //    問不問是應用的決定，不是這支該假設的。
    const confirmApply = page.locator('.quick-pick-item').filter({ hasText: /^套用/ })
    if (await confirmApply.count() > 0) await confirmApply.first().click()
    await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
    await page.waitForTimeout(2500)

    // ① 目標真的切過去了
    expect(
      await page.evaluate(() =>
        (window as never as { __app: { currentTarget: { id: string } } }).__app.currentTarget.id),
      `🔴 ${c.name} 沒有把目標切成 ${c.target}`,
    ).toBe(c.target)

    // ② 🔴 系統讀得懂——降級成 raw_code 代表範例在積木那一側是壞的
    await useAsSource(page, '程式碼')
    await page.waitForTimeout(2000)
    const ids = await page.evaluate(() => {
      const t = (window as never as { __app: { syncController: { getCurrentTree(): unknown } } })
        .__app.syncController.getCurrentTree()
      const seen = new Set<string>()
      const walk = (n: unknown): void => {
        if (!n || typeof n !== 'object') return
        const node = n as { componentId?: string; children?: Record<string, unknown[]> }
        if (node.componentId) seen.add(node.componentId)
        for (const k of Object.keys(node.children ?? {})) for (const c of node.children![k] ?? []) walk(c)
      }
      walk(t)
      return [...seen]
    })
    expect(ids.length, `🔴 ${c.name} 的語義樹是空的——那份範例根本沒進去`).toBeGreaterThan(1)
    expect(
      ids.filter((x) => x.includes('raw_')),
      `🔴 ${c.name} 降級了——一個跑不動的範例是【內建的壞例子】`,
    ).toEqual([])

    // ③ 跑起來不出錯
    await page.locator('#run-btn').click()
    await page.waitForTimeout(2200)
    const out = (await page.locator('.console-output').innerText()).trim()
    expect(
      out.split('\n').filter((l) => /尚未宣告|尚未定義|^Error:|不是一個結構|不合法/.test(l)),
      `🔴 ${c.name} 跑起來就出錯——學生拿它當起點，第一步就卡住`,
    ).toEqual([])
  })
}
