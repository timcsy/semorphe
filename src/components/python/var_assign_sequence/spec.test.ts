/** `python:var_assign_sequence` 的自證測——第 421 刀起它的目標可以是一個樣式。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

const find = (n: any): any => n?.componentId === 'python:var_assign_sequence' ? n
  : Object.values(n?.slots ?? {}).flat().map(find).find(Boolean)

describe('python:var_assign_sequence', () => {
  it('★ 平的名字仍是 targets（形態不變）', async () => {
    const s = find(await liftPython('x, y = p\n'))
    expect(s, '正向錨點：認得這個序列指派').toBeTruthy()
    expect(s.slots.targets?.map((p: any) => p.properties.name)).toEqual(['x', 'y'])
    expect(s.slots.pattern ?? []).toEqual([])
  })

  it('單一指派沒有被搶走（對照組）', async () => {
    const ids = componentIdsOf(await liftPython('x = 1\na[0] = 2\n'))
    expect(ids).toContain('python:var_assign')
    expect(ids).not.toContain('python:var_assign_sequence')
  })
})

describe('python:var_assign_sequence — 目標是一個樣式（第 421 刀）', () => {
  const cases = [
    'a[i], a[j] = a[j], a[i]',
    'first, *mid, last = r',
    'a, (b, c) = 1, (2, 3)',
    'o.x, o.y = o.y, o.x',
    '(p, q) = q, p',
    'x, = t',
    'g[r][c], n = 0, n + 1',
    'x, y = (1, 2)',
    '(a, b), c = (1, 2), 3',
  ]

  it('★ lift：樣式進 pattern，裡面是元組／變數／索引／屬性／展開', async () => {
    const s = find(await liftPython(cases[0] + '\n'))
    expect(s, '正向錨點：認得這個序列指派').toBeTruthy()
    expect(s.slots.pattern?.[0]?.componentId).toBe('python:tuple_make')
    const ids = componentIdsOf(await liftPython(cases.join('\n') + '\n'))
    expect(ids).toContain('python:splat')
    expect(ids).toContain('python:container_at')
    expect(ids).toContain('python:member_at')
    expect(ids.filter((i) => /raw|unresolved/.test(i))).toEqual([])
  })

  for (const c of cases) {
    it(`★ 來回一字不差：${c}`, async () => {
      expect(gen(await liftPython(c + '\n')).trim()).toBe(c)
    })
  }

  it('🔴 切片目標與連鎖仍整句降級（收一半就是另一支程式）', async () => {
    const anchor = componentIdsOf(await liftPython('a, b = 1, 2\n'))
    expect(anchor, '正向錨點').toContain('python:var_assign_sequence')
    for (const c of ['a[1:3], b = [9], 2\n', 'a, b = c, d = 1, 2\n']) {
      const t: any = await liftPython(c)
      const top = Object.values(t.slots ?? {}).flat()[0] as any
      expect(top?.componentId, `${c}：最外層那一句要降級（裡面的子句可以照樣認得來顯示）`).not.toBe('python:var_assign_sequence')
      expect(gen(t).trim(), '降級也不得改動原文').toBe(c.trim())
    }
  })

  it('★ 執行：交換、展開、巢狀、屬性（Cella）', async () => {
    const src = [
      'a = [5, 7, 9]',
      'i, j = 0, 2',
      'a[i], a[j] = a[j], a[i]',
      'print(a)',
      'first, *mid, last = range(5)',
      'print(first, mid, last)',
      'x, (y, z) = 1, (2, 3)',
      'print(x + y + z)',
      'class P:',
      '    pass',
      'o = P()',
      'o.x, o.y = 3, 4',
      'o.x, o.y = o.y, o.x',
      'print(o.x, o.y)',
      'g = [[0, 0], [0, 0]]',
      'g[1][0], n = 8, 1',
      'print(g, n)',
    ].join('\n') + '\n'
    expect(await runPython(src)).toBe('completed|[9, 7, 5]\n0 [1, 2, 3] 4\n6\n4 3\n[[0, 0], [8, 0]] 1\n')
  })
})
