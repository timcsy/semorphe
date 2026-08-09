/**
 * 繼承、虛擬方法、運算子多載、命名空間、模板、指標取成員（073）
 *
 * 物件導向的第三片。071 建了值模型，072 接上行為，這一片補其餘可做的。
 *
 * ## 這一片刻意不做的，以及為什麼
 *
 * | 概念 | 為什麼不做 |
 * |---|---|
 * | 解構式 | 需要**物件生命週期**——直譯器沒有離開作用域時的收尾時機 |
 * | lambda | 需要**閉包**——捕捉清單要把外層變數綁進一個可呼叫的值 |
 *
 * 兩者都不是「補一個執行器」的量級，**留在殼的清單裡繼續被數**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
// ⚠️ 成員指派用**辨識器真正產出的形狀**（帶點號的名字）。
// 手寫一個沒有生產者的形狀，測試會通過而什麼都沒驗到。
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
const ret = (v: SemanticNode): SemanticNode => n('cpp:return', {}, { value: [v] })

beforeAll(() => {
  registerCppLanguage()
})

async function run(tree: SemanticNode): Promise<string> {
  const interp = new SemanticInterpreter({ maxSteps: 20000 })
  await interp.execute(tree)
  return interp.getOutput().join('')
}

async function errOf(tree: SemanticNode): Promise<string> {
  try {
    await run(tree)
    return ''
  } catch (e) {
    return (e as Error).message
  }
}

describe('命名空間', () => {
  it('★ 命名空間裡的敘述會執行', async () => {
    const out = await run(prog(n('cpp:namespace_def', { name: 'N' }, { body: [show(num(5))] })))
    expect(out.trim(), '命名空間的本體沒有跑——它是空操作').toBe('5')
  })
})

describe('模板函式', () => {
  it('★ 模板函式可以被呼叫', async () => {
    const out = await run(
      prog(
        n('cpp:template_function', { func_name: 'twice', return_type: 'int', t: 'T' }, {
          params: [n('cpp:var_declare', { name: 'x', type: 'int' })],
          body: [ret(n('cpp:arithmetic', { operator: '*' }, { left: [ref('x')], right: [num(2)] }))],
        }),
        show(n('cpp:func_call', { name: 'twice' }, { args: [num(21)] })),
      ),
    )
    expect(out.trim()).toBe('42')
  })
})

describe('指標取成員 `p->x`', () => {
  const point = (): SemanticNode =>
    n('cpp:struct_declare', { name: 'Point' }, {
      members: [n('cpp:var_declare', { name: 'x', type: 'int' })],
    })

  it('★ 透過指標讀欄位', async () => {
    const out = await run(
      prog(
        point(),
        n('cpp:var_declare', { name: 'p', type: 'Point' }),
        n('cpp:var_assign', { obj: 'p.x' }, { value: [num(9)] }),
        n('cpp:pointer_declare', { name: 'ptr', type: 'Point' }, {
          initializer: [n('cpp:address_of', {}, { var: [ref('p')] })],
        }),
        show(n('cpp:struct_pointer_access', { obj: 'ptr', member: 'x' })),
      ),
    )
    expect(out.trim(), '指標取成員讀不到——多半是沒有解參照').toBe('9')
  })

  it('★ 空指標取成員要出聲', async () => {
    const 訊息 = await errOf(
      prog(point(), n('cpp:pointer_declare', { name: 'ptr', type: 'Point' }),
        show(n('cpp:struct_pointer_access', { obj: 'ptr', member: 'x' }))),
    )
    expect(訊息, '對空指標取成員靜默成功了——那在真的 C++ 會當掉').not.toBe('')
  })
})

describe('繼承與虛擬方法', () => {
  /**
   * class Animal { public: virtual string speak() { return "…"; } };
   * class Dog : public Animal { public: string speak() override { return "汪"; } };
   */
  const animal = (): SemanticNode =>
    n('cpp:class_def', { name: 'Animal' }, {
      public: [
        n('cpp:virtual_method', { name: 'speak', return_type: 'int' }, {
          params: [],
          body: [ret(num(1))],
        }),
      ],
      private: [],
    })

  const dog = (): SemanticNode =>
    n('cpp:class_def', { name: 'Dog', base: 'Animal' }, {
      public: [
        n('cpp:override_method', { name: 'speak', return_type: 'int' }, {
          params: [],
          body: [ret(num(2))],
        }),
      ],
      private: [],
    })

  it('★ 虛擬方法可以被呼叫', async () => {
    const out = await run(
      prog(animal(), n('cpp:var_declare', { name: 'a', type: 'Animal' }),
        show(n('cpp:method_call', { obj: 'a', method: 'speak' }, { args: [] }))),
    )
    expect(out.trim()).toBe('1')
  })

  it('★ 覆寫的方法蓋掉基底的', async () => {
    const out = await run(
      prog(animal(), dog(), n('cpp:var_declare', { name: 'd', type: 'Dog' }),
        show(n('cpp:method_call', { obj: 'd', method: 'speak' }, { args: [] }))),
    )
    expect(out.trim(), '呼叫到基底的實作了——覆寫沒有生效').toBe('2')
  })

  it('★ 沒有覆寫時，繼承基底的方法與欄位', async () => {
    const base = n('cpp:class_def', { name: 'B' }, {
      public: [
        n('cpp:var_declare', { name: 'v', type: 'int' }),
        n('cpp:func_def', { name: 'setV', return_type: 'void' }, { params: [], body: [assign('v', num(8))] }),
      ],
      private: [],
    })
    const derived = n('cpp:class_def', { name: 'D', base: 'B' }, { public: [], private: [] })
    const out = await run(
      prog(base, derived, n('cpp:var_declare', { name: 'd', type: 'D' }),
        n('cpp:method_call', { obj: 'd', method: 'setV' }, { args: [] }),
        show(n('cpp:struct_member_access', { obj: 'd', member: 'v' }))),
    )
    expect(out.trim(), '衍生類別沒有繼承基底的欄位或方法').toBe('8')
  })

  it('★ 純虛擬方法被呼叫時要出聲——它沒有本體', async () => {
    const abs = n('cpp:class_def', { name: 'A' }, {
      public: [n('cpp:pure_virtual', { name: 'f', return_type: 'int' }, { params: [] })],
      private: [],
    })
    const 訊息 = await errOf(
      prog(abs, n('cpp:var_declare', { name: 'a', type: 'A' }),
        show(n('cpp:method_call', { obj: 'a', method: 'f' }, { args: [] }))),
    )
    expect(訊息, '呼叫一個沒有本體的純虛擬方法靜默回傳了').not.toBe('')
  })
})

