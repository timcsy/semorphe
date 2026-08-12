/**
 * 類別、方法、建構式（072）——物件導向的第二片
 *
 * ## 這一片的關鍵設計：方法裡的欄位怎麼存取
 *
 * C++ 的方法直接寫欄位名（`x = 5`，不是 `this->x = 5`）。天真的做法是把欄位
 * 複製進方法的作用域、跑完再複製回去——**而那在方法呼叫方法時是錯的**：
 * 內層改的是自己那份副本。
 *
 * 這裡用的是：**方法的作用域直接用物件的欄位表當自己的變數表**。
 * 兩者都是 `Map<string, RuntimeValue>`，所以讀寫自動穿透，沒有副本、
 * 沒有複製回寫的時機問題。
 *
 * 下面「方法呼叫方法」那支測試就是釘這件事的——複製回寫的實作會在那裡壞掉。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { SemanticInterpreter } from '../../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import type { SemanticNode } from '../../../src/core/types'

const n = (
  concept: string,
  properties: Record<string, unknown> = {},
  children: Record<string, SemanticNode[]> = {},
): SemanticNode => ({ conceptId: concept, properties, children }) as unknown as SemanticNode

const prog = (...body: SemanticNode[]): SemanticNode => n('cpp:program', {}, { body })
const num = (v: number): SemanticNode => n('cpp:literal_number', { value: v })
const ref = (name: string): SemanticNode => n('cpp:var_ref', { name })
const show = (x: SemanticNode): SemanticNode => n('cpp:print', {}, { values: [x] })
const assign = (name: string, v: SemanticNode): SemanticNode => n('cpp:var_assign', { obj: name }, { value: [v] })

/**
 * class Counter {
 * public:
 *   int n;
 *   void bump()   { n = n + 1; }
 *   void bumpTwice() { bump(); bump(); }
 *   int  get()    { return n; }
 * };
 */
const counter = (): SemanticNode =>
  n('cpp:class_def', { name: 'Counter' }, {
    public: [
      n('cpp:var_declare', { name: 'n', type: 'int' }),
      n('cpp:func_def', { name: 'bump', return_type: 'void' }, {
        params: [],
        body: [assign('n', n('cpp:arithmetic', { operator: '+' }, { left: [ref('n')], right: [num(1)] }))],
      }),
      n('cpp:func_def', { name: 'bumpTwice', return_type: 'void' }, {
        params: [],
        body: [
          n('cpp:method_call', { obj: 'this', method: 'bump' }, { args: [] }),
          n('cpp:method_call', { obj: 'this', method: 'bump' }, { args: [] }),
        ],
      }),
      n('cpp:func_def', { name: 'get', return_type: 'int' }, {
        params: [],
        body: [n('cpp:return', {}, { value: [ref('n')] })],
      }),
    ],
    private: [],
  })

beforeAll(() => {
  registerCppLanguage()
})

async function run(tree: SemanticNode): Promise<string> {
  const interp = new SemanticInterpreter({ maxSteps: 20000 })
  await interp.execute(tree)
  return interp.getOutput().join('')
}

