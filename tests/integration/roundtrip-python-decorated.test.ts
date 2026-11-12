/**
 * 第 424 刀（元件管線）：裝飾器和類別、巢狀函式、多個裝飾器、呼叫形式組在一起。
 *
 * 每一支：lift 認得（元件身分對、零降級）→ 產碼與原文一字不差（空行除外） → 再 lift 是不動點 → Cella 的輸出等於 python3 真跑出來的。
 * expected 是 2026-11-12 用 python3 跑出來的。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython } from '../helpers/python-lift'
import { expectCellaOut } from '../helpers/cella-run'

const CASES: [string, string, string][] = [
  ["class_three_kinds", "class Temp:\n    unit = \"C\"\n\n    def __init__(self, c):\n        self.c = c\n\n    @staticmethod\n    def to_f(c):\n        return c * 9 / 5 + 32\n\n    @classmethod\n    def freezing(cls):\n        return cls(0)\n\n    @property\n    def f(self):\n        return Temp.to_f(self.c)\n\nt = Temp.freezing()\nprint(t.c, t.f, Temp.to_f(100), Temp.unit)\n", "0 32.0 212.0 C\n"],
  ["property_setter", "class Box:\n    def __init__(self):\n        self._w = 1\n\n    @property\n    def w(self):\n        return self._w\n\n    @w.setter\n    def w(self, v):\n        self._w = max(0, v)\n\nb = Box()\nb.w = 5\nprint(b.w)\nb.w = -3\nprint(b.w)\n", "5\n0\n"],
  ["stacked_custom", "def twice(f):\n    def g(x):\n        return f(f(x))\n    return g\n\ndef plus(n):\n    def deco(f):\n        def g(x):\n            return f(x) + n\n        return g\n    return deco\n\n@twice\n@plus(3)\ndef ident(x):\n    return x\n\nprint(ident(1))\n", "7\n"],
  ["nested_decorated", "def logged(f):\n    def g(*args):\n        print(\"call\", f.__name__)\n        return f(*args)\n    return g\n\ndef outer(k):\n    @logged\n    def inner(x):\n        return x * k\n    return inner(4)\n\nprint(outer(3))\n", "call inner\n12\n"],
  ["decorator_in_loop_use", "registry = []\n\ndef register(f):\n    registry.append(f)\n    return f\n\n@register\ndef a():\n    return 1\n\n@register\ndef b():\n    return 2\n\nfor fn in registry:\n    print(fn())\n", "1\n2\n"],
]

describe('裝飾器的組合來回', () => {
  for (const [id, code, expected] of CASES) {
    it(id, async () => {
      const t = await liftPython(code)
      const ids = componentIdsOf(t)
      expect(ids, '量到了被測的元件').toContain('python:decorated')
      expect(ids.filter((x) => /raw|unresolved/.test(x)), '零降級').toEqual([])
      const gen = generatePython(t)
      // ⚠️ 空行不在語義樹裡（既有的正規化，與裝飾器無關）：比對時去掉原文的空行
      expect(gen.trimEnd()).toBe(code.replace(/\n\n+/g, '\n').trimEnd())
      expect(generatePython(await liftPython(gen)), '來回是不動點').toBe(gen)
      await expectCellaOut(code, expected, { lang: 'python' })
    })
  }
})
