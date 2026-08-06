/**
 * 結構的執行（071）——物件導向的第一片
 *
 * ## 這一片為什麼先做
 *
 * 完備性護欄的 27 個殼裡，**16 個是物件導向**。它們全部註冊成空操作，於是
 * 使用者寫的一段 struct 程式**什麼都沒發生**（現在會出聲，但仍然不能跑）。
 *
 * 直譯器的執行期型別只有 `int｜float｜double｜char｜string｜bool｜void｜
 * array｜pointer`——**沒有物件**。所以這不是「補一個執行器」，是要先讓值模型
 * 能承載一個有欄位的東西。
 *
 * ## 範圍：一片，不是整套
 *
 * 這一片只做**結構 + 欄位讀寫**：
 *
 * | 做 | 不做 |
 * |---|---|
 * | 宣告一個結構型別 | 類別的存取控制（public／private） |
 * | 用它宣告變數（欄位取得預設值） | 方法、建構式、解構式 |
 * | 讀欄位、寫欄位 | 繼承、虛擬函式、運算子多載 |
 * | 巢狀結構 | 指標取成員 |
 *
 * **切一片而不是一次做完**，因為值模型的改動會碰到每一條路，而那個風險要能
 * 單獨驗證。剩下的殼留在完備性報表裡繼續被數。
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

const prog = (...body: SemanticNode[]): SemanticNode => n('program', {}, { body })
const num = (v: number): SemanticNode => n('number_literal', { value: v })
const show = (x: SemanticNode): SemanticNode => n('print', {}, { values: [x] })

/** struct Point { int x; int y; }; */
const point = (): SemanticNode =>
  n('cpp_struct_declare', { name: 'Point' }, {
    members: [
      n('var_declare', { name: 'x', type: 'int' }),
      n('var_declare', { name: 'y', type: 'int' }),
    ],
  })

beforeAll(() => {
  registerCppLanguage()
})

async function run(tree: SemanticNode): Promise<string> {
  const interp = new SemanticInterpreter({ maxSteps: 10000 })
  await interp.execute(tree)
  return interp.getOutput().join('')
}

describe('結構：宣告型別、實例化、讀寫欄位', () => {
  it('★ 宣告一個結構型別本身不得出錯', async () => {
    await expect(run(prog(point()))).resolves.toBeDefined()
  })

  it('★ 用結構型別宣告變數 → 欄位取得預設值', async () => {
    const out = await run(
      prog(
        point(),
        n('var_declare', { name: 'p', type: 'Point' }),
        show(n('cpp_struct_member_access', { obj: 'p', member: 'x' })),
      ),
    )
    expect(out, '結構變數的欄位沒有預設值——int 應該是 0').toContain('0')
  })

  it('★ 寫一個欄位，再讀回來', async () => {
    const out = await run(
      prog(
        point(),
        n('var_declare', { name: 'p', type: 'Point' }),
        n('var_assign', { name: 'p.x' }, { value: [num(7)] }),
        show(n('cpp_struct_member_access', { obj: 'p', member: 'x' })),
      ),
    )
    expect(out).toContain('7')
  })

  it('★ 寫一個欄位不得影響另一個——否則欄位是共用的，不是各自的', async () => {
    const out = await run(
      prog(
        point(),
        n('var_declare', { name: 'p', type: 'Point' }),
        n('var_assign', { name: 'p.x' }, { value: [num(7)] }),
        show(n('cpp_struct_member_access', { obj: 'p', member: 'y' })),
      ),
    )
    expect(out.trim(), 'y 被 x 的指派改到了').toBe('0')
  })

  it('★ 兩個實例互相獨立——否則欄位存在型別上而不是實例上', async () => {
    const out = await run(
      prog(
        point(),
        n('var_declare', { name: 'a', type: 'Point' }),
        n('var_declare', { name: 'b', type: 'Point' }),
        n('var_assign', { name: 'a.x' }, { value: [num(3)] }),
        show(n('cpp_struct_member_access', { obj: 'b', member: 'x' })),
      ),
    )
    expect(out.trim(), 'b.x 被 a.x 的指派改到了——兩個實例共用同一份欄位').toBe('0')
  })

  it('★ 讀一個不存在的欄位要出聲，不得靜默回 0', async () => {
    // 「靜默降級是 bug 的藏身之處」——回 0 的話，打錯欄位名的程式會跑完、
    // 印出東西、而它是錯的。
    let 訊息 = ''
    try {
      await run(
        prog(point(), n('var_declare', { name: 'p', type: 'Point' }),
          show(n('cpp_struct_member_access', { obj: 'p', member: '沒有這個欄位' }))),
      )
    } catch (e) {
      訊息 = (e as Error).message
    }
    expect(訊息, '讀不存在的欄位靜默成功了').not.toBe('')
  })

  it('★ 巢狀結構', async () => {
    const out = await run(
      prog(
        point(),
        n('cpp_struct_declare', { name: 'Line' }, {
          members: [n('var_declare', { name: 'from', type: 'Point' })],
        }),
        n('var_declare', { name: 'l', type: 'Line' }),
        show(n('cpp_struct_member_access', { obj: 'l', member: 'from' })),
      ),
    )
    expect(out, '巢狀結構的欄位沒有被建出來').not.toBe('')
  })
})
