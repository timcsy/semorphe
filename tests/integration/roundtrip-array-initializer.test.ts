/**
 * 陣列初始值的保留與誠實降級（US1）
 *
 * ## 這支測試在治什麼
 *
 * `int a[3] = {1,2,3}` 辨識後，初始值**整組消失**——沒有錯誤、沒有警告、
 * 沒有降級標記，而且該節點的 confidence 是 `high`。
 *
 * **系統不只丟了值，還宣稱自己有高信心。**
 *
 * 這正面違反 P6 誠實降級：「降級必須單調遞減、**必須可見**、必須區分原因…
 * **禁止**給出一個『看起來合理』的結構」（principles.md:85）。
 *
 * 也是既有教訓「靜默降級是 bug 的藏身之處」的同一個形狀。
 *
 * ## 斷言的順序是刻意的
 *
 * 「做不到要出聲」（describe 2）比「做得到要做對」（describe 1）**更根本**。
 * 若只要求後者，實作可以合法地在困難情形悄悄退回原狀，而測試照樣綠。
 *
 * ## 為什麼用真實程式碼走一圈，不用合成節點
 *
 * 完備性護欄漏掉這個 bug，正因為它只跑合成的最小樣本——而最小樣本不帶初始值。
 * 見 specs/050-repay-top-blockers/research.md F3。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../src/core/types'

let tsParser: Parser
let lifter: Lifter
const STYLE = { id: 'default' } as unknown as StylePreset

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
}, 60_000)

function lift(code: string): SemanticNode | null {
  return lifter.lift(tsParser.parse(code).rootNode as never)
}

/** 找出樹中第一個指定概念的節點 */
function find(node: SemanticNode | null, concept: string): SemanticNode | null {
  if (!node) return null
  if (node.componentId === concept) return node
  for (const arr of Object.values(node.children ?? {})) {
    for (const c of arr) {
      const hit = find(c, concept)
      if (hit) return hit
    }
  }
  return null
}

const arrayOf = (code: string): SemanticNode | null => find(lift(`int main(){ ${code} }`), 'cpp:array_declare')

// ─────────────────────────────────────────────────────────────────────────────

describe('陣列初始值：做得到的時候要做對（US1 場景 1-3）', () => {
  it('數值初始值被保留', () => {
    const n = arrayOf('int a[3] = {1,2,3};')
    expect(n, '應辨識為 array_declare').not.toBeNull()
    const values = n!.children.values ?? []
    expect(values.map((v) => v.properties.value)).toEqual(['1', '2', '3'])
  })

  it('字元初始值被保留', () => {
    const n = arrayOf("char c[4] = {'a','b','c'};")
    expect((n!.children.values ?? []).length).toBe(3)
  })

  it.skip('[BLOCKED:cpp:string_declare] 字串陣列的初始值被保留', () => {
    // 這一條與 array_declare 無關：`string s[2] = {...}` 根本沒有被辨識成
    // array_declare——`cpp_string_declare` 的匹配過寬，把它整個吞掉，連名字
    // 都變成垃圾（`s[2] = {"ab","cd"}`）。
    //
    // 這是**上游的誤判**，屬 P3「歧義在註冊時仲裁，不在執行時碰運氣」那條
    // 的違反，修法在 string 模組而非陣列策略——本功能刻意不擴大到那裡。
    // 已進缺陷帳，阻斷者標為 cpp_string_declare。
    const n = arrayOf('string s[2] = {"ab","cd"};')
    expect((n!.children.values ?? []).length).toBe(2)
  })

  it('初始值數量少於宣告大小仍完整保留（C++ 合法，其餘補零）', () => {
    const n = arrayOf('int a[5] = {1,2};')
    expect((n!.children.values ?? []).length).toBe(2)
  })

  it('初始值中的運算式被保留為節點，不是字串', () => {
    const n = arrayOf('int x=1; int a[2] = {x+1, 3};')
    const values = n!.children.values ?? []
    expect(values.length).toBe(2)
    expect(values[0].componentId).not.toBe('raw_code')
  })

  it('多維初始值的層次不被壓平', () => {
    // ⚠️ 2026-08-13：帶初始值的多維陣列改由 `cpp:array_2d_declare` 接住。
    // 在那之前它落到一維的 `cpp:array_declare`，而**維度被塞進名字**
    // （`name: "m[2]"`）——產出的碼是對的，而執行時變數就叫 `m[2]`。
    const n = find(lift('int main(){ int m[2][2] = {{1,2},{3,4}}; }'), 'cpp:array_2d_declare')
    expect(n, '多維陣列該由二維那顆接住').not.toBeNull()
    const values = n!.children.values ?? []
    expect(values.length, '外層應該是 2 個群組，不是壓平的 4 個值').toBe(2)
    const innerCount = values.reduce((sum, v) => sum + (v.children.values ?? []).length, 0)
    expect(innerCount, '內層各 2 個值').toBe(4)
  })

  it('三態可區分：無初始值／空列表／有初始值（FR-005）', () => {
    const none = arrayOf('int a[3];')!
    const empty = arrayOf('int a[3] = {};')!
    const some = arrayOf('int a[3] = {1};')!

    expect(none.children.values, '無初始值 → 欄位不存在').toBeUndefined()
    expect(empty.children.values, '空列表 → 空陣列').toEqual([])
    expect((some.children.values ?? []).length, '有初始值 → 有內容').toBe(1)
  })

  it('走完「辨識 → 產生程式碼」一圈後初始值等價', () => {
    const tree = lift('int main(){ int a[3] = {1,2,3}; }')
    const code = generateCode(tree!, 'cpp', STYLE)
    expect(code).toMatch(/\{\s*1\s*,\s*2\s*,\s*3\s*\}/)
  })
})

describe('陣列初始值：做不到的時候要出聲（US1 場景 4）★ 本故事的核心', () => {
  it('無初始值的宣告維持最高信心（對照組——這個本來就是對的）', () => {
    const n = arrayOf('int a[3];')!
    expect(n.metadata?.confidence ?? 'high').toBe('high')
  })

  it('若初始值未被完整保留，該節點 MUST NOT 標最高信心', () => {
    // 逐一檢查所有帶初始值的寫法：要嘛值都在、要嘛信心降級。
    // **不允許「值不見了但信心是 high」**——那是現況的病。
    const cases = [
      'int a[3] = {1,2,3};',
      "char c[4] = {'a','b','c'};",
      'int m[2][2] = {{1,2},{3,4}};',
      'int a[2] = {x+1, 3};',
    ]
    const dishonest: string[] = []
    for (const code of cases) {
      const n = arrayOf(code)
      if (!n) continue
      const kept = (n.children.values ?? []).length > 0
      const confidence = n.metadata?.confidence ?? 'high'
      if (!kept && confidence === 'high') {
        dishonest.push(`${code}  →  值未保留，卻標 confidence=high`)
      }
    }
    expect(
      dishonest,
      '系統可以做不到，但不可以「做不到卻說做到了」——見 principles.md P6 誠實降級',
    ).toEqual([])
  })

  it('降級時 MUST 記錄原因，不只是降信心', () => {
    const cases = ['int a[3] = {1,2,3};', 'int m[2][2] = {{1,2},{3,4}};']
    const missingCause: string[] = []
    for (const code of cases) {
      const n = arrayOf(code)
      if (!n) continue
      const confidence = n.metadata?.confidence ?? 'high'
      if (confidence !== 'high' && !n.metadata?.degradationCause) {
        missingCause.push(`${code}  →  降了信心卻沒說為什麼`)
      }
    }
    expect(missingCause, 'P6：降級必須「區分原因」').toEqual([])
  })
})
