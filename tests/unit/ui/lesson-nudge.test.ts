/**
 * **第一百二十條護欄：積木被打暗時，畫面說得出「該換哪一課」。**
 *
 * ## 🔴 學生的畫面（2026-09-10，使用者轉述）
 *
 * 他沒有換課，一路往下寫。第 1 課只開了三顆元件
 * （`print`／`literal_string`／`endl`），而他在宣告變數
 * ——於是**他自己寫的每一塊積木都被打暗**。
 *
 * ```
 * 發生了什麼   六塊積木是淡的      → 看得到
 * 為什麼       釘著第 1 課          → 沒說
 * 怎麼辦       換課，或不選課程     → 藏在最下面那條狀態列的一格下拉裡
 * ```
 *
 * ⚠️ 而**同一個問題被問過兩次**：2026-08-28 使用者自己看著畫面問過
 * 「為何積木變這麼暗？」。那一次修的是「不該暗的別暗」，
 * 這一次是「該暗的**沒說為什麼、也沒說怎麼辦**」。
 *
 * > **一個純視覺的訊號，如果它在使用者【正當地往前走】的時候觸發，
 * > 那它讀起來不是提示，是故障。**
 *
 * ## 本護欄不檢測什麼
 *
 * - **不驗版面**（顏色、位置）——那由 e2e 與人眼看。
 * - ⚠️ **不驗「打暗這件事本身」**：那是既有行為，而且它是對的。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../../helpers/guardrail'
import { suggestLessonFor, type LessonScope } from '../../../src/core/lesson-suggest'

const appSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/ui/app.ts'), 'utf8')
const barSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/ui/lesson-nudge-bar.ts'), 'utf8')
const panelSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/ui/panels/blockly-panel.ts'), 'utf8')
const cssSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/ui/style.css'), 'utf8')

/** 真的課程資料——⚠️ 不用假的，不然這條護欄驗的是我編的例子。 */
function realLessons(track: string): LessonScope[] {
  const dir = path.join(REPO_ROOT, 'lessons', track)
  return fs.readdirSync(dir)
    .filter((d) => fs.existsSync(path.join(dir, d, 'lesson.json')))
    .map((d) => {
      const j = JSON.parse(fs.readFileSync(path.join(dir, d, 'lesson.json'), 'utf8')) as
        { components: string[] }
      return { id: `${track}/${d}`, components: j.components }
    })
}

describe('第一百二十條護欄：打暗要說得出換哪一課', () => {
  it('★ 入口條件——真的讀到課了', () => {
    expect(realLessons('cpp-beginner').length).toBeGreaterThan(5)
  })

  /**
   * 🔴 **這一條就是學生的畫面。**
   *
   * 釘在第 1 課而在宣告變數 → 那四顆元件全部超出範圍 → 該指向第 2 課。
   */
  it('🔴 學生的情況：釘在第 1 課而在宣告變數 → 指向〈記住資料〉', () => {
    const lessons = realLessons('cpp-beginner')
    const dimmed = ['cpp:var_declare', 'cpp:var_ref', 'cpp:literal_number', 'cpp:literal_char']
    const s = suggestLessonFor(dimmed, lessons, 'cpp-beginner/01-印出一句話')
    expect(s, '🔴 一堂都指不出來——那條線只能說「你超出範圍了」而說不出下一步').not.toBeNull()
    expect(s!.lessonId).toBe('cpp-beginner/02-記住資料')
    expect(s!.covers, '🔴 第 2 課涵蓋不了全部 → 課程資料與這條建議對不上').toBe(dimmed.length)
  })

  it('🔴 面板要回報「打暗了哪幾顆」，不能只改畫面', () => {
    expect(panelSrc, '🔴 `markOutOfScopeBlocks` 什麼都不回 → 組裝點說不出有幾塊')
      .toMatch(/markOutOfScopeBlocks\(visibleComponents: Set<string>\): Set<string>/)
    expect(panelSrc).toMatch(/dimmed\.add\(componentId\)/)
  })

  it('🔴 組裝點有接上去，而且只在同一軌裡找', () => {
    expect(appSrc).toContain('updateLessonNudge')
    expect(appSrc, '🔴 沒有限定同一軌——會把 C++ 入門的學生指去 Arduino')
      .toMatch(/lessonsOfTrack\(trackOf\(lesson\.id\)\)/)
  })

  /** ⚠️ 「自由練習」＝ 不選課程，**不是**課內那一題「純練習」（後者仍然釘著工具箱）。 */
  it('🔴 「自由練習」是真的離開課程模式', () => {
    expect(appSrc).toMatch(/onFreePractice: \(\) => this\.selectLesson\(''\)/)
  })

  it('🔴 按過「不用」就不再說同一句', () => {
    expect(barSrc, '🔴 沒有記住被按掉的建議 → 它會變成一條趕不走的橫幅')
      .toContain('this.dismissed')
    expect(barSrc, '🔴 鍵不是「建議換到哪一課」→ 學生走到別課的範圍時問不出第二次')
      .toMatch(/const key = n\.suggestion\?\.lessonId/)
  })

  /**
   * 🔴 `display: flex` 與 `[hidden]` 的特異度相同，而後寫的贏。
   * 少了這一行的症狀：沒有話要說時那條線**照樣佔一格**（空的琥珀色細線）。
   */
  it('🔴 沒話說的時候收得起來', () => {
    expect(cssSrc).toContain('.lesson-nudge-bar[hidden] { display: none; }')
  })

  it('🔴 文案是指路，不是判決', () => {
    for (const loc of ['zh-TW', 'en']) {
      const m = JSON.parse(fs.readFileSync(
        path.join(REPO_ROOT, `src/i18n/${loc}/blocks.json`), 'utf8')) as Record<string, string>
      for (const k of ['LESSON_NUDGE_SWITCH', 'LESSON_NUDGE_BEYOND', 'LESSON_NUDGE_GO',
        'LESSON_NUDGE_FREE', 'LESSON_NUDGE_DISMISS']) {
        expect(m[k], `🔴 ${loc} 少了 ${k}`).toBeTruthy()
      }
    }
    const zh = JSON.parse(fs.readFileSync(
      path.join(REPO_ROOT, 'src/i18n/zh-TW/blocks.json'), 'utf8')) as Record<string, string>
    // ⚠️ 學生沒有做錯任何事——他只是走得比課快
    for (const bad of ['錯', '不該', '不能', '禁止']) {
      expect(zh.LESSON_NUDGE_SWITCH.includes(bad), `🔴 文案在判決（「${bad}」）而不是指路`).toBe(false)
    }
  })

  // ─── 注入（第四十九條）───

  it('★ 注入：沒有一堂沾得上邊 → 不硬推一堂', () => {
    const lessons = realLessons('cpp-beginner')
    expect(suggestLessonFor(['cpp:lambda', 'cpp:template_function'], lessons, 'cpp-beginner/01-印出一句話'))
      .toBeNull()
  })

  it('★ 反向：沒有東西被打暗 → 不說話', () => {
    expect(suggestLessonFor([], realLessons('cpp-beginner'), 'cpp-beginner/01-印出一句話')).toBeNull()
  })
})
