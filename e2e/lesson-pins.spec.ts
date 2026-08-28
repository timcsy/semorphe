/**
 * **選了一堂課，被釘住的控制項要【消失】，工具箱要只剩那幾顆。**
 *
 * ## 它從哪來
 *
 * `principles.md:97`（P4 漸進揭露的修訂條①）：
 *
 * > 「一個過濾機制若沒有附帶『條件從哪來』，它把認知負荷搬家而不是減少。
 * >  **而那個來源今天缺的是教材**」
 *
 * 使用者 2026-08-12：「我會乾脆叫學生把全部都打勾，**那有沒有這個漸進揭露是沒用的**」。
 *
 * ## 🔴 為什麼是「消失」不是「變灰」
 *
 * ```
 * 變灰   「這裡有一個你不能碰的東西」→ 仍然是負擔，而且它在嘲笑你
 * 消失   這一堂課裡，那不是一個問題
 * ```
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果「沒有 `?lesson`」那一支量到的控制項少於 2 顆，
 * > 代表頁面沒開起來——這份報表不算數，不是「控制項都消失了」。**
 *
 * 錨在**沒有選課時看得到幾顆**（合成量，而清理不會讓它變小）。
 * 🔴 刻意不錨在「還沒消失的顆數」——那正是要推向零的。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測課文**——這一刀只讀宣告。
 * - **不逐堂檢測**——65 堂的載入由 `audit-lesson-loadable` 守（那是靜態的、便宜的）；
 *   這裡只挑三堂**跨語言**的驗那條路真的通。
 */
import { test, expect } from '@playwright/test'
import { freshApp, useAsSource } from './helpers'

/** 三堂跨語言的——證明這條路不是只對 C++ 通 */
const CASES = [
  {
    id: 'cpp-beginner/01-印出一句話', target: 'cpp', language: 'cpp', want: 6,
    // ⚠️ 探針**刻意帶著鷹架**（`#include`／`using namespace`）——
    //    那正是「被打暗」那條要驗的東西。
    probe: '#include <iostream>\nusing namespace std;\nint main() {\n    cout << "hi" << endl;\n    return 0;\n}',
  },
  {
    id: 'python-beginner/01-印出一句話', target: 'python', language: 'python', want: 2,
    probe: 'print("hi")',
  },
  {
    id: 'arduino/01-閃一顆燈', target: 'arduino-uno', language: 'cpp', want: 6,
    probe: 'void setup() {\n    pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n    digitalWrite(LED_BUILTIN, HIGH);\n    delay(1000);\n}',
  },
]

const toolboxIds = async (page: import('@playwright/test').Page): Promise<string[]> =>
  page.evaluate(() => {
    const ws = (window as never as { __app: { blocklyPanel: { workspace: unknown } } })
      .__app.blocklyPanel.workspace as { getToolbox(): { getToolboxItems(): unknown[] } | null }
    const out: string[] = []
    const walk = (items: unknown[]): void => {
      for (const it of items) {
        const i = it as { getChildToolboxItems?(): unknown[]; toolboxItemDef_?: { contents?: { type?: string }[] } }
        for (const c of i.toolboxItemDef_?.contents ?? []) if (c.type) out.push(c.type)
        if (i.getChildToolboxItems) walk(i.getChildToolboxItems())
      }
    }
    walk(ws.getToolbox()?.getToolboxItems() ?? [])
    return [...new Set(out)]
  })

test('★ 入口條件 ＋ 回歸閘：沒有 `?lesson` 時與今天逐字相同', async ({ page }) => {
  await freshApp(page)
  // ⚠️ `freshApp` 等的是 Blockly 畫完，**而控制項是之後才送出的**
  //    ——直接數的話會量到 0，而症狀是「頁面沒開起來」。
  //    2026-08-28 注入時它假紅過一次，那是這一行的來源。
  await expect(page.locator('#status-controls .status-item-btn').first()).toBeVisible({ timeout: 20_000 })
  const controls = await page.locator('#status-controls .status-item-btn').count()
  // ⚠️ 錨在**沒選課時看得到幾顆**——這個數字不會因為「消失」做對了而變小
  expect(controls, '🔴 狀態列上一顆控制項都沒有 → 頁面沒開起來，下面在測空集合')
    .toBeGreaterThanOrEqual(2)
  await expect(
    page.locator('#status-controls .status-item-btn[data-control-id="target"]'),
    '🔴 沒有選課時 `target` 必須在——否則「消失」那條驗的是一個本來就不在的東西',
  ).toHaveCount(1)
  // ⚠️ 門檻刻意壓在遠低於實際值（實測 20 種）——它只擋「頁面沒開起來」，
  //    **不擋任何正常的增減**。設在實際值旁邊的話，工具箱少一顆就會紅，
  //    而那不是這一條要抓的東西。
  // 🪦 **沒有選課時它也不該在**——它已整個退場（不是「有課才藏」）
  await expect(
    page.locator('#status-controls .status-item-btn[data-control-id="branches"]'),
    '🔴 「教學層級」又長回來了',
  ).toHaveCount(0)
  expect((await toolboxIds(page)).length, '🔴 沒有選課時工具箱是空的').toBeGreaterThanOrEqual(10)
})