describe('類別與方法', () => {
  it('★ 宣告一個類別 → 它的欄位可以實例化', async () => {
    const out = await run(
      prog(counter(), n('cpp:var_declare', { name: 'c', type: 'Counter' }),
        show(n('cpp:struct_at_member', { obj: 'c', member: 'n' }))),
    )
    expect(out.trim(), '類別的欄位沒有被建出來').toBe('0')
  })

  it('★ 呼叫一個方法，它改的是**這個實例**的欄位', async () => {
    const out = await run(
      prog(counter(), n('cpp:var_declare', { name: 'c', type: 'Counter' }),
        n('cpp:method_call', { obj: 'c', method: 'bump' }, { args: [] }),
        show(n('cpp:struct_at_member', { obj: 'c', member: 'n' }))),
    )
    expect(out.trim(), '方法改不到欄位——多半是欄位被複製進方法的作用域了').toBe('1')
  })

  it('★ 有回傳值的方法（運算式位置）', async () => {
    const out = await run(
      prog(counter(), n('cpp:var_declare', { name: 'c', type: 'Counter' }),
        n('cpp:method_call', { obj: 'c', method: 'bump' }, { args: [] }),
        show(n('cpp:method_call', { obj: 'c', method: 'get' }, { args: [] }))),
    )
    expect(out.trim()).toBe('1')
  })

  it('★ 方法呼叫方法——複製回寫的實作會在這裡壞掉', async () => {
    // 內層方法改的必須是同一個實例，不是自己那份副本
    const out = await run(
      prog(counter(), n('cpp:var_declare', { name: 'c', type: 'Counter' }),
        n('cpp:method_call', { obj: 'c', method: 'bumpTwice' }, { args: [] }),
        show(n('cpp:struct_at_member', { obj: 'c', member: 'n' }))),
    )
    expect(out.trim(), '內層方法改的是副本——這正是「複製進去、跑完複製回來」的失效樣態').toBe('2')
  })

  it('★ 兩個實例的方法互不影響', async () => {
    const out = await run(
      prog(counter(),
        n('cpp:var_declare', { name: 'a', type: 'Counter' }),
        n('cpp:var_declare', { name: 'b', type: 'Counter' }),
        n('cpp:method_call', { obj: 'a', method: 'bump' }, { args: [] }),
        show(n('cpp:struct_at_member', { obj: 'b', member: 'n' }))),
    )
    expect(out.trim(), 'b 被 a 的方法改到了——方法綁在型別上而不是實例上').toBe('0')
  })

  it('★ 呼叫不存在的方法要出聲', async () => {
    let message = ''
    try {
      await run(prog(counter(), n('cpp:var_declare', { name: 'c', type: 'Counter' }),
        n('cpp:method_call', { obj: 'c', method: '沒有這個方法' }, { args: [] })))
    } catch (e) { message = (e as Error).message }
    expect(message, '呼叫不存在的方法靜默成功了').not.toBe('')
  })

  it('★ 方法裡的區域變數不得洩漏成欄位', async () => {
    const withLocal = n('cpp:class_def', { name: 'L' }, {
      public: [
        n('cpp:var_declare', { name: 'f', type: 'int' }),
        n('cpp:func_def', { name: 'run', return_type: 'void' }, {
          params: [],
          body: [n('cpp:var_declare', { name: '區域', type: 'int' }, { initializer: [num(5)] })],
        }),
      ],
      private: [],
    })
    let message = ''
    try {
      await run(prog(withLocal, n('cpp:var_declare', { name: 'o', type: 'L' }),
        n('cpp:method_call', { obj: 'o', method: 'run' }, { args: [] }),
        show(n('cpp:struct_at_member', { obj: 'o', member: '區域' }))))
    } catch (e) { message = (e as Error).message }
    expect(message, '方法裡宣告的區域變數變成了物件的欄位').not.toBe('')
  })
})

describe('建構式', () => {
  /** class P { public: int v; P(int a) { v = a; } }; */
  const withCtor = (): SemanticNode =>
    n('cpp:class_def', { name: 'P' }, {
      public: [
        n('cpp:var_declare', { name: 'v', type: 'int' }),
        n('cpp:constructor', { class_name: 'P' }, {
          params: [n('cpp:var_declare', { name: 'a', type: 'int' })],
          body: [assign('v', ref('a'))],
        }),
      ],
      private: [],
    })

  it('★ 有參數的建構式會被呼叫', async () => {
    const out = await run(
      prog(withCtor(),
        n('cpp:var_declare', { name: 'p', type: 'P' }, { initializer: [n('cpp:func_call', { name: 'P' }, { args: [num(42)] })] }),
        show(n('cpp:struct_at_member', { obj: 'p', member: 'v' }))),
    )
    expect(out.trim(), '建構式沒有跑——欄位還是預設值').toBe('42')
  })

  it('★ 沒有呼叫建構式時，欄位仍是預設值（不得炸）', async () => {
    const out = await run(
      prog(withCtor(), n('cpp:var_declare', { name: 'p', type: 'P' }),
        show(n('cpp:struct_at_member', { obj: 'p', member: 'v' }))),
    )
    expect(out.trim()).toBe('0')
  })
})
