/**
 * **`.size()` 的辨識與靜默回退**（`specs/110`）。
 *
 * 兩個病疊在一起，而第二個讓第一個看不見：
 *
 * ```
 * s.length()  →  cpp:string_size{obj:s}   ✅
 * s.size()    →  cpp:vector_size{obj:s}   ← 身分錯
 *                cpp:vector_size 對非陣列回 0  ← 讓上面那行看不見
 * ```
 *
 * 後果：`for (int i = 0; i < s.size(); i++)` **一次都不跑**，
 * 字串原樣輸出，而沒有任何地方說出錯了。19 筆誤差裡的 5 筆整叢是這個。
 *
 * 🔴 spec 202（重構 6c-2d）：執行判準從 JS 直譯器換成 Cella（`tests/helpers/cella-run.ts`）。
 */
import { describe, it } from 'vitest'
import { expectCellaOut } from '../helpers/cella-run'

const H = '#include <iostream>\n#include <string>\n#include <vector>\nusing namespace std;\n'
const run = (bodyText: string, want: string) => expectCellaOut(H + bodyText, want)

describe('`.size()` 在字串上要與 `.length()` 同義', () => {
  it('★ s.size() 回字元數', async () => {
    await run(`int main(){ string s="abc"; cout << s.size(); }`, '3')
  })

  it('★ 對照組：s.length() 本來就對，不得回歸', async () => {
    await run(`int main(){ string s="abc"; cout << s.length(); }`, '3')
  })

  it('★ 用 size() 當迴圈條件要跑滿（這是那 5 筆的形狀）', async () => {
    await run(`int main(){ string s="abc"; for(int i=0;i<s.size();i++) cout<<s[i]; }`, 'abc')
  })

  it('★ 對照組：真的容器的 size() 不得回歸', async () => {
    await run(`int main(){ vector<int> v={1,2,3}; cout << v.size(); }`, '3')
  })

  it('★ 對照組：空容器的 size() 仍然是 0（FR-004，反向不可省）', async () => {
    // 沒有這一支，「一律丟錯」也會通過「非容器要出聲」那一條。
    await run(`int main(){ vector<int> v; cout << v.size(); }`, '0')
  })
})
