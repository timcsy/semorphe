/**
 * **每一堂課的程式碼都要真的跑得出它宣告的結果，
 * 而它用到的積木都要真的是它宣告的那些。**
 *
 * ## 為什麼一定要開瀏覽器
 *
 * `audit-lessons`（第八十三條）只問「這顆元件存不存在」。它答不出
 * **「這堂課的程式碼真的會用到這顆嗎」**——那要真的解析一次。
 *
 * 2026-08-27 生第一堂課時憑印象列的清單漏了 `cpp:literal_number`
 * （`return 0;` 的那個 `0`）。**元件存在，宣告合法，而清單是錯的。**
 * 靜態護欄看不到這一類，只有實際 lift 一次才看得到。
 *
 * > **一份憑印象列的元件清單，與一份量出來的長得一模一樣
 * > ——直到有人照著它上課。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果掃到的課少於 1 堂，這支什麼都沒驗——不是「每堂課都對」。**
 *
 * 錨在**課的數量**（合成量），不是「不一致的課數」——後者正是要推向零的。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測課文寫得好不好**——那是人的事。
 * - **不檢測「換你了」的答案**——那本來就不給答案。
 * - **不檢測步驟中間那些示範用的程式碼片段**——只抽 `## 完成的樣子`。
 */
import { test, expect } from '@playwright/test'
import { freshApp, useAsSource, skipPredictionIfAsked } from './helpers'
import fs from 'node:fs'
import path from 'node:path'

interface LessonCase {
  name: string
  code: string
  components: string[]
  target?: string
  stdout: string
  stdin: string[]
  /** 這一課的練習題裡，**有參考解答**的那些（見下面的 `collectExercises`）。 */
  exercises: Exercise[]
}

/**
 * 一題**練習題**，以及它的參考解答。
 *
 * ## 🔴 為什麼期望輸出一定要有人跑過
 *
 * 一份 `check.stdout` 是課程作者**用手打的**。打錯一個空格，那一題的裁判
 * 就會對每一個做對的學生說他錯——而**畫面上完全看不出來**
 * （那正是 2026-09-04 那個「會在學生做對時說他錯」的缺陷的另一個形狀）。
 *
 * > **一個沒有人跑過的期望輸出，是一個還沒被發現的、會說錯話的裁判。**
 *
 * ## ⚠️ 而參考解答【不進課文】
 *
 * 它住在 `solutions/<題目 id>.<副檔名>`——`lesson.md` 一個字都不提，
 * 靜態頁產生器只讀 `lesson.md`，所以學生點不到它。
 */
interface Exercise {
  taskId: string
  title: string
  solution: string
  stdout: string
  stdin: string[]
}

/**
 * 讀一堂課的題目——⚠️ **舊的 `check` 就是第一題**（`core/lesson.ts` 的 `parseTasks`
 * 同一條規矩）。這裡不能只讀 `tasks`：66 課裡多數還是舊形狀。
 */
function tasksOf(j: Record<string, any>): { id: string; title: string; check?: { stdout?: string; stdin?: string[] } }[] {
  if (Array.isArray(j.tasks)) return j.tasks
  return j.check ? [{ id: 'follow', title: '跟著做', check: j.check }] : []
}

/** 有參考解答檔的那幾題。⚠️ 第一題不算——它的解答是課文裡的「完成的樣子」。 */
function collectExercises(dir: string, j: Record<string, any>): Exercise[] {
  const out: Exercise[] = []
  const sols = path.join(dir, 'solutions')
  if (!fs.existsSync(sols)) return out
  for (const t of tasksOf(j).slice(1)) {
    const file = fs.readdirSync(sols).find((f) => f.replace(/\.[^.]+$/, '') === t.id)
    if (!file) continue
    out.push({
      taskId: t.id, title: t.title,
      solution: fs.readFileSync(path.join(sols, file), 'utf8').trimEnd(),
      stdout: t.check?.stdout ?? '',
      stdin: t.check?.stdin ?? [],
    })
  }
  return out
}

