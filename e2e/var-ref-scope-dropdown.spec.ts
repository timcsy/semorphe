/**
 * spec 149：**`cpp:var_ref` 的下拉 ＝ 工作區變數 ∪ 這塊板子的常數。**
 *
 * ## 🔴 為什麼是 e2e
 *
 * 這一刀量的是「**學生點開下拉看到什麼**」——而它要走完
 * `貼上程式碼 → lift → 積木 → 下拉 → 目前的目標`。
 * ⚠️ 而 `experience`：「**一個修好的投影，可能不在使用者走的那條路上**」
 * ——spec 148 就是這樣被照出來只做了一半。所以這裡**從貼程式碼開始**。
 *
 * ## ⚠️ 能力邊界
 *
 * ```
 * 這支擋得住   常數沒進來、寫入目標被汙染、同名重複、沒有板子的目標被波及
 * 這支擋不住   下拉的排版與捲動（那是渲染）
 * ```
 */
import { test, expect, type Page } from '@playwright/test'
import { freshApp } from './helpers'

async function selectTarget(page: Page, id: string): Promise<void> {
  const sel = page.locator('select.topic-dropdown')
  await sel.selectOption(id)
  await expect(sel).toHaveValue(id)
}

/** 貼一段真的程式碼進去（走使用者那條路，不是 `newBlock`）。 */
async function pasteCode(page: Page, code: string): Promise<void> {
  await page.evaluate(async (c) => { await navigator.clipboard.writeText(c) }, code)
  await page.getByRole('button', { name: /覆蓋貼上/ }).click()
  await expect
    .poll(() => page.evaluate(() =>
      /* eslint-disable @typescript-eslint/no-explicit-any */
      ((window as any).__app?.blocklyPanel?.workspace?.getAllBlocks(false)?.length ?? 0)))
    .toBeGreaterThan(1)
}

/** 某一型積木的 `NAME` 下拉此刻列了什麼。 */
async function optionsOf(page: Page, blockType: string): Promise<string[]> {
  return page.evaluate((t) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const ws = (window as any).__app.blocklyPanel.workspace
    const b = ws.getAllBlocks(false).find((x: any) => x.type === t)
    if (!b) throw new Error(`工作區裡沒有 ${t}`)
    return b.getField('NAME').getOptions(false).map((o: string[]) => o[1]) as string[]
  }, blockType)
}

// ⚠️ **貼上那條路需要剪貼簿權限**——而它正是使用者真的走的那條。
//    （第一版沒給，四支全部倒在 `Write permission denied`。）
test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test.describe('spec 149 · 名字的範圍', () => {
  test('🔴 貼上 `pinMode(D1, OUTPUT)` 之後，D1 選得到', async ({ page }) => {
    await freshApp(page)
    await selectTarget(page, 'wemos-d1-mini')
    await pasteCode(page, 'void setup() {\n  int speed = 3;\n  pinMode(D1, OUTPUT);\n}\n\nvoid loop() {\n}\n')

    const opts = await optionsOf(page, 'cpp_var_ref')
    // ★ 錨點：學生自己的變數還在（否則這一刀是把一段換成另一段，不是補上）
    expect(opts, '學生自己宣告的 speed 不見了').toContain('speed')
    expect(opts, 'D1 mini 的 D1 沒有進來').toContain('D1')
    expect(opts, 'D0 沒有進來').toContain('D0')
    expect(opts, 'HIGH 沒有進來').toContain('HIGH')
    // 🔴 變數在前——它們是學生自己的
    expect(opts.indexOf('speed'), '常數排到學生自己的變數前面了').toBeLessThan(opts.indexOf('D1'))
  })

  test('🔴 使用者自己的宣告要贏——同名只出現一次', async ({ page }) => {
    await freshApp(page)
    await selectTarget(page, 'wemos-d1-mini')
    await pasteCode(page,
      'void setup() {\n  int D1 = 7;\n  D1 = 5;\n  pinMode(D1, OUTPUT);\n}\n\nvoid loop() {\n}\n')

    // ★ 錨點：先證明【變數那一側真的也提供 D1】——否則「只出現一次」
    //   可能只是因為變數那側根本沒認出它，而去重從來沒被執行到。
    //   （第一版就少了這個錨點，把去重拿掉之後測試照樣綠。）
    expect(await optionsOf(page, 'cpp_var_assign'), '變數那側沒認出 D1，這條測不到去重')
      .toContain('D1')

    const opts = await optionsOf(page, 'cpp_var_ref')
    // > 一個名字的意思由誰宣告它決定——而下拉不得讓同一個名字看起來有兩個意思。
    expect(opts.filter((o) => o === 'D1').length, 'D1 出現了不只一次').toBe(1)
  })

  test('🔴 寫入目標那些欄位一個常數都不得多', async ({ page }) => {
    await freshApp(page)
    await selectTarget(page, 'wemos-d1-mini')
    await pasteCode(page, 'void setup() {\n  int speed = 3;\n  speed = 5;\n}\n\nvoid loop() {\n}\n')
    // `cpp_var_assign` 問的是「把【哪個變數】設成…」——`HIGH = 5` 不合法
    const opts = await optionsOf(page, 'cpp_var_assign')
    expect(opts, '寫入目標的下拉長出了常數').not.toContain('HIGH')
    expect(opts, '寫入目標的下拉長出了板子常數').not.toContain('D1')
    // ★ 錨點：而它仍然列得出學生的變數
    expect(opts).toContain('speed')
  })

  test('🔴 沒有板子的目標，與今天逐字相同', async ({ page }) => {
    await freshApp(page)
    await selectTarget(page, 'cpp')
    await pasteCode(page, 'int main() {\n  int x = 1;\n  cout << x << endl;\n  return 0;\n}\n')
    const opts = await optionsOf(page, 'cpp_var_ref')
    expect(opts, '沒有板子的目標長出了板子常數').not.toContain('HIGH')
    expect(opts).toContain('x')
  })

  test('🔴 24 顆宣告元件的名字要進得來——那個分支曾經【永遠是 false】', async ({ page }) => {
    // `getWorkspaceVarOptions` 原本寫 `abstractComponentOf(block.type)`，
    // 而那支函式的鍵是**概念身分**（冒號），`block.type` 是**積木型別**（底線）
    // ——於是 `vector`／`string`／`pin_attach`… 一顆都沒進下拉，而且**不會拋錯**。
    await freshApp(page)
    await selectTarget(page, 'cpp')
    await pasteCode(page,
      'int main() {\n  vector<int> nums;\n  string label;\n  int plain = 1;\n  cout << plain << endl;\n  return 0;\n}\n')
    const opts = await optionsOf(page, 'cpp_var_ref')
    // ★ 錨點：一般的 int 宣告本來就進得來——它證明掃描器有在跑
    expect(opts, '連一般宣告都沒進來，那是掃描器整個沒跑').toContain('plain')
    expect(opts, 'vector 宣告的名字沒進下拉').toContain('nums')
    expect(opts, 'string 宣告的名字沒進下拉').toContain('label')
  })
})
