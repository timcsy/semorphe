/** `python:loop_while` 的自證測（spec 168）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:loop_while', () => {
  it('★ lift：認得出來', async () => {
    const ids = componentIdsOf(await liftPython('while x > 0:\n    x = x - 1\n'))
    expect(ids, '沒認出 while → 下面會空過').toContain('python:loop_while')
    expect(ids).not.toContain('cpp:loop_while')
  })

  it('🔴 body 要接進來，不是空的', async () => {
    const ids = componentIdsOf(await liftPython('while x > 0:\n    x = x - 1\n'))
    expect(ids, 'body 沒接進來 → 迴圈裡的指派不見了').toContain('python:var_assign')
  })

  it('★ generate ＋ round-trip：縮排不是大括號', async () => {
    expect(gen(await liftPython('while x > 0:\n    x = x - 1\n')))
      .toBe('while x > 0:\n    x = x - 1')
  })
})

describe('python:loop_while — else（第 417 刀）', () => {
  const code = 'n = 3\nwhile n > 0:\n    n = n - 1\n    if n == 5:\n        break\nelse:\n    print("done", n)\n'

  it('★ lift：else 那一段進 else_body，不再整顆降級', async () => {
    const t = await liftPython(code)
    const ids = componentIdsOf(t)
    expect(ids, '正向錨點').toContain('python:loop_while')
    expect(ids.filter((i) => /raw|unresolved/.test(i))).toEqual([])
  })

  it('★ generate ＋ round-trip：一字不差', async () => {
    expect(gen(await liftPython(code))).toBe(code.trim())
  })

  it('★ 執行：沒遇到 break 才做 else（Cella）', async () => {
    expect(await runPython(code)).toBe('completed|done 0\n')
    const broke = code.replace('n == 5', 'n == 1')
    expect(await runPython(broke), 'break 了就不做 else').toBe('completed|')
  })

  it('🔴 else 裡只有註解與 pass：兩行都要回得來（不可以收成「沒有 else」）', async () => {
    const src = 'while a:\n    a = 0\nelse:\n    # 什麼都不做\n    pass\n'
    expect(componentIdsOf(await liftPython(src)), '正向錨點').toContain('python:loop_while')
    expect(gen(await liftPython(src))).toBe(src.trim())
  })
})
