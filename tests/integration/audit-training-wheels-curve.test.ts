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

  // ─── 兩個 store 要一起接、一起清 ───

  /**
   * 🔴 **編輯計數與進度是同一個「這台電腦上這個學生」。**
   *
   * ⚠️ 少接一個的症狀是**它記不住而不會報錯**；少清一個的症狀是
   * **換一班學生之後新學生從一個不是他的數字開始**。
   */
  it('🔴 硬性零：兩個 store 一起接、一起清', () => {
    const app = fs.readFileSync(path.join(REPO_ROOT, 'src/ui/app.ts'), 'utf8')
    expect(app.includes('setEditTallyStore('),
      '🔴 編輯計數沒有接上 store → 它記在記憶體裡，重新整理就沒了（而且不報錯）').toBe(true)
    expect(app.includes('clearEditTally('),
      '🔴 清除進度時沒有清編輯計數 → 換一班學生，新學生看到上一班的數字').toBe(true)

    // ⚠️ 兩者要在**同一個**函式裡（接：組裝；清：清除入口）
    const wire = app.indexOf('setProgressStore(')
    expect(app.slice(wire, wire + 800).includes('setEditTallyStore('),
      '🔴 兩個 store 接在不同地方 → 遲早只改到一個').toBe(true)
    const clear = app.indexOf('clearProgress()')
    expect(app.slice(clear, clear + 500).includes('clearEditTally()'),
      '🔴 兩個清除不在一起 → 遲早只清一個').toBe(true)
  })

  /**
   * ⚠️ **計數不得離開這台機器**——送出去就破〈離線可用〉的硬性零，
   * 而且那個數字的價值在於它是**給學生自己看的**。
   */
  it('🔴 硬性零：計數不得被送出去', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'src/core/edit-tally.ts'), 'utf8')
    for (const forbidden of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket']) {
      expect(src.includes(forbidden),
        `🔴 編輯計數碰了 ${forbidden}——它只留在本機`).toBe(false)
    }
  })
})
