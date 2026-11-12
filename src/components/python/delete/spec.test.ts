/** `python:delete` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'
import { expectCellaOut, runCella } from '../../../../tests/helpers/cella-run'

const roundTrip = async (code: string) => {
  const t = await liftPython(code)
  expect(componentIdsOf(t), code).toContain('python:delete')
  expect(componentIdsOf(t), code).not.toContain('unresolved')
  expect(gen(t).trimEnd(), code).toBe(code.trimEnd())
  expect(gen(await liftPython(gen(t))), '來回是不動點').toBe(gen(t))
}

describe('python:delete', () => {
  it('★ 刪名字、刪屬性、一次刪好幾個（含某一格）都收、來回一字不差', async () => {
    await roundTrip('x = 1\ndel x\n')
    await roundTrip('del b.rate\n')
    await roundTrip('del a, b\n')
    await roundTrip('del a, xs[0], o.y\n')
    await roundTrip('del self.cache[k].x\n')
  })

  it('★ 單一的某一格仍歸同族「刪掉容器的一格」，不歸這裡', async () => {
    const ids = componentIdsOf(await liftPython('del d["a"]\n'))
    expect(ids).toContain('python:container_erase')
    expect(ids).not.toContain('python:delete')
  })

  it('🔴 收不下的目標整句誠實降級', async () => {
    expect(componentIdsOf(await liftPython('del a, b\n'))).toContain('python:delete')
    for (const code of ['del (a)\n', 'del [a, b]\n', 'del (a, b)\n']) {
      expect(componentIdsOf(await liftPython(code)), code).not.toContain('python:delete')
    }
  })

  it('🔴 執行（Cella）：刪掉實例的屬性之後，讀到的是類別上的那一個', async () => {
    await expectCellaOut('class A:\n    rate = 0.02\na = A()\na.rate = 0.05\nprint(a.rate)\ndel a.rate\nprint(a.rate)\n', '0.05\n0.02\n', { lang: 'python' })
  })

  it('🔴 執行（Cella）：一次刪好幾個，由左到右', async () => {
    await expectCellaOut('xs = [1, 2, 3]\nd = {"k": 1, "j": 2}\ny = 5\ndel xs[0], d["k"], y\nprint(xs, d)\n', '[2, 3] {\'j\': 2}\n', { lang: 'python' })
  })

  it('🔴 執行（Cella）：刪掉的名字再讀會出錯（照實判，不假裝沒事）', async () => {
    // ⚠️ 以例外結束的程式，判決仍是 accept（程式照語言的規則跑完了），結束碼與那則 NameError 說的是「停在哪」
    const r = await runCella('x = 1\ndel x\nprint(x)\n', { lang: 'python' })
    expect(r.verdict).toBe('accept')
    expect(r.raw?.exit).toBe(1)
    expect(r.problems.map((p) => p.reason).join()).toContain("NameError: name 'x' is not defined")
  })
})
