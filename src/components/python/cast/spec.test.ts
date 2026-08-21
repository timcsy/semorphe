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

  it('★ 不是那四個名字的不得被認走', async () => {
    expect(componentIdsOf(await liftPython('list(x)\n'))).not.toContain('python:cast')
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
