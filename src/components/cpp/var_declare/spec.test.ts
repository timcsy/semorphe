/**
 * `cpp:var_declare` 的**自證測**——推導不出來的語義（共同測從 `component.json` 推導，不放這裡）。
 *
 * 第 331 刀撞到：一行宣告好幾個類別物件、各帶建構子引數（`F a(1, 2), b(1, 3);`），外層那顆沒有 `init_style`，
 * 引擎的通用形狀逐一翻宣告子時不經過「類別的直接初始化」那條 ⟹ Cella 判「找不到相符的建構子」（分成兩行就判得出）。
 */
import { describe, it } from 'vitest'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'

const H = '#include <iostream>\nusing namespace std;\nstruct F { int n, d; F(int a, int b) : n(a), d(b) {} };\n'

describe('cpp:var_declare 自證測', () => {
  it('一行宣告兩個類別物件、各帶建構子引數（區域）', async () => {
    await expectCellaOut(H + 'int main() { F a(1, 2), b(1, 3); cout << a.n << b.d; return 0; }', '13')
  })

  it('同上（全域），而一般的多宣告照舊', async () => {
    await expectCellaOut(H + 'F g1(4, 5), g2(6, 7);\nint main() { int x = 1, y = 2; cout << g1.d << g2.n << x << y; return 0; }', '5612')
  })
})
