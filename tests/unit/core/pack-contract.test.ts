/**
 * **第一百二十四條護欄：`Pack` 不得長出只有一個域填得出的欄位。**
 *
 * ## 🔴 它守的是「域」那一軸
 *
 * `concepts/元件.md` 定過「域／語言／layer **三軸正交**」，而 2026-09-13 查證時
 * 量到一件事：**那一軸在程式碼裡不存在**（`component.json` 有 `domain` 的：0 個），
 * 而唯一的擴充點 `LanguagePack` 有一整族只有軟體域填得出的欄位：
 *
 * ```
 * grammar · createParser · liftPatterns · programRoot · fileExtension
 * styleExceptions · createCodeShaping
 * ```
 *
 * 一塊 Arduino 板子沒有文法、沒有解析器、沒有程式根、沒有副檔名。
 *
 * > **一個擴充點如果它的必填欄位只有一個域填得出來，
 * > 那它不是擴充點，是那個域的建構式。**
 *
 * 於是拆成 `Pack`（共同的）＋ `LanguagePack extends Pack`（多出文法那一族）。
 *
 * ## ⚠️ 而拆完之後最可能發生的事，是它慢慢漂回去
 *
 * 下一個人要在 `Pack` 加一格，而那一格剛好只有 C++ 用得到——**沒有東西會出聲**，
 * 直到硬體套件進來的那天才發現它填不出來。這一支就是那個會出聲的東西。
 *
 * 🟢 判準是**字面**的：`Pack` 的欄位名不得出現在那份「語言專屬」清單裡。
 * ⚠️ 它擋不住一個叫 `foo` 而實際上是語言專屬的欄位——那要人看。
 * 這一支擋的是**最常見的那一種：把語言的字直接寫進共同契約**。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../../../src/core/language-packs.ts'), 'utf8')

/** 只有軟體域填得出來的那些字。⚠️ 加字要問一句「硬體填得出來嗎」。 */
const LANGUAGE_ONLY = [
  'grammar', 'Parser', 'parser', 'liftPattern', 'liftSkip', 'liftTransform',
  'programRoot', 'fileExtension', 'styleException', 'codeShaping', 'CodeShaping',
  'diagnosticRule', 'Lifter', 'ExtractStrategies',
]

function bodyOf(name: string): string {
  const m = new RegExp(`export interface ${name}[^{]*\\{`).exec(SRC)
  if (!m) throw new Error(`找不到 interface ${name}`)
  let depth = 1, i = m.index + m[0].length
  const start = i
  while (i < SRC.length && depth > 0) {
    if (SRC[i] === '{') depth++
    else if (SRC[i] === '}') depth--
    i++
  }
  return SRC.slice(start, i - 1)
}

describe('第一百二十四條護欄：套件契約的分層', () => {
  it('入口條件：兩個介面都在，而 LanguagePack 繼承 Pack', () => {
    expect(SRC, '🔴 `Pack` 不見了 → 下面那一條不算數').toContain('export interface Pack {')
    expect(SRC, '🔴 `LanguagePack` 必須 extends `Pack`——不繼承的話兩份會各自漂')
      .toContain('export interface LanguagePack extends Pack {')
  })

  it('🔴 硬性零：`Pack` 不得出現只有語言填得出的欄位', () => {
    const body = bodyOf('Pack')
    const leaked = LANGUAGE_ONLY.filter((w) => body.includes(w))
    expect(
      leaked,
      '🔴 這些字漏進了跨域的 `Pack`——硬體套件填不出它們。\n'
      + '   要嘛把那一格移進 `LanguagePack`，要嘛說得出硬體域怎麼填。',
    ).toEqual([])
  })

  it('★ 反向：那些字確實在 `LanguagePack` 裡（不然上面那條是空的）', () => {
    const body = bodyOf('LanguagePack')
    const present = LANGUAGE_ONLY.filter((w) => body.includes(w))
    expect(present.length, '🔴 一個語言專屬的字都找不到 → 這份清單與現實脫節了')
      .toBeGreaterThan(6)
  })

  it('★ `Pack` 要留著三個域都有的那幾格——少了就代表它被掏空成一個空殼', () => {
    const body = bodyOf('Pack')
    for (const f of ['id', 'name', 'order', 'declarations', 'topics', 'targets', 'categories']) {
      expect(body, `🔴 \`Pack\` 少了 ${f}`).toContain(f)
    }
  })
})
