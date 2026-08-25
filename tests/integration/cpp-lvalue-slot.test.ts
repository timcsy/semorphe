/**
 * **左值是接點，不是字串**（路線圖項目，2026-08-25）——C++ 那一側的行為證據。
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-24 逐字：
 * 「**我的意思是 lvalue 的型態應該百百種吧，這樣不就寫死了？**」
 *
 * 🪦 在此之前 `cpp:var_assign_compound` 的左邊是 `properties.name`（一個字串）
 * ＋ 一個可有可無的 `index` 接點——**兩種形狀的列舉**。lift 那側寫著：
 *
 * > 「⚠️ 兩種形狀：`x += 1` 與 `arr[i] += 1`。後者多一個 `index` 子節點。」
 *
 * 而左值不只兩種。下面每一條在那一版都是壞的，**而且是靜默的**：
 * `o.x += 1` 會去 `ctx.scope.get("o.x")` 查一個不存在的變數名。
 *
 * ## 這一支不檢測什麼
 *
 * - ❌ **不檢測積木長什麼樣**——沒有任何測試在看標籤（見 `retire-imperative-block` §5），
 *   那一半是開瀏覽器看的。
 * - ❌ **不檢測普通指定**（`=`）——那是 `cpp:var_assign`／`array_assign` 的地盤，
 *   它們還在棘輪上（`audit-lvalue-slot`）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { generateCode } from '../../src/core/projection/code-generator'
import type { SemanticNode } from '../../src/core/types'
import googleStyle from '../../src/languages/cpp/styles/google.json'
import type { StylePreset } from '../../src/core/types'

let parser: Parser

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 60_000)

function lift(src: string): SemanticNode {
  const tree = parser.parse(src)
  if (!tree) throw new Error('parse 失敗')
  return createTestLifter().lift(tree.rootNode as never) as SemanticNode
}

async function run(src: string): Promise<string> {
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  await i.execute(lift(src))
  return i.getOutput().join('')
}

/** 找出那顆複合指定節點——找不到回 null，讓斷言指名。 */
function findCompound(n: SemanticNode): SemanticNode | null {
  if (n.componentId === 'cpp:var_assign_compound') return n
  for (const kids of Object.values(n.children ?? {})) {
    for (const k of kids as SemanticNode[]) {
      const hit = findCompound(k)
      if (hit) return hit
    }
  }
  return null
}

const IO = '#include <iostream>\nusing namespace std;\n'
const S = '#include <iostream>\n#include <string>\nusing namespace std;\n'
const P = 'struct P { int x; };\n'

describe('C++ 的左值是接點', () => {
  it('★ 錨點：`x += 1` lift 得出來，而左邊是一顆節點不是字串', () => {
    const node = findCompound(lift(`${IO}int main(){ int x = 1; x += 1; cout << x; }`))
    expect(node, '正向錨點——沒有它，下面的負向會空過').toBeTruthy()
    expect(node!.properties.name, '🔴 字串屬性長回來了').toBeUndefined()
    expect(node!.children.target).toHaveLength(1)
    expect(node!.children.target[0].componentId).toBe('cpp:var_ref')
  })

  it.each([
    ['a[i]', 'cpp:array_at', `${IO}int main(){ int a[3]={1,2,3}; int i=1; a[i] += 10; cout << a[1]; }`, '12'],
    ['o.x', 'cpp:struct_at_member', `${IO}${P}int main(){ P o; o.x = 1; o.x += 5; cout << o.x; }`, '6'],
    ['p->x', 'cpp:struct_at_ptr', `${IO}${P}int main(){ P o; o.x = 1; P* p = &o; p->x += 5; cout << o.x; }`, '6'],
    ['*q', 'cpp:pointer_deref', `${IO}int main(){ int i = 1; int* q = &i; *q += 5; cout << i; }`, '6'],
  ])('🎯 左值是 %s → 巢狀成 %s，而且算得對', async (_shape, componentId, src, want) => {
    const node = findCompound(lift(src))
    expect(node, '🔴 沒 lift 出複合指定').toBeTruthy()
    expect(node!.children.target[0].componentId,
      '🔴 左邊沒有變成那顆節點——它可能又被壓成字串了').toBe(componentId)
    expect(await run(src), '🔴 lift 對了而執行錯了').toBe(want)
  })

  /**
   * 🔴 **這一條是這個設計的證據**：`a[i][j]` 與 `s[i]` 是**另外兩顆元件**
   * （`cpp:array_2d_at`／`cpp:string_at`），而讓它們變成左值
   * **沒有動任何一支賦值執行器**——各自在自己的膠囊裡宣告怎麼被寫回。
   *
   * 這一支第一次跑時它們兩個都紅（「這個東西不能被指定值」），
   * 而修法是各加一個 `declareLvalue`，不是在共用檔多兩個分支。
   */
  it('★ 加一種左值形狀不改任何既有執行器（路線圖驗收②）', () => {
    const two = findCompound(lift(`${IO}int main(){ int a[2][2]; a[1][0] += 5; }`))
    const str = findCompound(lift(`${S}int main(){ string s = "h"; s[0] -= 7; }`))
    expect(two!.children.target[0].componentId).toBe('cpp:array_2d_at')
    expect(str!.children.target[0].componentId).toBe('cpp:string_at')
  })

  it('🎯 兩層下標（`a[i][j] += 1`）——舊版連 lift 都拆不出來', async () => {
    const src = `${IO}int main(){ int a[2][2]={{1,2},{3,4}}; a[1][0] += 5; cout << a[1][0]; }`
    expect(await run(src)).toBe('8')
  })

  it('⚠️ 字串那一格仍然是左值（`s[i] -= 7`）——C++ 的 `operator[]` 回參照', async () => {
    // 🔴 這個直譯器裡字串是**不可變**的，所以那一格的寫回要重建整個字串
    //    再寫回變數——`cpp:array_at` 的解法認得它。
    expect(await run(`${S}int main(){ string s = "h"; s[0] -= 7; cout << s; }`)).toBe('a')
  })

  it('⚠️ 字串的 `+=` 是串接不是相加（這一筆踩過兩次）', async () => {
    expect(await run(`${S}int main(){ string d = ""; d += 'a'; d += "bc"; cout << d; }`)).toBe('abc')
  })

  it('🎯 產回去一字不差——五種左值', () => {
    const src = `${IO}${P}int main(){ int a[3]; int i=0; P o; P* p=&o; int* q=&i;\n`
      + `a[i] += 1;\no.x += 1;\np->x += 1;\n*q += 1;\ni += 1;\n}`
    const out = generateCode(lift(src), 'cpp', googleStyle as unknown as StylePreset)
    for (const line of ['a[i] += 1;', 'o.x += 1;', 'p->x += 1;', '*q += 1;', 'i += 1;']) {
      expect(out, `🔴 產不回 ${line}`).toContain(line)
    }
  })
})
