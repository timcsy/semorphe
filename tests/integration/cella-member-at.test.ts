/**
 * 類別外定義的位置（395，`iMemberAt`，cella 2026-11-10 談定）。本體與初值掛在類別的成員上，
 * 而「看得到哪些全域名字」與「靜態初值的順序」看的是定義寫在哪裡。
 */
import { describe, it } from 'vitest'
import { expectCellaOut } from '../helpers/cella-run'

const HEAD = '#include <iostream>\nusing namespace std;\n'
const run = (code: string, out: string) => expectCellaOut(HEAD + code, out)

describe('類別外定義的位置', () => {
  it('靜態初值照定義的順序，不是類別裡宣告的順序', async () => {
    await run([
      'int c = 0;',
      'int nextId() { c = c + 1; return c; }',
      'struct A { static int b; static int a; };',
      'int A::a = nextId();',
      'int A::b = nextId();',
      'int main() { cout << A::a << " " << A::b; return 0; }',
    ].join('\n'), '1 2')
  }, 60_000)

  it('方法的本體看得到類別之後、定義之前的全域變數', async () => {
    await run([
      'struct A { int f(); };',
      'int g = 5;',
      'int A::f() { return g; }',
      'int main() { A a; cout << a.f(); return 0; }',
    ].join('\n'), '5')
  }, 60_000)

  it('建構子與解構子的本體也是', async () => {
    await run([
      'struct A { int v; A(); ~A(); };',
      'int g = 7;',
      'A::A() { v = g; }',
      'A::~A() { cout << "bye"; }',
      'int main() { A a; cout << a.v << " "; return 0; }',
    ].join('\n'), '7 bye')
  }, 60_000)

  it('多載的方法照宣告對應，定義的順序可以與宣告相反', async () => {
    await run([
      'struct A { int f(int x); int f(int x, int y); };',
      'int A::f(int x, int y) { return x + y; }',
      'int A::f(int x) { return x * 2; }',
      'int main() { A a; cout << a.f(3) << " " << a.f(3, 4); return 0; }',
    ].join('\n'), '6 7')
  }, 60_000)

  it('靜態方法宣告在靜態資料之前，本體讀得到它（383 的例外拿掉）', async () => {
    await run([
      'struct C { static int get(); static int total; };',
      'int C::total = 3;',
      'int C::get() { return total; }',
      'int main() { cout << C::get(); return 0; }',
    ].join('\n'), '3')
  }, 60_000)

  it('常數初值的靜態成員判決不受影響；指標也一樣', async () => {
    await run([
      'struct L { static int alive; static L* head; };',
      'int L::alive = 0;',
      'L* L::head = nullptr;',
      'int main() { cout << L::alive << (L::head == nullptr); return 0; }',
    ].join('\n'), '01')
  }, 60_000)
})
