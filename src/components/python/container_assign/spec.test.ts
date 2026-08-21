/** `python:container_assign` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:container_assign', () => {
  it('★ lift：左邊是「容器的某一格」時認得出來', async () => {
    const ids = componentIdsOf(await liftPython('a[0] = 5\n'))
    expect(ids).toContain('python:container_assign')
    expect(ids, '被一般指派接走的話左邊會被壓成字串').not.toContain('python:var_assign')
  })

  it('★ 對照組：裸名字的指派仍然走一般指派', async () => {
    const ids = componentIdsOf(await liftPython('a = 5\n'))
    expect(ids).toContain('python:var_assign')
    expect(ids).not.toContain('python:container_assign')
  })

  it('🔴 巢狀的左邊——這是它被做出來的原因', async () => {
    const code = 'grid[1][1] = 9\n'
    expect(componentIdsOf(await liftPython(code))).toContain('python:container_assign')
    expect(gen(await liftPython(code)).trimEnd(), '壓成字串的話拆出來的名字是 `1][1`').toBe(code.trimEnd())
    expect(await runPython('g = [[1, 2], [3, 4]]\ng[1][1] = 9\nprint(g)\n')).toContain('[[1, 2], [3, 9]]')
  })

  it('🔴 execute：串列寫得進去、字典可以【新增】一個鍵', async () => {
    expect(await runPython('n = [3, 1, 4]\nn[1] = 7\nprint(n)\n')).toContain('[3, 7, 4]')
    expect(await runPython('d = {"a": 1}\nd["b"] = 2\nprint(d)\n')).toContain("{'a': 1, 'b': 2}")
  })

  it('🔴 execute：串列【不能】用指派長出新的一格', async () => {
    expect(await runPython('n = [1]\nn[5] = 9\nprint(n)\n')).toMatch(/例外|錯誤|Error/)
  })
})
