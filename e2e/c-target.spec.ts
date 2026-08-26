/**
 * **選 C 之後，畫面上真的是 C。**
 *
 * ## 🔴 它從哪來——而它抓到了測試沒抓到的東西
 *
 * 階段 6.10 第一刀把 `c-style-parity` 從 6/10 修到 10/10。**而開瀏覽器一看**：
 *
 * ```
 * #include <iostream>        🔴 C 裡沒有這個東西
 * using namespace std;       🔴 C 裡不合法
 * bool b = 1 == 2;           而 <stdbool.h> 沒補
 * printf("%d\n", b);         ✅ 只有這一行是對的
 * ```
 *
 * 根因：`cpp:program` 有**兩條產出路徑**——有鷹架的（UI 走）與 legacy 的
 * （測試走）。**第一版只改了 legacy。**
 *
 * > **一份只走得到其中一條路徑的測試，會讓另一條路徑的缺陷全綠通過。**
 *
 * ## 而第二刀（spec 136）加了「工具箱那一半」
 *
 * 第一刀兩筆目標**綁到同一個課程清單**，於是「選一次而不是三次」
 * **只兌現了三分之一**：產出換成 C 了，**而工具箱裡還是 `vector`／`string`**。
 *
 * ⚠️ **而這一半有一個空過的陷阱**：開機時 `enabledBranches` 只有根節點
 * （`app.ts`：`new Set([this.currentTopic.levelTree.id])`），
 * 而 **L0 那 19 顆一顆都不用排除**。
 *
 * ```
 * 不展開層級   選 C++ 時 C++ 專屬概念 = 0  →  選 C 之後也是 0  →  【什麼都沒證明】
 * 展開層級     選 C++ 時 C++ 專屬概念 > 0  →  選 C 之後是 0    →  🟢 證明了
 * ```
 *
 * → 所以「★ 入口條件」那一段**比結論重要**（`build-guardrail` 第 10 步：
 * 「測試通過之前，先證明它真的測到了東西」）。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測產出編不編得過**——那是 `c-style-parity`（它有參照編譯器）
 * - **不檢測 C++ 那一側的完整產出**——⚠️ 而「C++ 不得退步」由全套測試守著
 * - **只走一個樣本**——它守的是「兩條路徑都改到了」，不是覆蓋率
 */
import { test, expect, type Page } from '@playwright/test'
import { useAsSource } from './helpers'

/**
 * C++ 專屬、而 C 裡不存在的積木——選 C 之後這些都不該出現在工具箱裡。
 *
 * ⚠️ **比對的是積木上的中文標籤**，不是概念 id——因為工具箱裡看得到的就是那個。
 * 🔴 第一版寫 `/vector/i`／`/class/i`，**一個都不會命中**：
 * 積木上寫的是「建立 int 動態陣列」「定義類別」。
 * 而入口條件把它當成「功能壞了」報出來——**量測錯了，而症狀長得像缺陷。**
 */
const CPP_ONLY_BLOCK_TEXT: Array<[string, RegExp]> = [
  ['cpp:class_def', /定義類別/],
  ['cpp:method_virtual', /虛擬方法/],
  ['cpp:map_declare', /建立對照表/],
  ['cpp:stack_declare', /堆疊/],
  ['cpp:try_catch', /捕捉/],
  ['cpp:string_declare', /建立文字/],
]

async function ready(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { codeView?: { editor?: unknown } } }).__app?.codeView?.editor),
    undefined, { timeout: 30_000 },
  )
}

/** 選一個目標。回傳 `false` 代表**選單裡沒有它**。 */
/**
 * 依**標籤**選一個目標。
 *
 * ⚠️ 2026-08-25 起走的是**狀態列的 QuickPick**，不是 `<select>`。
 * 🔴 而這一支仍然依標籤配對（不是依 id）——它要驗的正是
 * 「選單裡**有沒有**『C 語言教學』這一項」，而那是標籤的問題。
 */
async function pickTarget(page: Page, label: RegExp): Promise<boolean> {
  await page.locator('#status-controls .status-item-btn[data-control-id="target"]').click()
  const row = page.locator('.quick-pick-item').filter({ hasText: label })
  if (await row.count() === 0) {
    await page.keyboard.press('Escape')
    return false
  }
  await row.first().click()
  await page.waitForTimeout(1500)
  return true
}

/**
 * 工具箱（含所有分類）裡出現的積木文字。
 *
 * ⚠️ **要讀 SVG 的 `<text>`，不是 `innerText`**——Blockly 的積木是 SVG，
 * 而 `innerText` 對 SVG 回傳空字串。
 * 🔴 第一版用 `innerText`，於是「C++ 側看得到 vector」量成 0
 * ——**而那看起來像功能壞了，不是量測壞了**。
 * 入口條件擋下了它（`build-guardrail` 第 9 步）。
 */
