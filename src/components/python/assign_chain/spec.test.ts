/**
 * `python:assign_chain` 的自證測（第 413 刀）。
 *
 * 410 之前 `is_prime[0] = is_prime[1] = False` 產回去是 `is_prime[0] = `（壞掉的程式）；
 * 410 起整句降級；這一顆收下它。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython, runPython } from '../../../../tests/helpers/python-lift'

const ids = async (code: string): Promise<string[]> => componentIdsOf(await liftPython(code))
const roundTrip = async (code: string): Promise<string> => generatePython(await liftPython(code)).trim()

describe('python:assign_chain', () => {
  it('lift：三種目標（名字、索引、屬性）都收', async () => {
    for (const c of ['a = b = 0', 'is_prime[0] = is_prime[1] = False', 'o.x = y = z = 1']) {
      const f = await ids(c)
      expect(f, `正向錨點：${c}`).toContain('python:assign_chain')
      expect(f.filter((i) => /raw|unresolved/.test(i)), c).toEqual([])
    }
  })

  it('lift：單一指派、序列指派不受影響', async () => {
    const one = await ids('a = 0')
    expect(one, '正向錨點').toContain('python:var_assign')
    expect(one).not.toContain('python:assign_chain')
    const seq = await ids('a, b = 1, 2')
    expect(seq, '正向錨點').toContain('python:var_assign_sequence')
    expect(seq).not.toContain('python:assign_chain')
  })

  it('任一格是解包或帶型別註記 → 整句降級（不收一半）', async () => {
    for (const c of ['a, b = c = (1, 2)', 'c = a, b = (1, 2)']) {
      const f = await ids(c)
      expect(f, `正向錨點：${c}`).toContain('python:program')
      expect(f, c).not.toContain('python:assign_chain')
      expect(await roundTrip(c), '照實保留').toBe(c)
    }
  })

  it('來回：一字不差', async () => {
    for (const c of ['a = b = 0', 'is_prime[0] = is_prime[1] = False', 'o.x = y = z = f(1)', 'grid[i][j] = best = max(a, b)']) {
      expect(await roundTrip(c)).toBe(c)
    }
  })

  it('執行：值只算一次、由左到右存、存的是同一個東西', async () => {
    expect(await runPython('a = b = 0\nb += 1\nprint(a, b)\n')).toBe('completed|0 1\n')
    expect(await runPython('xs = ys = []\nxs.append(1)\nprint(ys)\n')).toBe('completed|[1]\n')
    // 由左到右：先存 a[i]（i 還是 0），再存 i
    expect(await runPython('a = [9, 9]\ni = 0\na[i] = i = 1\nprint(a, i)\n')).toBe('completed|[1, 9] 1\n')
    expect(await runPython('n = 0\ndef f():\n    global n\n    n += 1\n    return n\nx = y = f()\nprint(x, y, n)\n')).toBe('completed|1 1 1\n')
  })
})
