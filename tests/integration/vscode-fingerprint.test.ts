/**
 * 🔴 **樂觀更新要對帳。**
 *
 * ## 病歷（2026-08-18，Arduino IDE 實測）
 *
 * 使用者的 sketch 被寫成
 *
 * ```cpp
 * }
 * void loop() {
 *   int x;
 * }
 * void loop() {          ← 重複、錯位、少了開頭
 * ```
 *
 * 積木那一側是**樂觀更新**：算出一段範圍編輯、送出去、先把本地鏡像改掉。
 * ⚠️ 而那個假設只要錯一次，之後每一段範圍都是**錯位**的。
 *
 * > **樂觀更新沒有對帳的話，第一次分歧不會出聲，
 * > 而它之後的每一次操作都會把檔案弄得更爛。**
 *
 * ## 自我否證聲明（⚠️ 寫在斷言之前）
 *
 * > **一個「永遠回同一個值」的指紋函式，會讓下面每一條都綠。**
 *
 * 所以第一條先證明它**分得出不同的文字**。
 */
import { describe, it, expect } from 'vitest'
import { textFingerprint } from '../../src/vscode/sync/fingerprint'
import { rewriteSpan, applySpan } from '../../src/core/projection/rewrite-span'

describe('文字指紋', () => {
  it('🔴 正向錨點：不同的文字給出不同的指紋', () => {
    const a = textFingerprint('void setup() {\n}\n')
    const b = textFingerprint('void setup() {\n }\n')
    expect(a, '🔴 指紋分不出差一個空白 → 它守不住任何東西').not.toBe(b)
  })

  it('同樣的文字給出同樣的指紋（兩端各算一次要對得上）', () => {
    const t = 'void loop() {\n  int x = 1;\n}\n'
    expect(textFingerprint(t)).toBe(textFingerprint(t))
  })

  it('⚠️ 長度相同而內容不同——這正是 length 檢查會漏掉的那一類', () => {
    expect(textFingerprint('ab\ncd')).not.toBe(textFingerprint('ac\nbd'))
  })

  it('空字串也有指紋（不得回 0 之類的哨兵值混進正常結果）', () => {
    expect(typeof textFingerprint('')).toBe('number')
    expect(textFingerprint('')).not.toBe(textFingerprint('\n'))
  })

  it('🔴 對帳的意義：鏡像與宿主一致時，指紋才會相同', () => {
    const before = 'void setup() {\n  // a\n}\n\nvoid loop() {\n}\n'
    const after = 'void setup() {\n  int x = 0;\n}\n\nvoid loop() {\n}\n'
    const span = rewriteSpan(before, after)
    expect(span).not.toBeNull()
    // 宿主端照 span 套用 → 兩邊應該一致
    expect(textFingerprint(applySpan(before, span!))).toBe(textFingerprint(after))
  })

  it('🔴 而套錯位置時指紋【一定】不同——這就是它要抓的東西', () => {
    const before = 'void setup() {\n  // a\n}\n'
    const after = 'void setup() {\n  int x = 0;\n}\n'
    const span = rewriteSpan(before, after)!
    // 模擬宿主套在錯的起點（差一行）
    const wrong = { ...span, startLine: span.startLine + 1, endLine: span.endLine + 1 }
    expect(textFingerprint(applySpan(before, wrong))).not.toBe(textFingerprint(after))
  })
})
