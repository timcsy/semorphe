/**
 * 膠囊自證：`cpp:enum` 的 formalize（spec 202 檔案範圍；第 238 刀區域的列舉與列舉名當型別）——期望值都是 g++ 印的。
 * 形狀照 cella 2026-11-03 給的：檔案範圍 iEnum、區塊裡 sType{d: tdEnum}、型別 tEnum、列舉值是指向 enumC 的 eVar。
 */
import { describe, it } from 'vitest'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'

const H = '#include <iostream>\nusing namespace std;\n'

describe('膠囊自證：列舉', () => {
  it('★ 檔案範圍：沒寫值的接著前一個 +1', async () => {
    await expectCellaOut(H + 'enum Color { RED, GREEN = 5, BLUE };\nint main() { cout << RED << GREEN << BLUE; }\n', '056')
  }, 300_000)
  it('★ 列舉名當型別，用在 switch', async () => {
    await expectCellaOut(H + 'enum Color { RED, GREEN = 5, BLUE };\nint main() { Color c = GREEN;\n  switch (c) { case GREEN: cout << "g"; break; default: cout << "x"; }\n}\n', 'g')
  }, 300_000)
  it('★ 寫在函式裡的列舉（負的值）', async () => {
    await expectCellaOut(H + 'int main() { enum Level { LOW = -1, HIGH = 1 }; Level v = HIGH; cout << LOW << " " << v; }\n', '-1 1')
  }, 300_000)
})
