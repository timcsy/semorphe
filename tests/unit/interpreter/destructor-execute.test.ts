/**
 * 解構式（080）——物件生命週期
 *
 * ## 為什麼這是最後一個，而且最難
 *
 * 前面每一個 OOP 概念都是「有人明確呼叫它」。**解構式沒有人呼叫**——它在
 * 物件離開作用域時自動跑。所以這不是補一個執行器，是要在直譯器裡建立一個
 * 從來不存在的時機：**作用域結束**。
 *
 * 而那個時機碰到每一個建立與銷毀作用域的地方：分支、迴圈、函式、方法、
 * lambda。漏掉任何一個，那裡宣告的物件就永遠不會被收尾——**而症狀是沒有
 * 症狀**（少跑一段解構式，程式照樣跑完）。
 *
 * ## 三件必須測的事
 *
 * | | 為什麼 |
 * |---|---|
 * | 會跑 | 最基本 |
 * | **反序** | C++ 保證後宣告的先解構。順序錯的實作在單一物件時看不出來 |
 * | **每個實例各跑一次** | 跑成一次或跑成 N 次，單一物件時都看不出來 |
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { SemanticInterpreter } from '../../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import type { SemanticNode } from '../../../src/core/types'

const n = (
  component: string,
  properties: Record<string, unknown> = {},
  children: Record<string, SemanticNode[]> = {},
): SemanticNode => ({ componentId: component, properties, children }) as unknown as SemanticNode

const prog = (...body: SemanticNode[]): SemanticNode => n('cpp:program', {}, { body })
const num = (v: number): SemanticNode => n('cpp:literal_number', { value: v })
const str = (v: string): SemanticNode => n('cpp:literal_string', { value: v })
const show = (x: SemanticNode): SemanticNode => n('cpp:print', {}, { values: [x] })

/** class C { public: int tag; ~C(){ cout << "~" << tag; } }; */
const withDtor = (name = 'C'): SemanticNode =>
  n('cpp:class_def', { name }, {
    public: [
      n('cpp:var_declare', { name: 'tag', type: 'int' }),
      n('cpp:destructor', { class_name: name }, {
        body: [n('cpp:print', {}, { values: [str('~'), n('cpp:var_ref', { name: 'tag' })] })],
      }),
    ],
    private: [],
  })

const make = (varName: string, tag: number, type = 'C'): SemanticNode[] => [
  n('cpp:var_declare', { name: varName, type }),
  // 🟢 **左值是接點**（2026-08-25）——在此之前是 `{ obj, member }` 這對屬性，
  //    而那個 `member` 是第三十四條護欄長年報的「讀了沒宣告」之一。
  n('cpp:var_assign', {}, {
    target: [n('cpp:struct_at_member', { obj: varName, member: 'tag' }, {})],
    value: [num(tag)],
  }),
]

beforeAll(() => {
  registerCppLanguage()
})

async function run(tree: SemanticNode): Promise<string> {
  const interp = new SemanticInterpreter({ maxSteps: 20000 })
  await interp.execute(tree)
  return interp.getOutput().join('')
}

describe('解構式在離開作用域時執行', () => {
  it('★ 分支結束時跑', async () => {
    const out = await run(
      prog(
        withDtor(),
        n('cpp:if_else', {}, {
          condition: [num(1)],
          then: [...make('a', 7)],
          else: [],
        }),
        show(str('後面')),
      ),
    )
    expect(out, '離開分支時解構式沒有跑').toContain('~7')
    expect(out.indexOf('~7'), '解構式跑在分支結束**之後**了').toBeLessThan(out.indexOf('後面'))
  })

  it('★ 反序：後宣告的先解構', async () => {
    // 順序錯的實作在單一物件時完全看不出來
    const out = await run(
      prog(
        withDtor(),
        n('cpp:if_else', {}, {
          condition: [num(1)],
          then: [...make('a', 1), ...make('b', 2)],
          else: [],
        }),
      ),
    )
    expect(out.indexOf('~2'), 'C++ 保證後宣告的先解構，而這裡是正序').toBeLessThan(out.indexOf('~1'))
  })

  it('★ 每個實例各跑一次——不多不少', async () => {
    const out = await run(
      prog(
        withDtor(),
        n('cpp:if_else', {}, {
          condition: [num(1)],
          then: [...make('a', 1), ...make('b', 2), ...make('c', 3)],
          else: [],
        }),
      ),
    )
    const count = (out.match(/~/g) ?? []).length
    expect(count, `三個物件應該跑三次解構式，實際 ${count} 次`).toBe(3)
  })

  it('★ 函式回傳時跑', async () => {
    const out = await run(
      prog(
        withDtor(),
        n('cpp:func_def', { name: 'f', return_type: 'void' }, { params: [], body: [...make('x', 5)] }),
        n('cpp:func_call', { name: 'f' }, { args: [] }),
        show(str('回來了')),
      ),
    )
    expect(out, '函式的區域物件沒有被解構').toContain('~5')
    expect(out.indexOf('~5')).toBeLessThan(out.indexOf('回來了'))
  })

  it('★ 沒有解構式的類別不得出錯', async () => {
    const noDtor = n('cpp:class_def', { name: 'D' }, {
      public: [n('cpp:var_declare', { name: 'v', type: 'int' })],
      private: [],
    })
    const out = await run(
      prog(noDtor, n('cpp:if_else', {}, { condition: [num(1)], then: [n('cpp:var_declare', { name: 'd', type: 'D' })], else: [] }), show(str('OK'))),
    )
    expect(out).toContain('OK')
  })

  it('★ 非物件的變數不得觸發任何收尾', async () => {
    // 沒有這支的話，一個「對每個變數都試著跑解構式」的實作也會通過上面每一支
    const out = await run(
      prog(
        withDtor(),
        n('cpp:if_else', {}, {
          condition: [num(1)],
          then: [n('cpp:var_declare', { name: 'i', type: 'int' }, { initializer: [num(3)] })],
          else: [],
        }),
        show(str('OK')),
      ),
    )
    expect(out, '對一個整數跑了解構式').not.toContain('~')
    expect(out).toContain('OK')
  })
})
