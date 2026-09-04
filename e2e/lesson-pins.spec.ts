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
import { freshApp, useAsSource, treeReady } from './helpers'

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
    await treeReady(page)
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

/**
 * 🔴 **一條課程連結，不得被「這台電腦上次做了什麼」改寫。**
 *
 * 使用者截圖（2026-09-03）：開 `?lesson=cpp-beginner/15-多層迴圈`，
 * 而狀態列第一格寫著「**Python**」——因為 `restoreState()` 在建構子之後才跑，
 * 而它原本**無條件**把存檔裡的目標寫回去。
 *
 * > **一條連結如果會被上一次的使用狀態改寫，
 * > 它就不是一條可以貼給別人的連結。**
 */
test('★ 存檔是別的目標時，課釘住的那個要贏', async ({ page }) => {
  test.setTimeout(90_000)
  // ① 先在 Python 上留下一份存檔
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)
  await page.locator('[data-control-id="target"]').click()
  await page.waitForTimeout(400)
  await page.locator('.quick-pick-item[data-value="python"]').first().click()
  await page.waitForTimeout(3000)
  expect(await page.evaluate(() =>
    (window as never as { __app: { currentTarget: { id: string } } }).__app.currentTarget.id)).toBe('python')

  // ② 開一條釘住 C++ 的課程連結
  await page.goto('/?lesson=cpp-beginner%2F15-%E5%A4%9A%E5%B1%A4%E8%BF%B4%E5%9C%88', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(7000)
  const after = await page.evaluate(() => {
    const a = (window as never as { __app: {
      currentTarget: { id: string }; currentTopic: { id: string }; currentSkeletonId: string
    } }).__app
    return { target: a.currentTarget.id, topic: a.currentTopic.id, skeleton: a.currentSkeletonId,
      bar: (document.querySelector('[data-control-id="target"]')?.textContent ?? '').trim() }
  })
  expect(after.target, '🔴 存檔蓋掉了課釘住的目標').toBe('cpp')
  expect(after.topic, '🔴 主題跟著存檔跑了').toBe('cpp-beginner')
  // 🔴 狀態列與內部狀態要說同一件事——使用者看到的是這一格
  expect(after.bar, '🔴 狀態列還寫著上一次的目標').not.toContain('Python')

  // 🔴 **層級是另一格，而它也會被存檔蓋掉**（使用者：「多層迴圈的積木應該不只這些吧」）。
  //    那一課宣告的 `cpp:loop_count` 屬於「控制」——存檔的分支集合與這一課的主題
  //    交集之後，整個分類會消失，而**畫面上看起來只是「這一課比較小」**。
  // ⚠️ 選擇器是 `.blocklyToolboxCategory`——`.blocklyTreeLabel` 在這個版本的
  //    Blockly **不存在**（`e2e/toolbox.spec.ts:76` 記著同一個坑：沒驗過的選擇器
  //    會讓這支「空過」——0 個分類 → 什麼都沒比 → 綠）。
  const cats = await page.locator('.blocklyToolboxCategory').allInnerTexts()
  expect(cats.length, `★ 入口條件：一個分類都沒抓到（${cats.length}）→ 這支不算數`)
    .toBeGreaterThan(1)
  expect(cats, `🔴 工具箱少了「控制」——量到的分類：${cats.join('／')}`).toContain('控制')
})

/**
 * 🔴 **建構子裡換的骨架，要真的換到那三個持有者身上。**
 *
 * 使用者截圖（2026-09-03）：`?lesson=arduino/01-閃一顆燈` 的狀態列寫著
 * 「Arduino 骨架・淡的」，而程式碼是 `using namespace std; int main() { return 0; }`。
 *
 * 根因：`adoptSkeleton` 要交給三個持有者，而 `?lesson=` 在**建構子**裡就走它
 * ——那時 `scaffold` 與 `syncController` 都還是 `null`，只有那個 id 交得出去。
 *
 * > **一個在建構子裡做的決定，交給了三個還不存在的持有者
 * > ——它會安靜地只生效三分之一，而那三分之一正好是給人看的那一格。**
 */
