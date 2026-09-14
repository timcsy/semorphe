/**
 * **名字合不合法，以及那個判斷住在哪。**
 *
 * 🔴 它從一則學生回報來（2026-09-14，使用者轉述）：
 * 「學生的變數名稱會寫成數字，Semorphe 竟然還可以接受」。
 *
 * 實測當時：產出 `int 123 = 16;`，主控台零錯誤、畫面零標記。
 * 而 97 個參數宣告了 `kind: 'identifier'`——**沒有任何一處讀 `kind`**。
 *
 * > **一個宣告了而沒有人讀的型別，與沒有宣告是同一件事。**
 * > （同一週第三次：`slots` 的 min/max、形態軸 role、然後是這個。）
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { isLegalIdentifier, whyIllegal, identifierSyntaxOf } from '../../../src/core/identifier-syntax'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import '../../../src/languages/python/pack'

describe('識別字規則', () => {
  beforeAll(() => { registerCppLanguage() })

  it('★ 入口條件——兩個語言都宣告了規則', () => {
    expect(identifierSyntaxOf('cpp'), '🔴 C++ 沒宣告 → 下面全部是空過的').toBeDefined()
    expect(identifierSyntaxOf('python'), '🔴 Python 沒宣告').toBeDefined()
  })

  it('🔴 學生打的那三種，都要被判不合法', () => {
    expect(isLegalIdentifier('cpp', '123'), '數字開頭').toBe(false)
    expect(isLegalIdentifier('cpp', 'int'), '保留字').toBe(false)
    expect(isLegalIdentifier('cpp', 'my name'), '有空白').toBe(false)
  })

  it('🔴 而理由要分得出來——「數字開頭」不能被講成「有不能用的字元」', () => {
    expect(whyIllegal('cpp', '123')).toBe('starts_with_digit')
    expect(whyIllegal('cpp', 'int')).toBe('reserved')
    expect(whyIllegal('cpp', 'my name')).toBe('bad_char')
    expect(whyIllegal('cpp', '')).toBe('empty')
  })

  it('★ 不亂報：正常的名字全部要過', () => {
    for (const ok of ['age', '_tmp', 'x1', 'myName', 'MAX_N', 'i']) {
      expect(isLegalIdentifier('cpp', ok), `🔴 「${ok}」被判成不合法了`).toBe(true)
    }
  })

  /**
   * 🔴 **兩個語言的規則不一樣，而那正是它住在語言套件裡的理由。**
   * 核心寫死一份的話，其中一邊永遠是錯的。
   */
  it('🔴 Python 收得下中文名字，而 C++ 不行', () => {
    expect(isLegalIdentifier('python', '變數'), 'Python 3 的識別字收非 ASCII').toBe(true)
    expect(isLegalIdentifier('cpp', '變數'), 'C++ 這裡不收').toBe(false)
    // 而保留字兩邊各有各的
    expect(isLegalIdentifier('python', 'class')).toBe(false)
    expect(isLegalIdentifier('cpp', 'def'), '`def` 在 C++ 不是保留字').toBe(true)
  })

  /**
   * ⚠️ **沒宣告規則的語言要回「合法」，不是「不合法」。**
   * 反過來的話，加一個新語言的那一天，那個語言的每一個名字都會變紅。
   *
   * > **一條「我不知道」的路徑，預設值該是放行還是攔下，
   * > 看的是「錯的時候誰受害」——而這裡受害的是還沒接上的那個語言的每一個使用者。**
   */
  it('⚠️ 沒宣告規則的語言：一律放行，而且不出聲', () => {
    expect(isLegalIdentifier('rust', '123')).toBe(true)
    expect(whyIllegal('rust', '123')).toBeUndefined()
  })
})
