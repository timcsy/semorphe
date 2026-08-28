/**
 * **每一個語言都要把一段最簡單的程式 lift 成一棵非空的樹。**
 *
 * ## 它從哪來
 *
 * 2026-08-27 生 Python 教案時量到的：**六段 Python 全部量到 0 顆元件**。
 *
 * ```
 * print(1)  →  { componentId: "python:program", children: { body: [] } }
 *              主控台：Parse error: TypeError: Cannot read properties of undefined (reading 'verdict')
 * ```
 *
 * 根因在**組裝點的一條樂觀簽章**：
 *
 * ```
 * app.ts        languagePack('python')?.styleExceptions?.analyzeIo(...)  → undefined
 *               ↑ 而介面宣告的是「一定回傳 StyleConformance」，靠 `as never` 蓋過型別檢查
 * sync-ctrl     result.verdict                                           → 💥 整個 parse 中止
 * ```
 *
 * Python 套件**根本沒有 `styleExceptions`**——那是 C++ 才有的概念
 * （printf ↔ cout）。而崩潰之後畫面上**看起來只是「這段程式沒有積木」**。
 *
 * > **一個用 `as never` 蓋過去的樂觀簽章，會把「這個語言沒有這件事」
 * > 變成一次執行期崩潰——而崩潰的地方離原因很遠。**
 *
 * 🔴 **5890 支單元測試全綠**，而使用者切到 Python 之後整個編輯器不會動。
 * 單元測試驗的是各語言的 lifter，**沒有人驗那條組裝起來的路**。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果掃到的語言少於 2 個，這支什麼都沒驗——不是「每個語言都好」。**
 *
 * 錨在**語言數**（合成量），不是「壞掉的語言數」——後者正是要推向零的。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測 lift 得對不對**——只問「有沒有東西」。對不對是各語言的膠囊測試在管。
 * - **不檢測執行**——那是 `lessons.spec.ts` 的事。
 * - **不檢測每一顆元件都 lift 得出來**——這裡只餵一段最簡單的程式。
 */
import { test, expect } from '@playwright/test'
import { freshApp, selectTarget, useAsSource } from './helpers'

/** 每個語言一段**最簡單而一定有東西**的程式 */
const CASES = [
  { target: 'cpp', language: 'cpp', code: 'int main() {\n    cout << 1 << endl;\n    return 0;\n}' },
  { target: 'python', language: 'python', code: 'print(1)' },
]

test('★ 入口條件——真的有兩個以上的語言在驗', () => {
  const langs = new Set(CASES.map((c) => c.language))
  expect(langs.size, '🔴 只驗了一個語言 → 這支抓不到「某個語言的路斷了」').toBeGreaterThanOrEqual(2)
})

for (const c of CASES) {
  test(`★ ${c.language}：一段最簡單的程式要 lift 成非空的樹`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))

    await freshApp(page)
    await selectTarget(page, c.target)
    // ⚠️ 解析器是懶載入的——等不夠的話樹是空的，而**空樹與這支要抓的缺陷長得一模一樣**
    await page.waitForTimeout(3000)

    expect(
      await page.evaluate(() =>
        (window as never as { __app: { currentTopic: { language: string } } }).__app.currentTopic.language),
      '🔴 目標沒切過去 → 下面驗的是別的語言',
    ).toBe(c.language)

    await page.evaluate((code) =>
      (window as never as { __app: { codeView: { setCode(c: string): void } } })
        .__app.codeView.setCode(code), c.code)
    await useAsSource(page, '程式碼')
    await page.waitForTimeout(2500)

    const n = await page.evaluate(() => {
      const t = (window as never as { __app: { syncController: { currentTree: unknown } } })
        .__app.syncController.currentTree as { children?: Record<string, unknown[]> }
      return Object.values(t?.children ?? {}).reduce((a, v) => a + (v?.length ?? 0), 0)
    })

    expect(
      n,
      `🔴 ${c.language} 的程式碼 lift 出一棵【空的】樹——` +
        `而畫面上看起來只是「這段程式沒有積木」。\n` +
        `主控台：${errors.slice(0, 3).join(' || ') || '(乾淨)'}`,
    ).toBeGreaterThan(0)

    expect(
      errors.filter((e) => /Parse error|TypeError|undefined/.test(e)),
      `🔴 ${c.language} 同步時主控台有錯——就算樹不是空的，那也是一次被吞掉的崩潰`,
    ).toEqual([])
  })
}
