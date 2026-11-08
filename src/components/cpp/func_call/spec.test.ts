/**
 * `cpp:func_call` 的自證測——formalize 那一路（2026-11-07 升 Cella 1526 時抓到一整族主樹上就有的**假的 reject**）。
 *
 * 名字不是一個函式時照 eCall 送，Cella 判「未宣告的名字」——一支合法的程式被說成錯的（P6）：
 * ```
 * string("ab").size()            名字是型別：建暫時物件（eTemp）        ← 改成判得出
 * max<long long>(3, 5)           明確指定樣板引數的函式樣板呼叫           ← 送 eCallT（2026-11-08 cella 給的形狀），判得出
 * numeric_limits<int>::min()     樣板類別的靜態成員                       ← 送 eStaticCall（Cella 0.1.202611080524），判得出
 * ostream_iterator<int>(cout,"") 還不認得的樣板型別                       ← 照實翻不出
 * ```
 * 判準：**不准是 reject**——判不出的照實說翻不出，判得出的就要判對。
 */
import { describe, it, expect } from 'vitest'
import { runCella, expectCellaOut } from '../../../../tests/helpers/cella-run'

const prog = (expr: string): string =>
  `#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    cout << ${expr} << endl;\n    return 0;\n}\n`

describe('cpp:func_call 的 formalize：名字不是函式的那幾種', () => {
  it('🔴 名字是型別 → 建暫時物件：`string("ab").size()` 判得出、印 2', async () => {
    await expectCellaOut(prog('string("ab").size()'), '2\n')
  })

  for (const [e, out] of [['max<long long>(3, 5)', '5\n'], ['min<int>(3, 5)', '3\n'], ['make_pair<int, int>(1, 2).first', '1\n'], ['max<double>(1, 2.5)', '2.5\n'], ['get<1>(make_tuple<int, int>(1, 2))', '2\n']]) {
    it(`🔴 明確指定樣板引數：${e} 送 eCallT、判得出`, async () => {
      await expectCellaOut(prog(e), out)
    })
  }

  // Cella 0.1.202611080524：eStaticCall（numeric_limits）、swap<W> 照型別檢查、ostream_iterator（2026-11-08）——之前前兩個照實翻不出、swap<int> 判 reject
  for (const [e, out] of [['numeric_limits<int>::min()', '-2147483648\n'], ['numeric_limits<short>::max()', '32767\n'], ['std::numeric_limits<long long>::max()', '9223372036854775807\n']]) {
    it(`🔴 ${e}：樣板類別的靜態成員送 eStaticCall、判得出`, async () => {
      await expectCellaOut(prog(e), out)
    })
  }

  it('🔴 swap<int>(a, b)：送 eCallT、照型別檢查', async () => {
    await expectCellaOut('#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    int a = 1, b = 2;\n    swap<int>(a, b);\n    cout << a << b << endl;\n}\n', '21\n')
  })

  it('🔴 ostream_iterator<int>(cout, " ")：建一個暫時物件（eTemp、樣板名寫 std::、cout 送 eConst）', async () => {
    await expectCellaOut('#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    vector<int> v = {3, 1, 2};\n    copy(v.begin(), v.end(), ostream_iterator<int>(cout, " "));\n    cout << endl;\n}\n', '3 1 2 \n')
  })

  it('一般的函式呼叫照舊：`abs(-3)`', async () => {
    await expectCellaOut(prog('abs(-3)'), '3\n')
  })
})
