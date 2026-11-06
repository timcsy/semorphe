/**
 * **round-trip：類別外定義成員函式**（元件管線 322）——類別裡宣告方法／建構子／解構子、類別外定義它們（六顆元件）。
 *
 * 每一支驗四件事：元件身分（數量對得上，不是退化成頂層函式或原文）、產碼一字不差、再 lift 不漂移、Cella 跑出 clang++ 的輸出
 *（預期輸出是 2026-11-07 用 clang++ -std=c++17 實跑的）。另外換成 competitive 的大括號風格再跑一次 Cella。
 * ⚠️ 程式碼用反引號樣板寫：`audit-declared-slots` 等護欄的語料是 tests/integration 裡的反引號片段。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { expectCellaOut, knownCellaGap } from '../helpers/cella-run'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import competitive from '../../src/languages/cpp/styles/competitive.json'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../src/core/types'

let tsParser: Parser
let lifter: Lifter
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

const S = apcs as unknown as StylePreset
const lift = (code: string): SemanticNode => lifter.lift(tsParser.parse(code)!.rootNode as never) as SemanticNode
const all = (n: SemanticNode, out: SemanticNode[] = []): SemanticNode[] => {
  out.push(n)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) all(k, out)
  return out
}
const shape = (n: SemanticNode): unknown => ({ c: n.componentId, p: n.properties, s: Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, (v as SemanticNode[]).map(shape)])) })

const PROGS: { id: string; what: string; counts: Record<string, number>; expected: string; code: string }[] = [
  {
    id: 'rt_1',
    what: "帳戶：建構子帶初始化列、const 取值、回傳 bool 的方法",
    counts: {"cpp:constructor_declare": 1, "cpp:constructor_def_outside": 1, "cpp:method_declare": 3, "cpp:method_def_outside": 3},
    expected: "0 1 120\n",
    code: `#include <iostream>
using namespace std;
class Account {
public:
    Account(int start);
    void deposit(int x);
    bool withdraw(int x);
    int balance() const;
private:
    int money;
};
Account::Account(int start) : money(start) {
}
void Account::deposit(int x) {
    money += x;
}
bool Account::withdraw(int x) {
    if (x > money) {
        return false;
    }
    money -= x;
    return true;
}
int Account::balance() const {
    return money;
}
int main() {
    Account a(100);
    a.deposit(50);
    cout << a.withdraw(500) << " " << a.withdraw(30) << " " << a.balance() << endl;
    return 0;
}
`,
  },
  {
    id: 'rt_2',
    what: "鏈結串列：預設建構子、解構子釋放節點、回傳指標的方法",
    counts: {"cpp:constructor_declare": 1, "cpp:constructor_def_outside": 1, "cpp:destructor_declare": 1, "cpp:destructor_def_outside": 1, "cpp:method_declare": 3, "cpp:method_def_outside": 3},
    expected: "30 3\nfreed\n",
    code: `#include <iostream>
using namespace std;
struct Node {
    int v;
    Node* next;
};
class List {
public:
    List();
    ~List();
    void push(int v);
    Node* first();
    int size() const;
private:
    Node* head;
    int n;
};
List::List() : head(nullptr), n(0) {
}
List::~List() {
    while (head != nullptr) {
        Node* t = head;
        head = head->next;
        delete t;
    }
    cout << "freed" << endl;
}
void List::push(int v) {
    head = new Node{v, head};
    n++;
}
Node* List::first() {
    return head;
}
int List::size() const {
    return n;
}
int main() {
    List l;
    for (int i = 1; i <= 3; i++) {
        l.push(i * 10);
    }
    cout << l.first()->v << " " << l.size() << endl;
    return 0;
}
`,
  },
  {
    id: 'rt_3',
    what: "多載：同名不同參數型別各自配對、本體裡隱含 this 的呼叫",
    counts: {"cpp:method_declare": 3, "cpp:method_def_outside": 3},
    expected: "5 3.5 14\n",
    code: `#include <iostream>
using namespace std;
class Calc {
public:
    int add(int a, int b);
    double add(double a, double b);
    int twice(int k);
};
int Calc::add(int a, int b) {
    return a + b;
}
double Calc::add(double a, double b) {
    return a + b + 0.5;
}
int Calc::twice(int k) {
    return add(k, k);
}
int main() {
    Calc c;
    cout << c.add(2, 3) << " " << c.add(1.0, 2.0) << " " << c.twice(7) << endl;
    return 0;
}
`,
  },
  {
    id: 'rt_4',
    what: "回傳參照的方法（`int& Vec::at`）與 const 方法裡的迴圈",
    counts: {"cpp:method_declare": 3, "cpp:method_def_outside": 3},
    expected: "112\n",
    code: `#include <iostream>
using namespace std;
class Vec {
public:
    int& at(int i);
    void fill(int k);
    int sum() const;
private:
    int a[5];
};
int& Vec::at(int i) {
    return a[i];
}
void Vec::fill(int k) {
    for (int i = 0; i < 5; i++) {
        a[i] = k * i;
    }
}
int Vec::sum() const {
    int s = 0;
    for (int i = 0; i < 5; i++) {
        s += a[i];
    }
    return s;
}
int main() {
    Vec v;
    v.fill(2);
    v.at(4) = 100;
    cout << v.sum() << endl;
    return 0;
}
`,
  },
  {
    id: 'rt_5',
    what: "預設引數寫在原型、參數與欄位同名、virtual 解構子倒序跑",
    counts: {"cpp:constructor_declare": 1, "cpp:constructor_def_outside": 1, "cpp:destructor_declare": 1, "cpp:destructor_def_outside": 1, "cpp:method_declare": 1, "cpp:method_def_outside": 1},
    expected: "make 3x2\nmake 4x5\n26\ndrop 20\ndrop 6\n",
    code: `#include <iostream>
using namespace std;
class Shape {
public:
    Shape(int w, int h = 2);
    virtual ~Shape();
    int area() const;
private:
    int w;
    int h;
};
Shape::Shape(int w, int h) : w(w), h(h) {
    cout << "make " << w << "x" << h << endl;
}
Shape::~Shape() {
    cout << "drop " << area() << endl;
}
int Shape::area() const {
    return w * h;
}
int main() {
    Shape a(3);
    Shape b(4, 5);
    cout << a.area() + b.area() << endl;
    return 0;
}
`,
  },
]

/**
 * 短片段（400 字以內）——反引號語料的掃描器只收這個長度（`tests/helpers/backtick-corpus.ts`），
 * 上面五支整支程式太長、進不了 `audit-declared-slots` 等護欄的語料；這兩段讓六顆元件與它們的參數、初始化列、本體都被碰到。
 */
