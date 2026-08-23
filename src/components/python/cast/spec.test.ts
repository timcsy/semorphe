/** `python:cast` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:cast', () => {
  it('★ lift：四個名字都認得出來', async () => {
    for (const code of ['int(x)\n', 'str(x)\n', 'float(x)\n', 'bool(x)\n']) {
      const ids = componentIdsOf(await liftPython(code))
      expect(ids, `${code.trim()} 沒認出來 → 下面會空過`).toContain('python:cast')
    }
  })

  it('🔴 只認一個引數的——`int("ff", 16)` 讓一般呼叫接手', async () => {
    const ids = componentIdsOf(await liftPython('int("ff", 16)\n'))
    expect(ids, '兩個引數的積木上沒有那一格，認走它會產出一個少了引數的呼叫').not.toContain('python:cast')
    expect(ids, '而它仍然要有身分').toContain('python:func_call')
  })

  /**
   * ⚠️ **這條原本用 `list(x)` 當對照組，而 `list` 在 2026-08-22 加進了下拉**
   * ——邊界移動時要**改成釘新的邊界，不是刪掉它**。
   *
   * 🔴 **邊界第二次移動（2026-08-23）**：`set` 本來也在界外，理由是
   * 「這個直譯器沒有集合型別」——而集合字面（`{1, 2}`）進來時
   * `seqKind: 'set'` 一起做了，**那個理由當天就過期**。
   * 今天釘的新邊界是 `tuple`／`dict`：**內建表裡沒有它們**。
   */
  it('★ 不在下拉裡的名字不得被認走（`tuple`／`dict` 是刻意的）', async () => {
    expect(componentIdsOf(await liftPython('tuple(x)\n'))).not.toContain('python:cast')
    expect(componentIdsOf(await liftPython('dict(x)\n'))).not.toContain('python:cast')
  })

  it('🟢 而 `set(...)` 收得下（2026-08-23 起）——去重之後印出來是 `{…}`', async () => {
    expect(componentIdsOf(await liftPython('s = set(xs)\n'))).toContain('python:cast')
    expect(await runPython('print(set([3, 1, 3]))\n')).toContain('{3, 1}')
  })

  it('🟢 而 `list(...)` 收得下——「把走訪得到的東西收成一串」到處都是', async () => {
    expect(componentIdsOf(await liftPython('a = list(d.keys())\n'))).toContain('python:cast')
    expect(await runPython('print(list("abc"))\n')).toContain("['a', 'b', 'c']")
  })

  it('generate ＋ round-trip', async () => {
    const code = 'n = int("12")\ns = str(n)\nprint(s)\n'
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
  })

  it('🔴 execute：`int("12") + 1` 是 13，不是 "121"', async () => {
    expect(await runPython('print(int("12") + 1)\n')).toContain('13')
  })

  it('🔴 execute：`int(3.7)` 無條件捨去', async () => {
    expect(await runPython('print(int(3.7), int(-3.7))\n')).toContain('3 -3')
  })

  it('🔴 execute：`bool` 看容器空不空，不是轉成數字', async () => {
    expect(await runPython('print(bool([1, 2]), bool([]), bool(0))\n')).toContain('True False False')
  })

  it('🔴 execute：`float(1)` 印出來要有小數點', async () => {
    expect(await runPython('print(float(1))\n')).toContain('1.0')
  })

  it('🔴 使用者自己 `def int(x)` 時要讓路——判別在 lift 期，蓋掉是執行期的事', async () => {
    expect(await runPython('def int(x):\n    return 99\n\nprint(int("12"))\n')).toContain('99')
  })
})
