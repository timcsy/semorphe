/**
 * 第一百二十九條護欄：**課文承諾的答案，要有一台真的編譯器跑得出來**
 *
 * ## 🔴 它從哪來（2026-09-21）
 *
 * 一班學生上完 C++ 入門前幾課，授課老師的第一條回饋逐字：
 *
 * > Bug：第六課，`+=` 一個整數的行為有錯，
 * > **我覺得要幫每一課所有題目會遇到的練習都加入執行比對**
 *
 * ## ⚠️ 而「執行比對」已經有一條了——它比的是別的東西
 *
 * ```
 * e2e/lessons.spec.ts   【我們的直譯器】跑參考解答  vs  check.stdout（人手打的）
 * 這一條                【g++】        跑參考解答  vs  check.stdout
 * ```
 *
 * 兩條缺一不可，而它們抓的是**不同的東西**：
 *
 * ```
 * 只有前者   check.stdout 若當初是照【我們的輸出】寫的，那條檢查在自證，永遠綠
 * 只有後者   我們的直譯器與 g++ 分岔時，學生看到的是我們的輸出，而這條不會紅
 * 兩條都有   課文的答案【對得起真正的 C++】，而學生看到的【對得起課文】
 * ```
 *
 * > **一個拿自己的輸出當答案的檢查，與一個沒有檢查的系統，
 * > 產出同一種綠。**
 *
 * ## ⚠️ 它為什麼在 `integration/` 而不是 e2e
 *
 * 它不需要瀏覽器——只要編譯器。而放進 `npm test` 表示
 * **每一次改動都會問一次「課文的答案還對嗎」**。
 *
 * ## 本檔不檢測什麼
 *
 * - **不檢測我們的直譯器跑不跑得出同一個答案**——那是 `e2e/lessons.spec.ts`
 *   與 `interpreter-matches-compiler` 的事。這一條只問**課文**。
 * - **不檢測 Python 那幾軌**——參照是 `python3`，形狀不同，另開一條。
 * - **不檢測沒有 `check` 的題目**（例如「把印出搬到 return 下面」那種
 *   看現象的題目）——它們沒有承諾答案。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, printReport } from '../helpers/guardrail'
import { runCppDetailed, hasReferenceCompiler } from '../helpers/run-cpp'

interface Task { id: string; title: string; check?: { stdout?: string; stdin?: string[] } }
interface Row { lesson: string; taskId: string; title: string; source: string; want: string; stdin: string[] }

function answers(): Row[] {
  const root = path.join(REPO_ROOT, 'lessons')
  const out: Row[] = []
  if (!fs.existsSync(root)) return out
  for (const track of fs.readdirSync(root, { withFileTypes: true })) {
    if (!track.isDirectory()) continue
    for (const lesson of fs.readdirSync(path.join(root, track.name), { withFileTypes: true })) {
      if (!lesson.isDirectory()) continue
      const dir = path.join(root, track.name, lesson.name)
      const jf = path.join(dir, 'lesson.json')
      if (!fs.existsSync(jf)) continue
      for (const t of (JSON.parse(fs.readFileSync(jf, 'utf8')) as { tasks?: Task[] }).tasks ?? []) {
        const sol = path.join(dir, 'solutions', `${t.id}.cpp`)
        if (!fs.existsSync(sol)) continue
        if (typeof t.check?.stdout !== 'string') continue
        out.push({
          lesson: `${track.name}/${lesson.name}`,
          taskId: t.id,
          title: t.title,
          source: fs.readFileSync(sol, 'utf8'),
          want: t.check.stdout,
          stdin: t.check.stdin ?? [],
        })
      }
    }
  }
  return out
}

/** ⚠️ 與裁判同一把尺：行尾空白忽略、最後的換行忽略（見 `core/lesson/lesson.ts` 的 `compareOutput`）。 */
function norm(s: string): string {
  return s.replace(/\n+$/, '').split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n')
}

const ROWS = answers()

