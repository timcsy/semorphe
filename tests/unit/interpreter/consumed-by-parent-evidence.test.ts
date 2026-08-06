/**
 * 「由父概念消費」的證據（074）
 *
 * ## 為什麼需要這支
 *
 * 六個類別內的宣告（虛擬方法、覆寫、純虛擬、運算子多載、靜態成員、建構式）
 * 從「還沒實作的空操作」改判為「由父概念消費」。
 *
 * **那個改判正是「用宣告刷數字」最常見的形狀**——053 明明把它們判為「還沒
 * 實作（跑起來結果是錯的）」，而我現在說情況變了。
 *
 * > 「情況變了」本身就是最常見的合理化。
 *
 * 所以理由必須**可查證**：`cpp_class_def` 的執行器**真的**讀這六種節點嗎？
 * 這支測試就是去驗那件事——每一種成員各建一個類別，斷言它真的被收進型別。
 *
 * ⚠️ 這支測試若被刪掉或改成「總是通過」，那六個宣告就失去依據，
 * 而完備性報表會替一批空操作背書。門檻的清單裡有指向這裡的註記。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { SemanticInterpreter } from '../../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import type { SemanticNode } from '../../../src/core/types'

const n = (
  concept: string,
  properties: Record<string, unknown> = {},
  children: Record<string, SemanticNode[]> = {},
): SemanticNode => ({ concept, properties, children }) as unknown as SemanticNode

const num = (v: number): SemanticNode => n('number_literal', { value: v })
const ret = (v: SemanticNode): SemanticNode => n('return', {}, { value: [v] })

beforeAll(() => {
  registerCppLanguage()
})

/** 建一個只含這個成員的類別，跑一次，回傳直譯器好讓呼叫端查登記處 */
async function 宣告類別(member: SemanticNode, className = 'K'): Promise<SemanticInterpreter> {
  const interp = new SemanticInterpreter({ maxSteps: 5000 })
  await interp.execute(
    n('program', {}, {
      body: [n('cpp_class_def', { name: className }, { public: [member], private: [] })],
    }),
  )
  return interp
}

describe('cpp_class_def 真的消費這六種成員', () => {
  const 方法類: [string, string][] = [
    ['cpp_virtual_method', 'v'],
    ['cpp_override_method', 'o'],
    ['cpp_pure_virtual', 'pv'],
  ]

  for (const [concept, name] of 方法類) {
    it(`★ ${concept} 被收進型別的方法表`, async () => {
      const body = concept === 'cpp_pure_virtual' ? {} : { body: [ret(num(1))] }
      const interp = await 宣告類別(n(concept, { name, return_type: 'int' }, { params: [], ...body }))
      expect(
        interp.structs.method('K', name),
        `${concept} 沒有被 cpp_class_def 收進去 → 「由父概念消費」是假的，` +
          '那個 skipPaths 宣告就是在把一個空操作洗成設計',
      ).toBeDefined()
    })
  }

  it('★ cpp_operator_overload 被收成 `operator+`', async () => {
    const interp = await 宣告類別(
      n('cpp_operator_overload', { operator: '+', param_type: 'K', param_name: 'r' }, { body: [ret(num(1))] }),
    )
    expect(interp.structs.method('K', 'operator+')).toBeDefined()
  })

  it('★ cpp_static_member 被收進型別的靜態表', async () => {
    const interp = await 宣告類別(n('cpp_static_member', { name: 's', type: 'int' }))
    expect(
      interp.structs.staticsOf('K')?.has('s'),
      'cpp_static_member 沒有被收進靜態表',
    ).toBe(true)
  })

  it('★ cpp_constructor 被收成型別的建構式', async () => {
    const interp = await 宣告類別(
      n('cpp_constructor', { class_name: 'K' }, { params: [], body: [] }),
    )
    expect(interp.structs.constructorOf('K')).toBeDefined()
  })

  it('★ 反面：一個 cpp_class_def 不認得的成員概念不得被誤收', async () => {
    // 沒有這支的話，一個「什麼都收」的實作也會通過上面每一支
    const interp = await 宣告類別(n('cpp_destructor', { class_name: 'K' }, { body: [] }))
    expect(
      interp.structs.method('K', 'K'),
      'cpp_destructor 被當成方法收進去了——它**還沒實作**，不該有依據宣告 consumed-by-parent',
    ).toBeUndefined()
  })
})

describe('沒有被消費的那兩個，仍然是殼', () => {
  it('★ cpp_destructor 與 cpp_lambda 不得有 execute 的 skipPaths', async () => {
    const { allComponentDefs } = await import('../../helpers/component-scan')
    const 偷渡 = allComponentDefs()
      .filter(
        (d) =>
          ['cpp_destructor', 'cpp_lambda'].includes(d.conceptId) &&
          (d.skipPaths ?? []).includes('execute'),
      )
      .map((d) => d.conceptId)
    expect(
      偷渡,
      '解構式需要物件生命週期、lambda 需要閉包——**兩者都還沒實作**。' +
        '宣告它們「刻意不執行」是把缺陷洗成設計。',
    ).toEqual([])
  })
})
