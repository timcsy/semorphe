/**
 * `cpp:func_call` 的自證測——formalize 那一路（2026-11-07 升 Cella 1526 時抓到一整族主樹上就有的**假的 reject**）。
 *
 * 名字不是一個函式時照 eCall 送，Cella 判「未宣告的名字」——一支合法的程式被說成錯的（P6）：
 * ```
 * string("ab").size()            名字是型別：建暫時物件（eTemp）        ← 改成判得出
 * max<long long>(3, 5)           明確指定樣板引數的函式樣板呼叫           ← 送 eCallT（2026-11-08 cella 給的形狀），判得出
 * numeric_limits<int>::min()     樣板類別的靜態成員                       ← 照實翻不出
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

  for (const e of ['numeric_limits<int>::min()']) {
    it(`🔴 ${e}：照實翻不出，不得被判成錯的`, async () => {
      const r = await runCella(prog(e))
      expect(r.verdict, JSON.stringify(r.problems?.slice(0, 1))).not.toBe('reject')
      // 正向錨點：它確實是被我們照實標下來的那一種，不是剛好別的原因翻不出
      expect(r.verdict).toBe('untranslated')
      expect(r.untranslated.map((u) => u.reason).join(' ')).toMatch(/樣板類別的靜態成員/)
    })
  }

  it('一般的函式呼叫照舊：`abs(-3)`', async () => {
    await expectCellaOut(prog('abs(-3)'), '3\n')
  })
})