describe('第一百二十九條護欄：課文承諾的答案，要有一台真的編譯器跑得出來', () => {
  it('★ 入口條件：真的找到有答案的題目了', () => {
    // 不可省。掃不到的話下面那條在驗空集合，而它會是綠的。
    expect(ROWS.length, '一題都沒找到 → 掃描壞了，不是課文沒有答案').toBeGreaterThan(50)
  })

  it('★ 入口條件：參照編譯器在', () => {
    // 🔴 **沒有編譯器要紅，不是跳過**——一筆看不見的缺陷與一筆不存在的缺陷長得一樣。
    expect(hasReferenceCompiler(), '找不到 g++——這條護欄不得在此跳過').toBe(true)
  })

  it('★ 注入①：答案對不上必須被報出', () => {
    // 🔴 這一條餵的是**合成的**一對輸出——不靠任何一課真的壞掉。
    //    偵測器（`norm` ＋ 比對）壞掉的話，下面那條硬性零會在每一題都錯的時候全綠。
    expect(norm('29282.0\n') === norm('29282\n'), '認不出 29282.0 ≠ 29282').toBe(false)
    expect(norm('3 2 1\n') === norm('321\n'), '認不出空白的差別').toBe(false)
  })

  it('★ 注入②：而正規化該忽略的要忽略——不得把對的報成錯的', () => {
    // ⚠️ 與裁判同一把尺：行尾空白、最後的換行都不算差別。
    //    這一條擋的是「把 78 題全部報成不符」那種壞法。
    expect(norm('a\nb\n') === norm('a\nb'), '最後的換行不該算差別').toBe(true)
    expect(norm('1 2 \n') === norm('1 2\n'), '行尾空白不該算差別').toBe(true)
  })

  it('★ 注入③：一支真的編不過的程式，要被歸到「編不過」', () => {
    // 🔴 少了這一條，`runCppDetailed` 若把失敗回成成功，那 78 題會靜靜地全過。
    const bad = runCppDetailed('#include <bits/stdc++.h>\nint main(){ this is not c++ }\n', '')
    expect(bad.ok, '一支明顯編不過的程式被判成 ok → 那條硬性零是空過的').toBe(false)
  }, 60_000)

  it('🔴 硬性零：每一題的參考解答，g++ 跑出來就是課文宣告的答案', () => {
    const wrong: string[] = []
    const failed: string[] = []
    for (const r of ROWS) {
      // ⚠️ 課文的解答**沒有** `#include`／`using`（那是骨架，編輯器會補）。
      const full = /\bmain\s*\(/.test(r.source) && !r.source.includes('#include')
        ? `#include <bits/stdc++.h>\nusing namespace std;\n${r.source}`
        : r.source
      const res = runCppDetailed(full, r.stdin.length > 0 ? r.stdin.join('\n') + '\n' : '')
      if (!res.ok) {
        failed.push(`${r.lesson}#${r.taskId}：${String(res.error ?? '').slice(0, 90)}`)
        continue
      }
      if (norm(res.output ?? '') !== norm(r.want)) {
        wrong.push(
          `${r.lesson}#${r.taskId}〈${r.title}〉\n` +
          `      課文說 ${JSON.stringify(norm(r.want).slice(0, 60))}\n` +
          `      g++ 說 ${JSON.stringify(norm(res.output ?? '').slice(0, 60))}`,
        )
      }
    }
    printReport('課文的答案 vs 參照編譯器', [
      `有答案的題目   ${ROWS.length}`,
      `🔴 答案不符     ${wrong.length}  ← 硬性零`,
      `🔴 解答編不過   ${failed.length}  ← 硬性零`,
      ...wrong.map((w) => `  ${w}`),
      ...failed.map((f) => `  ${f}`),
    ])
    expect(failed, '參考解答編不過——那一題的「答案」沒有任何東西背書').toEqual([])
    expect(wrong, '課文承諾的答案，真正的 C++ 跑不出來').toEqual([])
  }, 600_000)
})
