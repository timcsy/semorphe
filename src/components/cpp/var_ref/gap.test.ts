/**
 * **`cout` 不是一個變數——而我們的訊息說它「尚未宣告」。**
 *
 * ## 它從哪來
 *
 * 2026-08-17 用 clangd 當裁判量涵蓋率（階段 6.6 ⑤），缺口只有兩筆。
 * 近似名建議關掉了第一筆（`Cout` 大小寫），**這一支關第二筆**：
 *
 * ```
 * cout < "Hello!" << endl;        ← `<<` 打成 `<`
 * ```
 *
 * tree-sitter 把它讀成 `(cout) < ("Hello!" << endl)`——因為 `<<` 綁得比 `<` 緊。
 * 於是 `cout` 變成一個**裸識別字**，而直譯器去作用域裡查它、查不到：
 *
 * ```
 * 🔴 變數 'cout' 尚未宣告
 * ```
 *
 * ⚠️ **那句話是【事實錯誤】**：`cout` 在真的 C++ 裡**是宣告過的**（`std::cout`）。
 * `experience`：「**一個指錯地方的錯誤訊息，比沒有訊息更糟。**」
 *
 * ## 🔴 而這一格我們可以做得比 clang 好
 *
 * 同一段程式，clang 說的是
 * 「reference to overloaded function could not be resolved; did you mean to call it?」
 * ——而它**指著 `endl`**。
 *
 * > **委派解決的是【判斷】，不是【說法】。而這一格的說法，
 * > 我們知道的比它多：我們知道 `cout` 是輸出的起點，而它要配 `<<`。**
 *
 * ## ⚠️ 為什麼修在 cpp 元件裡而不是 `Scope`
 *
 * 中立性護欄逐字：`NEUTRAL_DIRS = ['src/core', 'src/ui', 'src/interpreter', 'src/views']`
 * ——**核心不得硬編特定語言的名字**。而「`cout` 是串流」是 C++ 的事實，
 * 所以它住在 `src/components/cpp/var_ref/`。
 *
 * ## spec 205（重構 6c-3）：改看 Cella，而這幾條友善訊息今天沒有接手者
 *
 * 這幾條原本斷言 JS 直譯器**自己的**友善訊息（`RUNTIME_ERR_STREAM_NOT_VARIABLE(_SUGGEST)`）。Cella 給的是 clang 式的訊息
 * （`use of undeclared identifier 'q'`）。逐條判：
 *
 * ```
 * `cout <`／`cin <`    🟡 formalize 翻不出（運算式敘述的 cpp:compare）——沒有誤導成「cout 尚未宣告」，
 *                         但也說不出「要配 <<」，而且說成「Cella 還不支援」（系統的錯）⟹ 釘住
 * `Cout <<`            🟡 formalize 翻不出（運算式敘述的 cpp:arithmetic）——說不出「是 cout、它不是變數」⟹ 釘住
 * 一般的未宣告變數      ✅ Cella reject「use of undeclared identifier 'q'」，指到 q
 * `couty`              ✅ 同上，沒有被認成串流
 * 正確的程式            ✅ Cella accept，輸出不變
 * ```
 *
 * 🔴 釘住的兩類**都不是 Cella 判錯**：Cella 根本沒看到那支程式（formalize 先擋了）。要補的是兩層：
 * ① formalize 收下「運算式當敘述」，讓 Cella 判 reject（clang 對 `Cout` 會說 `did you mean 'cout'`）；
 * ② 診斷層把 reject 翻成「`cout` 是輸出的起點、要配 `<<`」這種友善的話——**委派解決的是判斷，不是說法**（上面那一節）。
 */
import { describe, it, expect } from 'vitest'
import { runCella, expectCellaOut, knownCellaGap, describeCellaResult } from '../../../../tests/helpers/cella-run'
import { toDiagnostics, type Verdict } from '../../../core/verdict-diagnostics'
import '../../../languages/cpp/pack'
import { languagePack } from '../../../core/language-packs'

/** 產品的跑法：照風格補上自動引入（`withScaffold`）再判——第一課的學生不寫 #include */
const run = (src: string) => runCella(src, { style: 'apcs' })

/** 期望的終點：Cella 判 reject（學生的錯），而原因說得出 `want`——今天在 formalize 就被擋下，丟出的訊息帶「翻不出」 */
async function expectRejectSaying(src: string, want: RegExp): Promise<void> {
  const r = await run(src)
  if (r.verdict !== 'reject') throw new Error(describeCellaResult(r))
  const why = r.problems.map((x) => x.reason ?? '').join('\n')
  if (!want.test(why)) throw new Error(`Cella 判 reject，但沒說到 ${want}：\n${describeCellaResult(r)}`)
}

