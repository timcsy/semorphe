/**
 * 字串本體的寫法（`body.ts`）——lift、generate、execute 三路對 CPython。
 *
 * 🔴 **2026-10-17，cella 對照元件 → 語法樹時指出兩個**（f-string 的大括號、空集合），
 * 查證時又量到三個同一族的：`'say "hi"'` 產回去是語法錯、`r"…"` 的 `r` 被印出來、
 * 三引號的另外兩個 `"` 被印出來。期望值是 `python3 -c` 印的。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, generatePython, runPython } from '../../../../tests/helpers/python-lift'
import { createNode } from '../../../core/semantic-tree'
import { buildLiteralString } from './build'

const out = async (code: string): Promise<string> => (await runPython(code)).replace(/^completed\|/, '')
const regen = async (code: string): Promise<string> => generatePython(await liftPython(code))

// [原始碼, CPython 印的]
const CASES: Array<[string, string]> = [
  [`print('say "hi"')\n`, 'say "hi"\n'],
  [`print(r"a\\nb\\"c")\n`, 'a\\nb\\"c\n'],
  [`print("""tri"ple\nx""")\n`, 'tri"ple\nx\n'],
  [`x = 1\nprint(f"a{{b}}\\n{x}\\"q")\n`, 'a{b}\n1"q\n'],
  [`print(f'x"{1}')\n`, 'x"1\n'],
  [`print(rf"\\n{1}{{")\n`, '\\n1{\n'],
  [`print('it\\'s')\n`, "it's\n"],
  [`print("\\\\")\n`, '\\\n'],
]

describe('Python 字串的本體', () => {
  it.each(CASES)('★ execute 與 CPython 相同：%j', async (src, py) => {
    expect(await out(src)).toBe(py)
  })

  it.each(CASES)('★ 產回去的程式碼跑出同樣的東西：%j', async (src, py) => {
    expect(await out(await regen(src) + '\n')).toBe(py)
  })

  it('★ 單引號裡的 " 產回去要跳脫——修之前是 "say "hi""（語法錯）', async () => {
    expect(await regen(`print('say "hi"')\n`)).toBe('print("say \\"hi\\"")')
  })

  it('★ 積木上打的字：裸的 " 補跳脫，f-string 片段裡的大括號加倍', () => {
    const lit = buildLiteralString('a "b" {c}')
    const prog = (e: ReturnType<typeof createNode>) => createNode('python:program', {}, {
      body: [createNode('python:print', {}, { values: [e] })],
    })
    expect(generatePython(prog(lit))).toContain('"a \\"b\\" {c}"')
    const f = createNode('python:string_make', {}, { parts: [buildLiteralString('{c}')] })
    expect(generatePython(prog(f)), '🔴 字面的大括號變成插值了').toContain('f"{{c}}"')
  })

  it('★ bytes 不是字串——不得被當成 literal_string', async () => {
    expect(await regen('x = b"hi"\n')).not.toMatch(/^x = "b/)
  })

  it('★ 空的 set_make 產 set()——{} 是空字典', () => {
    const empty = createNode('python:set_make', {}, { items: [] })
    const prog = createNode('python:program', {}, {
      body: [createNode('python:print', {}, { values: [empty] })],
    })
    expect(generatePython(prog)).toBe('print(set())')
  })
})
