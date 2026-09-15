/**
 * **一題「排回去」，要真的打散得出東西。**
 *
 * ## 🔴 它從哪來（2026-09-15）
 *
 * 使用者轉述學生：「不知道排回去在幹嘛」「在課程那邊點擊排回去**不會有打亂**」。
 *
 * 實測 19 課，**4 課一塊都沒打散**：
 *
 * ```
 * 01-印出一句話   本體只有一句 cout
 * 05-程式從哪開始  與第 1 課【逐字相同】的程式
 * 11-for迴圈     本體是一顆 for，其餘都在它裡面
 * 16-多層迴圈     同上
 * ```
 *
 * 前兩個是**內容**的問題（那支程式本來就排不出題目），後兩個是**機制**的：
 * 打散只取第一層，而第一層只有一塊。
 *
 * > **一個「只取第一層」的規則，在【第一層只有一塊】的時候
 * > 產出的不是「比較簡單的題目」，是【沒有題目】。**
 *
 * ## ⚠️ 而它其實一直在出聲——只是沒有人聽得到
 *
 * `scatterTopStatements` 的說明逐字寫著「**0 ＝ 那一題等於直接給答案，
 * 呼叫端要出聲**」，而呼叫端出的聲是 `console.error`。
 *
 * > **一則只有開發者看得到的錯誤訊息，在使用者那裡等於沒有訊息
 * > ——他只會說「不知道這在幹嘛」。**
 *
 * ## ⚠️ 本護欄不檢測什麼
 *
 * - **不檢測那一題好不好**——它只問「有沒有東西被打散」。
 *   🟠 而**真正的設計問題還開著**：31 題「排回去」有 31 題用的是
 *   學生剛打完的**同一支程式**，零題用自己的。那是一個課程設計的決定，
 *   不是這條護欄管得到的事。
 */
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

interface Task { id: string; kind?: string; title: string }

/**
 * 🟠 **本體只有一句話的那幾課**——走幾層都排不出題目。
 *
 * ⚠️ 這不是「例外清單」，是**待辦清單**：它們的 `arrange` 題等於直接給答案，
 * 而修法是**換一支程式或拿掉那一題**，不是放寬這條護欄。
 * 名單只准變短——多一筆就是有人新種了一題空的。
 */
const KNOWN_EMPTY = new Set([
  'cpp-beginner/01-印出一句話',
  'cpp-beginner/05-程式從哪開始',
])

function arrangeTasks(): { lesson: string; task: Task }[] {
  const out: { lesson: string; task: Task }[] = []
  for (const track of fs.readdirSync('lessons')) {
    const td = path.join('lessons', track)
    if (!fs.statSync(td).isDirectory()) continue
    for (const l of fs.readdirSync(td)) {
      const f = path.join(td, l, 'lesson.json')
      if (!fs.existsSync(f)) continue
      const j = JSON.parse(fs.readFileSync(f, 'utf8')) as { tasks?: Task[] }
      for (const t of j.tasks ?? []) {
        if (t.kind === 'arrange') out.push({ lesson: `${track}/${l}`, task: t })
      }
    }
  }
  return out
}

async function openTask(page: Page, lesson: string, taskId: string): Promise<number> {
  const url = `/?lesson=${encodeURIComponent(lesson)}&task=${taskId}`
  await page.goto(url)
  await page.waitForFunction(
    () => Boolean((window as unknown as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  // ⚠️ **清完要重進**：種題目是開場那一次做的事
  await page.evaluate(() => localStorage.clear())
  await page.goto(url)
  await page.waitForFunction(
    () => Boolean((window as unknown as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  // 🪦 **不能寫成一個猜出來的毫秒數**——Python 那一軌要多載一份 wasm，
  //    5 秒的時候還沒散、10 秒散了。第一版就是這樣把整條 python-beginner
  //    的 12 課全報成「沒打散」。
  //
  // > **一個寫成毫秒數的等待，就是在賭那台機器的速度**
  // > ——而這句話 `seedArrange` 的檔頭早就寫著了。
  //
  // 🟢 改成「等到它不再變」：連續三次讀到同一個數字才算穩。
  const tops = (): Promise<number> => page.evaluate(() => (window as unknown as {
    __app: { blocklyPanel: { workspace: { getTopBlocks(o: boolean): unknown[] } } }
  }).__app.blocklyPanel.workspace.getTopBlocks(false).length)
  // 🪦 而「等到它不再變」**也不夠**：散之前那個數字本來就穩，
  //    於是它在工作開始之前就滿足了（第二版又把 Python 那 12 課全報一次）。
  //
  // > **一個「等到穩定」的等待，要先確認【工作已經開始】
  // > ——不然它量到的是「還沒開始」那一段的穩定。**
  //
  // 🟢 先等積木真的載進來（題目種進去了），再等頂層數不再變。
  const loaded = (): Promise<number> => page.evaluate(() => (window as unknown as {
    __app: { blocklyPanel: { workspace: { getAllBlocks(o: boolean): unknown[] } } }
  }).__app.blocklyPanel.workspace.getAllBlocks(false).length)
  for (let i = 0; i < 40 && (await loaded()) < 3; i++) await page.waitForTimeout(500)
  let last = -1
  let same = 0
  for (let i = 0; i < 40 && same < 4; i++) {
    await page.waitForTimeout(750)
    const n = await tops()
    same = n === last ? same + 1 : 0
    last = n
  }
  return last
}

const ALL = arrangeTasks()

test('★ 入口條件：真的找到「排回去」那種題了', () => {
  expect(ALL.length, '🔴 一題都沒找到 → 下面在驗空集合').toBeGreaterThan(20)
})

test('★ 每一題「排回去」都要真的打散得出東西', async ({ page }) => {
  test.setTimeout(ALL.length * 25_000 + 60_000)
  const empty: string[] = []
  const fixed: string[] = []
  for (const { lesson, task } of ALL) {
    const tops = await openTask(page, lesson, task.id)
    // 頂層只有一塊 ＝ 骨架自己，什麼都沒被拆下來
    if (tops <= 1) empty.push(`${lesson}#${task.id}`)
    else if (KNOWN_EMPTY.has(lesson)) fixed.push(`${lesson}#${task.id}`)
  }
  // 🟠 名單上的那幾課修好了 → **也要紅**，這樣名單才會跟著變短
  expect(fixed, '🟢 這幾課已經排得出題目了——請把它們從 KNOWN_EMPTY 拿掉').toEqual([])
  expect(
    empty.filter((e) => !KNOWN_EMPTY.has(e.split('#')[0])),
    '🔴 這幾題「排回去」一塊都沒打散——學生打開它看到的就是答案：',
  ).toEqual([])
})
