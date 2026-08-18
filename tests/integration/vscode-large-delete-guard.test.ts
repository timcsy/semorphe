/**
 * 🔴 **一次同步不得刪掉大半個檔案。**
 *
 * ## 病歷（2026-08-18，Arduino IDE 實測，連續三次）
 *
 * ```
 * ① 整份 sketch 變成空的
 * ② 被寫成錯位的重複片段
 * ③ setup()／loop() 消失，只剩 int x;
 * ```
 *
 * 三次的共同形狀都是：**積木那側的內容比檔案少很多，然後寫了回去**。
 *
 * > **兩邊不一致的時候，「以少的為準」會刪掉資料，
 * > 「以多的為準」只會多一次同步——而這兩件事的代價差了一個量級。**
 *
 * ⚠️ **它不是根因的修法**，是把後果從「檔案沒了」降成「這一次沒同步」。
 * 🔴 所以它必須**出聲**：`blockedCount` 非 0 就代表上游還有一個真的 bug。
 *
 * ## 自我否證聲明（⚠️ 寫在斷言之前）
 *
 * > **如果門檻設得太鬆，正常的編輯也會被擋——那不是安全，是壞掉。**
 *
 * 所以前兩條先釘「正常的編輯照過」。
 */
import { describe, it, expect } from 'vitest'

/** 與 `vscode-code-view.ts` 同一條判準——⚠️ 兩邊要一起改。 */
function wouldBlock(mirror: string, code: string): boolean {
  const solid = (t: string): number => t.split('\n').filter((l) => l.trim() !== '').length
  const before = solid(mirror)
  const after = solid(code)
  return before >= 4 && after * 2 < before
}

const SKETCH = `void setup() {
  // put your setup code here, to run once:

}

void loop() {
  // put your main code here, to run repeatedly:

}
`

describe('大量刪除的安全網', () => {
  it('🔴 正向錨點：加一行照過', () => {
    const after = SKETCH.replace('once:\n', 'once:\n  int x = 0;\n')
    expect(wouldBlock(SKETCH, after), '🔴 正常編輯被擋 → 這不是安全網，是壞掉').toBe(false)
  })

  it('🔴 正向錨點：刪掉一行也照過', () => {
    const after = SKETCH.replace('  // put your main code here, to run repeatedly:\n', '')
    expect(wouldBlock(SKETCH, after)).toBe(false)
  })

  it('整份 sketch 變成 `int x;` → 擋下（病歷③）', () => {
    expect(wouldBlock(SKETCH, 'int x;\n')).toBe(true)
  })

  it('整份 sketch 變成空的 → 擋下（病歷①）', () => {
    expect(wouldBlock(SKETCH, '')).toBe(true)
  })

  it('⚠️ 小檔案不套用——四行以下時「少一半」沒有意義', () => {
    // 🔴 否則「兩行變一行」也會被擋，而那是完全正常的編輯。
    expect(wouldBlock('int a;\nint b;\n', 'int a;\n')).toBe(false)
  })

  it('恰好剩一半 → 不擋（門檻是【少於】一半）', () => {
    const six = 'a;\nb;\nc;\nd;\ne;\nf;\n'
    expect(wouldBlock(six, 'a;\nb;\nc;\n')).toBe(false)
    expect(wouldBlock(six, 'a;\nb;\n')).toBe(true)
  })

  it('⚠️ 空白行不算——排版差異不該觸發安全網', () => {
    const spaced = 'a;\n\n\nb;\n\n\nc;\n\n\nd;\n'
    expect(wouldBlock(spaced, 'a;\nb;\nc;\nd;\n')).toBe(false)
  })
})
