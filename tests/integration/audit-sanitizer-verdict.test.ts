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
import { sanitizerKind, sanitizerSaysUB, hasReferenceCompiler, referenceCompilerInfo } from '../helpers/run-cpp'

const H = '#include <bits/stdc++.h>\nusing namespace std;\n'

describe('量測工具的錨點：未定義行為的判定', () => {
  it('★ 健康檢查：這台機器上消毒器裝得起來（跳過的話下面在驗空氣）', async () => {
    expect(hasReferenceCompiler(), '🔴 找不到參照編譯器').toBe(true)
    const r = await sanitizerSaysUB(`${H}int main(){ int x=2147483647; x=x+1; cout<<x; return 0; }`, '')
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
  it('★ 正向錨點①：越界索引要被指名，而且程式是正常退出的那一路', async () => {
    const r = await sanitizerSaysUB(
      `${H}int main(){ int n; cin>>n; vector<int> a[3]; a[n].push_back(1); cout<<"done"; return 0; }`, '7\n')
    expect(r.ub).toBe(true)
    // 🔴 比**名字**不比原文（2026-10-11）：固定大小陣列的索引越界，UBSan 報 `array-bounds`、
    //    ASan 報 `stack-buffer-overflow`——兩者都是 clang 自己的名字，看是哪一個先攔到。
    expect(['array-bounds', 'stack-buffer-overflow'], `原文：${r.detail}`).toContain(r.kind)
  }, 180_000)

  it('★ 正向錨點②：有號整數溢位（純 UBSan，程式不會死）', async () => {
    const r = await sanitizerSaysUB(`${H}int main(){ int x = 2147483647; x = x + 1; cout << x; return 0; }`, '')
    expect(r.ub).toBe(true)
    expect(r.kind, `原文：${r.detail}`).toBe('signed-integer-overflow')
  }, 180_000)

  /**
   * ★ **正向錨點③：容量之內、大小之外的 vector 索引**（2026-10-11）。
   *
   * 這一格兩個平台走不同的工具：macOS／libc++ 的 ASan 標註報 `container-overflow`；
   * Linux／libstdc++ 要靠 `_GLIBCXX_ASSERTIONS`。少了後者，CI 那一台**完全不報**——
   * 而「沒報」在這條護欄的語言裡是「沒有 UB」。
   */
  it('★ 正向錨點③：vector 容量之內、大小之外的索引也要被指名（兩個平台各走各的工具）', async () => {
    const r = await sanitizerSaysUB(
      `${H}int main(){ vector<int> v; v.reserve(10); v.push_back(1); int i; cin>>i; cout<<v[i]; return 0; }`, '3\n')
    expect(r.ub, `沒被指名。原文：${r.detail}`).toBe(true)
    expect(['container-overflow', 'glibcxx-assertions'], `原文：${r.detail}`).toContain(r.kind)
  }, 180_000)

  /**
   * 🔴 **負向：這一條才是真正危險的方向。**
   * 判定往寬了壞（每一支都說 UB）會讓真的缺陷從帳上消失，而且全綠。
   */
  it('🔴 乾淨的程式不得被指名——否則整排缺陷會安靜地從帳上消失', async () => {
    const r = await sanitizerSaysUB(
      `${H}int main(){ int n; cin>>n; vector<int> v(n); for(int i=0;i<n;i++) v[i]=i; cout<<v[n-1]; return 0; }`,
      '5\n')
    expect(r.ub).toBe(false)
    expect(r.detail).toBe('')
  }, 180_000)

  /**
   * ⚠️ **餵不同的輸入要給不同的答案**——同一支程式，UB 與否**由那份測資決定**。
   * 這一條擋的是「它其實只看程式碼、根本沒餵進去」那種壞法。
   */
  it('🔴 同一支程式換一份輸入要換一個答案（否則它根本沒在餵 stdin）', async () => {
    const prog = `${H}int main(){ int n; cin>>n; vector<int> a(3); cout<<a[n]; return 0; }`
    expect((await sanitizerSaysUB(prog, '1\n')).ub, '界內的索引不得被指名').toBe(false)
    expect((await sanitizerSaysUB(prog, '9\n')).ub, '界外的索引要被指名').toBe(true)
  }, 180_000)

  /**
   * ★ **原文 → clang 的名字**：不需要編譯器的那一半（2026-10-11）。
   *
   * 三個地方要講同一件事——Cella 執行時停在 UB 的 `why`、cella 的差分報表、這條護欄。
   * 兩邊約定用 clang 自己的名字（UBSan 的 check 名、ASan 的報告類別）。
   * ⚠️ 對不上的要回 `unknown:` 而不是猜一個——下面最後一條就在擋「猜」。
   */
  it('★ 注入：sanitizer 的原文要對到 clang 自己的名字，對不上就說不認得', () => {
    const cases: [string, string][] = [
      ["runtime error: signed integer overflow: 2147483647 + 1 cannot be represented in type 'int'", 'signed-integer-overflow'],
      ["runtime error: division of -2147483648 by -1 cannot be represented in type 'int'", 'signed-integer-overflow'],
      ["runtime error: negation of -2147483648 cannot be represented in type 'int'", 'signed-integer-overflow'],
      ["runtime error: shift exponent 32 is too large for 32-bit type 'int'", 'shift-exponent'],
      ["runtime error: left shift of negative value -1", 'shift-base'],
      ['runtime error: division by zero', 'integer-divide-by-zero'],
      ["runtime error: 2.14748e+09 is outside the range of representable values of type 'int'", 'float-cast-overflow'],
      ["runtime error: index 7 out of bounds for type 'int[3]'", 'array-bounds'],
      ['runtime error: applying non-zero offset 4 to null pointer', 'pointer-overflow'],
      ["runtime error: load of null pointer of type 'int'", 'null'],
      ['ERROR: AddressSanitizer: heap-buffer-overflow on address 0x602000000014', 'heap-buffer-overflow'],
      ['ERROR: AddressSanitizer: heap-use-after-free on address 0x6020', 'heap-use-after-free'],
      ['ERROR: AddressSanitizer: stack-buffer-overflow on address 0x16', 'stack-buffer-overflow'],
      ['ERROR: AddressSanitizer: container-overflow on address 0x6040000003dc', 'container-overflow'],
      ["/usr/include/c++/13/bits/stl_vector.h:1125: std::vector<_Tp>::operator[](size_type): Assertion '__n < this->size()' failed.", 'glibcxx-assertions'],
    ]
    for (const [raw, want] of cases) expect(sanitizerKind(raw), raw).toBe(want)
    expect(sanitizerKind('runtime error: something nobody has seen before'), '🔴 對不上卻猜了一個名字')
      .toMatch(/^unknown:/)
  })
})
