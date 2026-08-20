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
): SemanticNode => ({ componentId: concept, properties, children }) as unknown as SemanticNode

const num = (v: number): SemanticNode => n('cpp:literal_number', { value: v })
const ret = (v: SemanticNode): SemanticNode => n('cpp:return', {}, { value: [v] })

beforeAll(() => {
  registerCppLanguage()
})

/** 建一個只含這個成員的類別，跑一次，回傳直譯器好讓呼叫端查登記處 */
async function declKind(member: SemanticNode, className = 'K'): Promise<SemanticInterpreter> {
  const interp = new SemanticInterpreter({ maxSteps: 5000 })
  await interp.execute(
    n('cpp:program', {}, {
      body: [n('cpp:class_def', { name: className }, { public: [member], private: [] })],
    }),
  )
  return interp
}

describe('cpp_class_def 真的消費這六種成員', () => {
  const methodKind: [string, string][] = [
    ['cpp:method_virtual', 'v'],
    ['cpp:method_override', 'o'],
    ['cpp:method_virtual_pure', 'pv'],
  ]

  for (const [concept, name] of methodKind) {
    it(`★ ${concept} 被收進型別的方法表`, async () => {
      const body = concept === 'cpp:method_virtual_pure' ? {} : { body: [ret(num(1))] }
      const interp = await declKind(n(concept, { name, return_type: 'int' }, { params: [], ...body }))
      expect(
        interp.structs.method('K', name),
        `${concept} 沒有被 cpp_class_def 收進去 → 「由父概念消費」是假的，` +
          '那個 skipPaths 宣告就是在把一個空操作洗成設計',
      ).toBeDefined()
    })
  }

  it('★ cpp_operator_overload 被收成 `operator+`', async () => {
    const interp = await declKind(
      n('cpp:operator_overload', { operator: '+', param_type: 'K', param_name: 'r' }, { body: [ret(num(1))] }),
    )
    expect(interp.structs.method('K', 'operator+')).toBeDefined()
  })

  it('★ cpp_static_member 被收進型別的靜態表', async () => {
    const interp = await declKind(n('cpp:member_static', { name: 's', type: 'int' }))
    expect(
      interp.structs.staticsOf('K')?.has('s'),
      'cpp_static_member 沒有被收進靜態表',
    ).toBe(true)
  })

  it('★ cpp_destructor 被收成型別的解構式', async () => {
    const interp = await declKind(n('cpp:destructor', { class_name: 'K' }, { body: [] }))
    expect(interp.structs.destructorOf('K'), 'cpp_destructor 沒有被收進去').toBeDefined()
  })

  it('★ cpp_constructor 被收成型別的建構式', async () => {
    const interp = await declKind(
      n('cpp:constructor', { class_name: 'K' }, { params: [], body: [] }),
    )
    expect(interp.structs.constructorOf('K')).toBeDefined()
  })

  it('★ 反面：不認得的成員概念不得被誤收', async () => {
    // ⚠️ 這支原本錨在 `cpp_destructor` 上（「它還沒實作，不該被收進去」）
    // ——而 080 把解構式實作了，那個錨點於是爛掉。**同一個坑今天第四次。**
    //
    // 改用**合成的**概念名：它按定義永遠不會被任何實作認得。
    // 沒有這支的話，一個「什麼都收」的實作會通過上面每一支。
    const interp = await declKind(n('__不存在的成員概念__', { name: 'zz' }, { body: [] }))
    expect(
      interp.structs.method('K', 'zz'),
      '一個不存在的概念被當成方法收進去了 → 「什麼都收」的實作也會通過上面每一支',
    ).toBeUndefined()
  })
})

describe('宣告的依據必須存在——反過來查一次', () => {
  /**
   * ⚠️ 這支原本是「解構式與 lambda 不得有宣告」，而 079／080 把它們實作了
   * ——清單變空，**那支測試於是什麼都沒驗到，自己成了一個殼**。
   *
   * 留一個空清單假通過，比刪掉它更糟：它看起來還在守著什麼。
   *
   * 改成**反過來查**：每一個宣告了 `consumed-by-parent` 的概念，
   * 都必須真的被父概念收進型別。這個形狀不隨「哪些概念實作了」而失效，
   * 而且**下一個想偷渡宣告的概念會在這裡被擋住**。
   */
  it('★ 每個宣告 consumed-by-parent 的概念，都要真的被收進型別', async () => {
    const { allComponentDefs } = await import('../../helpers/component-scan')
    // ⚠️ **只查父概念是類別的那些。** 第一版查了全部宣告者，於是 `cpp_case`
    // 與 `cpp_default` 被報出來——它們的父概念是 switch，不是類別。
    // 那是這支測試的範圍寫太寬，不是那兩個概念有問題。
    //
    // 其他父概念的消費關係要各自有各自的證據測試——本檔不涵蓋，
    // 而這一行就是那個邊界。
    const classMembers = new Set([
      'cpp:method_virtual', 'cpp:method_override', 'cpp:method_virtual_pure',
      'cpp:operator_overload', 'cpp:member_static', 'cpp:constructor', 'cpp:destructor',
    ])
    const declarers = allComponentDefs()
      .filter(
        (d) =>
          classMembers.has(d.componentId) &&
          (d.skipReasons as Record<string, string> | undefined)?.execute === 'consumed-by-parent',
      )
      .map((d) => d.componentId)

    expect(
      declarers.length,
      `類別成員裡宣告了 consumed-by-parent 的只有 ${declarers.length} 個 → ` +
        '少於預期，這支可能什麼都沒驗到',
    ).toBe(classMembers.size)

    const unsupported: string[] = []
    for (const id of declarers) {
      // 每一種成員各建一個類別，看它有沒有被收進型別的任何一張表
      const interp = await declKind(
        n(id, { name: 'probe', class_name: 'K', operator: '+', type: 'int', return_type: 'int' }, { params: [], body: [] }),
      )
      const wasCollected =
        interp.structs.method('K', 'probe') !== undefined ||
        interp.structs.method('K', 'operator+') !== undefined ||
        interp.structs.staticsOf('K')?.has('probe') === true ||
        interp.structs.constructorOf('K') !== undefined ||
        interp.structs.destructorOf('K') !== undefined
      if (!wasCollected) unsupported.push(id)
    }
    expect(
      unsupported,
      '以下概念宣告了「由父概念消費」，而父概念**根本沒有收它**——' +
        `那個宣告就是在把一個空操作洗成設計：\n  ${unsupported.join('\n  ')}`,
    ).toEqual([])
  })
})
