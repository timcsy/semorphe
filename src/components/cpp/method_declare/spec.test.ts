/**
 * `cpp:method_declare` ＋ `cpp:method_def_outside` 的**自證測**（第 322 刀，類別外定義成員函式）。
 *
 * 推導不出來的四件事：
 *
 * ```
 * ① 兩顆一起才是一個成員：類別裡的原型 ＋ 類別外的定義 → Cella 的一個 mbMethod（本體與參數名取定義，預設引數取原型）
 * ② 多載靠鍵分：名字 ＋ 參數型別 ＋ const——`get()` 與 `get() const` 是兩個成員
 * ③ 對不上的照實標翻不出：只宣告不定義、定義了而類別裡沒有那個成員——不猜
 * ④ 形狀不單純的（virtual 與 override 並寫、static 帶尾端 const、巢狀命名空間）不准被吃掉——照舊降級（只寫 virtual 或只寫 override 是一格屬性）成原文
 * ```
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { expectCellaOut, runCella } from '../../../../tests/helpers/cella-run'
import { renderToBlocklyState } from '../../../core/projection/block-renderer'
import { setupTestRenderer } from '../../../../tests/helpers/setup-renderer'
import apcs from '../../../languages/cpp/styles/apcs.json'
import competitive from '../../../languages/cpp/styles/competitive.json'
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
const gen = (code: string, style: StylePreset = S): string => generateCode(lift(code), 'cpp', style)

function all(n: SemanticNode, pred: (id: string) => boolean, out: SemanticNode[] = []): SemanticNode[] {
  if (pred(n.componentId)) out.push(n)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) all(k, pred, out)
  return out
}
const ofId = (t: SemanticNode, id: string): SemanticNode[] => all(t, (x) => x === id)
const shape = (n: SemanticNode): unknown => ({ c: n.componentId, p: n.properties, s: Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, (v as SemanticNode[]).map(shape)])) })

const head = '#include <iostream>\nusing namespace std;\n'
const SRC = `${head}class B;
class A {
public:
    int v;
    void link(B* b);
    int get() const;
    int twice(int k = 2);
};
class B {
public:
    int x;
};
void A::link(B* b) {
    v = b->x;
}
int A::get() const {
    return v;
}
int A::twice(int k) {
    return get() * k;
}
int main() {
    A a;
    B b;
    b.x = 21;
    a.link(&b);
    cout << a.get() << " " << a.twice() << endl;
    return 0;
}
`

describe('cpp:method_declare ＋ cpp:method_def_outside', () => {
  it('★ lift：類別裡三行原型是 method_declare、類別外三個定義是 method_def_outside；沒有原文降級', () => {
    const t = lift(SRC)
    const decls = ofId(t, 'cpp:method_declare')
    const defs = ofId(t, 'cpp:method_def_outside')
    expect(decls.map((d) => [d.properties.return_type, d.properties.name, d.properties.is_const])).toEqual([
      ['void', 'link', 'false'], ['int', 'get', 'true'], ['int', 'twice', 'false'],
    ])
    expect(defs.map((d) => [d.properties.class_name, d.properties.name, d.properties.is_const])).toEqual([
      ['A', 'link', 'false'], ['A', 'get', 'true'], ['A', 'twice', 'false'],
    ])
    expect(decls[2].slots.params?.[0]?.properties).toMatchObject({ type: 'int', name: 'k', default: '2' })
    expect(all(t, (x) => /raw_code|unresolved/.test(x))).toEqual([])
  })

  it('★ generate：一字不差（apcs 與 competitive 兩種大括號風格各一次）', () => {
    // 產生器不寫檔尾的換行（同其他膠囊的來回測試）——比到最後一個 `}`
    expect(gen(SRC)).toBe(SRC.trimEnd())
    const comp = gen(SRC, competitive as unknown as StylePreset)
    expect(comp).toContain('int A::get() const')
    expect(comp).toContain('    int get() const;')
  })

  it('★ 來回一趟語義不漂移', () => {
    const t = lift(SRC)
    expect(shape(lift(generateCode(t, 'cpp', S)))).toEqual(shape(t))
  })

  it('★ 執行（Cella）：本體接回類別成員——印出 21 42', async () => {
    await expectCellaOut(SRC, '21 42\n')
  })

  it('★ 沒有名字的指標參數（`void link(B*);`）：星號保留，鍵與定義 `B* b` 對得上', async () => {
    const src = SRC.replace('void link(B* b);', 'void link(B*);')
    expect(gen(src)).toContain('    void link(B*);')
    await expectCellaOut(src, '21 42\n')
  })

  it('★ 多載：get() 與 get() const 各自配對', async () => {
    const src = `${head}class C {
public:
    int n = 1;
    int get();
    int get() const;
};
int C::get() {
    return n + 10;
}
int C::get() const {
    return n + 20;
}
int main() {
    C c;
    const C& r = c;
    cout << c.get() << " " << r.get() << endl;
    return 0;
}
`
    expect(gen(src)).toBe(src.trimEnd())
    await expectCellaOut(src, '11 21\n')
  })

  it('★ 積木：兩顆都渲染成自己的積木，欄位帶著類別名、名字、const', () => {
    const t = lift(SRC)
    const st = renderToBlocklyState(t) as unknown as { blocks: { blocks: unknown[] } }
    const text = JSON.stringify(st)
    expect(text).toContain('"type":"cpp_method_declare"')
    expect(text).toContain('"type":"cpp_method_def_outside"')
    expect(text).toMatch(/"CLASS_NAME":"A"/)
    expect(text).toMatch(/"IS_CONST":"true"/)
  })

  it('🔴 只宣告不定義：照實標翻不出（不補空本體）', async () => {
    const r = await runCella(`${head}class A {\npublic:\n    void f();\n};\nint main() {\n    return 0;\n}\n`)
    expect(r.verdict).toBe('untranslated')
    expect(r.untranslated.map((u) => u.reason).join('；')).toMatch(/找不到它的定義/)
  })

  it('🔴 定義了而類別裡沒有那個成員（參數型別不同）：照實標翻不出，不猜成頂層函式', async () => {
    const r = await runCella(`${head}class A {\npublic:\n    void f(int x);\n};\nvoid A::f(double x) {\n}\nint main() {\n    return 0;\n}\n`)
    expect(r.verdict).toBe('untranslated')
    expect(r.untranslated.map((u) => u.reason).join('；')).toMatch(/找不到 f 這個成員的宣告/)
  })

  it('靜態成員函式（383）：lift 成同一顆、virt 是 static；產回去一字不差；Cella 判得出（經類別呼叫、類別裡呼叫、遞迴）', async () => {
    const src = `${head}class A {\npublic:\n    static int fact(int n);\n    int twice() {\n        return fact(2) * 2;\n    }\n};\nint A::fact(int n) {\n    return n <= 1 ? 1 : n * fact(n - 1);\n}\nint main() {\n    A a;\n    cout << A::fact(4) << " " << a.twice() << endl;\n    return 0;\n}\n`
    const t = lift(src)
    expect(ofId(t, 'cpp:method_declare')[0].properties.virt).toBe('static')
    expect(generateCode(t, 'cpp', S)).toContain('static int fact(int n);')
    await expectCellaOut(src, '24 4\n')
  })

  it('🔴 靜態成員函式讀靜態資料成員：Cella 目前誤判，照實翻不出（不送去被說成錯的）', async () => {
    const r = await runCella(`${head}class A {\npublic:\n    static int f();\n    static int a;\n};\nint A::a = 7;\nint A::f() {\n    return a;\n}\nint main() {\n    cout << A::f() << endl;\n    return 0;\n}\n`)
    expect(r.verdict).toBe('untranslated')
    expect(r.untranslated.map((u) => u.reason).join('；')).toMatch(/靜態成員函式 f 的本體讀了類別的成員/)
  })

  it('負向：virtual 與 override 並寫、static 帶尾端 const、巢狀命名空間的定義不被吃掉——照舊降級、原文一字不差', () => {
    const src = `${head}namespace ns {\nclass A {\npublic:\n    virtual void f() override;\n    static int g() const;\n};\n}\nvoid ns::A::f() {\n}\nint main() {\n    return 0;\n}\n`
    const t = lift(src)
    // 正向錨點：程式真的被讀進來了（main 在）
    expect(all(t, (x) => x === 'cpp:func_def').length).toBeGreaterThan(0)
    expect(ofId(t, 'cpp:method_declare')).toEqual([])
    expect(ofId(t, 'cpp:method_def_outside')).toEqual([])
    const out = generateCode(t, 'cpp', S)
    for (const s of ['virtual void f() override;', 'static int g() const;']) expect(out).toContain(s)
  })
})

// ── 第 331 刀：運算子的原型與類別外定義走同兩顆（名字記成 `operator+`）────────────
describe('運算子：類別裡只宣告、定義寫在類別外', () => {
  const OPS = `${head}class Fraction {
public:
    int n, d;
    Fraction(int a, int b) : n(a), d(b) {
    }
    Fraction operator+(const Fraction&) const;
    Fraction& operator+=(const Fraction& o);
    bool operator<(const Fraction&) const;
    bool operator==(const Fraction& rhs) const;
};
Fraction Fraction::operator+(const Fraction& o) const {
    return Fraction(n * o.d + o.n * d, d * o.d);
}
Fraction& Fraction::operator+=(const Fraction& o) {
    n = n * o.d + o.n * d;
    d = d * o.d;
    return *this;
}
bool Fraction::operator<(const Fraction& o) const {
    return n * o.d < o.n * d;
}
bool Fraction::operator==(const Fraction& o) const {
    return n == o.n && d == o.d;
}
int main() {
    Fraction a(1, 2), b(1, 3);
    Fraction c = a + b;
    cout << c.n << "/" << c.d << endl;
    a += b;
    cout << a.n << "/" << a.d << endl;
    cout << (b < a) << " " << (a == a) << endl;
    return 0;
}
`
  it('lift：四個原型是宣告方法、四個定義是類別外定義方法，名字是 operator⊕', () => {
    const t = lift(OPS)
    const decls = ofId(t, 'cpp:method_declare')
    const defs = ofId(t, 'cpp:method_def_outside')
    expect(decls.map((d) => d.properties.name)).toEqual(['operator+', 'operator+=', 'operator<', 'operator=='])
    expect(defs.map((d) => d.properties.name)).toEqual(['operator+', 'operator+=', 'operator<', 'operator=='])
    expect(decls[1].properties.return_type, '回傳參照').toBe('Fraction&')
    expect(ofId(t, 'cpp:raw_code'), '不再降級').toHaveLength(0)
  })

  it('產碼一字不差、來回不漂移', () => {
    expect(gen(OPS)).toBe(OPS.trimEnd())
    expect(shape(lift(gen(OPS)))).toEqual(shape(lift(OPS)))
  })

  it('執行：Cella 判得出，輸出同 clang', async () => {
    await expectCellaOut(OPS, '5/6\n5/6\n1 1\n')
  })

  it('原型與定義的運算子寫法不同（`operator +` 與 `operator+`）也配得上', async () => {
    const code = `${head}struct S {
    int v;
    S operator -() const;
};
S S::operator-() const {
    S r;
    r.v = -v;
    return r;
}
int main() {
    S s{3};
    cout << (-s).v << endl;
    return 0;
}
`
    const t = lift(code)
    expect(ofId(t, 'cpp:method_declare')[0].properties.name).toBe('operator-')
    expect(ofId(t, 'cpp:method_def_outside')[0].properties.name).toBe('operator-')
    await expectCellaOut(code, '-3\n')
  })
})