test('★ `?lesson=arduino/…` 開出來的是 setup／loop，不是 int main', async ({ page }) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/?lesson=arduino%2F01-%E9%96%83%E4%B8%80%E9%A1%86%E7%87%88', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(7000)
  const d = await page.evaluate(() => {
    const a = (window as never as { __app: {
      currentSkeletonId: string; codeView: { getCode(): string }
    } }).__app
    return { skeleton: a.currentSkeletonId, code: a.codeView.getCode() }
  })
  expect(d.skeleton).toBe('arduino')
  expect(d.code, '🔴 骨架宣告說是 Arduino，而產出來的是 C++ 的外框').toContain('void setup()')
  expect(d.code, '🔴 兩個外框疊在一起了').not.toContain('int main()')
})

/**
 * 🔴 **裁判：跑完要說得出「差在哪」，不只是對或錯。**
 *
 * `check.stdout` 從 2026-08 就寫在 66 份 `lesson.json` 裡，而 `Lesson` 型別裡
 * 沒有它——`parseLesson` 讀完就丟，**應用根本不知道它存在**。
 * 學生按了執行，沒有任何人告訴他對了沒有。
 *
 * > **回饋要說的是「你少了第 2 行」，不是「你答錯了」。**
 */
test('★ 跑完之後，裁判說得出差在哪一行', async ({ page }) => {
  test.setTimeout(120_000)
  const write = async (body: string): Promise<void> => {
    await page.locator('.monaco-editor').first().click()
    await page.keyboard.press('Control+Home')
    await page.keyboard.press('ArrowDown')   // → `int main() {`
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type(body, { delay: 10 })
    await page.waitForTimeout(2600)
    await page.locator('#run-btn').click()
    await page.waitForTimeout(3000)
  }

  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/?lesson=cpp-beginner%2F01-%E5%8D%B0%E5%87%BA%E4%B8%80%E5%8F%A5%E8%A9%B1',
    { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(7000)

  // ① 少一個驚嘆號 → 要說「還沒」，而且要**並排**看得到差在哪
  await write('cout << "Hello" << endl;')
  const bad = page.locator('.console-verdict')
  await expect(bad, '🔴 跑完沒有裁判——學生按了執行而沒有人告訴他對了沒有').toBeVisible()
  await expect(bad).toHaveClass(/not-yet/)
  const text = await bad.innerText()
  expect(text, `🔴 只說了對錯而沒有並排差異：${text}`).toContain('Hello!')
  // ⚠️ 用「還沒」不用「錯」——前者指向下一步，後者指向自己
  expect(text, '🔴 對學生說了「錯」').not.toMatch(/錯誤|失敗|✗|❌/)

  // ② 改對 → ✅，而且不再有 diff 表格
  await page.goto('/?lesson=cpp-beginner%2F01-%E5%8D%B0%E5%87%BA%E4%B8%80%E5%8F%A5%E8%A9%B1',
    { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(7000)
  await write('cout << "Hello!" << endl;')
  const ok = page.locator('.console-verdict')
  await expect(ok).toHaveClass(/passed/)
  expect(await page.locator('.console-verdict-diff').count(), '🔴 對了還在給 diff').toBe(0)
})

/**
 * 🔴 **執行覆蓋：跑完要說得出「這一段從來沒跑到」。**
 *
 * 初學者的 bug 有壓倒性的比例是這兩種：`return` 後面的程式碼、永遠不成立的 `if`、
 * 根本沒進去的迴圈。而執行器本來就知道它到過誰——缺的只是把它畫出來。
 *
 * ⚠️ 而它是**問句不是判決**：一個 `if` 的另一支本來就可能不該跑。
 */
test('★ 跑完之後，沒被跑到的積木標得出來——而且是問句不是判決', async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(7000)

  await page.locator('.monaco-editor').first().click()
  await page.keyboard.press('Control+Home')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('cout << "A" << endl;\nif (1 > 2) {\ncout << "never" << endl;', { delay: 10 })
  await page.waitForTimeout(3000)
  await page.locator('#run-btn').click()
  await page.waitForTimeout(3500)

  // 🔴 **只標最外層那一塊**：`cout << "never" << endl;` 在樹裡是三顆節點，
  //    而學生眼裡那是一句話。
  expect(await page.locator('.never-ran').count(),
    '🔴 沒跑到的那一句沒有被標出來（或標成了三塊——計數單位要跟知覺一致）').toBe(1)

  const console_ = await page.locator('#bottom-container').innerText()
  expect(console_, '🔴 主控台沒說').toContain('沒有被跑到')
  // ⚠️ 是問句不是判決——「沒跑到」不等於錯
  expect(console_, '🔴 對學生說了「錯」').not.toMatch(/錯誤|失敗|不對/)

  // ⚠️ 而下一次開跑要先清掉——不然學生會對著上一次的結論改東西
  await page.locator('#run-btn').click()
  await page.waitForTimeout(600)
  await page.waitForTimeout(3000)
  expect(await page.locator('.never-ran').count(), '🔴 第二次跑完標記重複累加').toBe(1)
})

/**
 * 🔴 **一支完全正確的程式，一塊都不准標**（2026-09-04，開瀏覽器截圖抓到的）。
 *
 * 第一版對 `sum = sum + n;` 標了兩塊——因為指定的**左邊那顆變數不走執行，
 * 走的是 lvalue 解析**，於是它從來不會進 `visited`。
 *
 * > **一個在正確的程式上發出警告的警告，比沒有那個警告更糟
 * > ——它教會學生把警告當背景雜訊。**
 */
test('★ 執行覆蓋：一支完全正確的程式，一塊都不准標', async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/?lesson=cpp-beginner%2F10-%E9%87%8D%E8%A4%87', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(7000)

  await page.locator('.monaco-editor').first().click()
  await page.keyboard.press('Control+Home')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  // ⚠️ 指定的左邊（`sum` / `n`）就是那兩個假警報的來源
  await page.keyboard.type('int sum = 0;\nint n = 1;\nwhile (n <= 5) {\nsum = sum + n;\nn = n + 1;', { delay: 10 })
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
  await page.keyboard.type('\ncout << sum << endl;', { delay: 10 })
  await page.waitForTimeout(3000)
  await page.locator('#run-btn').click()
  await page.waitForTimeout(3500)

  expect(
    await page.locator('.never-ran').count(),
    '🔴 正確的程式被標了——多半又是某個【不走 executeNode】的節點（lvalue／宣告初值／預設參數）',
  ).toBe(0)
  expect(
    await page.locator('#bottom-container').innerText(),
    '🔴 正確的程式而主控台在問「是故意的嗎」',
  ).not.toContain('沒有被跑到')
})

/**
 * 🔴 **題目——而它修的是一個【會在學生做對時說他錯】的裁判。**
 *
 * 使用者 2026-09-04：「課程應該除了課程題目之外，還會有一些練習題，
 * **這樣去比對結果不就沒有辦法做練習題了**？」
 *
 * 一課一個 `check` 的時候，學生一開始做練習題，寫的就是另一支程式：
 *
 * ```
 * 學生：認真在做練習 2
 * 裁判：還沒對——你的輸出是「1 2 3」，這一課要的是「Hello!」
 * ```
 *
 * > **一個會在學生做對事情時說他錯的裁判，比沒有裁判更糟。**
 */
test('★ 題目：只有選了課程與章節才有那一格，而預設是「跟著做」', async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => window.localStorage.clear())

  // ① 沒有課 ⟹ **那一格不存在**（不是「有而空的」）
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(7000)
  await expect(
    page.locator('#status-controls .status-item-btn[data-control-id="task"]'),
    '🔴 沒選課程就出現「題目」——那時「我在做哪一題」這個問題不存在',
  ).toHaveCount(0)

  // ② 有課 ⟹ 那一格在，而它預設停在第一題
  await page.goto('/?lesson=cpp-beginner%2F10-%E9%87%8D%E8%A4%87', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(7000)
  const cell = page.locator('#status-controls .status-item-btn[data-control-id="task"]')
  await expect(cell, '🔴 選了課程與章節，而沒有「題目」那一格').toHaveCount(1)
  const label = await cell.innerText()
  expect(label, `🔴 預設不是「跟著做」：${label}`).toContain('跟著做')
  // 🔴 進度就在標籤上——它是這一格唯一說得出「我學到哪」的地方
  expect(label, `🔴 標籤上沒有進度：${label}`).toMatch(/0\/2/)

  // ③ 清單裡有「純練習」與那兩題，而沒有裁判的那一題要說出來
  await cell.click()
  const rows = await page.$$eval('.quick-pick-item', (e) => e.map((x) => x.textContent ?? ''))
  expect(rows.join('｜'), '🔴 清單裡沒有「純練習」——那是使用者拍板的那一格').toContain('純練習')
  expect(rows.join('｜')).toContain('練習：印出 1 到 5 的總和')
  await page.keyboard.press('Escape')
})

