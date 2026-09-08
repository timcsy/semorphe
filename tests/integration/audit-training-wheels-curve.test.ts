/**
 * **第一百一十三條護欄：拆輪子的曲線。**
 *
 * ## 🔴 它與第一百零四條（語意波）方向相反，而兩者都對
 *
 * ```
 * 語意波   一【課】之內   先下到具體，再回到抽象   ← 這一趟要理解一個東西
 * 曲線     一【軌】之間   往程式碼那一頭走，不回頭  ← 這一路是把輪子拆掉
 * ```
 *
 * ⚠️ **搞混它們會讓兩條護欄互相打架**：一課之內回到抽象是**學會了**，
 * 而一軌之間回到積木是**鷹架又裝回去了**。
 *
 * 使用者原話：「我希望這成為學生的**輔助輪**，最終是可以看懂程式碼的」
 * ——`concepts/認知鷹架.md`「三輪車不是輔助輪」。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不強迫任何一條軌道宣告曲線**——沒有宣告是合法的（那條軌沒有這個意圖）
 * - **不管使用者實際看哪一邊**——那是**建議不是鎖**
 * - **不管一課之內的 `tasks[].view`**——那是第一百零四條的事
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { allLessons, viewForLesson } from '../../src/core/load-lessons'
import { curveOf, LESSON_VIEWS, type LessonView } from '../../src/core/semantic-wave'
import { REPO_ROOT } from '../helpers/guardrail'

interface Step { lesson: string; view: LessonView }

/**
 * 依課程順序收每一軌的**有效** view。
 *
 * 🔴 **走產品那一支 `viewForLesson`，不在這裡自己算**——兩份判斷會讓
 * 護欄驗過一條產品不會走的路。⚠️ 而這不是假設：第一版就是自己算的
 * （`pins.view ?? trackView`），而**那個算法是錯的**（轉折點的下一課退回預設）。
 *
 * > **一條護欄如果自己重算一次產品的判斷，它守的是自己那一份。**
 */
function tracks(): Map<string, Step[]> {
  const out = new Map<string, Step[]>()
  const byTrack = new Map<string, string[]>()
  for (const id of allLessons().keys()) {
    const t = id.split('/')[0] ?? id
    byTrack.set(t, [...(byTrack.get(t) ?? []), id])
  }
  for (const [t, ids] of byTrack) {
    const steps: Step[] = []
    // ⚠️ 課程 id 帶編號（`01-…`），所以字典序**就是**課程順序
    for (const id of [...ids].sort((a, b) => a.localeCompare(b))) {
      const v = viewForLesson(id)
      if (v !== undefined && LESSON_VIEWS.includes(v)) steps.push({ lesson: id, view: v })
    }
    if (steps.length > 0) out.set(t, steps)
  }
  return out
}

const TRACKS = tracks()

/** 一個看法的中文名——⚠️ 與 `core/semantic-wave.ts` 的 `viewLabel` 是同一份。 */
function viewName(v: LessonView): string {
  return { code: '程式碼', compare: '對照', three: '三欄', blocks: '積木', flow: '流程' }[v]
}

