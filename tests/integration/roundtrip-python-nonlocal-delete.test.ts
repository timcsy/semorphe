/**
 * 第 423 刀（元件管線）：`nonlocal` 與 `del` 和巢狀函式、類別、迴圈、try 組在一起。
 *
 * 每一支：lift 認得（元件身分對、零降級）→ 產碼與原文一字不差 → 再 lift 是不動點 → Cella 的輸出等於 python3 真跑出來的。
 * expected 是 2026-11-12 用 python3 跑出來的。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython } from '../helpers/python-lift'
import { expectCellaOut } from '../helpers/cella-run'

const CASES: [string, string, string][] = [
  ["closure_counter", "def make_counter(start):\n    count = start\n    def step(by=1):\n        nonlocal count\n        count += by\n        return count\n    return step\nc = make_counter(10)\nfor i in range(3):\n    print(c(i))\n", "10\n11\n13\n"],
  ["nested_two_levels", "def outer():\n    total = 0\n    def mid():\n        def inner():\n            nonlocal total\n            total += 5\n        inner()\n        inner()\n    mid()\n    return total\nprint(outer())\n", "10\n"],
  ["class_attr_delete", "class Account:\n    rate = 0.02\n    def __init__(self, owner):\n        self.owner = owner\na = Account(\"Amy\")\na.rate = 0.05\nprint(a.rate, Account.rate)\ndel a.rate\nprint(a.rate)\n", "0.05 0.02\n0.02\n"],
  ["del_in_loop", "d = {\"a\": 1, \"b\": 2, \"c\": 3}\nkeys = list(d)\nfor k in keys:\n    if d[k] % 2 == 1:\n        del d[k]\nxs = [5, 6, 7, 8]\ndel xs[0], xs[1]\nprint(d, xs)\n", "{'b': 2} [6, 8]\n"],
  ["del_name_try", "x = 3\ndel x\ntry:\n    print(x)\nexcept NameError as e:\n    print(\"gone\")\ny, z = 1, 2\ndel y, z\nprint(\"ok\")\n", "gone\nok\n"],
]

describe('nonlocal 與 del 的組合來回', () => {
  for (const [id, code, expected] of CASES) {
    it(id, async () => {
      const t = await liftPython(code)
      const ids = componentIdsOf(t)
      expect(ids.some((x) => x === 'python:nonlocal' || x === 'python:delete' || x === 'python:container_erase'), '量到了被測的元件').toBe(true)
      expect(ids.filter((x) => /raw|unresolved/.test(x)), '零降級').toEqual([])
      const gen = generatePython(t)
      expect(gen.trimEnd()).toBe(code.trimEnd())
      expect(generatePython(await liftPython(gen)), '來回是不動點').toBe(gen)
      await expectCellaOut(code, expected, { lang: 'python' })
    })
  }
})
