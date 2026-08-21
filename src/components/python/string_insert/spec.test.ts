/** `python:string_insert` 的自證測（格式化文字的每一格）。 */
import { describe, it, expect } from 'vitest'
import { runPython } from '../../../../tests/helpers/python-lift'

/**
 * 🔴 **格式規格是一份**（2026-08-22）：格式化文字與 `.format(...)` 與
 * 舊式的 `%` 都走 `languages/python/format-spec.ts`。
 *
 * 在此之前它有**三份、各自對一小塊**：這裡只認 `.Nf`、`.format` 只認 `{}`、
 * `%` 只認沒有寬度精度的 `%s`／`%d`。
 */
describe('三種格式化，同一套規格', () => {
  it('🔴 對齊、寬度、補零', async () => {
    const out = await runPython('name = "小明"\nscore = 92.456\nprint(f"{name:>6}|")\nprint(f"{score:.1f} {score:08.3f}")\nprint(f"{10:3d}|{10:<3d}|")\n')
    expect(out).toContain('    小明|')
    expect(out).toContain('92.5 0092.456')
    expect(out).toContain(' 10|10 |')
  })

  it('🔴 千分位、正負號、百分比，而補零排在正負號【後面】', async () => {
    const out = await runPython('print(f"{1234567:,}")\nprint(f"{-5:05d}")\nprint(f"{3.5:+.1f}")\nprint(f"{0.256:.1%}")\n')
    expect(out).toContain('1,234,567')
    expect(out, '`000-5` 是錯的').toContain('-0005')
    expect(out).toContain('+3.5')
    expect(out).toContain('25.6%')
  })

  it('🔴 `.format` 的三種佔位子', async () => {
    const out = await runPython('print("{}-{}".format(1, 2))\nprint("{0}{1}{0}".format("a", "b"))\nprint("{n} 是 {v}".format(n="x", v=1))\n')
    expect(out).toContain('1-2')
    expect(out, '只認 {} 的話這一行會原樣印出模板').toContain('aba')
    expect(out).toContain('x 是 1')
  })

  it('🔴 舊式的 `%`：`%d` 截斷小數、`%.2f` 有精度', async () => {
    const out = await runPython('print("%s 得了 %d 分" % ("小明", 92.456))\nprint("%.2f" % 92.456)\nprint("%5.1f|%-6s|" % (3.14159, "ab"))\n')
    expect(out).toContain('小明 得了 92 分')
    expect(out).toContain('92.46')
    expect(out).toContain('  3.1|ab    |')
  })

  it('🔴 認不得的格式仍然【丟錯】，不靜默照原樣印', async () => {
    expect(await runPython('print(f"{1:@@@}")\n')).toMatch(/例外|錯誤|Error|支援/)
  })
})
