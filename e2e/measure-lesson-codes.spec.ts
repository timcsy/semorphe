/**
 * 🔧 **不是護欄，是量測器**——生教材用的（`knowledge/skills/write-lesson` 第 1 步）。
 *
 * 讀 `.lesson-measure/codes.json`（`{ 名: { target, code } }`），逐段：
 * 同步 → 走語義樹收元件 → **按執行讀主控台**，寫出 `.lesson-measure/measured.json`。
 *
 * ⚠️ **沒有那個輸入檔就整支跳過**，所以它留在 e2e 目錄裡不影響全套。
 *
 * ## 它踩過的四個坑（每一個都真的發生過，2026-08-27）
 *
 * | 坑 | 症狀 | 這裡怎麼處理 |
 * |---|---|---|
 * | 同步還沒完成 | 量到**上一段的樹**——一份看起來很合理的錯清單 | 每段先同步一個**空程式**，讓「沒更新」露出空樹 |
 * | 執行狀態殘留 | 每一批**只有第一段印得出東西** | 每段之前 `freshApp` 重新載入（`handleStop()` 救不了） |
 * | 解析器懶載入 | 切到 Python 量到 **0 顆元件** | 切目標後等 2500 ms ＋ 斷言「真程式不可能零元件」 |
 * | `trim()` 吃空白 | 「印了一串空行」與「什麼都沒印」分不開 | 空字串而原文非空 → 印出「只有 N 個空白字元」 |
 *
 * > **一個把自己的狀態殘留算進結果的量測器，
 * > 產出的是一份看起來像發現的東西。**
 */
import { test, expect } from '@playwright/test'
import { freshApp, selectTarget } from './helpers'
import fs from 'node:fs'
import path from 'node:path'

// 🔴 **暫存檔放 `.lesson-measure/`，不要放 `tools/`。**
//    `tools/` 是**產品建置腳本的家**（`build-sdk.mjs` 之類）——
//    2026-08-28 我把暫存檔寫進去，收尾時 `rm -rf tools` 把整個目錄刪了，
//    而第五十八條護欄（核心可獨立出貨）當場紅在
//    「Cannot find module tools/build-sdk.mjs」。
//
//    > **一個「我建的」目錄，與一個「本來就在、而我剛好也寫了東西進去」的目錄，
//    > 在 `ls` 底下長得一模一樣。**
const IN = path.resolve(process.cwd(), '.lesson-measure/codes.json')
const OUT = path.resolve(process.cwd(), '.lesson-measure/measured.json')

interface Spec { target?: string; code: string }

test('🔧 量測：把每一段課文程式碼用到的元件與輸出量出來', async ({ page }) => {
  test.skip(!fs.existsSync(IN), '沒有 .lesson-measure/codes.json，不用量')
  test.setTimeout(40 * 60 * 1000)
  const specs = JSON.parse(fs.readFileSync(IN, 'utf8')) as Record<string, Spec>
  const result: Record<string, {
    components: string[]; structural: string[]; raw: string[]; target?: string; stdout: string
  }> = {}

  const walk = async (): Promise<string[]> =>
    page.evaluate(() => {
      const tree = (window as never as { __app: { syncController: { currentTree: unknown } } })
        .__app.syncController.currentTree
      const seen = new Set<string>()
      const go = (n: unknown): void => {
        if (!n || typeof n !== 'object') return
        const node = n as { componentId?: string; children?: Record<string, unknown[]> }
        if (node.componentId) seen.add(node.componentId)
        for (const k of Object.keys(node.children ?? {})) for (const c of node.children![k] ?? []) go(c)
      }
      go(tree)
      return [...seen]
    })

  const sync = async (code: string): Promise<void> => {
    await page.evaluate(async (c) => {
      const app = window as never as {
        __app: { codeView: { setCode(c: string): void }; syncController: { syncCodeToBlocks(c: string): Promise<unknown> } }
      }
      app.__app.codeView.setCode(c)
      await app.__app.syncController.syncCodeToBlocks(c)
    }, code)
    await page.waitForTimeout(700)
  }

  let first = true
  let current: string | undefined
  for (const [name, spec] of Object.entries(specs)) {
    if (first) await freshApp(page)
    else { await freshApp(page); current = undefined }
    first = false
    if (spec.target && spec.target !== current) {
      await selectTarget(page, spec.target)
      await page.waitForTimeout(2500)
      current = spec.target
    }
    const blank = spec.target === 'python' ? 'pass' : 'int main() { return 0; }'
    await sync(blank)
    const before = (await walk()).sort().join(',')

    await sync(spec.code)
    const all = (await walk()).filter((x) => !x.endsWith(':program'))
    // 🔴 結構節點不是元件（`core/non-components.ts`）——真元件的身分都帶冒號
    const ids = all.filter((x) => x.includes(':'))
    const structural = all.filter((x) => !x.includes(':'))
    const after = ids.sort().join(',')

    expect(after, `🔴 ${name} 量到的與空程式相同 → 同步沒完成，這筆不算數`).not.toBe(before)
    expect(ids.length, `🔴 ${name} 量到 0 顆元件 → 解析器沒載入或同步失敗，這筆不算數`).toBeGreaterThan(0)

    let stdout = ''
    try {
      await page.locator('#run-btn').click()
      await page.waitForTimeout(2200)
      const rawOut = await page.locator('.console-output').innerText()
      stdout = rawOut.trim()
      if (stdout === '' && rawOut.length > 0) stdout = `(只有 ${rawOut.length} 個空白字元)`
    } catch { stdout = '(跑不起來)' }

    result[name] = { target: spec.target, stdout, components: ids.sort(), structural: structural.sort(), raw: ids.filter((x) => x.includes('raw_')) }
    console.log(`  ${name}  ${ids.length} 顆  輸出「${stdout.replace(/\n/g, '⏎').slice(0, 50)}」${result[name].raw.length ? '  🔴 有 raw_code' : ''}`)
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2))
  console.log(`\n✅ 寫出 ${Object.keys(result).length} 筆 → ${OUT}`)
})
