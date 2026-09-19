/**
 * **量測工具的錨點：那支「這份輸入讓程式走進未定義行為了嗎」的判定，自己對不對。**
 *
 * ## 🔴 它為什麼是常駐的，不是一支探針
 *
 * `sanitizerSaysUB` 的用途是**把語料的「解譯器出錯」拆成兩堆**：
 * 我們的缺陷，與「那份測資讓那支程式沒有定義的行為」。
 * 它一旦壞掉的症狀**不是紅**——是它對每一支都回 `false`，
 * 於是那一族重新被算成缺陷；或對每一支都回 `true`，
 * 於是**一整排真的缺陷安靜地從帳上消失**。
 *
 * > **一個用來「把東西移出缺陷帳」的判定，壞掉的方向決定它有多危險
 * > ——而往寬的那個方向不會有人發現。**
 *
 * ## ⚠️ 它只能證實，不能否證
 *
 * 消毒器抓不到未初始化的讀取、抓不到全域陣列的小幅越界。
 * 所以回 `false` 的那些**仍然算我們的帳**——這條在助手的檔頭寫死了。
 *
 * ## 🔴 沒有消毒器時**不跳過**
 *
 * 「跳過的護欄與不存在的護欄長得一樣」。所以可用性自己是一支斷言，
 * 而不是一個 `skipIf`——CI 上少了 libasan 的話，紅的是那一支，訊息說得出是哪一台。
 */
import { describe, it, expect } from 'vitest'
import { sanitizerSaysUB, hasReferenceCompiler, referenceCompilerInfo } from '../helpers/run-cpp'

const H = '#include <bits/stdc++.h>\nusing namespace std;\n'

describe('量測工具的錨點：未定義行為的判定', () => {
  it('★ 健康檢查：這台機器上消毒器裝得起來（跳過的話下面在驗空氣）', () => {
    expect(hasReferenceCompiler(), '🔴 找不到參照編譯器').toBe(true)
    const r = sanitizerSaysUB(`${H}int main(){ int x=2147483647; x=x+1; cout<<x; return 0; }`, '')
    expect(r.ub,
      `🔴 消毒器在這台機器上不可用（${referenceCompilerInfo().version}）——`
      + '語料的「測資走進 UB」那一欄會整欄歸零，而那看起來像「缺陷變多了」。'
      + `\n   回傳：${JSON.stringify(r)}`)
      .not.toBeNull()
  }, 180_000)

  /**
   * ★ **正向錨點①：語料真正的那個形狀**——`vector<T> A[n]` 之後用輸入來的索引。
   * ⚠️ 而它走的是**程式正常退出**那一路（UBSan 預設會讓程式繼續跑），
   *    第一版的 `execFileSync` 只在「它失敗了」時讀 stderr，**對這一路是沉默的**。
   */
  it('★ 正向錨點①：越界索引要被指名，而且程式是正常退出的那一路', () => {
    const r = sanitizerSaysUB(
      `${H}int main(){ int n; cin>>n; vector<int> a[3]; a[n].push_back(1); cout<<"done"; return 0; }`, '7\n')
    expect(r.ub).toBe(true)
    expect(r.detail).toMatch(/out of bounds|AddressSanitizer/)
  }, 180_000)

  it('★ 正向錨點②：有號整數溢位（純 UBSan，程式不會死）', () => {
    const r = sanitizerSaysUB(`${H}int main(){ int x = 2147483647; x = x + 1; cout << x; return 0; }`, '')
    expect(r.ub).toBe(true)
    expect(r.detail).toMatch(/signed integer overflow/)
  }, 180_000)

  /**
   * 🔴 **負向：這一條才是真正危險的方向。**
   * 判定往寬了壞（每一支都說 UB）會讓真的缺陷從帳上消失，而且全綠。
   */
  it('🔴 乾淨的程式不得被指名——否則整排缺陷會安靜地從帳上消失', () => {
    const r = sanitizerSaysUB(
      `${H}int main(){ int n; cin>>n; vector<int> v(n); for(int i=0;i<n;i++) v[i]=i; cout<<v[n-1]; return 0; }`,
      '5\n')
    expect(r.ub).toBe(false)
    expect(r.detail).toBe('')
  }, 180_000)

  /**
   * ⚠️ **餵不同的輸入要給不同的答案**——同一支程式，UB 與否**由那份測資決定**。
   * 這一條擋的是「它其實只看程式碼、根本沒餵進去」那種壞法。
   */
  it('🔴 同一支程式換一份輸入要換一個答案（否則它根本沒在餵 stdin）', () => {
    const prog = `${H}int main(){ int n; cin>>n; vector<int> a(3); cout<<a[n]; return 0; }`
    expect(sanitizerSaysUB(prog, '1\n').ub, '界內的索引不得被指名').toBe(false)
    expect(sanitizerSaysUB(prog, '9\n').ub, '界外的索引要被指名').toBe(true)
  }, 180_000)
})
