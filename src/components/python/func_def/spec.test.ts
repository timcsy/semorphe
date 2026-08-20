/** `python:func_def` 的自證測（spec 168）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'

describe('python:func_def', () => {
  it('★ lift：認得出來，body 也接得進來', async () => {
    const ids = componentIdsOf(await liftPython('def add(a, b):\n    return a + b\n'))
    expect(ids, '沒認出函式定義 → 下面會空過').toContain('python:func_def')
    expect(ids, 'body 沒接進來').toContain('python:return')
  })

  it('🔴 參數是【結構節點】不是一個字串——這是 mutation 的前提', async () => {
    const t = await liftPython('def add(a, b):\n    return a\n')
    const find = (n: typeof t): typeof t =>
      !n ? null : n.componentId === 'python:func_def' ? n
        : Object.values(n.children ?? {}).flat().map((k) => find(k)).find(Boolean) ?? null
    const fd = find(t)!
    expect(fd.children.params?.length, '🔴 兩個參數要是兩格——一個逗號分隔的字串表達不出「兩格」').toBe(2)
    expect(fd.children.params!.map((p) => p.properties.name)).toEqual(['a', 'b'])
    expect(gen(t)).toBe('def add(a, b):\n    return a')
  })

  it('🔴 認不出來的參數形式走誠實降級，不得產回一個【少了東西】的函式', async () => {
    // `b=1` 是 default_parameter —— 收一半的話 `def f(a, b=1)` 會產回 `def f(a, b)`，
    // 而使用者的預設值就不見了。
    const ids = componentIdsOf(await liftPython('def f(a, b=1):\n    return a\n'))
    expect(ids, '⚠️ 預設值參數被吃掉了').not.toContain('python:func_def')
  })

  it('★ 零參數也走得完', async () => {
    expect(gen(await liftPython('def go():\n    print(1)\n')))
      .toBe('def go():\n    print(1)')
  })
})
