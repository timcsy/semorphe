/**
 * `writeBaseline` 不得吃掉基線裡累積的**理由**
 *
 * ## 這支測試在防什麼
 *
 * `build-guardrail` 第 7 步：「上調的理由要寫進基線檔的 `note`，**不是只寫在
 * commit 訊息裡**——commit 訊息沒有人會回頭翻，而基線檔是下一個看到這個數字的人
 * **一定會打開**的地方」。
 *
 * 🔴 而那個約定被同一個病打破過**三次**：
 *
 * ```
 * ① toolbox-snapshot 的區域寫入器直接覆寫整份     → 修了
 * ② 共用的 writeBaseline 也有                     → 修了（2026-08-11），
 *                                                    而 identity-namespace 的理由當場被吃掉
 * ③ 14 條護欄的呼叫端全都傳 note: RATCHET_NOTE    → 「傳進來的贏」讓 ② 的修復
 *                                                    對它們全部失效（2026-08-13）
 * ```
 *
 * > **一個機制修好了，而繞過它的那條路仍然是預設的走法。**
 *
 * ②修好時沒有留下測試，所以③沒有任何東西會說話——**這支測試就是那個缺口**。
 *
 * ## 判準很窄，所以它不會擋到正當的覆寫
 *
 * 只有「呼叫端寫的正好是通用樣板」才保留舊的。呼叫端真的要換一份具體說明時，
 * 寫進去的不等於樣板，照樣會贏——**下面第三支釘的就是這一半**。
 */
import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { writeBaseline, loadBaseline, RATCHET_NOTE, REPO_ROOT } from '../../helpers/guardrail'

const GUARD = 'zz-writebaseline-selftest'
const FILE = path.join(REPO_ROOT, 'tests/baselines', `${GUARD}.json`)

interface Shape {
  _meta: { guard: string; note: string; rule?: string }
  count: number
}

afterEach(() => {
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE)
})

describe('writeBaseline 的 _meta 保存', () => {
  it('🔴 具體理由不得被通用樣板洗掉——這是犯了三次的那一個', () => {
    const specific = `${RATCHET_NOTE} ⚠️ 2026-08-10 10 → 11（上升是揭露不是退步，見 spec 106）。`
    writeBaseline(GUARD, { _meta: { guard: GUARD, note: specific }, count: 10 })

    // 第二次重產：呼叫端照 14 條護欄的寫法，傳通用樣板
    writeBaseline(GUARD, { _meta: { guard: GUARD, note: RATCHET_NOTE }, count: 11 })

    const after = loadBaseline<Shape>(GUARD)
    expect(after._meta.note, '累積的理由被靜默清掉了').toBe(specific)
    expect(after.count, '數字本身仍然要更新').toBe(11)
  })

  it('🔴 護欄自組的長 note 也不得洗掉追加——第一版的判準漏掉這一種', () => {
    // ⚠️ 14 條護欄裡只有一部分傳純樣板；其餘各自組一段更長的固定說明。
    // 第一版判準寫「等於 RATCHET_NOTE 才保留」，於是這一類照樣被覆蓋
    // ——同一輪內三個基線的理由當場又被吃掉一次。
    //
    // > 一個判準如果是照著手上那個實例寫的，它只會涵蓋那個實例。
    const guardOwn = '靜默回退：執行器遇到處理不了的輸入時有沒有出聲。⚠️ 只有型別不符進棘輪。'
    writeBaseline(GUARD, { _meta: { guard: GUARD, note: `${guardOwn} ⚠️ 2026-08-13 +1（上升，指名）：…` }, count: 20 })
    writeBaseline(GUARD, { _meta: { guard: GUARD, note: guardOwn }, count: 21 })
    expect(loadBaseline<Shape>(GUARD)._meta.note).toContain('2026-08-13')
    expect(loadBaseline<Shape>(GUARD).count).toBe(21)
  })

  it('★ 反向：呼叫端給的**具體**說明照樣會贏', () => {
    // 沒有這一支的話，一個「note 永遠不准變」的實作也會通過上一支——
    // 而那會讓基線的理由永遠停在第一版。
    writeBaseline(GUARD, { _meta: { guard: GUARD, note: '舊的理由' }, count: 1 })
    writeBaseline(GUARD, { _meta: { guard: GUARD, note: '新的、更準的理由' }, count: 2 })
    expect(loadBaseline<Shape>(GUARD)._meta.note).toBe('新的、更準的理由')
  })

  it('★ 第一次寫入（沒有舊檔）時，通用樣板就是最終的 note', () => {
    writeBaseline(GUARD, { _meta: { guard: GUARD, note: RATCHET_NOTE }, count: 0 })
    expect(loadBaseline<Shape>(GUARD)._meta.note).toBe(RATCHET_NOTE)
  })

  it('★ 呼叫端完全不傳 _meta 時，整份舊的 _meta 保留（②那次修的行為）', () => {
    writeBaseline(GUARD, { _meta: { guard: GUARD, note: '要保住', rule: '也要保住' }, count: 1 })
    writeBaseline(GUARD, { count: 2 })
    const after = loadBaseline<Shape>(GUARD)
    expect(after._meta.note).toBe('要保住')
    expect(after._meta.rule).toBe('也要保住')
    expect(after.count).toBe(2)
  })
})