test('★ 題目：純練習的時候裁判沉默，而執行覆蓋照樣標', async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/?lesson=cpp-beginner%2F10-%E9%87%8D%E8%A4%87', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(7000)

  // 切到「純練習」
  await page.locator('#status-controls .status-item-btn[data-control-id="task"]').click()
  await page.locator('.quick-pick-item[data-value=""]').click()
  await page.waitForTimeout(500)

  // 寫一支【不是這一課答案】的程式——他在亂試
  await page.locator('.monaco-editor').first().click()
  await page.keyboard.press('Control+Home')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('cout << "A" << endl;\nif (1 > 2) {\ncout << "never" << endl;', { delay: 10 })
  await page.waitForTimeout(3000)
  await page.locator('#run-btn').click()
  await page.waitForTimeout(3500)

  // 🔴 **裁判一個字都不說**——系統分不出「卡住」與「在玩」，那就閉嘴
  expect(
    await page.locator('.console-verdict').count(),
    '🔴 純練習時裁判還在說話——他【說了】他不在做題目',
  ).toBe(0)

  // ⚠️ 而覆蓋照樣標——這是刻意畫的界線：
  //    **描述性的回饋永遠可以給；評價性的回饋要先問過。**
  expect(
    await page.locator('.never-ran').count(),
    '🔴 純練習把覆蓋也一起關掉了——那不是評價，那只是在說發生了什麼',
  ).toBe(1)
})