async function toolboxText(page: Page): Promise<string> {
  const cats = page.locator('.blocklyToolboxCategory')
  const n = await cats.count()
  let all = ''
  for (let i = 0; i < n; i++) {
    await cats.nth(i).click()
    await page.waitForTimeout(150)
    all += ' ' + (await page.locator('.blocklyFlyout text, .blocklyToolboxFlyout text').allTextContents()).join(' ')
  }
  return all
}

test('★ 選 C 目標 → 產出是乾淨的 C（而不是換了 printf 的 C++）', async ({ page }) => {
  await ready(page)

  await page.evaluate(() =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } })
      .__app.codeView.setCode('int main(){ bool b = 1 == 2; cout << b << endl; return 0; }'))
  await useAsSource(page, '程式碼')
  await page.waitForTimeout(900)

  // ★ 入口條件：C 目標**選得到**（合成量——2026-08-17 才接上選單）
  expect(
    await pickTarget(page, /C 語言教學/),
    '🔴 選單裡沒有「C 語言教學」——目標在 2026-08-17 之前只活在測試裡',
  ).toBe(true)

  const code = await page.evaluate(() =>
    (window as never as { __app: { codeView: { getCode(): string } } }).__app.codeView.getCode())

  // 🔴 C 裡【不存在】的東西——那不是「換個名字」，是那個東西沒有
  expect(code, '🔴 C 產出含 <iostream>——而 C 裡沒有這個標頭').not.toContain('iostream')
  expect(code, '🔴 C 產出含 using namespace std——C 裡不合法').not.toContain('using namespace')
  expect(code, '🔴 C 產出含 cout').not.toContain('cout')

  // ✅ C 需要而 C++ 不需要的
  expect(code, 'C99 的 bool 要 <stdbool.h>').toContain('stdbool.h')
  expect(code, 'printf 要 <stdio.h>').toContain('stdio.h')
  expect(code).toContain('printf')
})

/**
 * 使用者**自己寫**的 `#include <iostream>`，在 C 目標下也要換掉。
 *
 * ## ⚠️ 這一支第一次跑就是綠的，而那個理由值得記
 *
 * 它的來歷是一次**誤診**：2026-08-17 開瀏覽器看到選 C 之後產出仍是
 * `#include <iostream>`，我判定「顯式的 `cpp:include` 節點走元件自己的
 * `generate`，而那裡沒問過風格」，並且改了 `include/generate.ts`。
 *
 * 🔴 **而在 build 上重現不出來**——`header` 屬性本身就已經被改寫成
 * `stdio.h`，那顆元件的 `generate` 從來沒看到過 `iostream`。
 * 全新啟動的 dev server 也一樣。**那個 `<iostream>` 來自一個開了很久、
 * HMR 沒跟上的 dev server。** 修正因此被還原（它是死碼）。
 *
 * > **一個開著沒關的 dev server，會讓「開瀏覽器實測」測到一個不存在的世界。**
 *
 * ⚠️ 而這一支**留著**：它釘的是一條真的契約（使用者寫的 `iostream`
 * 在 C 目標下要變成 `stdio.h`），只是那條契約**本輪之前就成立了**。
 * 🔴 **不要把它讀成「本輪修好的東西」。**
 */
test('★ 使用者自己寫的 #include，在 C 目標下也要換掉', async ({ page }) => {
  await ready(page)

  await page.evaluate(() =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } })
      .__app.codeView.setCode('#include <iostream>\nint main(){ int n = 3; cout << n << endl; return 0; }'))
  await useAsSource(page, '程式碼')
  await page.waitForTimeout(1200)

  expect(await pickTarget(page, /C 語言教學/), '🔴 選單裡沒有「C 語言教學」').toBe(true)
  await useAsSource(page, '積木')
  await page.waitForTimeout(1200)

  const code = await page.evaluate(() =>
    (window as never as { __app: { codeView: { getCode(): string } } }).__app.codeView.getCode())

  expect(code, '🔴 使用者寫的 <iostream> 沒有被換掉——C 裡沒有這個標頭').not.toContain('iostream')
  expect(code, 'I/O 那個等價類在 C 那一側的成員是 <stdio.h>').toContain('stdio.h')
})