test('★ 三層選得到課——目標 → 課程 → 章節', async ({ page }) => {
  // 🔴 使用者 2026-08-28 兩次推動這個形狀：
  //    ①「**課程要去哪裡找？**」——在此之前唯一的入口是手動打 `?lesson=`
  //    ②「**課程可以再拆分成課程和章節，目標可以更單純一些**」
  //
  // ```
  // 目標   語言／板子   C++ · C · Python · Arduino Uno · ESP32…
  // 課程   軌道         C++ 入門 · C++ 進階 · Python 入門 · Arduino 專題…
  // 章節   課           01 印出一句話 · 02 記住資料…
  // ```
  await freshApp(page)
  await expect(page.locator('#status-controls .status-item-btn').first()).toBeVisible({ timeout: 20_000 })

  await expect(
    page.locator('.status-item-btn[data-control-id="track"]'),
    '🔴 狀態列上沒有「課程」——那沒有人找得到課',
  ).toHaveText('選擇課程')

  // 🔴 **「章節」與「範例」佔同一格，不同時出現**（2026-08-28）。
  //    那一格問的是同一件事——「我從什麼開始」——只是有課的時候由課回答。
  await expect(
    page.locator('.status-item-btn[data-control-id="template"]'),
    '🔴 沒選課程時該有「範例」那一顆——否則那一格是空的，而它其實有一個隱形的預設',
  ).toHaveCount(1)
  await expect(
    page.locator('.status-item-btn[data-control-id="lesson"]'),
    '🔴 沒選課程時不該有「章節」——它與「範例」佔同一格',
  ).toHaveCount(0)

  // 🔴 **目標選單只剩語言與板子**——`C++ 進階` 與「不指定板子的 Arduino」
  //    改成 `listed: false`，只由課程進得去。
  await page.locator('.status-item-btn[data-control-id="target"]').click()
  const targetRows = await page.$$eval('.quick-pick-item', (e) => e.map((x) => x.textContent ?? ''))
  expect(
    targetRows.filter((r) => /進階|不指定板子/.test(r)),
    '🔴 目標選單裡還有軌道或陷阱——它們該只由課程進得去',
  ).toEqual([])
  // ⚠️ 錨在**目標選單有幾項**（合成量）——它不會因為任何缺陷被修好而變小
  expect(targetRows.length, '🔴 目標選單是空的').toBeGreaterThanOrEqual(5)
  await expect(
    page.locator('.quick-pick-group'),
    '🔴 目標選單沒有分組——13 項平清單混著兩個不同的軸',
  ).toHaveCount(2)
  await page.keyboard.press('Escape')

  // 選一條軌道 → **自動落在第一章**
  await page.locator('.status-item-btn[data-control-id="track"]').click()
  await page.locator('.quick-pick-item[data-value="cpp-advanced"]').click()
  await page.waitForTimeout(3000)
  await expect(
    page.locator('.status-item-btn[data-control-id="track"]'),
    '🔴 選了軌道而「課程」沒跟上',
  ).toHaveText('C++ 進階')
  await expect(
    page.locator('.status-item-btn[data-control-id="lesson"]'),
    '🔴 選了軌道而沒有落在第一章——一個「選了課程卻沒有章節」的狀態，' +
      '畫面上與「還沒選」分不出來',
  ).toHaveText('預備')
  await expect(
    page.locator('.status-item-btn[data-control-id="template"]'),
    '🔴 選了課程而「範例」還在——那一格該由課回答了',
  ).toHaveCount(0)
  await expect(
    page.locator('.status-item-btn[data-control-id="template"]'),
    '🔴 選了課程而「範例」還在——那一格該由課回答了',
  ).toHaveCount(0)
  // 🔴 **目標與課程各說一件事，不重複**
  await expect(
    page.locator('.status-item-btn[data-control-id="target"]'),
    '🔴 目標那一格重複了軌道的名字——兩格該各說一件事',
  ).toHaveText('C++')

  // 章節選單只列這條軌道的
  await page.locator('.status-item-btn[data-control-id="lesson"]').click()
  const chapters = await page.$$eval('.quick-pick-item', (e) => e.map((x) => x.textContent ?? ''))
  expect(chapters.length, '🔴 章節選單是空的').toBeGreaterThanOrEqual(5)
  expect(
    chapters.filter((c) => /印出一句話|閃一顆燈/.test(c)),
    '🔴 章節選單列到別條軌道的課了',
  ).toEqual([])
  await page.keyboard.press('Escape')

  // 🔴 換目標要退出課程——課的清單是跟著目標走的
  await page.locator('.status-item-btn[data-control-id="target"]').click()
  await page.locator('.quick-pick-item[data-value="python"]').click()
  await page.waitForTimeout(3000)
  await expect(
    page.locator('.status-item-btn[data-control-id="track"]'),
    '🔴 換了目標而課程還留著——那條軌道不屬於這個目標',
  ).toHaveText('選擇課程')
})