function collect(): LessonCase[] {
  const root = path.resolve(process.cwd(), 'lessons')
  const out: LessonCase[] = []
  for (const track of fs.readdirSync(root, { withFileTypes: true })) {
    if (!track.isDirectory()) continue
    for (const dir of fs.readdirSync(path.join(root, track.name), { withFileTypes: true })) {
      if (!dir.isDirectory()) continue
      const p = path.join(root, track.name, dir.name)
      if (!fs.existsSync(path.join(p, 'lesson.json'))) continue
      const j = JSON.parse(fs.readFileSync(path.join(p, 'lesson.json'), 'utf8'))
      const md = fs.readFileSync(path.join(p, 'lesson.md'), 'utf8')
      // 🔴 **程式碼只有一份，住在課文裡**——這裡是唯一的抽取點
      const code = md.split('## 完成的樣子')[1]?.split('\n## ')[0]
        ?.match(/```[a-z]*\n([\s\S]+?)\n```/)?.[1]
      if (code === undefined) throw new Error(`${track.name}/${dir.name} 抽不出「完成的樣子」的程式碼`)
      out.push({
        name: `${track.name}/${dir.name}`,
        code,
        components: j.components ?? [],
        target: j.pins?.target,
        // 🔴 第一題（「跟著做」）就是課文那一支——這兩格是它的裁判
        stdout: tasksOf(j)[0]?.check?.stdout ?? '',
        stdin: tasksOf(j)[0]?.check?.stdin ?? [],
        exercises: collectExercises(p, j),
      })
    }
  }
  return out
}

const CASES = collect()

/**
 * 開一堂課——**走 `?lesson=`，不走目標選單**。
 *
 * 🔴 2026-08-28 之前這裡是 `freshApp` ＋ `selectTarget(c.target)`，
 * 而那天 `cpp-advanced` 改成 `listed: false`（它其實是一條軌道，
 * 不是一個語言）——於是**那 26 支全部 30 秒逾時**：
 * `.quick-pick-item[data-value="cpp-advanced"]` 不在選單裡了。
 *
 * > **一個靠「在選單裡點得到」開場的測試，會在那一項合法地離開選單的那天全紅。**
 *
 * 🟢 而 `?lesson=` 本來就是**真實路徑**（老師貼的那條連結），
 * 課自己會把目標釘過去——這裡不必知道它是哪一個。
 */
async function openLesson(page: import('@playwright/test').Page, c: LessonCase): Promise<void> {
  await freshApp(page)
  await page.goto(`/?lesson=${encodeURIComponent(c.name)}`)
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 30_000 })
  // 🔴 **等【條件】，不等固定秒數**（2026-08-31 量測之後改的）。
  //
  // 這裡原本是 `waitForTimeout(2500)`。整個 `lessons.spec` 是 14.8 分鐘，
  // 而量出來**每支測試有 79～82% 是純粹在睡**：
  //
  // ```
  // 元件檢查  openLesson 2500 ＋ useAsSource 600 ＋ 1500 = 4600ms ／ 實測 5.6 秒
  // 執行輸出  2500 ＋ 1200 ＋ 400×N ＋ 2500 ≥ 6200ms      ／ 實測 7.8 秒
  // ```
  //
  // 換成條件等待之後：**888 秒 → 218 秒，133 支零改判定**。
  //
  // ⚠️ 而它同時是**這個檔不能平行跑的原因**。對照實驗（`workers=1` vs `4`）：
  // 序列 9/9 過，併行 3 支紅——而失敗的形狀是「產出是舊的」與
  // 「element not found」，**不是互相覆寫**（`playwright.config.ts` 的註解
  // 那樣寫，而那句話是錯的：Playwright 每個 worker 有自己的 context）。
  // 是 4 個 Chromium 搶 4 個效能核，開機慢 3～4 倍，而固定等待是照閒置機器校準的。
  //
  // > **一個用固定秒數等待的測試，它的正確性綁在「機器現在有多閒」上
  // > ——那既讓它慢，也讓它不能平行。同一個病，兩個症狀。**
  //
  // 🔴 **條件要挑「這一步真的完成了」的那個**，不是「有東西了」——
  //    這裡等的是「目標釘好了 ＋ 樹存在」，那正是下面每一條斷言的前提。
  await page.waitForFunction(() => {
    const a = (window as never as Record<string, any>).__app
    return Boolean(a?.currentTarget?.id) && Boolean(a?.syncController?.currentTree)
  }, undefined, { timeout: 30_000 })
  // ★ 目標真的被釘過去了——否則下面驗的是另一個語言
  if (c.target) {
    expect(
      await page.evaluate(() =>
        (window as never as { __app: { currentTarget: { id: string } } }).__app.currentTarget.id),
      `🔴 ${c.name} 的 ?lesson= 沒有把目標釘成 ${c.target}`,
    ).toBe(c.target)
  }
}

test('★ 入口條件——真的掃到課了', () => {
  // ⚠️ 錨在課的數量（合成量）。0 堂 ＝ 這支什麼都沒驗，不是「都對」。
  expect(CASES.length, '🔴 一堂課都沒掃到 → 下面每一支都是空過的').toBeGreaterThanOrEqual(1)
})