describe('運算子多載', () => {
  it('★ 多載的 `+` 會被用到', async () => {
    const vec = n('cpp:class_def', { name: 'V' }, {
      public: [
        n('cpp:var_declare', { name: 'x', type: 'int' }),
        n('cpp:operator_overload', { operator: '+', return_type: 'V', param_type: 'V', param_name: 'o' }, {
          body: [ret(n('cpp:arithmetic', { operator: '+' }, {
            left: [ref('x')],
            right: [n('cpp:struct_member_access', { obj: 'o', member: 'x' })],
          }))],
        }),
      ],
      private: [],
    })
    const out = await run(
      prog(vec,
        n('cpp:var_declare', { name: 'a', type: 'V' }),
        n('cpp:var_declare', { name: 'b', type: 'V' }),
        n('cpp:var_assign', { obj: 'a.x' }, { value: [num(3)] }),
        n('cpp:var_assign', { obj: 'b.x' }, { value: [num(4)] }),
        show(n('cpp:arithmetic', { operator: '+' }, { left: [ref('a')], right: [ref('b')] }))),
    )
    expect(out.trim(), '兩個物件相加沒有走多載的運算子').toBe('7')
  })
})

describe('靜態成員', () => {
  it('★ 靜態成員由所有實例共用', async () => {
    const c = n('cpp:class_def', { name: 'C' }, {
      public: [
        n('cpp:static_member', { name: 'count', type: 'int' }),
        n('cpp:func_def', { name: 'inc', return_type: 'void' }, {
          params: [],
          body: [assign('count', n('cpp:arithmetic', { operator: '+' }, { left: [ref('count')], right: [num(1)] }))],
        }),
      ],
      private: [],
    })
    const out = await run(
      prog(c,
        n('cpp:var_declare', { name: 'a', type: 'C' }),
        n('cpp:var_declare', { name: 'b', type: 'C' }),
        n('cpp:method_call', { obj: 'a', method: 'inc' }, { args: [] }),
        n('cpp:method_call', { obj: 'b', method: 'inc' }, { args: [] }),
        show(n('cpp:struct_member_access', { obj: 'a', member: 'count' }))),
    )
    expect(out.trim(), '靜態成員沒有共用——它變成了每個實例各一份').toBe('2')
  })
})
