/**
 * 護欄：**跟著做走完，學生手上要是〈完成的樣子〉那一支。**
 *
 * ## 🔴 它從哪來（2026-09-29，使用者站在學生旁邊發現的）
 *
 * > 「06 算一算的跟著做最後完成的樣子是錯的，**這很嚴重**。」
 *
 * ```
 * 課文頁的順序
 *   §一 換掉裡面的值   int score = 95; score = 100;        ← 跟著做
 *   §二 = 不是等於     score = score + 5;                  ← 跟著做
 *   §三 五種運算       int a = 7, b = 2; 五行 cout          ← 【另一支程式】
 *   §四 開根號與次方    cout << sqrt(16); cout << sqrt(2);   ← 【又一支程式】
 *   完成的樣子         int score = 95; score = score + 5;   ← 回到 §二
 * ```
 *
 * 而編輯器裡「跟著做」**只有一個裁判**，它要的是 `分數是 100`。
 * ⟹ 學生照著頁面一路打下來，最後手上是 `sqrt`——**那一關永遠過不了**。
 *
 * ## 判準
 *
 * 一課的**最後一個 `step`**（圍籬上沒宣告 `demo`／`counter` 的那些裡的最後一個），
 * 它的每一行有內容的程式碼都要出現在〈完成的樣子〉裡。
 *
 * ⚠️ **中間的步驟不查**：跟著做本來就會打一行再改掉它
 * （第 6 課 §一 的 `score = 100;` 就是，而它是對的）。
 * 壞掉的是**終點**，不是路徑。
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * **如果掃到的課數是 0、或有步驟的課是 0，代表路徑或解析壞了，不是每一課都對。**
 * 錨在**掃到幾課**（輸入量）上——刻意不錨在「還有幾課不合格」。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢查 `demo`／`counter` 宣告得對不對**——那是教學判斷，要人看。
 *   這一條只保證**終點**對得上。
 * - 不檢查中間步驟的連續性（打了再改掉是正當的）。
 * - 不檢查〈完成的樣子〉本身跑不跑得出裁判要的答案（那是
 *   `audit-lesson-answers-vs-compiler` 與 `e2e/lessons.spec.ts` 的地盤）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { allStepFragments } from '../../tools/build-lessons/step-fragments'

const ROOT = path.resolve(__dirname, '../..')
const FRAGS = allStepFragments(ROOT)

/** 〈完成的樣子〉那一段程式碼裡，每一行有內容的文字。 */
function doneLines(lesson: string): Set<string> | null {
  const md = path.join(ROOT, 'lessons', lesson, 'lesson.md')
  if (!fs.existsSync(md)) return null
  const done = (fs.readFileSync(md, 'utf8').split('## 完成的樣子')[1] ?? '').split('\n## ')[0]
  const m = /```(?:cpp|c|arduino|ino|python|py)\n([\s\S]*?)```/.exec(done)
  if (!m) return null
  return new Set(m[1].split('\n').map((l) => l.trim()).filter(Boolean))
}

/** 一行程式碼去掉行末註解之後的樣子——兩邊都這樣看，否則 `// 四` 會讓它對不上。 */
function bare(l: string): string {
  return l.split('//')[0].split('#')[0].trim()
}

const lessons = [...new Set(FRAGS.map((f) => f.lesson))]

describe('護欄：跟著做走完，要停在〈完成的樣子〉', () => {
  it('★ 入口條件：讀到的課與片段不得為零', () => {
    expect(lessons.length, '🔴 一課都沒讀到 → 路徑或解析壞了').toBeGreaterThan(30)
    expect(FRAGS.length, '🔴 一段片段都沒解析到').toBeGreaterThan(100)
  })

  it('★ 入口條件：宣告用得上——demo／counter 兩種都要真的出現過', () => {
    const kinds = new Set(FRAGS.map((f) => f.kind))
    expect(kinds.has('demo'), '🔴 一段 demo 都沒有 → 資訊字串的旗標沒有被解析到').toBe(true)
    expect(kinds.has('step'), '🔴 一段 step 都沒有 → 解析把所有東西都當成旗標了').toBe(true)
  })

  it('🔴 硬性零：一課的最後一個 step，要落在〈完成的樣子〉裡', () => {
    const bad: string[] = []
    for (const lesson of lessons) {
      const done = doneLines(lesson)
      if (done === null) continue
      const steps = FRAGS.filter((f) => f.lesson === lesson && f.kind === 'step')
      const last = steps[steps.length - 1]
      if (last === undefined) continue
      const body = last.code.split('\n').map((l) => l.trim())
        .filter((l) => l !== '' && !l.startsWith('//') && !l.startsWith('#'))
      const outside = body.filter((l) => !done.has(l) && !done.has(bare(l)))
      if (outside.length === body.length && body.length > 0) {
        bad.push(`${lesson} · 第 ${last.index} 段（§${last.section}）· 例：${body[0].slice(0, 40)}`)
      }
    }
    expect(
      bad,
      '\n🔴 這些課的「跟著做」走完，學生手上是另一支程式：\n' + bad.join('\n')
        + '\n\n處置：那一段如果只是示範，在圍籬上宣告 「」`<語言> demo（反例用 counter）；'
        + '\n否則改課文，讓跟著做真的接到〈完成的樣子〉。\n',
    ).toEqual([])
  })

  it('★ 注入：合成一段「整段都不在完成的樣子裡」的 step → 判準要認得出來', () => {
    const done = new Set(['int a = 1;'])
    const body = ['cout << 9 << endl;']
    const outside = body.filter((l) => !done.has(l) && !done.has(bare(l)))
    expect(outside.length === body.length, '判準認不出終點跑掉了').toBe(true)
  })

  it('★ 不亂報：一段落在完成的樣子裡的 step，不得被報', () => {
    const done = new Set(['int a = 1;', 'cout << a << endl;'])
    const body = ['int a = 1;', 'cout << a << endl;   // 註解不算']
    const outside = body.filter((l) => !done.has(l) && !done.has(bare(l)))
    expect(outside.length, '把正確的終點報成錯的').toBe(0)
  })
})
