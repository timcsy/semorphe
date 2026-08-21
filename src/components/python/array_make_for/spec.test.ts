/** `python:array_make_for` 的自證測。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

const ids = async (c: string): Promise<string[]> => componentIdsOf(await liftPython(c))
const rt = async (c: string): Promise<string> => gen(await liftPython(c)).trim()

describe('python:array_make_for', () => {
  it('lift：有無篩選都收得了', async () => {
    expect(await ids('a = [x * x for x in xs]\n'), '正向錨點').toContain('python:array_make_for')
    expect(await ids('a = [x for x in xs if x > 0]\n')).toContain('python:array_make_for')
    expect(await ids('a = [x for x in xs if x > 0]\n')).not.toContain('unresolved')
  })

  it('🔴 lift：巢狀整顆走誠實降級——收一半會少一層迴圈', async () => {
    const nested = 'a = [x for row in m for x in row]\n'
    expect(await ids(nested)).not.toContain('python:array_make_for')
    expect(await ids(nested), '而它必須看得見').toContain('unresolved')
  })

  it('來回：一字不差', async () => {
    for (const c of ['a = [x * x for x in xs]', 'a = [x for x in xs if x > 0]']) {
      expect(await rt(c + '\n'), c).toBe(c)
    }
  })

  it('執行：算得出來，篩選也有作用', async () => {
    expect(await runPython('sq = [x * x for x in range(4)]\nprint(sq)\n')).toContain('[0, 1, 4, 9]')
    expect(await runPython('ev = [x for x in range(6) if x % 2 == 0]\nprint(ev)\n')).toContain('[0, 2, 4]')
  })

  it('🔴 執行：那個名字只在運算式裡活著，不得污染外面', async () => {
    const out = await runPython('x = 99\na = [x for x in range(3)]\nprint(x)\n')
    expect(out, `外面的 x 被生成式改掉了：${JSON.stringify(out)}`).toContain('99')
  })
})
