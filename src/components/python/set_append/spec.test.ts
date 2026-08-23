/**
 * `python:set_append` 的規格——`s.add(x)`。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, generatePython as gen, componentIdsOf, runPython } from '../../../../tests/helpers/python-lift'

const CODE = 's = {1}\ns.add(2)\ns.add(1)\nprint(sorted(s))\n'

describe('python:set_append', () => {
  it('lift：拿得到自己的身分，而不是掉進通用桶', async () => {
    const ids = componentIdsOf(await liftPython(CODE))
    expect(ids).toContain('python:set_append')      // ← 正向錨點
    expect(ids).not.toContain('raw_code')
    expect(ids).not.toContain('python:func_call')
  })

  it('generate ＋ round-trip：一字不差', async () => {
    expect(gen(await liftPython(CODE)).trimEnd()).toBe(CODE.trimEnd())
  })

  it('execute：重複的不會加第二次', async () => {
    expect(await runPython(CODE)).toContain('[1, 2]')
  })

  it('🔴 串列上要出聲——Python 的串列沒有 add', async () => {
    const out = await runPython('xs = [1]\nxs.add(2)\n')
    expect(out).toMatch(/append/)   // 錯誤訊息裡直接寫修法
  })

  it('★ 邊界：`.append` 不得被認走', async () => {
    const ids = componentIdsOf(await liftPython('xs = [1]\nxs.append(2)\n'))
    expect(ids).toContain('python:container_append')  // ← 正向錨點
    expect(ids).not.toContain('python:set_append')
  })
})
