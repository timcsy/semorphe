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
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { RuntimeError } from '../../../interpreter/errors'
import type { SemanticNode } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 30000)

async function runAndCatch(src: string): Promise<RuntimeError> {
  const tree = createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  try { await i.execute(tree) } catch (e) { if (e instanceof RuntimeError) return e; throw e }
  throw new Error('竟然沒有停下來')
}

describe('串流名字不是變數', () => {
  it('★ `cout <` 打錯 → 不得說「變數 cout 尚未宣告」', async () => {
    const e = await runAndCatch('int main(){ cout < "Hello!" << endl; }')
    expect(
      e.i18nKey,
      '🔴 `cout` 在真的 C++ 裡是宣告過的——說它「尚未宣告」是事實錯誤',
    ).toBe('RUNTIME_ERR_STREAM_NOT_VARIABLE')
    expect(JSON.stringify(e.params), '要說得出是哪個名字、要配哪個運算子').toContain('cout')
    expect(JSON.stringify(e.params)).toContain('<<')
  }, 60000)

  it('★ `cin` 要配的是 `>>`，不是 `<<`', async () => {
    const e = await runAndCatch('int main(){ int x; cin < x; }')
    expect(e.i18nKey).toBe('RUNTIME_ERR_STREAM_NOT_VARIABLE')
    expect(JSON.stringify(e.params)).toContain('>>')
  }, 60000)

  it('★ `Cout` 大小寫打錯 → 說出正確的那個【並且】說它不是變數', async () => {
    const e = await runAndCatch('int main(){ Cout << "Hello!" << endl; }')
    expect(e.i18nKey).toBe('RUNTIME_ERR_STREAM_NOT_VARIABLE_SUGGEST')
    expect(JSON.stringify(e.params)).toContain('cout')
  }, 60000)

  // 🔴 不亂認那一側——一般的未宣告變數**不得**被說成串流
  //
  // ⚠️ **`couty` 那一筆是測試當場抓到的**：它與 `cout` 距離 1、兩邊都 ≥4，
  // 差點被誤認成串流。
  // > **一個使用者自己取的名字，長得像函式庫的名字，是常態不是打錯。**
  // → 這一側因此**只認大小寫**，不認編輯距離（變數那一側可以，
  //   因為那些候選是他自己宣告的）。
  it.each([
    ['一般的未宣告變數', 'int main(){ cout << q << endl; }', 'RUNTIME_ERR_UNDECLARED_VAR'],
    ['名字很像串流而不是', 'int main(){ cout << couty << endl; }', 'RUNTIME_ERR_UNDECLARED_VAR'],
  ])('★ 不亂認：%s', async (_label, src, expected) => {
    const e = await runAndCatch(src)
    expect(e.i18nKey).toBe(expected)
  }, 60000)

  it('★ 而正確的程式一點都沒變', async () => {
    const tree = createTestLifter().lift(parser.parse('int main(){ cout << "Hello!" << endl; }')!.rootNode as never) as SemanticNode
    const i = new SemanticInterpreter({ maxSteps: 100000 })
    await i.execute(tree)
    expect(i.getOutput().join('')).toBe('Hello!\n')
  }, 60000)
})
