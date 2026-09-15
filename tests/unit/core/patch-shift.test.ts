/**
 * **補丁器插了幾行，對照表就挪幾行**——`shiftMappings` 的判定。
 *
 * ⚠️ e2e（`highlight-lines-up.spec.ts`）只走得到「在最上面插一行」那一種，
 * 而補丁器還會**縮排**與**包進 `int main()`**。那兩種在這裡驗。
 *
 * 🔴 **行號是 0-based**——消費端逐字寫著 `m.startLine + 1`（Monaco 是 1-based）。
 * 第一版的我拿 1-based 去讀它，於是把一個真的缺陷判成「本來就是對的」。
 */
import { describe, it, expect } from 'vitest'
import { alignLines, shiftMappings } from '../../../src/core/projection/patch-shift'

const M = (nodeId: string, startLine: number, endLine = startLine) => ({ nodeId, startLine, endLine })

describe('alignLines：哪一行搬到哪裡去了', () => {
  it('在最上面插一行 → 每一行往下挪一格', () => {
    expect(alignLines(['a', 'b'], ['x', 'a', 'b'])).toEqual([1, 2])
  })

  it('在中間插 → 插入點之後才挪', () => {
    expect(alignLines(['a', 'b'], ['a', 'x', 'b'])).toEqual([0, 2])
  })

  it('🔴 縮排變了仍然對得上——補丁器會把本體整段縮四格', () => {
    expect(alignLines(['int a = 1;'], ['    int a = 1;'])).toEqual([0])
  })

  it('一個字都沒改 → 原位', () => {
    expect(alignLines(['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual([0, 1, 2])
  })
})

describe('shiftMappings', () => {
  it('🔴 使用者回報的那一個：最上面多一行 `#include`', () => {
    const before = 'using namespace std;\nint main() {\n    return 0;\n}'
    const after = `#include <iostream>\n${before}`
    // 0-based：using 在 0、main 在 1-3
    const out = shiftMappings(before, after, [M('using', 0), M('main', 1, 3)])
    expect(out).toEqual([M('using', 1), M('main', 2, 4)])
  })

  it('沒補 → 一個字都不動（同一份文字）', () => {
    const c = 'a\nb'
    expect(shiftMappings(c, c, [M('n', 1)])).toEqual([M('n', 1)])
  })

  it('🔴 包進 `int main()` ＋ 整段縮排 → 也要跟著挪', () => {
    const before = 'int a = 1;\ncout << a;'
    const after = '#include <iostream>\nint main() {\n    int a = 1;\n    cout << a;\n    return 0;\n}'
    expect(shiftMappings(before, after, [M('a', 0), M('p', 1)])).toEqual([M('a', 2), M('p', 3)])
  })

  it('⚠️ 對不上的那一行沿用前一個位移——不得丟掉它', () => {
    // 🔴 丟掉的症狀是「點了沒反應」，而那比差一行更難查
    const before = 'a\n改過的那一行\nc'
    const after = 'x\na\n換掉了\nc'
    const out = shiftMappings(before, after, [M('mid', 1)])
    expect(out[0].startLine, '🔴 對不上就不挪的話，它會指回舊位置').toBe(2)
  })

  it('空的對照表 → 不炸', () => {
    expect(shiftMappings('a', 'x\na', [])).toEqual([])
  })
})
