/**
 * **分類判準要先在已知答案的樣本上驗過。**
 *
 * `build-guardrail` 第 6 步逐字：「靜態判斷不能下結論，只能排順序……
 * 要用靜態判斷，**先在已知答案的樣本上驗過**。」
 *
 * 而它要分的兩件事今天被算在同一欄：
 *
 * ```
 * toolCannotRun     工具跑不動        → 我們量測機構的極限
 * programIsIllegal   程式不合法        → 🔴 我們接受了 C++ 拒絕的程式
 * unclassified       判不出來          → 不計入任一邊
 * ```
 *
 * ⚠️ **這支放在 `tests/unit/`，不是 `integration/`**——
 * `audit-behavior-error` 會掃 `tests/integration/*.test.ts` 的反引號當 C++ 語料
 * （`history/059`），而這裡的樣本是**編譯器訊息**不是 C++，
 * 放過去會讓另一條護欄的分母無聲地變大。
 */
import { describe, it, expect } from 'vitest'
import { classifyRefFailure } from '../../helpers/ref-failure'

describe('參照失敗的分類——先在已知答案的樣本上驗過', () => {
  it('★ 已知答案 A：缺標頭 → 工具跑不動', () => {
    const msg = "fatal error: 'bits/stdc++.h' file not found\n#include <bits/stdc++.h>\n         ^"
    expect(classifyRefFailure('compile', msg)).toBe('toolCannotRun')
  })

  it('★ 已知答案 B：編譯器看懂了而且拒絕 → 程式不合法', () => {
    const msg = "error: expected ';' after expression\n    int x = 1\n             ^"
    expect(classifyRefFailure('compile', msg)).toBe('programIsIllegal')
  })

  it('★ 已知答案 C：型別不符 → 程式不合法', () => {
    const msg = "error: no member named 'push_back' in 'int'"
    expect(classifyRefFailure('compile', msg)).toBe('programIsIllegal')
  })

  it('🔴 ★ 順序：缺標頭【同時】產生一堆 expected → 仍然算工具跑不動', () => {
    // ⚠️ 少了標頭之後型別全部不見，編譯器會吐一長串 `expected`／`undeclared`
    // ——而真正的原因是缺標頭。**先判環境，再判程式。**
    const msg =
      "fatal error: 'vector' file not found\nerror: expected unqualified-id\nerror: use of undeclared identifier 'v'"
    expect(
      classifyRefFailure('compile', msg),
      '把缺標頭判成「程式不合法」→ 那個數字會被工具的極限灌水，而我們會去修一個不存在的病',
    ).toBe('toolCannotRun')
  })

  it('🔴 ★ 判不出來就說判不出來——不得樂觀歸類', () => {
    expect(classifyRefFailure('compile', 'internal compiler error: segmentation fault')).toBe(
      'unclassified',
    )
    expect(classifyRefFailure(undefined, '')).toBe('unclassified')
  })

  it('★ 執行期失敗（跑起來了但沒跑完）→ 不算「程式不合法」', () => {
    // 編譯過了就代表 C++ 接受它——之後的失敗是行為問題，不是合法性問題。
    expect(classifyRefFailure('run', 'timeout')).toBe('toolCannotRun')
  })
})
