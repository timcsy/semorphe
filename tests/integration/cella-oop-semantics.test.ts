/**
 * **OOP 與閉包的語義，改由 Cella 背書**（spec 208 T002，6c 盤點風險 3）。
 *
 * 原本守這些語義的是手搭語意樹丟給 JS 直譯器跑的那幾支（`tests/unit/interpreter/{destructor,class-method,lambda}-execute`、`oop-slice3`）。
 * 直譯器刪掉之後，「我們的 lift → formalize 有沒有把它們翻對」只有這一檔在看：寫成真的程式碼，走產品同一條路，由 Cella 判。
 * 期望值是 C++ 標準規定的輸出（每一支都可以拿任何編譯器重跑）。
 */
import { describe, it } from 'vitest'
import { expectCellaOut, knownCellaGap } from '../helpers/cella-run'

const H = '#include <iostream>\nusing namespace std;\n'

describe('解構的順序', () => {
  it('★ 同一個作用域的兩個物件：後建的先解構（[class.dtor]、[stmt.dcl]）', async () => {
    await expectCellaOut(`${H}struct T { char c; T(char x) : c(x) { cout << "+" << c; } ~T() { cout << "-" << c; } };
int main() { T a('a'); T b('b'); cout << "|"; return 0; }`, '+a+b|-b-a')
  })
  it('★ 函式回傳時，區域物件在回到呼叫者之前解構', async () => {
    await expectCellaOut(`${H}struct T { ~T() { cout << "D"; } };
void f() { T t; cout << "f"; }
int main() { f(); cout << "M"; return 0; }`, 'fDM')
  })
  it('★ 迴圈裡每一圈各建一個、各解構一次', async () => {
    await expectCellaOut(`${H}struct T { int i; T(int x) : i(x) {} ~T() { cout << i; } };
int main() { for (int k = 1; k <= 3; k++) { T t(k); } cout << "!"; return 0; }`, '123!')
  })
})

describe('方法', () => {
  it('★ 方法呼叫同一個物件的另一個方法（隱含的 this）', async () => {
    await expectCellaOut(`${H}struct C { int n = 0; void inc() { n++; } void twice() { inc(); inc(); } };
int main() { C c; c.twice(); cout << c.n; return 0; }`, '2')
  })
  it('★ 反向：類別外面同名的函式，從 main 呼叫時照舊是那個函式（不是誤認成方法）', async () => {
    await expectCellaOut(`${H}void inc() { cout << "free"; }
struct C { int n = 0; void inc() { n++; } void twice() { inc(); inc(); } };
int main() { C c; c.twice(); inc(); cout << c.n; return 0; }`, 'free2')
  })
  it('★ 虛擬分派：基底的參照呼叫到衍生類別的覆寫', async () => {
    await expectCellaOut(`${H}class A { public: virtual void hi() { cout << "A"; } virtual ~A() {} };
class B : public A { public: void hi() override { cout << "B"; } };
void call(A& a) { a.hi(); }
int main() { A a; B b; call(a); call(b); return 0; }`, 'AB')
  })
  it('★ 沒寫 override：衍生類別同名同參數的方法照樣覆寫（[class.virtual]p2）', async () => {
    await expectCellaOut(`${H}class A { public: virtual int v() { return 1; } };
class B : public A { public: int v() { return 2; } };
int f(A& a) { return a.v(); }
int main() { B b; cout << f(b); return 0; }`, '2')
  })
  // 🟡 已知缺陷（修好時這兩條會紅——拿掉 knownCellaGap 這層包裝）：都是【我們這一側】lift 的來回一趟缺陷，不是 Cella 的
  //    （spec 208 T002 量到，修在 spec 209「OOP 來回一趟」，刪直譯器之前先做）。
  it('🟡 已知缺陷（修好時這條會紅）：虛擬分派經過基底的指標 `p->v()`——lift 把 `->` 當成 `.`', async () => {
    await knownCellaGap(/no member named 'v'/, () => expectCellaOut(`${H}class A { public: virtual int v() { return 1; } virtual ~A() {} };
class B : public A { public: int v() override { return 2; } };
int main() { B b; A* p = &b; cout << p->v(); return 0; }`, '2'))
  })
  it('★ `struct B : A` 的繼承：override 對得到基底（spec 209 修好 lift 之前是釘子）', async () => {
    await expectCellaOut(`${H}struct A { virtual void hi() { cout << "A"; } };
struct B : A { void hi() override { cout << "B"; } };
void call(A& a) { a.hi(); }
int main() { B b; call(b); return 0; }`, 'B')
  })
})

describe('lambda 的捕捉', () => {
  it('★ [&]：改到外面的那一個', async () => {
    await expectCellaOut(`${H}int main() { int x = 1; auto f = [&]() { x = x + 10; }; f(); cout << x; return 0; }`, '11')
  })
  it('★ [=]：捕捉的是建立當下的值，之後外面改了也不影響', async () => {
    await expectCellaOut(`${H}int main() { int x = 1; auto f = [=]() { return x; }; x = 5; cout << f() << x; return 0; }`, '15')
  })
})
