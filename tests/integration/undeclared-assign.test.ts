/**
 * **指定給一個沒宣告的名字，必須停下來。**
 *
 * ## 為什麼這支是【行為端】而不是單元端
 *
 * 缺陷在 `Scope.set`，而**單元測試看不見它真正的失敗模式**：
 * 舊寫法用 `try { parent.get(name) } catch {}` 當「看看有沒有」，
 * 而改成拒絕之後 `parent.set()` 也會拋——**被那個 catch 吃掉之後，
 * 行為完全沒變，而它看起來像修好了**。
 *
 * > **一個為了「看看有沒有」而存在的 try/catch，
 * > 在被查的那件事本身開始拋錯的那天，會靜靜地把新行為吃掉。**
 *
 * 那條路徑只有**跑一段真的程式**才會走到。
 *
 * ## 🟢 限定解除（spec 203，重構 6c-2e）：判準換成 Cella 之後，這是【編譯期】的拒絕
 *
 * 原本（JS 直譯器）是**跑到那一行才停**——一段有這個錯誤而永遠跑不到那一行的程式仍然會「成功」，
 * 而停之前已經印出的東西留著。換成 Cella 之後，它跟 C++ 一樣在**整支程式跑之前**就拒絕：
 *
 * ```
 * 跑不到的那一行   C++ 拒絕（編譯錯誤）   JS 直譯器：成功   Cella：reject   ← 下面「跑不到也要拒絕」那一條
 * 停之前的輸出     C++ 一行都沒跑        JS 直譯器：留著   Cella：out 是空的
 * ```
 *
 * ⚠️ 所以「停下來之前已經印出的東西必須還在」那一條**跟著直譯器退場**：編譯錯誤的程式沒有「之前」——
 * 它的位置（`problems` 指回原始碼的那一行）才是現在要守的。
 */
import { describe, it, expect } from 'vitest'
import { runCella, describeCellaResult, expectCellaOut, knownCellaGap } from '../helpers/cella-run'

/** 整支程式交給 Cella（產品同一條 lift → formalize → 判決）；這支的程式都會被拒絕，所以斷言要看判決種類與位置 */
const judge = runCella

describe('指定給一個沒宣告的名字', () => {
  it('★ 會停下來，而問題指得回那個名字', async () => {
    const r = await judge('int main() {\n  score = 90;\n  cout << score << endl;\n  return 0;\n}')
    expect(r.verdict, `🔴 沒宣告就指定，而程式被接受了——C++ 拒絕這段程式\n${describeCellaResult(r)}`).toBe('reject')
    expect(r.out, '編譯錯誤的程式一行都不跑').toBe('')
    // 第一個問題就是那一行的那個名字（不是後面那個讀取）
    expect(r.problems[0]?.source, describeCellaResult(r)).toEqual({ line: 2, text: 'score' })
  }, 60000)

  // 🟡 Cella 0.1.202611020258：寫入未宣告的名字，理由是「expression is not assignable」，不是「use of undeclared identifier 'score'」
  //    （clang 說的是後者；讀同一個名字 Cella 也說後者）。formalize 照約定把程式沒宣告的名字送成 eConst（cella 2026-10-31：標頭的名字），
  //    Cella 讀 eConst 時先查名字、寫 eConst 時先查可不可寫——疑似 Cella 側的順序，已回報。
  it('🟡 已知缺陷（修好時這條會紅）：★ 訊息說得出是哪個名字', () => knownCellaGap(/expression is not assignable/, async () => {
    const r = await judge('int main() {\n  score = 90;\n  cout << score << endl;\n  return 0;\n}')
    const first = r.problems[0]
    if (r.verdict !== 'reject' || !/undeclared identifier 'score'/.test(first?.reason ?? '')) throw new Error(describeCellaResult(r))
  }))

  // 🟡 同上一條的同一個缺陷：讀是「use of undeclared identifier」，寫是「expression is not assignable」
  it('🟡 已知缺陷（修好時這條會紅）：★ 讀與寫用同一則訊息——同一件事不得有兩種說法', () => knownCellaGap(/讀與寫的理由不同.*not assignable/s, async () => {
    const w = await judge('int main() {\n  score = 90;\n  return 0;\n}')
    const rd = await judge('int main() {\n  cout << score << endl;\n  return 0;\n}')
    expect(rd.problems[0]?.reason, describeCellaResult(rd)).toMatch(/undeclared identifier 'score'/)
    if (w.problems[0]?.reason !== rd.problems[0]?.reason) {
      throw new Error(`讀與寫的理由不同：寫「${w.problems[0]?.reason}」、讀「${rd.problems[0]?.reason}」`)
    }
  }))

  // spec 203：原本是「★ 停下來之前已經印出的東西，必須還在」（期望 out 含 before）——那是「跑到那一行才停」的設計的答案。
  // C++ 在編譯時拒絕整支程式，`before` 從來沒有被印出（clang：error: use of undeclared identifier 'nope'，不產生執行檔）
  // ⟹ 現在守的是「被拒絕的東西去哪了」的另一半：問題指回第 3 行，而不是靜靜地什麼都沒有。
  it('★ 拒絕的是整支程式：前面的輸出不會發生，而問題指得回那一行', async () => {
    const r = await judge('int main() {\n  cout << "before" << endl;\n  nope = 1;\n  return 0;\n}')
    expect(r.verdict, describeCellaResult(r)).toBe('reject')
    expect(r.out, 'C++ 的編譯錯誤：一行都不跑').toBe('')
    expect(r.problems[0]?.source, describeCellaResult(r)).toEqual({ line: 3, text: 'nope' })
  }, 60000)

  // spec 203 新增：原本的限定（「永遠跑不到那一行的程式仍然會成功」）在 Cella 底下不成立了——跟 C++ 一樣拒絕
  it('★ 跑不到的那一行也要拒絕（C++ 是編譯期的錯）', async () => {
    const r = await judge('int main() {\n  cout << "before" << endl;\n  if (false) { nope = 1; }\n  return 0;\n}')
    expect(r.verdict, describeCellaResult(r)).toBe('reject')
    expect(r.problems[0]?.source?.text).toBe('nope')
  }, 60000)

  // ★ 不亂報那一側——🔴 比「會報」更重要（build-guardrail 第 9 步）
  it.each([
    ['指標寫入（&x 後 *p = 7）', 'int main() {\n  int x = 1;\n  int* p = &x;\n  *p = 7;\n  cout << x << endl;\n  return 0;\n}', '7\n'],
    ['外層作用域寫入（迴圈內改 n）', 'int main() {\n  int n = 1;\n  for (int i = 0; i < 3; i = i + 1) {\n    n = n + i;\n  }\n  cout << n << endl;\n  return 0;\n}', '4\n'],
    ['引用別名寫入（int& r）', 'void bump(int& r) {\n  r = r + 10;\n}\nint main() {\n  int v = 1;\n  bump(v);\n  cout << v << endl;\n  return 0;\n}', '11\n'],
  ])('★ 不亂報：%s', async (_label, src, expected) => {
    // 🔴 這個寫法【宣告過】，不得被判成未宣告——不是 accept 的話 expectCellaOut 會說出判決與原因
    await expectCellaOut(src, expected)
  }, 60000)
})
