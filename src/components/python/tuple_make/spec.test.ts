/** 第三批：固定組合、序列指派、引入模組、取成員、for 多目標。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython, runPython } from '../../../../tests/helpers/python-lift'

const ids = async (c: string): Promise<string[]> => componentIdsOf(await liftPython(c))
const rt = async (c: string): Promise<string> => generatePython(await liftPython(c)).trim()

describe('python 多重指派家族', () => {
  it('lift：五種寫法各自認得出來', async () => {
    expect(await ids('p = (3, 4)\n')).toContain('python:tuple_make')
    expect(await ids('x, y = p\n')).toContain('python:var_assign_sequence')
    expect(await ids('a, b = 1, 2\n'), '裸的 1, 2 也是一個固定組合').toContain('python:tuple_make')
    expect(await ids('import math\n')).toContain('python:import')
    expect(await ids('x = math.pi\n')).toContain('python:member_at')
  })

  it('lift：單一指派沒有被序列那顆搶走（對照組）', async () => {
    const got = await ids('x = 1\n')
    expect(got).toContain('python:var_assign')
    expect(got).not.toContain('python:var_assign_sequence')
  })

  it('🔴 來回：括號是排版，投影記住它', async () => {
    expect(await rt('p = (3, 4)\n')).toBe('p = (3, 4)')
    expect(await rt('a, b = 1, 2\n'), '硬加括號等於改了使用者的碼').toBe('a, b = 1, 2')
    expect(await rt('p = (3,)\n'), '一格的固定組合要保留那個逗號').toBe('p = (3,)')
  })

  it('來回：其餘一字不差', async () => {
    for (const c of ['x, y = p', 'import math', 'x = math.pi', 'for k, v in d:\n    print(k)']) {
      expect(await rt(c + '\n'), c).toBe(c)
    }
  })

  it('執行：拆開、交換、模組成員', async () => {
    expect(await runPython('p = (3, 4)\nx, y = p\nprint(x, y)\n')).toContain('3 4')
    expect(await runPython('a, b = 1, 2\na, b = b, a\nprint(a, b)\n')).toContain('2 1')
    expect(await runPython('import math\nprint(math.pi > 3)\n')).toContain('True')
    expect(await runPython('import math\nprint(math.sqrt(16))\n')).toContain('4')
  })

  it('🔴 執行：for 的多目標——字典的鍵與值', async () => {
    const out = await runPython('d = {"甲": 1, "乙": 2}\nfor k, v in d.items():\n    print(k, v)\n')
    expect(out).toContain('甲 1')
    expect(out).toContain('乙 2')
  })

  it('🔴 執行：格數對不上要出聲，不得補 None', async () => {
    const out = await runPython('a, b, c = 1, 2\nprint(a)\n')
    expect(out, `靜靜跑完了：${JSON.stringify(out)}`).toMatch(/例外|錯誤|Error/)
  })
})
