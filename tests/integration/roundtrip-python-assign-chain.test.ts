/**
 * 元件管線 413 · round-trip：Python 的連鎖指定 `a = b = 0`（`python:assign_chain`）
 *
 * 名字、下標、屬性三種目標、三個以上目標、函式與迴圈裡、右邊是運算式。
 * 每一支都驗：元件身分、lift → 產碼一字不差、再 lift 是不動點、Cella 判決的輸出與 CPython 相同。
 * 期望輸出是 python3 實跑錄下的。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, generatePython, componentIdsOf, runPython } from '../helpers/python-lift'

const P: Record<string, { code: string; expected: string }> = {
  "names": {
    "code": "a = b = c = 7\nprint(a, b, c)\n",
    "expected": "7 7 7\n"
  },
  "subscript": {
    "code": "g = [[0] * 3 for _ in range(2)]\ng[0][1] = g[1][2] = 9\nprint(g)\n",
    "expected": "[[0, 9, 0], [0, 0, 9]]\n"
  },
  "attribute": {
    "code": "class P:\n    def __init__(self):\n        self.x = self.y = 0\n\np = P()\np.x = p.y = 3\nprint(p.x + p.y)\n",
    "expected": "6\n"
  },
  "mixed": {
    "code": "class P:\n    def __init__(self):\n        self.x = self.y = 0\n\no = P()\nd = {}\no.v = d[\"k\"] = n = 2 * 5 + 1\nprint(o.v, d, n)\n",
    "expected": "11 {'k': 11} 11\n"
  },
  "in_func_loop": {
    "code": "def reset(xs):\n    for i in range(len(xs)):\n        lo = hi = xs[i]\n        xs[i] = lo + hi\n    return xs\n\nprint(reset([1, 2, 3]))\n",
    "expected": "[2, 4, 6]\n"
  },
  "expr_rhs": {
    "code": "s = t = \"ab\" * 2\nprint(s, t, len(s))\n",
    "expected": "abab abab 4\n"
  }
}

describe('round-trip：連鎖指定（413）', () => {
  for (const [id, { code, expected }] of Object.entries(P)) {
    it(id, async () => {
      const t = await liftPython(code)
      const ids = componentIdsOf(t)
      expect(ids, '元件身分').toContain('python:assign_chain')
      expect(ids.filter((i) => /raw|unresolved/.test(i)), '整段都認得').toEqual([])
      const gen = generatePython(t)
      // 空行由產生器正規化（既有行為），比的是其餘每一字
      const squeeze = (s: string) => s.replace(/\n\s*\n/g, '\n').trimEnd()
      expect(squeeze(gen)).toBe(squeeze(code))
      expect(generatePython(await liftPython(gen)), '第二趟漂了').toBe(gen)
      expect(await runPython(code)).toBe('completed|' + expected)
    })
  }

  it('任何一格是多目標（`a, b = c = 1, 2`）仍整句照實降級，不收成連鎖指定', async () => {
    const code = 'a, b = c = 1, 2\nprint(a, b, c)\n'
    const t = await liftPython(code)
    const ids = componentIdsOf(t)
    expect(ids, '正向錨點：print 認得').toContain('python:print')
    expect(ids).not.toContain('python:assign_chain')
    expect(generatePython(t), '照實保留原文').toContain('a, b = c = 1, 2')
  })
})