for (const c of CASES) {
  test(`★ ${c.name}：宣告的元件 ＝ 程式碼真的用到的元件`, async ({ page }) => {
    await openLesson(page, c)

    await page.evaluate((code) =>
      (window as never as { __app: { codeView: { setCode(c: string): void } } })
        .__app.codeView.setCode(code), c.code)
    await useAsSource(page, '程式碼')
    // 等到樹**真的有內容**——`useAsSource` 回來時同步還在跑。
    await page.waitForFunction(() => {
      const t = (window as never as Record<string, any>).__app?.syncController?.currentTree
      return Boolean(t) && Object.keys(t.children ?? {}).length > 0
    }, undefined, { timeout: 30_000 })

    const measured = await page.evaluate(() => {
      const tree = (window as never as { __app: { syncController: { currentTree: unknown } } })
        .__app.syncController.currentTree
      const seen = new Set<string>()
      const walk = (n: unknown): void => {
        if (!n || typeof n !== 'object') return
        const node = n as { componentId?: string; children?: Record<string, unknown[]> }
        if (node.componentId) seen.add(node.componentId)
        for (const k of Object.keys(node.children ?? {})) {
          for (const child of node.children![k] ?? []) walk(child)
        }
      }
      walk(tree)
      return [...seen]
    })

    // 🔴 **降級成 raw_code 代表這一課的程式碼系統根本讀不懂**——先擋這個
    expect(
      measured.filter((x) => x.includes('raw_')),
      `🔴 ${c.name} 的程式碼降級了——課文教的東西，編輯器接不住`,
    ).toEqual([])

    const declared = new Set(c.components)
    // `cpp:program` 是每一份都有的骨架，不算在課的元件裡。
    // 🔴 **結構節點也不算**——`core/non-components.ts` 宣告的那一類
    //    （`param_decl` 之類）是別人的子節點，**學生在積木盤上看不到它們**，
    //    所以一堂課不該宣告要開它們。判準是**真元件的身分都帶冒號**
    //    （`語言:名字`，實測 332/332）。
    const used = measured.filter((x) => !x.endsWith(':program') && x.includes(':'))

    // 🔴 **骨架的元件不算在課的宣告裡**（2026-08-28）。
    //
    // 在此之前 65 堂課每一堂都得列 `func_def` 與 `return`——因為每支程式都有
    // `int main(){ … return 0; }`。而那張表**同時在驅動工具箱**，於是
    // 第 1 課的工具箱裡有「函式」那一格（使用者：「為何在工具箱還看得到函式？」）。
    //
    // > **一張表扛兩個工作：「畫得出來」與「拿得到」。而骨架要前者、不要後者。**
    //
    // ⚠️ **問 app，不要在這裡自己判一次**——「哪一塊是骨架」這個決定
    //    在 2026-08-28 之前已經有六份各自的實作了（`history/188`）。
    const skeletonOwned = await page.evaluate(() =>
      [...(window as never as { __app: { scaffoldComponentIds(): Set<string> } })
        .__app.scaffoldComponentIds()])

    // ★ 入口條件——這個機制沒有死掉。有骨架的語言至少要認出一顆；
    //   全空的話下面那條斷言會**什麼都不擋**而看起來是綠的。
    if (c.target !== 'python') {
      expect(
        skeletonOwned.length,
        `🔴 ${c.name}：一顆骨架元件都認不出來 → 下面那條斷言是空過的`,
      ).toBeGreaterThan(0)
    }

    expect(
      used.filter((x) => !declared.has(x) && !skeletonOwned.includes(x)).sort(),
      `🔴 ${c.name} 的程式碼用到了【沒有宣告、也不是骨架】的元件——` +
        `學生在課堂上會找不到這幾顆積木：`,
    ).toEqual([])

    expect(
      [...declared].filter((x) => !used.includes(x)).sort(),
      `🔴 ${c.name} 宣告了【程式碼用不到】的元件——多開的積木是雜訊，` +
        `而它也可能代表宣告是從別堂課抄來的：`,
    ).toEqual([])
  })

  test(`★ ${c.name}：跑出來就是課文說的那樣`, async ({ page }) => {
    // 🔴 **沒有輸出的課不能整支跳過。**
    //
    // 七堂 Arduino 課只閃燈／發聲／轉馬達，主控台本來就是空的。
    // 在此之前它們被 `test.skip` 整支跳掉，於是
    // **一個執行期錯誤會完全溜過去**——而那正是 2026-08-27 抓到的那一類
    // （`變數 'LED_BUILTIN' 尚未宣告`，症狀是整堂課的第一步就做不了）。
    //
    // > **「這堂課沒有輸出可比」不等於「這堂課不用跑跑看」。**
    //
    // 所以改成：有宣告 `stdout` 就比對；沒有的話**仍然跑**，
    // 只驗它沒有把錯誤印在主控台上。
    await openLesson(page, c)

    await page.evaluate((code) =>
      (window as never as { __app: { codeView: { setCode(c: string): void } } })
        .__app.codeView.setCode(code), c.code)
    await useAsSource(page, '程式碼')
    // 等到樹**真的有內容**——`useAsSource` 回來時同步還在跑。
    await page.waitForFunction(() => {
      const t = (window as never as Record<string, any>).__app?.syncController?.currentTree
      return Boolean(t) && Object.keys(t.children ?? {}).length > 0
    }, undefined, { timeout: 30_000 })

    await page.locator('#run-btn').click()
    // ⚠️ 這支測試不是在扮演一個學生——它在驗「課文承諾的輸出」
    await skipPredictionIfAsked(page)

    // 🔴 **用真的輸入框餵，不灌 API**——學生做的就是這件事，
    //    而灌 API 會繞過「程式有沒有真的停下來等人」這一半。
    for (const line of c.stdin) {
      const box = page.locator('.console-inline-input')
      await expect(
        box,
        `🔴 ${c.name} 宣告了 stdin，而程式沒有停下來等輸入——` +
          `課文說「程式會停住」，而它沒有`,
      ).toBeVisible({ timeout: 8000 })
      await box.fill(line)
      await box.press('Enter')
      await page.waitForTimeout(400)
    }

    // 🔴 **等【執行真的結束】，不等 2.5 秒**——狀態列自己會說。
    //    ⚠️ 三種結局都要收（完畢／錯誤／英文），否則錯誤的那一課會等滿 20 秒
    //    然後用一個過期的輸出去比對。
    await expect
      .poll(() => page.locator('.console-status').innerText(), { timeout: 20_000 })
      .toMatch(/程式執行完畢|錯誤|Error|Completed/)

    const output = (await page.locator('.console-output').innerText()).trim()

    // ★ 兩種課都要驗的：**主控台上不得有錯誤**
    //   ⚠️ 認的是直譯器吐出來的那幾種說法，不是任意含「錯」的字
    //   ——課文本身的輸出也可能有那個字。
    const errs = output.split('\n').filter((l) =>
      /尚未宣告|尚未定義|^Error:|不是一個結構|不合法/.test(l))
    expect(
      errs,
      `🔴 ${c.name} 跑起來就出錯——學生照著課文做，第一步就卡住`,
    ).toEqual([])

    if (c.stdout.trim() === '') return   // 沒有輸出可比的課（只閃燈／發聲），驗到這裡

    expect(
      output,
      `🔴 ${c.name} 跑出來的東西與 check.stdout 不符——` +
        `課文承諾學生會看到什麼，而他看到的是別的`,
    ).toContain(c.stdout.trim())
  })

  // 🔴 **每一題練習的期望輸出，都要有一份參考解答真的跑出它**（2026-09-04）。
  //
  //    一份手打的 `check.stdout` 錯一個空格，那一題的裁判就會對每一個
  //    做對的學生說他錯——而畫面上完全看不出來。
  for (const ex of c.exercises) {
    test(`★ ${c.name}〈${ex.title}〉：參考解答真的跑得出宣告的答案`, async ({ page }) => {
      await openLesson(page, c)
      await page.evaluate((code) =>
        (window as never as { __app: { codeView: { setCode(c: string): void } } })
          .__app.codeView.setCode(code), ex.solution)
      await useAsSource(page, '程式碼')
      await page.waitForFunction(() => {
        const t = (window as never as Record<string, any>).__app?.syncController?.currentTree
        return Boolean(t) && Object.keys(t.children ?? {}).length > 0
      }, undefined, { timeout: 30_000 })

      await page.locator('#run-btn').click()
      await skipPredictionIfAsked(page)
      for (const line of ex.stdin) {
        const box = page.locator('.console-inline-input')
        await expect(box).toBeVisible({ timeout: 8000 })
        await box.fill(line)
        await box.press('Enter')
        await page.waitForTimeout(400)
      }
      await expect
        .poll(() => page.locator('.console-status').innerText(), { timeout: 20_000 })
        .toMatch(/程式執行完畢|錯誤|Error|Completed/)

      const output = (await page.locator('.console-output').innerText()).trim()
      expect(
        output,
        `🔴 ${c.name}〈${ex.title}〉的參考解答跑出來不是宣告的答案——` +
          `這一題的裁判會對【做對的學生】說他錯`,
      ).toContain(ex.stdout.trim())
    })
  }
}