for (const c of CASES) {
  test(`★ ${c.id}：釘住的控制項消失、工具箱只剩宣告的那幾顆`, async ({ page }) => {
    await freshApp(page)
    await page.goto(`/?lesson=${encodeURIComponent(c.id)}`)
    await page.waitForFunction(
      () => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
      undefined, { timeout: 30_000 })
    await page.waitForTimeout(2500)
    // 同上——控制項送出來之前，「它消失了」與「它還沒出現」分不開
    await expect(page.locator('#status-controls .status-item-btn').first()).toBeVisible({ timeout: 20_000 })

    // ① 目標真的被釘過去了
    expect(
      await page.evaluate(() =>
        (window as never as { __app: { currentTarget: { id: string } } }).__app.currentTarget.id),
      `🔴 ${c.id} 沒有把目標釘成 ${c.target}`,
    ).toBe(c.target)

    // ② 🔴 **目標要留著，而且顯示的是課釘的那一個**
    //
    //    🪦 第一版讓它**消失**（照 `draft/教案是一個宣告` 的
    //    「釘住的控制項應該消失」），而使用者選了一堂課之後說：
    //    「**我發現選了課程之後目標就不見了**」。
    //
    //    兩個毛病：他自己拍板的順序是「先選目標再選課程」，而目標消失之後
    //    那句話只成立一次；而且畫面上剩「樹上走訪」，**它沒說自己是哪一軌的**。
    //
    //    > **「這個選項已經被替你決定了」與「你看不到它是什麼」是兩件事，
    //    > 而藏起來同時做了兩件。**
    await expect(
      page.locator('#status-controls .status-item-btn[data-control-id="target"]'),
      `🔴 ${c.id} 選了課而目標那顆不見了——使用者就看不出自己在哪一軌`,
    ).toHaveCount(1)

    // ③ 🪦 **「教學層級」整個退場了**——不管有沒有選課都不該在
    await expect(
      page.locator('#status-controls .status-item-btn[data-control-id="branches"]'),
      `🔴 「教學層級」又長回來了——它已於 2026-08-28 退場`,
    ).toHaveCount(0)

    // ④ 🔴 **一顆積木都不該被打暗**
    //
    //    使用者 2026-08-28 看著畫面問「**為何積木變這麼暗？**」——
    //    根因是課的可見集合把**系統自己產的鷹架**（`#include`／
    //    `using namespace std;`／main 的 `return`）也濾掉了，
    //    於是 `markOutOfScopeBlocks` 把它們打成 0.35 透明。
    //
    //    > **畫面在對學生說「這顆不該在這裡」，而那顆是工具自己放的。**
    await page.evaluate((code) =>
      (window as never as { __app: { codeView: { setCode(c: string): void } } })
        .__app.codeView.setCode(code), c.probe)
    await useAsSource(page, '程式碼')
    await page.waitForTimeout(2500)
    const dimmed = await page.evaluate(() => {
      const ws = (window as never as { __app: { blocklyPanel: { workspace: { getAllBlocks(b: boolean): unknown[] } } } })
        .__app.blocklyPanel.workspace
      return ws.getAllBlocks(false)
        .map((b) => b as { type: string; getSvgRoot?(): SVGElement })
        .filter((b) => b.getSvgRoot?.()?.style.opacity)
        .map((b) => b.type)
    })
    expect(
      dimmed,
      `🔴 ${c.id} 的畫布上有積木被打暗——而那多半是系統自己產的鷹架`,
    ).toEqual([])

    // ⑤ 工具箱只剩宣告的那幾顆
    const ids = await toolboxIds(page)
    expect(ids.length, `🔴 ${c.id} 的工具箱是空的——那與「這堂課就是這麼小」長得一樣`)
      .toBeGreaterThan(0)
    expect(
      ids.length,
      `🔴 ${c.id} 宣告了 ${c.want} 顆元件，而工具箱給了 ${ids.length} 種積木——` +
        `收窄沒有生效（積木種類可以少於元件數，不該多很多）`,
    ).toBeLessThanOrEqual(c.want + 2)
  })
}
