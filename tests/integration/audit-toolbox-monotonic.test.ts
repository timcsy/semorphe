/**
 * **工具箱只准長大——一軌之內，前面拿得到的後面不准消失。**
 *
 * ## 它從哪來（2026-10-01，使用者看著畫面）
 *
 * > 「我發現你提供的積木並沒有嚴格漸近增加，**有一些前面課程有的積木到後面
 * > 就不見了**，而且我是希望不只跟著做是這樣，練習也要。」
 *
 * 量出來不是零星：**69 課裡 62 課**掉過前面教過的元件，六軌全中，
 * 合計 1092 次。根因是兩份判斷——
 *
 * ```
 * audit-solution-vocabulary   「這一課 ∪ 之前每一課」            ← 累積
 * src/ui/app.ts               new Set(currentLesson.components)  ← 只有這一課
 * ```
 *
 * 於是一份解答過得了護欄而學生做不出來（第 4 課宣告 `cpp:input`，
 * 聯集裡有它；學生在第 6 課按不到）。
 *
 * ## 🔴 而「原本那個行為」不是漸進揭露，是滑動視窗
 *
 * ```
 * 漸進揭露   藏【還沒教的】   第 1 課少、第 19 課多    嚴格不遞減
 * 滑動視窗   藏【已經教的】   第 5 課比第 4 課還少    ← 原本是這個
 * ```
 *
 * 兩者在第 1 課長得一樣，之後完全相反。
 *
 * ## 這一條驗什麼
 *
 * `componentsForLesson()`（**產品與護欄共用的那一支**）沿著每一軌走過去，
 * 後一課的集合必須是前一課的**超集**。
 *
 * ⚠️ **它不驗「該不該教這一顆」**——那是 `audit-lesson-vocabulary`
 * 與 `audit-solution-vocabulary` 的事（母體是課文與解答）。
 * 這一條只問**形狀**：這條曲線有沒有往下掉。
 *
 * ## 🔴 而它刻意不是棘輪
 *
 * 一條棘輪會讓「掉 1092 → 掉 900」看起來像進步。而這件事沒有中間態：
 * **一顆消失的積木，學生就是按不到。**
 */
import { describe, it, expect } from 'vitest'
import { allTracks, lessonsOfTrack, componentsForLesson } from '../../src/core/lesson/load-lessons'
import { printReport } from '../helpers/guardrail'

/** 一軌走過去，回「後一課少了前一課哪幾顆」。`pick` 決定拿哪一種集合。 */
function dropsIn(track: string, pick: (id: string) => Set<string>): string[] {
  const out: string[] = []
  let prev: Set<string> | null = null
  let prevId = ''
  for (const l of lessonsOfTrack(track)) {
    const now = pick(l.id)
    if (prev !== null) {
      const lost = [...prev].filter((c) => !now.has(c)).sort()
      if (lost.length > 0) out.push(`${prevId} → ${l.id}  掉了 ${lost.length} 顆：${lost.slice(0, 8).join('、')}${lost.length > 8 ? ' …' : ''}`)
    }
    prev = now; prevId = l.id
  }
  return out
}

const TRACKS = (): string[] => [...allTracks().keys()].sort()

describe('工具箱只准長大：一軌之內，前面拿得到的後面不准消失', () => {
  it('★ 入口條件：課真的載進來了（否則下面的零是空過的）', () => {
    const n = TRACKS().reduce((a, t) => a + lessonsOfTrack(t).length, 0)
    expect(TRACKS().length, '一條軌都沒有 → 載入壞了').toBeGreaterThan(4)
    expect(n, '課數不對 → 載入壞了，不是曲線完美').toBeGreaterThan(50)
  })

  it('★ 注入：拿【原始的單課宣告】跑同一個判準，必須紅', () => {
    // 🔴 這一條證明上面那條不是同義反覆：同一個判準、換一個集合，
    //    1092 筆就回來了。少了它，「嚴格不遞減」可能只是因為我量錯了。
    const raw = (id: string): Set<string> => {
      const l = lessonsOfTrack(id.slice(0, id.indexOf('/'))).find((x) => x.id === id)
      return new Set(l?.components ?? [])
    }
    const bad = TRACKS().flatMap((t) => dropsIn(t, raw))
    expect(bad.length, '🔴 連原始的單課宣告都不遞減的話，這一條在量別的東西').toBeGreaterThan(30)
  })

  it('🔴 硬性零：每一軌的每一步，後一課都是前一課的超集', () => {
    const rows = TRACKS().map((t) => ({ t, drops: dropsIn(t, componentsForLesson) }))
    printReport('工具箱只准長大（母體＝每一軌的每一步）', [
      ...rows.flatMap(({ t, drops }) => [
        `── ${t}｜${lessonsOfTrack(t).length} 課｜最後一課拿得到 ${
          componentsForLesson(lessonsOfTrack(t).at(-1)?.id ?? '').size} 顆`,
        drops.length === 0 ? '   🟢 嚴格不遞減' : `   🔴 ${drops.length} 步往下掉`,
        ...drops.map((d) => `      ${d}`),
      ]),
      '⚠️ 這一條只問形狀——「該不該教這一顆」是 audit-lesson-vocabulary 與',
      '   audit-solution-vocabulary 的事（母體是課文與解答）。',
    ])
    const all = rows.flatMap((r) => r.drops)
    expect(
      all,
      '\n🔴 這幾步往下掉了——學生在後面那一課按不到前面教過的積木：\n' + all.join('\n'),
    ).toEqual([])
  })
})
