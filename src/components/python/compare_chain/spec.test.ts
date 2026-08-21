/** `python:compare_chain` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:compare_chain', () => {
  it('★ lift：串接比較認得出來', async () => {
    expect(componentIdsOf(await liftPython('y = 1 < x < 10\n'))).toContain('python:compare_chain')
  })

  it('🔴 一般的兩元比較【不得】被搶走（對照組）', async () => {
    const ids = componentIdsOf(await liftPython('y = 1 < x\n'))
    expect(ids).toContain('python:compare')
    expect(ids).not.toContain('python:compare_chain')
  })

  it('🔴 三段以上【主動變灰】，不是被一般比較砍掉後半段', async () => {
    const ids = componentIdsOf(await liftPython('y = 1 < x < 10 < z\n'))
    expect(ids, '落到一般比較的話它只讀前兩個運算元——而那是安靜的錯').not.toContain('python:compare')
    expect(ids, '認不得就要看得見').toContain('python:raw_expression')
  })

  it('🔴 generate ＋ round-trip：後半段不得被砍掉', async () => {
    const code = 'y = 1 < x < 10\n'
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
    // 三段以上原文原樣產得回去
    expect(gen(await liftPython('y = 1 < x < 10 < z\n')).trimEnd()).toBe('y = 1 < x < 10 < z')
  })

  it('🔴 execute：三個區間各測一次', async () => {
    expect(await runPython('x = 5\nprint(1 < x < 10, 1 < x < 3, 10 < x < 20)\n')).toContain('True False False')
  })

  it('🔴 execute：中間那一格【只求值一次】', async () => {
    const out = await runPython('def f():\n    print("算了一次")\n    return 5\n\nprint(0 < f() < 10)\n')
    expect(out).toContain('True')
    expect(out.split('算了一次').length - 1, '算了不只一次＝它被展開成 a < b and b < c 了').toBe(1)
  })

  it('🔴 execute：前半不成立就【不算】後半', async () => {
    const out = await runPython('def f():\n    print("算了")\n    return 5\n\nprint(10 < 1 < f())\n')
    expect(out).toContain('False')
    expect(out, '短路失效').not.toContain('算了')
  })
})
