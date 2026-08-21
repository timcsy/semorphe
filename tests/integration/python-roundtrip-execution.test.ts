/**
 * spec 170：**Python 的 round-trip 執行比對**——管線第 3 階段。
 *
 * ## 這一支問的問題與別支不同
 *
 * ```
 * 自證測              lift 對不對 · generate 對不對          （各自一半）
 * python-execution    執行的結果對不對                        （一半）
 * 🔴 這一支            【轉一圈之後】執行的結果還一不一樣      （整條）
 * ```
 *
 * > **一段程式碼轉成積木再轉回來，如果【跑出來的東西】變了，
 * > 那麼「文字一字不差」證明不了任何事——因為它可能兩邊都錯。**
 *
 * 而它是管線第 3 階段（`component-roundtrip`）的機械版：
 * 在 `python:program` 有執行器之前，**這一支寫不出來**。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, generatePython, runPython } from '../helpers/python-lift'

/** 原始碼 → 積木 → 原始碼，回轉一圈後的文字。 */
async function roundTrip(src: string): Promise<string> {
  return generatePython(await liftPython(src))
}

const PROGRAMS: [name: string, code: string, stdin?: string[]][] = [
  ['輸出與字面值', 'print("hi", 42, 3.14, True, None)\n'],
  ['指派與算術', 'x = 5\ny = x * 2 + 1\nprint(y)\n'],
  ['整數與小數的分界', 'print(7 / 2)\nprint(7 // 2)\nprint(2 ** 10)\nprint(-7 % 3)\n'],
  ['比較與邏輯', 'a = 3\nprint(a > 1 and a < 5)\nprint(not a == 3)\n'],
  ['if / elif / else', 'x = 0\nif x > 0:\n    print("正")\nelif x < 0:\n    print("負")\nelse:\n    print("零")\n'],
  ['while 與遞減', 'n = 3\nwhile n > 0:\n    print(n)\n    n = n - 1\n'],
  ['for 走 range', 'for i in range(2, 6):\n    print(i)\n'],
  ['函式與回傳', 'def sq(x):\n    return x * x\nfor i in range(4):\n    print(sq(i))\n'],
  ['讀輸入', 'name = input()\nage = input()\nprint("嗨", name, age)\n', ['小明', '12']],
  ['註解不影響執行', '# 這是註解\nprint(1)\n# 又一行\nprint(2)\n'],
]

describe('spec 170 · Python round-trip 之後【執行結果】不變', () => {
  it('★ 錨點：先證明這批程式本來就跑得起來', async () => {
    for (const [name, code, stdin] of PROGRAMS) {
      const out = await runPython(code, stdin ?? [])
      expect(out, `${name}：原始碼本身就跑不起來 → 下面的比對無意義`).toMatch(/^completed\|/)
    }
  })

  for (const [name, code, stdin] of PROGRAMS) {
    it(`🔴 ${name}`, async () => {
      const back = await roundTrip(code)
      // ① 文字：轉一圈之後一字不差
      expect(back, '文字漂了').toBe(code.trim())
      // ② 🔴 行為：轉一圈之後跑出來的東西一樣
      //    ⚠️ 這一條【比①強】——兩邊文字一樣而行為不同是不可能的，
      //    而兩邊文字不同卻行為相同是可能的（排版）。所以①壞了②不一定壞，
      //    ②壞了則一定有東西真的錯了。
      expect(await runPython(back + '\n', stdin ?? []),
        '轉一圈之後跑出來的東西變了').toBe(await runPython(code, stdin ?? []))
    })
  }
})
