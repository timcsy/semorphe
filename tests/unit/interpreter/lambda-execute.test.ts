/**
 * lambda 的執行（079）——閉包
 *
 * ## 為什麼這是「新機制」而不是「補一個執行器」
 *
 * lambda 求值出來的是一個**可以晚點再呼叫的東西**，而執行期的值模型只有
 * 數值／字串／陣列／指標／物件——**沒有「可呼叫」**。而且它要記得**定義時的
 * 那個作用域**，否則捕捉來的變數在呼叫時已經不在了。
 *
 * ## 捕捉語意：兩種，而它們的差別必須測得出來
 *
 * | 寫法 | 意思 |
 * |---|---|
 * | `[&]` | **參照捕捉**——之後外層改了，lambda 看得到新值 |
 * | `[=]` | **值捕捉**——定義當下拍一份快照，外層之後改了不影響 |
 *
 * 只實作其中一種、兩種都當成同一件事的話，**單看一支測試分不出來**——
 * 所以下面那兩支要成對讀。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { SemanticInterpreter } from '../../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import type { SemanticNode } from '../../../src/core/types'

const n = (
  concept: string,
  properties: Record<string, unknown> = {},
  children: Record<string, SemanticNode[]> = {},
): SemanticNode => ({ componentId: concept, properties, children }) as unknown as SemanticNode

const prog = (...body: SemanticNode[]): SemanticNode => n('cpp:program', {}, { body })
const num = (v: number): SemanticNode => n('cpp:literal_number', { value: v })
const ref = (name: string): SemanticNode => n('cpp:var_ref', { name })
const show = (x: SemanticNode): SemanticNode => n('cpp:print', {}, { values: [x] })
const ret = (v: SemanticNode): SemanticNode => n('cpp:return', {}, { value: [v] })
const decl = (name: string, init?: SemanticNode): SemanticNode =>
  n('cpp:var_declare', { name, type: 'int' }, init ? { initializer: [init] } : {})
const assign = (name: string, v: SemanticNode): SemanticNode =>
  n('cpp:var_assign', { obj: name }, { value: [v] })
const call = (name: string, ...args: SemanticNode[]): SemanticNode =>
  n('cpp:func_call', { name }, { args })

/** `[capture](int a){ return <bodyExpr>; }` */
const lambda = (capture: string, params: string[], bodyExpr: SemanticNode): SemanticNode =>
  n('cpp:lambda', { capture, return_type: 'int' }, {
    params: params.map((p) => n('cpp:var_declare', { name: p, type: 'int' })),
    body: [ret(bodyExpr)],
  })

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

describe('lambda 的基本呼叫', () => {
  it('★ 無捕捉、有參數', async () => {
    const out = await run(
      prog(
        n('cpp:var_declare', { name: 'f', type: 'auto' }, {
          initializer: [lambda('', ['a'], n('cpp:arithmetic', { operator: '*' }, { left: [ref('a')], right: [num(2)] }))],
        }),
        show(call('f', num(21))),
      ),
    )
    expect(out.trim(), 'lambda 沒有被呼叫——多半是它求值成了一個不可呼叫的值').toBe('42')
  })

  it('★ 呼叫一個不是 lambda 的變數要出聲', async () => {
    const message = await errOf(prog(decl('x', num(1)), show(call('x'))))
    expect(message, '把一個整數當函式呼叫靜默成功了').not.toBe('')
  })
})

describe('捕捉語意——兩支要成對讀', () => {
  it('★ `[&]` 參照捕捉：外層之後改了，lambda 看得到新值', async () => {
    const out = await run(
      prog(
        decl('n', num(1)),
        n('cpp:var_declare', { name: 'f', type: 'auto' }, { initializer: [lambda('&', [], ref('n'))] }),
        assign('n', num(9)),
        show(call('f')),
      ),
    )
    expect(out.trim(), '參照捕捉看到的是舊值——它拍了快照').toBe('9')
  })

  it('★ `[=]` 值捕捉：定義當下拍快照，外層之後改了不影響', async () => {
    const out = await run(
      prog(
        decl('n', num(1)),
        n('cpp:var_declare', { name: 'f', type: 'auto' }, { initializer: [lambda('=', [], ref('n'))] }),
        assign('n', num(9)),
        show(call('f')),
      ),
    )
    expect(out.trim(), '值捕捉看到的是新值——它沒有拍快照，兩種捕捉被當成同一件事了').toBe('1')
  })
})

describe('作用域', () => {
  it('★ lambda 的參數不得洩漏到外層', async () => {
    const message = await errOf(
      prog(
        n('cpp:var_declare', { name: 'f', type: 'auto' }, { initializer: [lambda('', ['內部參數'], num(1))] }),
        show(call('f', num(1))),
        show(ref('內部參數')),
      ),
    )
    expect(message, 'lambda 的參數變成了外層的變數').not.toBe('')
  })

  it('★ 同一個 lambda 可以呼叫多次，彼此不互相汙染', async () => {
    const out = await run(
      prog(
        n('cpp:var_declare', { name: 'f', type: 'auto' }, {
          initializer: [lambda('', ['a'], n('cpp:arithmetic', { operator: '+' }, { left: [ref('a')], right: [num(1)] }))],
        }),
        show(call('f', num(1))),
        show(call('f', num(10))),
      ),
    )
    expect(out.replace(/\s/g, ''), '第二次呼叫受到第一次的影響').toBe('211')
  })
})
