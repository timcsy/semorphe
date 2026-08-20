/**
 * **屬性宣告清償的回歸釘子**（`specs/112`）。
 *
 * 第三十四條護欄第一次跑抓到 6 種漏宣告，而拆開之後是三種東西：
 *
 * | | 例 | 修法 |
 * |---|---|---|
 * | 純漏宣告 | `include.local`、`class_def.base_class` | 補一行 |
 * | **真缺陷** | `struct_at_ptr.ptr` | **lifter 產 `ptr`、執行器讀 `obj` → `p->x` 會炸** |
 * | 不能改宣告 | `pair_declare.type` | 宣告 `type1/type2` 才是對的，見下 |
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import type { SemanticNode } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const find = (n: SemanticNode, id: string): SemanticNode | null => {
  if (n.componentId === id) return n
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) { const r = find(k, id); if (r) return r }
  return null
}
async function run(c: string): Promise<string> {
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  await i.execute(lift(c))
  return i.getOutput().join('')
}
const IO = '#include <iostream>\nusing namespace std;\n'

describe('屬性宣告清償', () => {
  it('★ p->x 要跑得動（真缺陷：lifter 產 ptr、執行器讀 obj）', async () => {
    // 🔴 修之前丟 RUNTIME_ERR_UNDECLARED_VAR: undefined
    //    ——`String(node.properties.obj)` 拿到 undefined，變成字串 "undefined" 去查變數。
    // 家族慣例是 `obj`（`cpp:struct_at_member` 用的就是它，執行器也讀它），
    // 所以**修 lifter**而不是改宣告——改宣告會讓同族兩顆用不同的名字。
    expect(await run(`${IO}struct P { int x; };\nint main(){ P a; a.x=7; P* p=&a; cout << p->x; }`)).toBe('7')
  })

  it('★ 而 p.x 的既有行為不得回歸（同族的另一顆）', async () => {
    expect(await run(`${IO}struct P { int x; };\nint main(){ P a; a.x=7; cout << a.x; }`)).toBe('7')
  })

  it('★ struct_at_ptr 產出的屬性名要與宣告一致', () => {
    // ⚠️ 用**讀取**位置，不是賦值位置——`p->x = 1` 會被 lift 成別的概念
    // （賦值那一路自己處理成員），於是這支測試什麼都測不到。
    // 那個對照斷言（`not.toBeNull()`）第一版就抓到了它。
    const n = find(lift('#include <iostream>\nstruct P { int x; };\nint main(){ P a; P* p=&a; std::cout << p->x; }'), 'cpp:struct_at_ptr')
    expect(n, '語料要真的產出這顆，否則這支測試什麼都沒測到').not.toBeNull()
    expect(Object.keys(n!.properties)).toContain('obj')
    expect(Object.keys(n!.properties)).not.toContain('ptr')
  })

  it('兩個型別是兩個屬性，不是一個逗號字串（2026-08-13 修，釘子已拔）', () => {
    // ✅ **這支曾經是 `it.fails`**。當時的判斷逐字：「**這一筆刻意不用『改宣告』
    // 來消掉**。宣告寫的是 `type1`／`type2`，而那是**對的設計**——把它改成 `type`
    // 會讓護欄變綠而缺陷還在，那正是『把缺陷洗成設計，然後讓護欄替它背書』。」
    //
    // 🔴 **那個判斷完全正確，而它在十一天後省下了一次誤修**：修的是 lifter
    // （`strategies.ts` 為 pair 拆樣板引數），三路裡另外兩路一個字都不用動。
    //
    // > **忍住不改宣告，是為了讓將來的人還找得到真正該改的那一路。**
    const n = find(lift('#include <utility>\nusing namespace std;\nint main(){ pair<int,string> pr; }'), 'cpp:pair_declare')
    expect(n).not.toBeNull()
    expect(Object.keys(n!.properties)).toContain('type1')
    expect(Object.keys(n!.properties)).toContain('type2')
    // ⚠️ 負向：那個逗號字串不得回來
    expect(Object.keys(n!.properties)).not.toContain('type')
  })
})