describe('第一百一十三條護欄：拆輪子的曲線', () => {
  /**
   * 🔴 **這一條今天量的是 0**，而那**不是壞掉**——沒有軌道宣告曲線。
   *
   * ⚠️ 所以它的健康檢查**完全靠注入**（第四十九條）：
   * 底下那三支合成的樣本才是它真正的自我驗證。
   *
   * > **一條回報「零違規」的健康護欄，與一條什麼都沒量到的壞護欄，
   * > 產出完全一樣。**
   */
  it('報表：今天有幾條軌道宣告了版面', () => {
    const lines = [...TRACKS].map(([t, s]) => `${t}：${s.map((x) => x.view).join(' → ')}`)
    console.log(lines.length === 0 ? '（今天沒有軌道宣告 view——合法）' : lines.join('\n'))
    expect(true).toBe(true)
  })

  it('🔴 硬性零：宣告了版面的軌道，曲線不得倒退', () => {
    const bad: string[] = []
    for (const [t, steps] of TRACKS) {
      const c = curveOf(steps.map((s) => s.view))
      for (const i of c.regressAt) {
        bad.push(`${t}：${steps[i - 1]?.lesson}（${steps[i - 1]?.view}）`
          + ` → ${steps[i]?.lesson}（${steps[i]?.view}）——高度 ${c.levels.join(' ')}`)
      }
    }
    expect(
      bad,
      '🔴 版面的曲線倒退了——**鷹架又裝回去了**。\n'
        + '⚠️ 它與一課之內的語意波不同：課內回到抽象是「學會了」，\n'
        + '   而一軌之間回到積木是「他又需要輔助輪了」。\n'
        + '🟢 如果那是刻意的（例如一個新概念要重新降下來），\n'
        + '   那它該是**課內**的 `tasks[].view`，不是課的 `pins.view`。',
    ).toEqual([])
  })

  // ─── 注入（第四十九條）——🔴 這一條今天量到 0，所以注入是它唯一的健康檢查 ───

  it('★ 注入：一條倒退的曲線 → 抓得到，並指出在哪一步', () => {
    const c = curveOf(['blocks', 'compare', 'code', 'blocks'])
    expect(c.regresses).toBe(true)
    expect(c.regressAt).toEqual([3])
  })

  it('★ 注入：中途退回對照也算倒退', () => {
    expect(curveOf(['code', 'compare']).regressAt).toEqual([1])
  })

  it('★ 反向：一條正常的曲線不得被報', () => {
    expect(curveOf(['blocks', 'blocks', 'compare', 'code']).regresses).toBe(false)
  })

  it('★ 反向：一整軌同一個看法不得被報（那條軌沒有曲線的意圖）', () => {
    expect(curveOf(['blocks', 'blocks', 'blocks']).regresses).toBe(false)
  })

  /**
   * 🔴 **宣告了版面轉折的課，課文要提到那個轉折。**
   *
   * ## 為什麼需要這一條
   *
   * `pins.view` 換了，學生**下一次打開這一課時版面就變了**——而如果課文
   * 一個字都沒提，那個變化對他就是「它自己動了」。
   *
   * > **一個由宣告驅動的改變，如果沒有人在課文裡說一句，
   * > 它對使用者就是一件【沒有原因發生的事】。**
   *
   * ⚠️ 而它取代的是一條橫條（2026-09-08 退場）：那條橫條想用**一面鏡子**
   * 讓學生自己看出「該換邊了」，而使用者的判斷是**直接在課程裡提醒更好**。
   *
   * 🟢 判準刻意寬：只要課文提到那個看法的名字（「對照」「程式碼」）就算
   * ——**這一條守的是「有沒有說」，不是「說得好不好」**。
   */
  it('🔴 硬性零：宣告了版面轉折的課，課文要提到它', () => {
    const bad: string[] = []
    let checked = 0
    for (const [, steps] of TRACKS) {
      for (let i = 1; i < steps.length; i++) {
        const prev = steps[i - 1]!
        const cur = steps[i]!
        if (prev.view === cur.view) continue      // 不是轉折
        checked++
        const md = fs.readFileSync(
          path.join(REPO_ROOT, 'lessons', cur.lesson, 'lesson.md'), 'utf8')
        const name = viewName(cur.view)
        if (!md.includes(name)) {
          bad.push(`${cur.lesson}：版面從「${viewName(prev.view)}」換成「${name}」，`
            + `而課文一個字都沒提`)
        }
      }
    }
    expect(checked, '★ 入口條件——真的有轉折點').toBeGreaterThan(0)
    expect(
      bad,
      '🔴 版面換了而課文沒說——學生下一次打開會覺得「它自己動了」。\n'
        + '🟢 修法：在那一課的「開始之前」加一句，說**為什麼**這一課換邊。',
    ).toEqual([])
  })

})
