/**
 * 宣告家族的語義（B 項，身分健檢的「要看」批）
 *
 * 護欄報出六顆宣告概念**宣告完全相同**（properties／children／role 一致）：
 * `var_declare`／`cpp_pointer_declare`／`cpp_const_declare`／`cpp_ref_declare`／
 * `cpp_constexpr_declare`／`cpp_static_declare`，並問「型別是身分還是參數？」
 *
 * ## 量了之後：答案不是合併
 *
 * 五顆共用同一個執行器（`execVarDeclare`），只有 pointer 有自己的。
 * **而「共用執行器」有兩種可能**：行為真的一樣，或**直譯器沒模型化差別**。
 *
 * 跟 `g++ -std=c++17` 對答案：
 *
 * | | 直譯器（修之前） | g++ |
 * |---|---|---|
 * | `static int n` 跨呼叫保存 | `111` | **`123`** |
 * | `int& r = a; r = 9;` | `59` | **`99`** |
 *
 * **兩顆的身分是對的，缺的是行為。** 而它們之所以三個月沒被發現，正是因為
 * 共用執行器讓「沒實作」看起來像「一樣」。
 *
 * → 六顆**不合併**。`const`／`constexpr` 的執行期行為確實與 `var_declare` 相同，
 * 但要不要把修飾詞變成參數，取決於參數規格化（C 項）——現在決定會決定兩次。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { generateCode } from '../../src/core/projection/code-generator'
import type { SemanticNode } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

let treeParser: Parser

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  treeParser = new Parser()
  treeParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

function lift(src: string): SemanticNode {
  const tree = treeParser.parse(src)
  if (!tree) throw new Error('parse 失敗')
  return createTestLifter().lift(tree.rootNode as never) as SemanticNode
}

async function run(src: string): Promise<string> {
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  await i.execute(lift(src))
  return i.getOutput().join('')
}

const P = '#include <iostream>\nusing namespace std;\n'

// ─── static 區域變數：跨呼叫保存 ────────────────────────────────────

describe('cpp_static_declare — 區域靜態變數跨呼叫保存', () => {
  it('★ g++ 說是 123（不是 111）', async () => {
    const out = await run(`${P}void tick(){ static int n = 0; n++; cout << n; }\nint main(){ tick(); tick(); tick(); return 0; }`)
    expect(out, '111 代表每次呼叫都重新初始化——那是把 static 當成一般區域變數').toBe('123')
  })

  it('★ 負向：**非** static 的區域變數每次都重來', async () => {
    // 沒有這一支的話，「所有區域變數都保存」的實作也會過
    const out = await run(`${P}void tick(){ int n = 0; n++; cout << n; }\nint main(){ tick(); tick(); tick(); return 0; }`)
    expect(out, '一般區域變數被保存了——那比不保存更糟').toBe('111')
  })

  it('★ 兩個不同函式的 static 互不干擾', async () => {
    const out = await run(
      `${P}void a(){ static int n = 0; n++; cout << n; }\nvoid b(){ static int n = 10; n++; cout << n; }\nint main(){ a(); b(); a(); b(); return 0; }`,
    )
    expect(out).toBe('111212')
  })

  it('★ 產生路徑不變', () => {
    const code = generateCode(lift(`${P}void tick(){ static int n = 0; }\nint main(){ return 0; }`), 'cpp', apcs as never)
    expect(code).toContain('static int n = 0;')
  })
})

// ─── 參照：別名，不是複製 ───────────────────────────────────────────

describe('cpp_ref_declare — 參照是別名', () => {
  it('★ 透過參照寫入會改到本體：g++ 說是 99（不是 59）', async () => {
    const out = await run(`${P}int main(){ int a = 5; int& r = a; r = 9; cout << a << r; return 0; }`)
    expect(out, '59 代表參照被當成複製——那讓「參照」這個概念完全沒有意義').toBe('99')
  })

  it('★ 反向也成立：改本體，參照跟著變', async () => {
    const out = await run(`${P}int main(){ int a = 5; int& r = a; a = 7; cout << a << r; return 0; }`)
    expect(out).toBe('77')
  })

  it('★ 負向：**非**參照的宣告是複製', async () => {
    // 沒有這一支的話，「所有宣告都變成別名」的實作也會過
    const out = await run(`${P}int main(){ int a = 5; int b = a; b = 9; cout << a << b; return 0; }`)
    expect(out, '一般宣告變成別名了——那會讓每一個複製都變成共用').toBe('59')
  })

  it('★ 產生路徑不變', () => {
    const code = generateCode(lift(`${P}int main(){ int a = 5; int& r = a; return 0; }`), 'cpp', apcs as never)
    expect(code).toContain('int& r = a;')
  })
})

// ─── 身分判定：六顆不合併，而理由是量出來的 ─────────────────────────

describe('六顆宣告概念的身分', () => {
  const 樣本: [string, string][] = [
    ['int a = 1;', 'var_declare'],
    ['const int b = 2;', 'cpp:const_declare'],
    ['constexpr int c = 3;', 'cpp:constexpr_declare'],
    ['static int d = 4;', 'cpp:static_declare'],
    ['int* p = nullptr;', 'cpp:pointer_declare'],
    ['int& r = a;', 'cpp:ref_declare'],
  ]

  for (const [程式, 身分] of 樣本) {
    it(`★ ${程式} → ${身分}`, () => {
      const ids: string[] = []
      const walk = (n: SemanticNode): void => {
        if (!n) return
        ids.push(n.conceptId)
        for (const l of Object.values(n.children ?? {})) for (const c of l ?? []) walk(c as SemanticNode)
      }
      walk(lift(`${P}int main(){ int a = 0; ${程式} return 0; }`))
      expect(ids, '六顆都是活的、都到得了——合併之前先確認這件事').toContain(身分)
    })
  }
})