test('★ 題目：做對練習題 → 說出是哪一題，而下一題【問過才切】', async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/?lesson=cpp-beginner%2F10-%E9%87%8D%E8%A4%87', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(7000)

  // 選第二題（練習：印出總和），然後寫出它的答案
  await page.locator('#status-controls .status-item-btn[data-control-id="task"]').click()
  await page.locator('.quick-pick-item[data-value="ex1"]').click()
  await page.waitForTimeout(500)

  await page.locator('.monaco-editor').first().click()
  await page.keyboard.press('Control+Home')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('int sum = 0;\nint n = 1;\nwhile (n <= 5) {\nsum = sum + n;\nn = n + 1;', { delay: 10 })
  // ⚠️ 迴圈外面才印——`typeBody` 那一課學到的：游標會留在迴圈裡
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
  await page.keyboard.type('\ncout << sum << endl;', { delay: 10 })
  await page.waitForTimeout(3000)
  await page.locator('#run-btn').click()
  await page.waitForTimeout(3500)

  const verdict = page.locator('.console-verdict')
  await expect(verdict).toHaveClass(/passed/)
  // 🔴 **說出是哪一題**——「✅ 對了」在一課有好幾題的時候是有歧義的
  expect(await verdict.innerText(),
    '🔴 祝賀沒有說出是哪一題——他不知道那個勾算在哪一題頭上').toContain('練習：印出 1 到 5 的總和')

  // 🔴 **不自動切**：下一題是一句話 ＋ 一顆按鈕
  const next = page.locator('.console-next-task')
  await expect(next, '🔴 過了而沒有指向下一步').toBeVisible()
  const stillHere = await page.locator('#status-controls .status-item-btn[data-control-id="task"]').innerText()
  expect(stillHere,
    '🔴 自動切了下一題——他下一次執行會突然被另一題評價，而他不知道何時換的',
  ).toContain('練習：印出 1 到 5 的總和')
  // 進度要跟著動
  expect(stillHere, `🔴 過了而進度沒動：${stillHere}`).toMatch(/1\/2/)

  await next.locator('button').click()
  await page.waitForTimeout(400)
  expect(await page.locator('#status-controls .status-item-btn[data-control-id="task"]').innerText(),
    '🔴 按了「切過去」而沒有切').toContain('跟著做')
})

