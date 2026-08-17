/**
 * 重寫範圍的自證測 —— **而它的主斷言不是「跨距合理」**。
 *
 * ## 自我否證聲明（⚠️ 寫在斷言之前）
 *
 * > **範圍算錯的症狀是【改到不該改的行】，而它不會拋錯。**
 * > 所以斷言必須是「把回傳的範圍套用到 `before`，**逐字元等於 `after`**」
 * > ——一個檢查「跨距看起來合不合理」的測試，**會放過所有真正的錯誤**。
 *
 * ## 🔴 而 `before` 是【文件的實際文字】，不是 `generate(原樹)`
 *
 * 規劃期我量錯過這一點（`specs/139/research.md` 第一節）：
 *
 * ```
 * 量的      generate(原樹) ↔ generate(突變樹)   → 中位 1 行
 * 要寫的    文件的實際內容 ↔ generate(新樹)
 * ```
 *
 * 而兩者**不相等**——`history/080`§三 量過：「內容保真 100%，
 * **而差異全是排版**」（縮排、空行、`enum` 折行）。
 *
 * > **我量到的是「第 2 次之後的編輯」，而我把它讀成了「所有編輯」。**
 *
 * ⚠️ 所以下面有一支測試專門餵「排版不同但語義相同」的輸入。
 */
import { describe, it, expect } from 'vitest'
import { rewriteSpan, applySpan } from '../../src/core/projection/rewrite-span'

/** 把範圍套回去——測試用的參考實作，與生產路徑的套用語義相同。 */
const roundTrip = (before: string, after: string): string => {
  const span = rewriteSpan(before, after)
  return span === null ? before : applySpan(before, span)
}

describe('rewriteSpan —— 一次修改真正要覆蓋的那一段', () => {
  // ─── 🔴 主斷言：套用結果必須逐字元正確 ───

  it('🔴 套用結果逐字元等於 after —— 單行修改', () => {
    const before = 'int a = 1;\nint b = 2;\nint c = 3;\n'
    const after = 'int a = 1;\nint b = 99;\nint c = 3;\n'
    expect(roundTrip(before, after)).toBe(after)
  })

  it('🔴 套用結果逐字元等於 after —— 插入一行', () => {
    const before = 'a();\nb();\n'
    const after = 'a();\nnew();\nb();\n'
    expect(roundTrip(before, after)).toBe(after)
  })

  it('🔴 套用結果逐字元等於 after —— 刪掉一行', () => {
    const before = 'a();\ngone();\nb();\n'
    const after = 'a();\nb();\n'
    expect(roundTrip(before, after)).toBe(after)
  })

  it('🔴 套用結果逐字元等於 after —— 改開頭', () => {
    expect(roundTrip('x;\ny;\n', 'X;\ny;\n')).toBe('X;\ny;\n')
  })

  it('🔴 套用結果逐字元等於 after —— 改結尾', () => {
    expect(roundTrip('x;\ny;\n', 'x;\nY;\n')).toBe('x;\nY;\n')
  })

  it('🔴 套用結果逐字元等於 after —— 整份都不一樣', () => {
    expect(roundTrip('aaa\nbbb\n', 'ccc\nddd\neee\n')).toBe('ccc\nddd\neee\n')
  })

  it('🔴 套用結果逐字元等於 after —— 空的 before', () => {
    expect(roundTrip('', 'int main() {}\n')).toBe('int main() {}\n')
  })

  it('🔴 套用結果逐字元等於 after —— 變成空的', () => {
    expect(roundTrip('int main() {}\n', '')).toBe('')
  })

  it('🔴 套用結果逐字元等於 after —— 相鄰的重複行（去頭去尾最容易錯的地方）', () => {
    // ⚠️ 前後綴都能匹配到同一批行時，樸素的實作會算出負長度的範圍。
    const before = 'x\nx\nx\n'
    const after = 'x\nx\n'
    expect(roundTrip(before, after)).toBe(after)
  })

  // ─── 🔴 而 before 是「文件的實際文字」 ───

  it('🔴 `before` 是文件的實際文字（排版不同也要正確）', () => {
    // 使用者的排版：2 空格縮排、有空行、註解在旁邊
    const documentText =
      '// 我的程式\n\nint main() {\n  int x = 1;\n\n  return 0;\n}\n'
    // 我們產生的：4 空格縮排、空行被移除
    const generated =
      '// 我的程式\nint main() {\n    int x = 2;\n    return 0;\n}\n'
    expect(roundTrip(documentText, generated)).toBe(generated)
  })

  it('⚠️ 排版差異會讓第一次的跨距很大——而那是誠實，不是缺陷', () => {
    const documentText = 'int main() {\n  int x = 1;\n\n  return 0;\n}\n'
    const generated = 'int main() {\n    int x = 1;\n    return 0;\n}\n'
    const span = rewriteSpan(documentText, generated)
    expect(span).not.toBeNull()
    // 正向錨點：它確實動了不只一行
    expect(span!.endLine - span!.startLine).toBeGreaterThan(1)
    // 而套用之後仍然逐字元正確——那才是重點
    expect(applySpan(documentText, span!)).toBe(generated)
  })

  // ─── 契約的其餘保證 ───

  it('相同 → 回傳 null（不產生空編輯）', () => {
    expect(rewriteSpan('a\nb\n', 'a\nb\n')).toBeNull()
  })

  it('只差一行 → 跨距 1', () => {
    const span = rewriteSpan('a\nb\nc\n', 'a\nB\nc\n')
    expect(span).not.toBeNull()
    expect(span!.endLine - span!.startLine).toBe(1)
    expect(span!.startLine).toBe(1)
  })

  it('純函式：同輸入同輸出，且不改動輸入', () => {
    const before = 'a\nb\n'
    const after = 'a\nB\n'
    const first = rewriteSpan(before, after)
    const second = rewriteSpan(before, after)
    expect(second).toEqual(first)
    expect(before).toBe('a\nb\n')
    expect(after).toBe('a\nB\n')
  })

  it('跨距不會比兩邊都大（正向錨點：它真的有在縮小範圍）', () => {
    const before = Array.from({ length: 50 }, (_, i) => `line${i};`).join('\n')
    const after = before.replace('line25;', 'CHANGED;')
    const span = rewriteSpan(before, after)!
    expect(span.endLine - span.startLine).toBe(1)
    expect(applySpan(before, span)).toBe(after)
  })
})
