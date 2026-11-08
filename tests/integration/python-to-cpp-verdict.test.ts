/**
 * **Python → C++：兩邊交給 Cella 判，判決、輸出、assumes 相同**（spec 225）。
 *
 * ⚠️ Phase 1：型別表是**手寫的**（`tests/helpers/fake-observed-types.ts`）——Cella 的 `python.observedTypes` 發布之後換成真的，
 *    並加上 python-beginner 課文逐支的護欄（tasks T007）。這裡先釘住「換出來的 C++ 是合法的、意思相同」。
 */
import { describe, it, expect } from 'vitest'
import { liftPython } from '../helpers/python-lift'
import { runCella } from '../helpers/cella-run'
import { fakeObserved } from '../helpers/fake-observed-types'
import { convertPythonToCpp } from '../../src/languages/python/python-to-cpp'

const CASES: [string, string, Record<string, string>, string][] = [
  ['印出、end、sep', 'n = 3\nprint("hi", n)\nprint(n, end="")\nprint(1, 2, sep=",")\n', { n: 'int' }, ''],
  ['讀一行轉整數、if／else 裡第一次指定、印 bool', 'x = int(input())\nif x > 0:\n    y = x * 2\nelse:\n    y = 0\nprint(y, x > 1)\n', { x: 'int', y: 'int' }, '5\n'],
  ['負數的 // 與 %（向下取整）', 'a = -7\nb = 2\nprint(a // b, a % b)\nc = a // -3\nprint(c)\n', { a: 'int', b: 'int', c: 'int' }, ''],
  ['計數 for（含倒數）、while、break、清單', 'xs = []\nfor i in range(3):\n    xs.append(i * 2)\nfor j in range(5, 0, -1):\n    xs[0] = j\nk = 0\nwhile k < len(xs):\n    k += 1\n    break\nprint(xs[0], sum(xs), max(xs), k, i, j)\n', { xs: 'list[int]', i: 'int', j: 'int', k: 'int' }, ''],
  // Python：本體改迴圈變數不影響下一圈（C++ 的 for 會）
  ['計數 for 的本體改迴圈變數', 't = 0\nfor i in range(3):\n    i = i * 10\n    t += i\nprint(t)\n', { t: 'int', i: 'int' }, ''],
  ['函式', 'def add(a, b):\n    return a + b\nprint(add(1, 2))\n', { a: 'int', b: 'int', 'add()': 'int' }, ''],
  ['字串相加', 's = input()\nt = s + "!"\nprint(t)\n', { s: 'str', t: 'str' }, 'hey\n'],
]

describe('Python → C++：換出來的 C++ 與原本的 Python 判得一樣（手寫型別表）', () => {
  for (const [name, src, vars, stdin] of CASES) {
    it(name, async () => {
      const t = (await liftPython(src))!
      const r = convertPythonToCpp(t, fakeObserved(t, vars))
      expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
      const a = await runCella(src, { lang: 'python', stdin })
      const b = await runCella(r.code!, { lang: 'cpp', stdin })
      const show = `\n--- C++ ---\n${r.code}--- Python: ${a.verdict} ${JSON.stringify(a.out)} / C++: ${b.verdict} ${JSON.stringify(b.out)} ${JSON.stringify(b.problems?.map((p) => p.reason ?? p.kind))}`
      expect(a.verdict, `Python 那一側本身就不是 accept${show}`).toBe('accept')
      expect(b.verdict, show).toBe(a.verdict)
      expect(b.out, show).toBe(a.out)
      expect(b.assumes ?? [], show).toEqual(a.assumes ?? [])
    }, 120_000)
  }
})