describe('串流名字不是變數（Cella）', () => {
  it('★ `cout <` 打錯 → 不得說「變數 cout 尚未宣告」', async () => {
    const r = await run('int main(){ cout < "Hello!" << endl; }')
    expect(r.verdict, '🔴 一支打錯的程式被判成能跑').not.toBe('accept')
    const said = JSON.stringify([r.problems, r.untranslated])
    expect(said, '🔴 `cout` 在真的 C++ 裡是宣告過的——說它「尚未宣告」是事實錯誤').not.toMatch(/undeclared identifier 'cout'|cout.*尚未宣告/)
  })

  /**
   * 🟢 spec 205 T011（D4）修好一半：formalize 原本不收「運算式當敘述」，`cout <`、`cin <`、`Cout <<` 都翻不出，
   * 學生看到「Cella 還不支援」——把學生的錯說成系統的能力不足。現在照實送出，判決**歸類成學生的錯（reject）並指到那一行**。
   * 🟢 友善建議由判決診斷補上：「是 cout」（spec 206，近似名）、「要配 << ／ >>」（spec 207，串流配錯運算子）——見下面兩組。
   */
  it.each([
    ['cout <', 'int main(){ cout < "Hello!" << endl; }'],
    ['cin <', 'int main(){ int x; cin < x; }'],
    ['Cout <<', 'int main(){ Cout << "Hello!" << endl; }'],
  ])('★ `%s` 歸類成學生的錯：判 reject（不是「還不支援」），而且指到那一行', async (_name, body) => {
    const r = await run(body)
    expect(r.verdict, describeCellaResult(r)).toBe('reject')
    expect(r.problems[0]?.source?.line, '要指得到是哪一行').toBeGreaterThan(0)
  })



  // 🟢 spec 207 修好（原本是兩根釘子）：比較運算的左邊是串流 → 判決診斷說「要配 << ／ >>」，並取代那則讓人困惑的 reject
  it.each([
    ['cout <', 'int main(){ cout < "Hello!" << endl; }', 'cout', '<<'],
    ['cin <', 'int main(){ int x; cin < x; }', 'cin', '>>'],
  ])('★ `%s`：判決診斷說得出「%s 要配」哪個運算子（產品同一支 toDiagnostics）', async (_n, body, stream, want) => {
    const r = await run(body)
    expect(r.verdict, describeCellaResult(r)).toBe('reject')
    const pack = languagePack('cpp')
    const { diagnostics } = toDiagnostics({ verdict: r.raw as unknown as Verdict, types: null, tree: r.tree, readsInput: false, hasStdin: false, knownNames: pack?.wellKnownNames, streamOperators: pack?.streamOperators })
    expect(diagnostics.map((d) => [d.rule, d.params?.stream, d.params?.want])).toEqual([['STREAM_OPERATOR_SUGGEST', stream, want]])
  })

  // 🟢 spec 206 修好（原本是釘子）：近似名的建議從 JS 直譯器搬到判決診斷——Cella 判「未宣告的 Cout」，產品的 toDiagnostics 說「是不是要寫 cout」
  it('★ `Cout` 大小寫打錯：判決診斷說得出「是不是要寫 cout」（產品同一支 toDiagnostics）', async () => {
    const r = await run('int main(){ Cout << "Hello!" << endl; }')
    expect(r.verdict, describeCellaResult(r)).toBe('reject')
    const { diagnostics } = toDiagnostics({ verdict: r.raw as unknown as Verdict, types: null, tree: r.tree, readsInput: false, hasStdin: false, knownNames: languagePack('cpp')?.wellKnownNames })
    expect(diagnostics.map((d) => [d.rule, d.params?.near])).toContainEqual(['CELLA_UNDECLARED_SUGGEST', 'cout'])
  })

  // 🔴 不亂認那一側——一般的未宣告變數**不得**被說成串流
  //
  // ⚠️ **`couty` 那一筆是測試當場抓到的**：它與 `cout` 距離 1、兩邊都 ≥4，差點被誤認成串流。
  // > **一個使用者自己取的名字，長得像函式庫的名字，是常態不是打錯。**
  it.each([
    ['一般的未宣告變數', 'int main(){ cout << q << endl; }', 'q'],
    ['名字很像串流而不是', 'int main(){ cout << couty << endl; }', 'couty'],
  ])('★ 不亂認：%s', async (_label, src, name) => {
    const r = await run(src)
    expect(r.verdict, describeCellaResult(r)).toBe('reject')
    expect(r.problems).toHaveLength(1)
    expect(r.problems[0].kind).toBe('reject')
    expect(r.problems[0].reason).toBe(`use of undeclared identifier '${name}'`)
    expect(r.problems[0].source?.text, '要指到那個名字').toBe(name)
  })

  it('★ 而正確的程式一點都沒變', async () => {
    await expectCellaOut('int main(){ cout << "Hello!" << endl; }', 'Hello!\n', { style: 'apcs' })
  })
})