const SHORT = [
  `class P {
public:
    P(int v);
    ~P();
    int get() const;
    void set(int v, int w);
private:
    int x;
};
P::P(int v) : x(v) {
}
P::~P() {
}
int P::get() const {
    return x;
}
void P::set(int v, int w) {
    x = v + w;
}`,
  `class Q {
public:
    Q();
    virtual ~Q();
    double half(double d);
};
Q::Q() {
    cout << "q" << endl;
}
Q::~Q() {
    cout << "bye" << endl;
}
double Q::half(double d) {
    return d / 2;
}`,
]

describe('round-trip：類別外定義成員函式', () => {
  for (const [i, code] of SHORT.entries()) {
    it(`★ 短片段 ${i + 1}：六顆元件裡用到的都認得、一字不差、不漂移`, () => {
      expect(code.length, '片段超過 400 字就進不了反引號語料').toBeLessThanOrEqual(400)
      const t = lift(code)
      const ids = all(t).map((x) => x.componentId)
      for (const id of ['cpp:constructor_declare', 'cpp:constructor_def_outside', 'cpp:destructor_declare', 'cpp:destructor_def_outside', 'cpp:method_declare', 'cpp:method_def_outside']) expect(ids, id).toContain(id)
      expect(ids.filter((x) => /raw_code|unresolved/.test(x))).toEqual([])
      const out = generateCode(t, 'cpp', S)
      expect(out).toBe(code)
      expect(shape(lift(out))).toEqual(shape(t))
    })
  }

  it('入口條件：五支都在，每支都有預期輸出與要數的元件', () => {
    expect(PROGS).toHaveLength(5)
    for (const p of PROGS) {
      expect(p.expected.length, p.id).toBeGreaterThan(0)
      expect(Object.keys(p.counts).length, p.id).toBeGreaterThan(0)
    }
  })

  for (const p of PROGS) {
    it(`★ ${p.id}（${p.what}）：元件身分、一字不差、不漂移`, () => {
      const t = lift(p.code)
      const nodes = all(t)
      for (const [id, n] of Object.entries(p.counts)) expect(nodes.filter((x) => x.componentId === id).length, `${p.id} 的 ${id}`).toBe(n)
      expect(nodes.filter((x) => /raw_code|unresolved/.test(x.componentId)).map((x) => String(x.metadata?.rawCode ?? ''))).toEqual([])
      const out = generateCode(t, 'cpp', S)
      expect(out).toBe(p.code.trimEnd())
      expect(shape(lift(out))).toEqual(shape(t))
    })

    // 🟡 rt_2 的 `new Node{v, head}`：`new T(…)`／`new T{…}` 的引數今天是**文字屬性**（`cpp:new` 的 formalize 照實標翻不出）——
    //    是 semorphe 這一側的缺口，不是 Cella 的。為什麼不現在修：引數要從屬性升格成運算式槽，判準在〈元件代數〉「屬性的結構化邊界」，
    //    積木形狀跟著變，是另一刀（路線圖〈類別外定義成員函式〉的後續；313 的盲測 fuzz_2、3、5、6 也卡在這裡）。修好的那天這一支會紅 → 拿掉包裝。
    const run = async (): Promise<void> => {
      await expectCellaOut(p.code, p.expected)
      await expectCellaOut(generateCode(lift(p.code), 'cpp', competitive as unknown as StylePreset), p.expected)
    }
    it(`★ ${p.id}：Cella 跑出 clang++ 的輸出——原樣與 competitive 風格各一次`, async () => {
      if (p.id === 'rt_2') await knownCellaGap(/new T\(…\)` 的引數是文字屬性/, run)
      else await run()
    })
  }

  // 🔴 round-trip 順手抓到的既有缺陷：類別裡的陣列欄位被建成名字叫 `a[5]` 的變數（寫在類別裡的方法一樣壞），Cella 說 `a` 未宣告
  it('🔴 陣列欄位：類別裡定義的方法、struct 的欄位都讀得到（tArr，不是名字叫 a[5] 的變數）', async () => {
    const cls = `#include <iostream>
using namespace std;
class V {
public:
    int get(int i) {
        return a[i];
    }
    void fill() {
        for (int i = 0; i < 5; i++) {
            a[i] = i * 3;
        }
    }
private:
    int a[5];
};
int main() {
    V v;
    v.fill();
    cout << v.get(4) << endl;
    return 0;
}`
    const t = lift(cls)
    const arr = all(t).find((x) => x.componentId === 'cpp:array_declare')
    expect(arr?.properties).toMatchObject({ type: 'int', name: 'a' })
    expect(generateCode(t, 'cpp', S)).toBe(cls)
    await expectCellaOut(cls, '12\n')
    await expectCellaOut(`#include <iostream>
using namespace std;
struct S {
    int a[3];
    int n;
};
int main() {
    S s;
    s.a[2] = 7;
    s.n = 1;
    cout << s.a[2] + s.n << endl;
    return 0;
}`, '8\n')
  })

  it('負向：二維陣列欄位照實降級——原文一字不差（不把維度塞進名字）', () => {
    const code = `class G {
public:
    int g[2][3];
};`
    const t = lift(code)
    // 正向錨點：類別有被認得
    expect(all(t).map((x) => x.componentId)).toContain('cpp:class_def')
    expect(all(t).some((x) => x.componentId === 'cpp:raw_code' && String(x.metadata?.rawCode ?? '').includes('多維陣列欄位'))).toBe(true)
    expect(generateCode(t, 'cpp', S)).toContain('    int g[2][3];')
  })
})
