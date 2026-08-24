/**
 * **多層指標——`int**` 一路掉東西。**
 *
 * ## 這支測試從哪來
 *
 * 2026-08-24，使用者：「C++ 那邊的 function return type 是不是無法自訂？
 * 例如我要 `int**` 就找不到了。」
 *
 * 查下拉的過程順手拿 `int**` 探了抬升那一路，而它掉的東西比下拉多：
 *
 * ```
 * int** p;            → cpp:pointer_declare{ name: "ptr", type: "int" }
 *                       🔴 名字掉了（退成預設 "ptr"）、一顆星也掉了
 * int** f(int** a)    → param_decl{ type: "int*", name: "" }
 *                       🔴 參數掉一顆星、名字是空的
 * ```
 *
 * ## 根因是同一個，出現在兩個地方
 *
 * `int**` 的 AST 是**巢狀**的 `pointer_declarator`：
 *
 * ```
 * declaration
 *   primitive_type "int"
 *   pointer_declarator
 *     pointer_declarator      ← 而兩處都只剝了一層
 *       identifier "p"
 * ```
 *
 * 兩處都寫 `namedChildren.find(c => c.type === 'identifier')`——
 * 對單層指標成立，對多層**找不到**，於是退回預設值。
 *
 * > **`?? 'ptr'` 與 `?? ''` 讓「沒找到」與「本來就沒有」長得一模一樣。**
 * > （`CLAUDE.md` 點名的靜默降級反模式，第 N 個實例。）
 *
 * ⚠️ 而症狀是**產出一段合法但不同的程式**（`int* ptr;`），不是錯誤——
 * 所以編譯器不會幫你發現。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestLifter } from '../helpers/setup-lifter'
import { CppParser } from '../../src/languages/cpp/parser'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import { generateCode } from '../../src/core/projection/code-generator'
import { registerCppLanguage } from '../../src/languages/cpp/generators'

const style: StylePreset = {
  id: 'apcs',
  name: { 'zh-TW': 'APCS', en: 'APCS' },
  io_style: 'cout',
  naming_convention: 'camelCase',
  indent_size: 4,
  brace_style: 'K&R',
  namespace_style: 'using',
  header_style: 'individual',
}

let parser: CppParser
let lifter: ReturnType<typeof createTestLifter>

beforeAll(async () => {
  parser = new CppParser()
  await parser.init('public')
  lifter = createTestLifter()
  registerCppLanguage()
}, 30_000)

async function lift(code: string): Promise<SemanticNode> {
  const tree = await parser.parse(code)
  const t = lifter.lift(tree.rootNode as never)
  if (!t) throw new Error('抬升回 null')
  return t
}

function find(n: SemanticNode, id: string): SemanticNode | null {
  if (n.componentId === id) return n
  for (const kids of Object.values(n.children ?? {})) {
    for (const k of kids ?? []) {
      const hit = find(k, id)
      if (hit) return hit
    }
  }
  return null
}

/** 🔴 **真正的判準是產回去的那段碼**——樹對而產出不對，使用者拿到的還是壞的 */
async function roundtrip(code: string): Promise<string> {
  return generateCode(await lift(code), 'cpp', style).trim()
}

describe('多層指標不得掉東西', () => {
  it('來回一趟：`int** p;` 還是 `int** p;`', async () => {
    expect(await roundtrip('int** p;\n')).toBe('int** p;')
  })

  it('來回一趟：三層也還在', async () => {
    expect(await roundtrip('int*** p;\n')).toBe('int*** p;')
  })

  it('來回一趟：帶多層指標參數的函式', async () => {
    expect(await roundtrip('int f(int** a) {\n    return 0;\n}\n')).toContain('int f(int** a)')
  })

  it('★ 錨點：單層指標本來就是對的（否則下面比的是一個壞掉的基準）', async () => {
    const p = find(await lift('int* p;\n'), 'cpp:pointer_declare')
    expect(p?.properties).toMatchObject({ name: 'p', type: 'int' })
  })

  it('`int** p;` 的名字與星數都要留住', async () => {
    const p = find(await lift('int** p;\n'), 'cpp:pointer_declare')
    // ⚠️ `pointer_declare` 的產生器自己會補一顆星（`${type}* ${name}`），
    //    所以兩顆星的型別是 `int*`
    expect(p?.properties, '名字退成預設 "ptr" 的話，產出的是一段合法而不同的程式').toMatchObject({
      name: 'p',
      type: 'int*',
    })
  })

  it('`int*** p;` 也一樣——不是只補到兩層', async () => {
    const p = find(await lift('int*** p;\n'), 'cpp:pointer_declare')
    expect(p?.properties).toMatchObject({ name: 'p', type: 'int**' })
  })

  it('參數的多層指標：型別與名字都要留住', async () => {
    const t = await lift('int f(int** a) { return 0; }\n')
    const param = find(t, 'param_decl')
    expect(param?.properties).toMatchObject({ type: 'int**', name: 'a' })
  })

  it('回傳型別本來就對——這一條釘住它不要被順手改壞', async () => {
    const f = find(await lift('int** f(int** a) { return a; }\n'), 'cpp:func_def')
    expect(f?.properties).toMatchObject({ name: 'f', return_type: 'int**' })
  })

  it('多層指標帶初始值', async () => {
    const p = find(await lift('int x; int* q = &x; int** p = &q;\n'), 'cpp:pointer_declare')
    // 第一顆是 `int* q`，找最後一顆
    const t = await lift('int** p = nullptr;\n')
    const last = find(t, 'cpp:pointer_declare')
    expect(p).not.toBeNull()
    expect(last?.properties).toMatchObject({ name: 'p', type: 'int*' })
  })
})