/**
 * 🔴 **迴圈跑了幾次**——初學者的另一種 bug 是「跑的次數不對」（差一錯誤），
 * 而那是**看不見的**：程式跑完了、沒有錯誤、輸出少一行，
 * 而他只能一行一行讀。
 *
 * ⚠️ 而它與「沒跑到」共用同一份資料，也共用同一條規矩：
 * 它在**描述發生了什麼**，不在說對錯。
 */
test('★ 迴圈跑了幾次：巢狀是【倍數】不是總次數', async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(7000)

  await page.locator('.monaco-editor').first().click()
  await page.keyboard.press('Control+Home')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type(
    'for (int i = 0; i < 3; i = i + 1) {\nfor (int j = 0; j < 4; j = j + 1) {\ncout << i << j << endl;',
    { delay: 10 })
  await page.waitForTimeout(3500)
  await page.locator('#run-btn').click()
  await page.waitForTimeout(4000)

  // ⚠️ 入口條件：真的跑了 3×4 圈（沒跑的話下面驗的是一個空畫面）
  expect(
    (await page.locator('.console-output').innerText()).trim().split('\n').length,
    '🔴 這支程式沒有跑出 12 行 → 下面兩條是空過的',
  ).toBe(12)

  const badges = await page.$$eval('.iteration-badge-text', (e) => e.map((x) => x.textContent))
  // 🔴 內層是 **×4**（12 ÷ 3），不是 ×12——學生看著 ×12 會想「我明明寫 4」
  expect(
    [...badges].sort(),
    `🔴 巢狀迴圈的次數不對：${JSON.stringify(badges)}`,
  ).toEqual(['×3', '×4'])

  // 🔴 **兩顆都要真的看得見**——第一版琥珀色的字落在橘色的迴圈積木上
  //    （而迴圈正是這個功能唯一會標的積木），內層那顆等於沒有畫。
  const boxes = await page.$$eval('.iteration-badge', (e) => e.map((x) => {
    const r = (x as SVGGElement).getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }
  }))
  expect(boxes.every((b) => b.w > 0), '🔴 徽章沒有實際尺寸').toBe(true)
  // ⚠️ 兩顆在**同一條左側的槽**上（像行號），而**不在同一列**
  expect(
    new Set(boxes.map((b) => b.x)).size,
    '🔴 兩顆的水平位置不同——它們該對齊成一條槽',
  ).toBe(1)
  expect(
    new Set(boxes.map((b) => b.y)).size,
    '🔴 兩顆疊在同一列上——那就分不出哪個數字在講哪一顆迴圈',
  ).toBe(2)

  // ⚠️ 改了積木，上一次的數字就過期了
  await page.locator('.monaco-editor').first().click()
  await page.keyboard.type(' ', { delay: 10 })
  await page.waitForTimeout(2500)
  expect(await page.locator('.iteration-badge').count(), '🔴 改過之後數字還留著').toBe(0)
})
