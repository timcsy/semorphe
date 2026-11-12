/** `python:decorated` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'
import { expectCellaOut, knownCellaGap } from '../../../../tests/helpers/cella-run'

const roundTrip = async (code: string) => {
  const t = await liftPython(code)
  expect(componentIdsOf(t), code).toContain('python:decorated')
  expect(componentIdsOf(t), code).not.toContain('unresolved')
  expect(gen(t).trimEnd(), code).toBe(code.trimEnd())
  expect(gen(await liftPython(gen(t))), '來回是不動點').toBe(gen(t))
}

describe('python:decorated', () => {
  it('★ 名字、屬性、呼叫形式的裝飾器，函式與類別，來回一字不差', async () => {
    await roundTrip('@staticmethod\ndef fmt(x):\n    return x\n')
    await roundTrip('@lru_cache(maxsize=None)\ndef fib(n):\n    return n\n')
    await roundTrip('@a\n@b.c\n@d(1, 2)\ndef f():\n    pass\n')
    await roundTrip('@dataclass\nclass P:\n    x = 0\n')
  })

  it('★ 類別裡帶裝飾器的方法：類別整顆收下，方法是 decorated', async () => {
    const code = 'class A:\n    @staticmethod\n    def f(x):\n        return x + 1\n\n    @property\n    def g(self):\n        return 2\n'
    const t = await liftPython(code)
    const ids = componentIdsOf(t)
    expect(ids).toContain('python:class_def')
    expect(ids).toContain('python:decorated')
    expect(ids).not.toContain('unresolved')
    expect(gen(await liftPython(gen(t)))).toBe(gen(t))
  })

  it('🔴 收不下的裝飾器整段照實保留（不收一半）', async () => {
    expect(componentIdsOf(await liftPython('@a\ndef f():\n    pass\n'))).toContain('python:decorated')
    for (const code of ['@(lambda f: f)\ndef f():\n    pass\n', '@xs[0]\ndef f():\n    pass\n']) {
      const ids = componentIdsOf(await liftPython(code))
      expect(ids, code).toContain('unresolved')
      expect(ids, code).not.toContain('python:decorated')
    }
  })

  it('🔴 執行（Cella）：靜態方法、類別方法、唯讀屬性', async () => {
    await expectCellaOut(
      'class A:\n    n = 3\n\n    @staticmethod\n    def twice(x):\n        return x * 2\n\n    @classmethod\n    def make(cls):\n        return cls.n\n\n    @property\n    def half(self):\n        return self.n / 2\n\nprint(A.twice(4), A().twice(5), A.make(), A().half)\n',
      '8 10 3 1.5\n', { lang: 'python' })
  })

  it('🔴 執行（Cella）：自己寫的裝飾器，由下往上套用', async () => {
    await expectCellaOut(
      'def add1(f):\n    def g(x):\n        return f(x) + 1\n    return g\n\ndef dbl(f):\n    def g(x):\n        return f(x) * 2\n    return g\n\n@add1\n@dbl\ndef h(x):\n    return x\n\nprint(h(5))\n',
      '11\n', { lang: 'python' })
  })

  it('執行（Cella 缺口）：functools.lru_cache', async () => {
    await knownCellaGap(/functools/, async () => {
      await expectCellaOut('from functools import lru_cache\n\n@lru_cache(maxsize=None)\ndef f(n):\n    return n\n\nprint(f(3))\n', '3\n', { lang: 'python' })
    })
  })
})
