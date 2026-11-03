/**
 * **`cout` 的預設浮點格式，逐格對上 g++**（2026-09-18；spec 208 起由 Cella 背書）。
 *
 * ## 🔴 它從哪來
 *
 * I/O 操縱子那一族的探索問了一題：「`fixed << setprecision(6)` 要改數字怎麼變成
 * 文字——今天那一段在哪裡？」而去讀那一段的時候發現**它本身是錯的**：
 *
 * ```
 *                    g++            我們（舊）
 * 1e9                1e+09          1.00000e+9
 * 123456789.0        1.23457e+08    1.23457e+8
 * 0.000012345        1.2345e-05     0.000012345
 * 999999.5           1e+06          1000000
 * ```
 *
 * 三個獨立的錯，而它們**疊在同一個函式裡**：
 *
 * ```
 * ① 科學記號的尾數沒有去尾零        `1.00000e+9`
 * ② 指數沒有補成兩位                `e+9` 而不是 `e+09`
 * ③ 切換門檻用 JS 的，不是 C 的 %g  指數 < -4 就該切，而 JS 是 < -7
 * ④ 指數在【四捨五入之前】算        999999.5 進位之後是七位數字
 * ```
 *
 * ⚠️ 而舊碼的註解逐字寫著「**直接沿用**」——
 *
 * > **一個「直接沿用」的註解，說的是「我沒有比對過」。**
 *
 * 🔴 **母體不是一支語料**：它是**每一支印大數或小數的程式**。
 * 語料量到的那一支（`AP325/7/7_5_TLE.cpp`）只是第一個被看見的。
 *
 * ⚠️ **每一個期望值都是問 g++ 來的**，不是推的——第四個錯就是推出來的那一版。
 *
 * 🟢 **spec 208（重構 6c-4）**：原本量的是直譯器自己的格式化函式（`valueToString`、`toFixedHalfEven`…）。直譯器刪掉之後，
 * 學生看到的數字由 Cella 印——同一張表（每一格都是問 g++ 來的）改成每一格寫成一支 `cout` 程式交給 Cella。
 */
import { describe, it } from 'vitest'
import { expectCellaOut } from '../helpers/cella-run'

/** JS 的數字寫成 C++ 的 double 字面量（整數形狀補 `.0`，否則 1.5e20 會是溢位的整數字面量） */
const lit = (n: number): string => { const t = String(n); return /[.e]/.test(t) ? t : `${t}.0` }
const prog = (stmt: string): string => `#include <iostream>\n#include <iomanip>\nusing namespace std;\nint main() { ${stmt} return 0; }\n`

describe('`cout` 的預設浮點格式：逐格對上 g++', () => {
  it.each([
    [1e9, '1e+09'], [123456789.0, '1.23457e+08'], [0.000012345, '1.2345e-05'],
    [1/3, '0.333333'], [1.0, '1'], [2.5, '2.5'], [1e-7, '1e-07'], [1.5e20, '1.5e+20'],
    [-1e9, '-1e+09'], [1e100, '1e+100'], [999999.5, '1e+06'], [0.0001, '0.0001'], [0.00001, '1e-05'], [100000.0, '100000'], [1000000.0, '1e+06'], [3.14159265, '3.14159'], [0.1, '0.1'], [1e6+0.5, '1e+06'], [999999.4, '999999'], [1234567.0, '1.23457e+06'], [99999.99, '100000'],
  ])('%s → %s', async (n, want) => {
    await expectCellaOut(prog(`cout << ${lit(n)};`), want)
  })
})

/**
 * **平手的時候往哪邊走**——C 的預設捨入模式是**逢五取偶**，JS 是逢五進位。
 *
 * ⚠️ 兩者**只在精確的平手上不同**（`0.35` 在二進位裡略小於 0.35，兩邊都給 `0.3`）
 * ——而一半的測資會讓那個差別隱形。
 *
 * > **一個只在「剛好一半」時才不同的規則，測資裡沒有整齊的數字就永遠不會紅。**
 *
 * ⚠️ **每一個期望值都是問 g++ 來的**。
 */
describe('四捨五入的收尾：逢五取偶（問過 g++）', () => {
  it.each([
    [2.5, 0, '2'], [3.5, 0, '4'], [0.5, 0, '0'], [1.5, 0, '2'],
    [0.25, 1, '0.2'], [0.35, 1, '0.3'], [2.25, 1, '2.2'], [2.75, 1, '2.8'],
    [3.14159, 2, '3.14'], [-2.5, 0, '-2'], [1.005, 2, '1.00'],
  ])('固定小數 %s → %s 位 = %s', async (n, d, want) => {
    await expectCellaOut(prog(`cout << fixed << setprecision(${d}) << ${lit(n)};`), want)
  })

  it.each([
    [1234.5, 3, '1.234e+03'], [1e9, 5, '1.00000e+09'], [0.000012345, 4, '1.2345e-05'],
  ])('科學記號 %s → %s 位 = %s', async (n, p, want) => {
    await expectCellaOut(prog(`cout << scientific << setprecision(${p}) << ${lit(n)};`), want)
  })

  it.each([
    [1.25, 2, '1.2'], [1.35, 2, '1.4'], [3.14159, 3, '3.14'],
    [123456.0, 3, '1.23e+05'], [1.0000005, 6, '1'],
  ])('有效數字 %s → %s 位 = %s', async (n, p, want) => {
    await expectCellaOut(prog(`cout << setprecision(${p}) << ${lit(n)};`), want)
  })
})

// 2026-11-04（第 251 刀）：這五顆（io_mode／io_mode_number／io_flush／range_min／range_find_upper）
// 原本只被刪掉的直譯器測試碰到——宣告完整性護欄的語料因此掉了它們。這一支走產品那條路（lift → formalize → Cella），
// 同時把它們放回語料（最後一行的 `'\n'` 與 `set<pair<int, int>>` 也是：字串屬性護欄的字元常值判定、
// 與「型別字串裡裝了結構」那一筆待看的，原本都靠刪掉的 interpreter-matches-compiler 撐著）。
// ⚠️ `cout.flush()`（方法呼叫的寫法）Cella 0.1.202611031229 判 reject（「no member named 'flush' in ''」）
//    ——我們送的是忠實的 `eMCall { obj: eStdout, f: 'flush' }`，已附最小重現回報 cella（2026-11-04）。
describe('串流修飾與範圍查找（走 lift → Cella）', () => {
  it('fixed／setprecision／flush／min_element／upper_bound', async () => {
    await expectCellaOut(`#include <bits/stdc++.h>
using namespace std;
int main() {
    vector<int> v = {1, 2, 3};
    set<pair<int, int>> st;
    st.insert({2, 1});
    cout << st.size() << endl;
    cout << fixed << setprecision(2) << 1.5 << endl;
    cout << flush;
    cout << *min_element(v.begin(), v.end()) << endl;
    cout << *upper_bound(v.begin(), v.end(), 1) << '\\n';
    return 0;
}`, '1\n1.50\n1\n2\n')
  })
})
