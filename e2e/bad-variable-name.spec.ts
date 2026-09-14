/**
 * **打一個不能當名字的字，工具要說話。**
 *
 * ## 它從哪來
 *
 * 使用者 2026-09-14 轉述：
 *
 * > 「學生的變數名稱會寫成數字，Semorphe **竟然還可以接受**，
 * > 這應該是一個整體變數命名的問題」
 *
 * 實測當時（把宣告積木的名字欄改成 `123`）：
 *
 * ```
 * 產出的程式碼   int 123 = 16;
 * 主控台錯誤     none
 * 畫面上的標記   0
 * ```
 *
 * ⚠️ 而第 3 課「變數」**整整一節在教「哪些名字編譯器不准」**。
 *
 * > **一個教「這樣不行」的工具，如果它自己收下了那樣東西，
 * > 它教的不是規則，是「規則沒有人在管」。**
 *
 * ## ⚠️ 這一支為什麼非得是 e2e
 *
 * 判斷本身有單元測試（`tests/unit/core/identifier-check.ts`）。
 * 而**「學生看不看得到」只有真的工作區答得出來**——
 * 判斷對了而警告沒畫出來，症狀與完全沒做一模一樣。
 */
import { test, expect } from '@playwright/test'
import { useAsSource, treeReady } from './helpers'

const PROGRAM = '#include <iostream>\nusing namespace std;\n'
  + 'int main() {\n    int age = 16;\n    cout << age << endl;\n    return 0;\n}'

async function rename(page: import('@playwright/test').Page, to: string): Promise<void> {
  await page.evaluate((v) => {
    const ws = (window as never as Record<string, any>).__app.blocklyPanel.workspace
    const b = ws.getAllBlocks(false).find((x: any) => x.type === 'cpp_var_declare')
    const f = b?.inputList?.flatMap((i: any) => i.fieldRow).find((x: any) => /NAME/.test(x?.name ?? ''))
    f?.setValue(v)
  }, to)
  await page.waitForTimeout(1800)
}

/** 畫面上的警告：幾顆、寫什麼 */
const warnings = (page: import('@playwright/test').Page): Promise<string[]> =>
  page.evaluate(() => {
    const ws = (window as never as Record<string, any>).__app.blocklyPanel.workspace
    const out: string[] = []
    for (const b of ws.getAllBlocks(false)) {
      for (const ic of (b.getIcons?.() ?? [])) {
        const t = ic.getText?.() ?? ''
        if (t) out.push(t)
      }
    }
    return out
  })

test('🔴 不能當名字的字，畫面上要說得出為什麼', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 30_000 })
  await page.evaluate((c) => (window as never as Record<string, any>).__app.codeView.setCode(c), PROGRAM)
  await useAsSource(page, '程式碼')
  await treeReady(page)
  await page.waitForTimeout(1200)

  // ★ 對照組——合法的名字**一句話都不該說**
  await rename(page, 'age')
  expect(await warnings(page), '🔴 合法的名字被報了 → 學生每打一個字都會看到紅的').toEqual([])

  // 🔴 三種不合法，而**理由要分得出來**
  await rename(page, '123')
  expect((await warnings(page)).join(''), '🔴 數字開頭沒被說出來').toContain('數字開頭')

  await rename(page, 'int')
  expect((await warnings(page)).join(''), '🔴 保留字沒被說出來').toContain('不能拿來當名字')

  await rename(page, 'my name')
  expect((await warnings(page)).join(''), '🔴 有空白沒被說出來').toContain('底線')

  // 🔴 **而它要擋下執行**（使用者 2026-09-14 拍板：「變數名稱不合格應該要不能執行才對」）
  await rename(page, '123')
  await page.locator('#run-btn').click()
  await page.waitForTimeout(2500)
  const out = (await page.locator('.console-output').innerText())
  expect(out, '🔴 名字不合法卻照跑了——一個會執行的錯誤程式，教的是「這裡沒有錯」')
    .toContain('名字不能用')
  // ⚠️ 而理由要對：他的語法是完整的，說「語法還不完整」會讓他去找錯的地方
  expect(out, '🔴 拒絕的理由說成語法問題了').not.toContain('語法還不完整')

  // ★ 改回合法的 → 警告要消失，而且跑得動
  await rename(page, 'age')
  expect(await warnings(page), '🔴 改回合法之後警告沒消——那比不報還糟').toEqual([])
  await page.locator('#run-btn').click()
  await page.waitForTimeout(2500)
  expect(await page.locator('.console-output').innerText(),
    '🔴 改好了還是被擋——那比一開始就擋更糟').toContain('16')
})
