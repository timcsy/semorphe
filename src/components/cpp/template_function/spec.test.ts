/**
 * `cpp:template_function` 的自證測（397）。
 *
 * ① 單純的函式樣板：lift 成這顆、程式碼與走積木回來一字不差、Cella 判得出（推導與明確指定）。
 * ② 裝不下的形狀（第二個型別參數、非型別參數、預設值、static／inline）照實降級，原文保留——原本會被安靜弄壞。
 * ③ 負向：推導失敗、本體有錯要 reject。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { setupTestRenderer } from '../../../../tests/helpers/setup-renderer'
import { expectCellaOut, runCella } from '../../../../tests/helpers/cella-run'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { renderToBlocklyState } from '../../../core/projection/block-renderer'
import { PatternExtractor } from '../../../core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../../core/blocks/block-spec-registry'
import { allCppComponents, allCppProjections } from '../../../languages/cpp/all-declarations'
import { registerCppExtractStrategies } from '../../../languages/cpp/extractors/extract-strategies'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
let ex: PatternExtractor
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  setupTestRenderer()
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allCppComponents(), allCppProjections())
  ex = new PatternExtractor()
  ex.loadBlockSpecs(reg.getAll())
  registerCppExtractStrategies(ex)
}, 120_000)

const S = apcs as unknown as StylePreset
const H = '#include <iostream>\n#include <string>\n#include <vector>\nusing namespace std;\n'
const main = (b: string) => 'int main() {\n' + b + '    return 0;\n}\n'
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const all = (n: SemanticNode, o: SemanticNode[] = []): SemanticNode[] => { o.push(n); for (const k of Object.values(n.slots ?? {})) for (const c of k) all(c, o); return o }
const ids = (t: SemanticNode) => all(t).map((n) => n.componentId)
function viaBlocks(src: string): string {
  const state = renderToBlocklyState(lift(src)) as unknown as { blocks: { blocks: { next?: { block: unknown } }[] } }
  const back: SemanticNode[] = []
  for (const b0 of state.blocks.blocks) {
    let cur: { next?: { block: unknown } } | undefined = b0
    while (cur) {
      const n = ex.extract(cur as never)
      if (n) back.push(n)
      cur = cur.next?.block as typeof cur
    }
  }
  return generateCode({ id: 'r', componentId: 'cpp:program', properties: {}, slots: { body: back } } as SemanticNode, 'cpp', S)
}

const SIMPLE: [string, string, string][] = [
  ['推導', 'template <typename T>\nT mx(T a, T b) {\n    return a > b ? a : b;\n}\n' + main('    cout << mx(1, 2) << " " << mx(1.5, 0.5) << endl;\n'), '2 1.5\n'],
  ['明確指定', 'template <typename T>\nT twice(T a) {\n    return a + a;\n}\n' + main('    cout << twice<double>(2) << endl;\n'), '4\n'],
  ['參考參數', 'template <typename T>\nvoid sw(T& a, T& b) {\n    T c = a;\n    a = b;\n    b = c;\n}\n' + main('    int x = 1, y = 2;\n    sw(x, y);\n    cout << x << y << endl;\n'), '21\n'],
  ['回傳 const 參考', 'template <typename T>\nconst T& pick(const T& a, const T& b) {\n    return a < b ? a : b;\n}\n' + main('    cout << pick(3, 2) << endl;\n'), '2\n'],
  ['回傳指標', 'template <typename T>\nT* self(T* p) {\n    return p;\n}\n' + main('    int x = 4;\n    cout << *self(&x) << endl;\n'), '4\n'],
  ['陣列參數', 'template <typename T>\nT sum(T a[], int n) {\n    T s = 0;\n    for (int i = 0; i < n; i++) {\n        s += a[i];\n    }\n    return s;\n}\n' + main('    int a[3] = {1, 2, 3};\n    cout << sum(a, 3) << endl;\n'), '6\n'],
  ['容器裡的 T', 'template <typename T>\nvoid show(const vector<T>& v) {\n    for (int i = 0; i < (int)v.size(); i++) {\n        cout << v[i] << " ";\n    }\n    cout << endl;\n}\n' + main('    vector<int> v = {1, 2};\n    show(v);\n'), '1 2 \n'],
  ['T 是 string', 'template <typename T>\nT mx(T a, T b) {\n    if (a > b) {\n        return a;\n    }\n    return b;\n}\n' + main('    string a = "x";\n    string b = "y";\n    cout << mx(a, b) << endl;\n'), 'y\n'],
  ['遞迴', 'template <typename T>\nT pw(T b, int e) {\n    if (e == 0) {\n        return 1;\n    }\n    return b * pw(b, e - 1);\n}\n' + main('    cout << pw(2, 3) << endl;\n'), '8\n'],
]

describe('cpp:template_function', () => {
  it.each(SIMPLE)('%s：身分、程式碼與積木來回、Cella 判決', async (_n, code, out) => {
    const src = H + code
    const t = lift(src)
    expect(ids(t)).toContain('cpp:template_function')
    expect(ids(t)).not.toContain('cpp:raw_code')
    expect(generateCode(t, 'cpp', S).trim()).toBe(src.trim())
    expect(viaBlocks(src).trim()).toBe(src.trim())
    await expectCellaOut(src, out)
  })

  it('class 關鍵字與 typename 同義：認得，產回去統一寫 typename', async () => {
    const src = H + 'template <class T>\nT id(T a) {\n    return a;\n}\n' + main('    cout << id(3) << endl;\n')
    expect(ids(lift(src))).toContain('cpp:template_function')
    expect(generateCode(lift(src), 'cpp', S)).toContain('template <typename T>')
    await expectCellaOut(src, '3\n')
  })

  it.each([
    ['第二個型別參數', 'template <typename T, typename U>\nT first(T a, U b) {\n    return a;\n}\n'],
    ['非型別參數', 'template <int N>\nint plus_n(int a) {\n    return a + N;\n}\n'],
    ['參數預設值', 'template <typename T>\nT add(T a, T b = 1) {\n    return a + b;\n}\n'],
    ['static', 'template <typename T>\nstatic T f(T a) {\n    return a;\n}\n'],
    ['inline', 'template <typename T>\ninline T f(T a) {\n    return a;\n}\n'],
  ])('裝不下的形狀照實降級、原文一字不差：%s', async (_n, fn) => {
    const src = H + fn + main('')
    const t = lift(src)
    expect(ids(t)).not.toContain('cpp:template_function')
    expect(ids(t)).toContain('cpp:raw_code')
    expect(generateCode(t, 'cpp', S).trim()).toBe(src.trim())
    expect((await runCella(src)).verdict).toBe('untranslated')
  })

  it.each([
    ['T 推導不一致', 'template <typename T>\nT mx(T a, T b) {\n    return a;\n}\n' + main('    cout << mx(1, 2.5) << endl;\n'), /no matching function/],
    ['本體用了沒宣告的名字', 'template <typename T>\nT f(T a) {\n    return a + nope;\n}\n' + main('    cout << f(1) << endl;\n'), /undeclared identifier 'nope'/],
  ])('負向：%s 判 reject', async (_n, code, why) => {
    const r = await runCella(H + code)
    expect(r.verdict).toBe('reject')
    expect(r.problems.map((p) => p.reason).join('；')).toMatch(why as RegExp)
  })
})