test('★ 選 C 目標 → 工具箱裡拿不到 C 沒有的東西', async ({ page }) => {
  await ready(page)

  // 🔴 展開全部層級——不展開的話下面那個 0 在功能做出來之前就成立了（見檔頭）
  await page.evaluate(() => {
    const app = window as never as {
      __app: {
        currentTopic: { levelTree: unknown }
        enabledBranches: Set<string>
        reloadBlockSpecsForTopic(): void
        updateToolbox(): void
      }
    }
    const all = new Set<string>()
    const walk = (n: { id: string; children: unknown[] }): void => {
      all.add(n.id)
      for (const k of n.children) walk(k as { id: string; children: unknown[] })
    }
    walk(app.__app.currentTopic.levelTree as { id: string; children: unknown[] })
    app.__app.enabledBranches = all
    app.__app.reloadBlockSpecsForTopic()
    app.__app.updateToolbox()
  })
  await page.waitForTimeout(600)

  // ★ 入口條件：展開之後，C++ 那一側【真的看得到】這些東西
  const cppSide = await toolboxText(page)
  const visibleInCpp = CPP_ONLY_BLOCK_TEXT.filter(([, re]) => re.test(cppSide)).map(([id]) => id)
  expect(
    visibleInCpp.length,
    '🔴 展開全部層級之後，C++ 工具箱裡一個 C++ 專屬積木都看不到 → ' +
      '層級沒有真的展開，或工具箱沒重建。**下一段的「0」什麼都沒證明。**',
  ).toBeGreaterThan(0)

  expect(await pickTarget(page, /C 語言教學/), '🔴 選單裡沒有「C 語言教學」').toBe(true)

  const cSide = await toolboxText(page)
  const leaked = CPP_ONLY_BLOCK_TEXT.filter(([, re]) => re.test(cSide)).map(([id]) => id)
  expect(
    leaked,
    '🔴 選了 C 之後，工具箱裡仍然拿得到 C 裡不存在的東西——' +
      '「選一次而不是三次」只兌現了風格那一次。',
  ).toEqual([])
})

test('★ 選擇器沒有變多——目標是把三次收成一次，不是多加一個下拉', async ({ page }) => {
  await ready(page)
  // 反目標（SC-009）：目標若是**多**一個選擇器，它就沒有收攏任何東西。
  // ⚠️ 2026-08-25 起它們是**狀態列的項目**，不是工具列的 `<select>`
  //    ——量的東西換了位置，而**要守的那條規則沒變**。
  //
  // 🔴 **而它 2026-08-26 改寫過一次，因為它錨錯了**（`build-guardrail`：
  //    「一個數字因為做對事而必須上調時，它混了兩個母體」）。
  //
  //    舊寫法是「狀態列的控制項 ≤ 5」。那個數字混了兩件事：
  //
  //    ```
  //    🔴 這一刀有沒有多加一個【語言／板子】的選擇器   ← 反目標真正在問的
  //    ⚪ 狀態列總共有幾個控制項                        ← 一個會隨【任何】新功能上升的量
  //    ```
  //
  //    當天加「版面」picker（一個與目標無關的功能）時它就紅了，
  //    而下調它的人每一次都會做出同一個正確的判斷——**那個錨會一直爛**。
  //
  // → 改成**指名**：那三個被收攏掉的選擇器不得回來。
  //   ⚠️ 這條在「有人真的把語言選擇器加回來」時仍然會紅，而它不再因為
  //   別的功能加一顆按鈕而紅。
  const labels = await page.locator('#status-controls .status-item-btn').allTextContents()
  const resurrected = labels.filter((t) =>
    /^\s*(語言|Language)\s*$/.test(t) || /^\s*(板子|Board)\s*$/.test(t) || /^\s*(教學層級|Level)\s*$/.test(t))
  expect(
    resurrected,
    `🔴 被收攏掉的選擇器又出現在狀態列上：${resurrected.join('、')}\n` +
      '「選一次而不是三次」是這一刀的反目標——多一個選擇器就等於沒有收攏任何東西。',
  ).toEqual([])
})

test('★ 重新整理之後，選的目標還在', async ({ page }) => {
  await ready(page)
  expect(await pickTarget(page, /C 語言教學/)).toBe(true)
  await page.waitForTimeout(1200)

  await page.reload()
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { codeView?: { editor?: unknown } } }).__app?.codeView?.editor),
    undefined, { timeout: 30_000 },
  )
  await page.waitForTimeout(1500)

  // ⚠️ 2026-08-25：目標不再是一顆 `<select>`——它是**狀態列上的一個項目**，
  //    而項目的文字就是目前的值。要驗的那件事沒變：**重新整理之後它還在**。
  const selected = await page.locator('#status-controls .status-item-btn[data-control-id="target"]').textContent()
  expect(selected ?? '', '🔴 重新整理之後目標跑掉了——存檔沒記住 targetId').toMatch(/C 語言教學/)
})
