/**
 * `preserveBlankLines` 的測試。
 *
 * 🔴 使用者實測的那一段是**第一支**——往 `setup()` 加一行，
 * 而 `loop()` 裡的空行不該受影響（他根本沒碰那一段）。
 */
import { describe, it, expect } from 'vitest'
import { preserveBlankLines } from '../../../src/core/projection/preserve-blank-lines'

/** Arduino 的預設樣板——⚠️ 它**本來就有**空行，10 行。 */
const TEMPLATE = [
  'void setup() {',
  '  // put your setup code here, to run once:',
  '',
  '}',
  '',
  'void loop() {',
  '  // put your main code here, to run repeatedly:',
  '',
  '}',
  '',
].join('\n')

/** 產生器吐出來的樣子——**沒有任何空行**（實測 10 行 → 6 行）。 */
const FLAT = [
  'void setup() {',
  '  // put your setup code here, to run once:',
  '}',
  'void loop() {',
  '  // put your main code here, to run repeatedly:',
  '}',
].join('\n')

describe('preserveBlankLines', () => {
  it('★ 錨點：產生器真的把空行吃光了', () => {
    // 沒有這一條的話，下面每一支都可能是在測「本來就沒差」
    expect(TEMPLATE.split('\n').length).toBe(10)
    expect(FLAT.split('\n').length).toBe(6)
  })

  it('沒有語義變動時，逐字還原成原檔', () => {
    // 🔴 這一條的份量最重：結果與原檔【相同】→ rewriteSpan 回 null
    //    → **整個寫入不會發生**。在此之前每一次同步都在重寫檔案。
    expect(preserveBlankLines(TEMPLATE, FLAT)).toBe(TEMPLATE)
  })

  it('往 setup 加一行，loop 的空行不受影響', () => {
    const withDecl = [
      'void setup() {',
      '  // put your setup code here, to run once:',
      '  int x;',
      '}',
      'void loop() {',
      '  // put your main code here, to run repeatedly:',
      '}',
    ].join('\n')
    // 🔴 **區塊結尾的空行被新內容吃掉**——使用者逐字：「原本的空行
    //    被新東西覆蓋感覺比較自然」。那個空行是「在這裡寫你的程式」的**位置**。
    //    ⚠️ 而它只吃「下一行縮排更淺」的那種，見下面那支反向測試。
    expect(preserveBlankLines(TEMPLATE, withDecl)).toBe([
      'void setup() {',
      '  // put your setup code here, to run once:',
      '  int x;',    // ← 新加的一行，⚠️ **不給空行**，而且吃掉了下面那個
      '}',
      '',            // ← 兩個函式之間的空行
      'void loop() {',
      '  // put your main code here, to run repeatedly:',
      '',            // ← 🔴 使用者根本沒碰 loop
      '}',
      '',
    ].join('\n'))
  })

  it('★ 反向：同一層的分隔空行【不得】被吃掉', () => {
    // 🔴 這是「區塊結尾的空行被吃掉」那條規則的邊界。
    //    `bar();` 與新加的 `baz();` **同層** → 那是分隔，不是位置。
    const prev = '  foo();\n\n  bar();\n'
    expect(preserveBlankLines(prev, '  foo();\n  baz();\n  bar();'))
      .toBe('  foo();\n  baz();\n\n  bar();\n')
  })

  it('新加的行不得憑空長出空行', () => {
    const prev = 'a\n\nb\n'
    // c 是全新的，前後都對不上原檔的空行位置
    expect(preserveBlankLines(prev, 'a\nc\nb')).toBe('a\nc\n\nb\n')
  })

  it('刪掉一段時，跟著那一段的空行也走', () => {
    const prev = 'a\n\nb\n\nc\n'
    expect(preserveBlankLines(prev, 'a\nc')).toBe('a\n\nc\n')
  })

  it('重複的行靠順序區分，不是靠內容配對', () => {
    // ⚠️ 貪婪配對會把第一個 `}` 配到最後一個 `}`，空行就掛錯地方
    const prev = 'f() {\n\n}\ng() {\n\n}\n'
    expect(preserveBlankLines(prev, 'f() {\n}\ng() {\n}')).toBe(prev)
  })

  it('原檔是空的 → 原樣回傳', () => {
    expect(preserveBlankLines('', 'a\nb')).toBe('a\nb')
  })

  it('★ 反向：原檔沒有空行時，不得無中生有', () => {
    expect(preserveBlankLines('a\nb\nc', 'a\nb\nc')).toBe('a\nb\nc')
  })
})
