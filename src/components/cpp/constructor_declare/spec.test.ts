/**
 * `cpp:constructor_declare`／`cpp:constructor_def_outside`／`cpp:destructor_declare`／`cpp:destructor_def_outside` 的**自證測**（第 322 刀）。
 *
 * ```
 * ① 類別裡 `A(int v);`、`~A();` ＋ 類別外 `A::A(int v) : x(v) {…}`、`A::~A() {…}` → Cella 的 mbCtor／mbDtor（初始化列與本體取類別外那一顆）
 * ② 建構子靠參數型別配對（多載）；解構子一個類別只有一個
 * ③ virtual 寫在類別裡那一行，類別外的定義不寫
 * ④ explicit、= default 這類修飾不被吃掉——照舊降級
 * ```
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
import { renderToBlocklyState } from '../../../core/projection/block-renderer'
import { setupTestRenderer } from '../../../../tests/helpers/setup-renderer'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { Lifter } from '../../../core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../../core/types'

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
})

const S = apcs as unknown as StylePreset
const lift = (code: string): SemanticNode => lifter.lift(tsParser.parse(code)!.rootNode as never) as SemanticNode
const ids = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) ids(k, out)
  return out
}
const shape = (n: SemanticNode): unknown => ({ c: n.componentId, p: n.properties, s: Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, (v as SemanticNode[]).map(shape)])) })

const head = '#include <iostream>\nusing namespace std;\n'
const SRC = `${head}class Box {
public:
    int w;
    int h;
    Box();
    Box(int a, int b = 3);
    virtual ~Box();
};
Box::Box() : w(1), h(1) {
    cout << "default" << endl;
}
Box::Box(int a, int b) : w(a), h(b) {
    cout << "made " << w * h << endl;
}
Box::~Box() {
    cout << "bye " << w << endl;
}
int main() {
    Box x;
    Box y(4);
    return 0;
}
`

describe('建構子／解構子：類別裡宣告、類別外定義', () => {
  it('★ lift：四顆元件各就各位，沒有原文降級', () => {
    const got = ids(lift(SRC))
    expect(got.filter((x) => x === 'cpp:constructor_declare')).toHaveLength(2)
    expect(got.filter((x) => x === 'cpp:constructor_def_outside')).toHaveLength(2)
    expect(got.filter((x) => x === 'cpp:destructor_declare')).toHaveLength(1)
    expect(got.filter((x) => x === 'cpp:destructor_def_outside')).toHaveLength(1)
    expect(got.filter((x) => /raw_code|unresolved/.test(x))).toEqual([])
  })

  it('★ generate：一字不差（含初始化列、預設引數、virtual）', () => {
    expect(generateCode(lift(SRC), 'cpp', S)).toBe(SRC.trimEnd())
  })

  it('★ 來回一趟語義不漂移', () => {
    const t = lift(SRC)
    expect(shape(lift(generateCode(t, 'cpp', S)))).toEqual(shape(t))
  })

  it('★ 執行（Cella）：多載的建構子各自配對、初始化列與預設引數生效、解構子倒序跑', async () => {
    await expectCellaOut(SRC, 'default\nmade 12\nbye 4\nbye 1\n')
  })

  it('★ 積木：四顆都渲染成自己的積木', () => {
    const text = JSON.stringify(renderToBlocklyState(lift(SRC)))
    for (const t of ['cpp_constructor_declare', 'cpp_constructor_def_outside', 'cpp_destructor_declare', 'cpp_destructor_def_outside']) expect(text).toContain(`"type":"${t}"`)
    expect(text).toMatch(/"IS_VIRTUAL":"true"/)
  })

  // 🔴 `= default` 原本被建成空本體的解構子（`~C() {}`）——`= delete` 的話意思整個反過來；這一刀順手修成照實降級
  it('負向：explicit、= default 的原型不被吃掉——照舊降級、原文一字不差', () => {
    const src = `${head}class C {\npublic:\n    explicit C(int v);\n    ~C() = default;\n};\nC::C(int v) {\n}\nint main() {\n    return 0;\n}\n`
    const t = lift(src)
    // 正向錨點：類別外的定義有被認得
    expect(ids(t)).toContain('cpp:constructor_def_outside')
    expect(ids(t)).not.toContain('cpp:constructor_declare')
    expect(ids(t)).not.toContain('cpp:destructor_declare')
    const out = generateCode(t, 'cpp', S)
    for (const s of ['explicit C(int v);', '~C() = default;']) expect(out).toContain(s)
  })
})
