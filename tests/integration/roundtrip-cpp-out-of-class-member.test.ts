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
import { expectCellaOut } from '../helpers/cella-run'
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

    // 🟢 rt_2 的 `new Node{v, head}`：第 333 刀接上 Cella 的 eNewList（2026-11-07），原本照實回 unknown
    const run = async (): Promise<void> => {
      await expectCellaOut(p.code, p.expected)
      await expectCellaOut(generateCode(lift(p.code), 'cpp', competitive as unknown as StylePreset), p.expected)
    }
    it(`★ ${p.id}：Cella 跑出 clang++ 的輸出——原樣與 competitive 風格各一次`, async () => {
      await run()
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

// ── 第 331 刀：運算子的原型與類別外定義（走同兩顆，名字記成 `operator⊕`）──────────────────────────
// 期望輸出是 clang++ 跑出來的（2026-11-07）。
const OP_PROGS: { id: string; what: string; counts: Record<string, number>; expected: string; code: string }[] = [
  {
    id: 'op_1',
    what: "矩陣乘法、指派、相等：三個運算子都在類別外定義（回傳值、回傳參照、bool）",
    counts: {"cpp:method_declare": 3, "cpp:method_def_outside": 3, "cpp:constructor_declare": 1, "cpp:constructor_def_outside": 1},
    expected: "89 55\n1\n",
    code: `#include <iostream>
using namespace std;
class Mat {
public:
    int a, b, c, d;
    Mat(int p, int q, int r, int s);
    Mat operator*(const Mat&) const;
    Mat& operator=(const Mat& o);
    bool operator==(const Mat& o) const;
};
Mat::Mat(int p, int q, int r, int s) : a(p), b(q), c(r), d(s) {
}
Mat Mat::operator*(const Mat& o) const {
    return Mat(a * o.a + b * o.c, a * o.b + b * o.d, c * o.a + d * o.c, c * o.b + d * o.d);
}
Mat& Mat::operator=(const Mat& o) {
    a = o.a;
    b = o.b;
    c = o.c;
    d = o.d;
    return *this;
}
bool Mat::operator==(const Mat& o) const {
    return a == o.a && b == o.b && c == o.c && d == o.d;
}
int main() {
    Mat f(1, 1, 1, 0);
    Mat r(1, 0, 0, 1);
    for (int i = 0; i < 10; i++) {
        r = r * f;
    }
    cout << r.a << " " << r.b << endl;
    cout << (r == r * Mat(1, 0, 0, 1)) << endl;
    return 0;
}
`,
  },
  {
    id: 'op_2',
    what: "串流式的 << 串接（回傳 *this 的參照）與 const 的 []",
    counts: {"cpp:method_declare": 2, "cpp:method_def_outside": 2, "cpp:constructor_declare": 1, "cpp:constructor_def_outside": 1},
    expected: "5 14\n",
    code: `#include <iostream>
using namespace std;
class Bag {
public:
    int items[8];
    int n;
    Bag();
    Bag& operator<<(int x);
    int operator[](int i) const;
};
Bag::Bag() : n(0) {
}
Bag& Bag::operator<<(int x) {
    items[n] = x;
    n++;
    return *this;
}
int Bag::operator[](int i) const {
    return items[i];
}
int main() {
    Bag b;
    b << 3 << 1 << 4 << 1 << 5;
    int s = 0;
    for (int i = 0; i < b.n; i++) {
        s += b[i];
    }
    cout << b.n << " " << s << endl;
    return 0;
}
`,
  },
  {
    id: 'op_3',
    what: "給 sort 用的 <：struct 裡只宣告、定義在外面",
    counts: {"cpp:method_declare": 1, "cpp:method_def_outside": 1},
    expected: "1,9 1,2 3,5 3,1 \n",
    code: `#include <bits/stdc++.h>
using namespace std;
struct P {
    int x, y;
    bool operator<(const P& o) const;
};
bool P::operator<(const P& o) const {
    if (x != o.x) {
        return x < o.x;
    }
    return y > o.y;
}
int main() {
    vector<P> v = {{3, 1}, {1, 2}, {3, 5}, {1, 9}};
    sort(v.begin(), v.end());
    for (P p : v) {
        cout << p.x << "," << p.y << " ";
    }
    cout << endl;
    return 0;
}
`,
  },
]

describe('round-trip：運算子的類別外定義（第 331 刀）', () => {
  it('入口條件：三支都在', () => { expect(OP_PROGS).toHaveLength(3) })
  for (const p of OP_PROGS) {
    it(`★ ${p.id}（${p.what}）：元件身分、名字是 operator⊕、一字不差、不漂移`, () => {
      const t = lift(p.code)
      const nodes = all(t)
      for (const [id, n] of Object.entries(p.counts)) expect(nodes.filter((x) => x.componentId === id).length, `${p.id} 的 ${id}`).toBe(n)
      expect(nodes.filter((x) => x.componentId === 'cpp:method_declare').every((x) => String(x.properties.name).startsWith('operator'))).toBe(true)
      expect(nodes.filter((x) => /raw_code|unresolved/.test(x.componentId)).map((x) => String(x.metadata?.rawCode ?? ''))).toEqual([])
      const out = generateCode(t, 'cpp', S)
      expect(out).toBe(p.code.trimEnd())
      expect(shape(lift(out))).toEqual(shape(t))
    })
    it(`★ ${p.id}：Cella 跑出 clang++ 的輸出——原樣與 competitive 風格各一次`, async () => {
      await expectCellaOut(p.code, p.expected)
      await expectCellaOut(generateCode(lift(p.code), 'cpp', competitive as unknown as StylePreset), p.expected)
    })
  }

  // 🔴 round-trip 順手抓到的兩個既有缺陷（盲測 fuzz_2、fuzz_6 卡在這裡）——都是對稱的資料遺失：lift 丟、產碼也丟，來回比對一直綠
  it('🔴 delete[] 的 [] 走一趟不見、Cella 照實判 ubFree（現在記成 is_array）', async () => {
    const code = `#include <iostream>
using namespace std;
class Buf {
public:
    int* d;
    Buf();
    ~Buf();
};
Buf::Buf() : d(new int[4]) {
    d[0] = 9;
}
Buf::~Buf() {
    delete[] d;
}
int main() {
    Buf b;
    cout << b.d[0] << endl;
    return 0;
}`
    expect(generateCode(lift(code), 'cpp', S)).toBe(code)
    await expectCellaOut(code, '9\n')
  })

  it('🔴 指標的陣列當參數（const char* t[]）：[] 原本丟了，t[i][0] 被判「不是陣列或指標」', async () => {
    const code = `#include <iostream>
using namespace std;
int firsts(const char* t[], int n) {
    int s = 0;
    for (int i = 0; i < n; i++) {
        s += t[i][0] - 'a';
    }
    return s;
}
int main() {
    const char* w[3] = {"cat", "dog", "bee"};
    cout << firsts(w, 3) << endl;
    return 0;
}`
    expect(generateCode(lift(code), 'cpp', S)).toBe(code)
    await expectCellaOut(code, '6\n')
  })
})
