/**
 * **「你是不是要打 `score`？」——近似名的演算法本身**（`src/core/near-miss.ts`）。
 *
 * 2026-11-04（spec 208，6c-4）：原本住在 `tests/unit/near-miss-suggestion.test.ts`，經直譯器的 `Scope.get` 驗；
 * 直譯器刪掉之後改成直接驗演算法。接上判決的那一段（Cella 判「未宣告」時給 `CELLA_UNDECLARED_SUGGEST`）
 * 由 `verdict-diagnostics` 的測試守。判準與理由見 `near-miss.ts` 檔頭：
 *
 * ```
 * 大小寫不同而其餘相同             → 建議
 * 編輯距離 1（含相鄰對調）且兩邊都 ≥ 4 個字元 → 建議
 * 其餘                             → 不建議（不亂猜比會猜更重要）
 * ```
 */
import { describe, it, expect } from 'vitest'
import { findNearMiss } from '../../../src/core/near-miss'

describe('近似名建議（演算法）', () => {
  it('★ 大小寫打錯 → 說出正確的那個', () => {
    expect(findNearMiss('Score', ['score'])).toBe('score')
  })

  it.each([
    ['取代一個字元', 'scorx'],
    ['少一個字元', 'scre'],
    ['多一個字元', 'scoree'],
    ['🔴 相鄰兩字【對調】', 'scoer'],
  ])('★ 距離 1 且夠長 → 建議：%s', (_label, typo) => {
    expect(findNearMiss(typo, ['score'])).toBe('score')
  })

  // `scoer` 在 Levenshtein 下是距離 2，而它其實是一次對調。長度下限照樣擋住短名字的對調。
  it('★ 而短名字的對調仍然不猜', () => {
    expect(findNearMiss('ba', ['ab'])).toBeUndefined()
  })

  it.each([
    ['沒有任何名字', [] as string[], 'x'],
    ['完全不像', ['total'], 'q'],
    ['太短而距離 1（a vs b）', ['a'], 'b'],
    ['太短而距離 1（ab vs ac）', ['ab'], 'ac'],
    ['距離 2', ['score'], 'scrxe'],
  ])('★ 不亂猜：%s', (_label, declared, lookup) => {
    expect(findNearMiss(lookup, declared), `🔴 對「${lookup}」給了建議——而那是亂猜`).toBeUndefined()
  })

  it('★ 有多個近似名時，只給一個——大小寫完全相符優先於編輯距離', () => {
    expect(findNearMiss('Score', ['scores', 'score'])).toBe('score')
    expect(findNearMiss('Score', ['score', 'scores'])).toBe('score')
  })
})
