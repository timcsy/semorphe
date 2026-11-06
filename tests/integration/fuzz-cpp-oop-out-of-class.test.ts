/**
 * **模糊測試：類別外定義成員函式**（元件管線 322）——隔離出題者寫的十支（不知道 Semorphe 的實作），語料在
 * `tests/fixtures/fuzz-cpp-oop-out-of-class.json`（預期輸出是 2026-11-07 用 clang++ -std=c++17 實跑的）。報告：`tests/reports/fuzz-cpp-oop-out-of-class-20261107.md`。
 *
 * 每一支驗：這一族的元件真的被認得（數量）、降級只落在登記過的原因、來回一趟語義不漂移；
 * 交給 Cella 翻不出的原因**都在已知缺口清單裡**（清單上的哪一條修好了，那一條就從這裡拿掉——下面那支會說）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { runCella } from '../helpers/cella-run'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const PROGS = JSON.parse(readFileSync(`${process.cwd()}/tests/fixtures/fuzz-cpp-oop-out-of-class.json`, 'utf8')) as { id: string; code: string; expected: string }[]
const S = apcs as unknown as StylePreset
let tsParser: Parser
let lifter: Lifter
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})
const lift = (code: string): SemanticNode => lifter.lift(tsParser.parse(code)!.rootNode as never) as SemanticNode
const all = (n: SemanticNode, out: SemanticNode[] = []): SemanticNode[] => {
  out.push(n)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) all(k, out)
  return out
}
const shape = (n: SemanticNode): unknown => ({ c: n.componentId, p: n.properties, s: Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, (v as SemanticNode[]).map(shape)])) })
const OURS = /^cpp:(method|constructor|destructor)_(declare|def_outside)$/

/** 這一族之外、已知的缺口（降級原因的開頭或原文）——每一條都是另一刀 */
const ALLOWED_DEGRADE = [
  /類別裡的方法原型（static、運算子/,           // 靜態成員函式、運算子多載的原型——另一刀
  /類別外定義的成員函式（建構子／解構子帶修飾、或樣板／巢狀類別）/, // 運算子多載的類別外定義（`Fraction::operator+`）
  /純虛擬函式的指標回傳或尾端 const/,             // 313 就登記過
  /^\w+::\w+$|^\w+$/,                             // `Node::created`：靜態成員的限定名（既有缺口）
  /^class Car \{/,                                // tree-sitter 不認得沒有名字的指標參數帶預設值（`Engine* = nullptr`）
  /^(Course|Grid)::\1\(/,                         // 初始化列裡的 `new X*[n]`：tree-sitter 的容錯解析（既有缺口）
]
/** 交給 Cella 翻不出的已知原因——各自是另一刀 */
const KNOWN_UNTRANSLATED = [
  /這顆(類別成員|頂層元件|元件)還沒有對應到 Cella 的建構子/, // 上面那些降級
  /類別外的靜態成員定義/,
  /`new T\(…\)` 的引數是文字屬性/,
  /型別「(Car|ostream)」還沒有對應/,
  /找不到 \w+ 這個成員的宣告|找不到這個(建構子|解構子)的宣告|類別外找不到它的定義/, // 它的另一半落在上面的降級裡
]

describe('模糊測試：類別外定義成員函式', () => {
  it('入口條件：十支都在、每一支都有預期輸出', () => {
    expect(PROGS).toHaveLength(10)
    expect(PROGS.every((p) => p.expected.length > 0)).toBe(true)
  })

  it.each(PROGS.map((p) => [p.id, p]))('★ %s：這一族都認得、降級只有登記過的、再 lift 不漂移', (_id, p) => {
    const t = lift((p as { code: string }).code)
    const nodes = all(t)
    expect(nodes.filter((n) => OURS.test(n.componentId)).length).toBeGreaterThanOrEqual(8)
    const bad = nodes.filter((n) => /raw_code|unresolved/.test(n.componentId))
      .map((n) => String(n.metadata?.rawCode ?? ''))
      .filter((why) => !ALLOWED_DEGRADE.some((re) => re.test(why.split('\n')[0])))
    expect(bad).toEqual([])
    expect(shape(lift(generateCode(t, 'cpp', S)))).toEqual(shape(t))
  })

  // 🟡 十支今天都還翻不出——原因全在這一族之外（見 KNOWN_UNTRANSLATED）。哪一天某一支判得出，就換成 expectCellaOut 對 clang 的輸出
  it.each(PROGS.map((p) => [p.id, p]))('🟡 %s：翻不出的原因都是已知缺口（不是這一族的）', async (_id, p) => {
    const r = await runCella((p as { code: string }).code)
    if (r.verdict === 'accept') {
      expect(r.out, '判得出了——拿掉這一支的釘子、改成對 clang 輸出的斷言').toBe((p as { expected: string }).expected)
      return
    }
    expect(r.verdict).toBe('untranslated')
    const unknown = r.untranslated.map((u) => u.reason).filter((why) => !KNOWN_UNTRANSLATED.some((re) => re.test(why)))
    expect(unknown).toEqual([])
  })

  // ── 盲測掀出、這一刀修好的（各一支） ──
  it('🔴 修好：`new int[n]()` 的值初始化不再丟掉（fuzz_9 原本來回漂移）', () => {
    const t = lift('int main() {\n    int n = 3;\n    int* a = new int[n]();\n    int* b = new int[n]{};\n    int* c = new int[n];\n}\n')
    const out = generateCode(t, 'cpp', S)
    for (const s of ['new int[n]()', 'new int[n]{}', 'new int[n];']) expect(out).toContain(s)
  })
  it('🔴 修好：類別整段因語法錯誤降級時，結尾的 `;` 跟著原文（fuzz_7 原本來回漂移）', () => {
    const code = 'class E;\nclass Car {\npublic:\n    void f(E* = nullptr);\n};\nint main() {\n}\n'
    const t = lift(code)
    const out = generateCode(t, 'cpp', S)
    expect(out).toContain('    void f(E* = nullptr);\n};')
    expect(shape(lift(out))).toEqual(shape(t))
  })
  it('🔴 修好：explicit 建構子、virtual／override 方法與解構子的原型——各是一格屬性，一字不差', () => {
    const code = 'class S {\npublic:\n    virtual ~S();\n    virtual void d(int k) const;\n};\nclass R : public S {\npublic:\n    explicit R(double r = 1.0);\n    ~R() override;\n    void d(int k) const override;\n};\nint main() {\n}\n'
    const t = lift(code)
    const ids = all(t).map((n) => `${n.componentId}:${n.properties?.virt ?? n.properties?.is_virtual ?? n.properties?.is_explicit ?? ''}`)
    for (const want of ['cpp:destructor_declare:true', 'cpp:method_declare:virtual', 'cpp:constructor_declare:true', 'cpp:destructor_declare:override', 'cpp:method_declare:override']) expect(ids).toContain(want)
    expect(generateCode(t, 'cpp', S)).toBe(code.trimEnd())
  })

  it('★ Cella：virtual／override 的原型與類別外定義——經基底參照呼叫走到衍生的那一個、解構子順序對（clang 輸出）', async () => {
    const code = `#include <iostream>
using namespace std;
class S {
public:
    virtual ~S();
    virtual int d(int k) const;
};
class R : public S {
public:
    explicit R(int r);
    ~R() override;
    int d(int k) const override;
private:
    int r;
};
S::~S() {
    cout << "~S" << endl;
}
int S::d(int k) const {
    return k;
}
R::R(int r) : r(r) {
}
R::~R() {
    cout << "~R" << endl;
}
int R::d(int k) const {
    return k * r;
}
int show(const S& s) {
    return s.d(5);
}
int main() {
    R a(3);
    S b;
    cout << show(a) << " " << show(b) << endl;
    return 0;
}
`
    expect(all(lift(code)).filter((n) => OURS.test(n.componentId)).length).toBe(10)
    const { expectCellaOut } = await import('../helpers/cella-run')
    await expectCellaOut(code, '15 5\n~S\n~R\n~S\n')
  })
})
