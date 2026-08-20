/**
 * spec 161：**加一個語言，`app.ts` 一行都不用改。**
 *
 * ## 為什麼有這一條
 *
 * `principles.md:65` 逐字：
 *
 * > 系統可以在**不修改既有程式碼**的前提下加入新元件、新語言、新套件。
 *
 * spec 160 證明了「加一顆**積木**」成立（`block-registrar` 一行沒動），
 * 而「加一個**語言**」**今天不成立**——那一刀自己在 `app.ts` 加了
 * **5 個 import ＋ 3 行註冊 ＋ 一個 `language === 'python'` 分支**。
 *
 * 🔴 **而沒有任何東西說話**：`app.ts` 是中立性護欄豁免的組裝點，報表只印一句
 * 「組裝點明確豁免——它知道自己裝了什麼是正常的」，**它不印數字**。
 *
 * > `experience.md` 逐字：「一條護欄的每個**例外**，都要能回答
 * > **『它今天豁免了幾筆』**與『理由是什麼』。」
 *
 * `app.ts` 今天答不出第一個問題——**這一條就是讓它答得出來**。
 *
 * ## 判準：不是「有幾個字串」，是「加一個語言要編輯幾處」
 *
 * 組裝點知道自己裝了什麼**是正常的**，所以數字串會誤判。
 * 真正該零的是**每個語言各自一份的接線**。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../helpers/guardrail'

const APP = path.join(REPO_ROOT, 'src/ui/app.ts')
const src = (): string => fs.readFileSync(APP, 'utf8')

/** `app.ts` 裡**指名某一個語言**的行——組裝點該認得「語言」這個概念，不該認得語言的名字。 */
function perLanguageWiring(text: string): string[] {
  const langs = fs.readdirSync(path.join(REPO_ROOT, 'src/languages'), { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name)
  const hits: string[] = []
  text.split('\n').forEach((line, i) => {
    if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return
    for (const l of langs) {
      if (new RegExp(`languages/${l}\\b|['"\`]${l}['"\`]`).test(line)) { hits.push(`${i + 1}: ${line.trim().slice(0, 80)}`); break }
    }
  })
  return hits
}

describe('spec 161 · 加一個語言，app.ts 一行都不用改', () => {
  it('★ 錨點：真的讀到 app.ts 了（否則下面在驗空集合）', () => {
    expect(src().length, '讀不到 app.ts → 是掃描壞了').toBeGreaterThan(10_000)
    expect(fs.readdirSync(path.join(REPO_ROOT, 'src/languages'), { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name).sort(),
      '語言資料夾少了 → 這條的判準會整個空掉').toEqual(['cpp', 'python'])
  })

  it('🔴 `app.ts` 不得有【指名某個語言】的接線', () => {
    const hits = perLanguageWiring(src())
    expect(hits,
      `⚠️ 還有 ${hits.length} 行指名了語言。組裝點知道自己裝了「一些語言」是正常的，`
      + '而知道**它們各自叫什麼**不是——那代表加第三個語言要再編輯這裡一次。\n'
      + hits.join('\n')).toEqual([])
  })

  it('🔴 每個語言都要有 manifest，而 manifest 要說得出它提供什麼', () => {
    const dir = path.join(REPO_ROOT, 'src/languages')
    const langs = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    const missing = langs.filter((l) => !fs.existsSync(path.join(dir, l, 'manifest.json')))
    expect(missing, '沒有 manifest 的語言只能靠 app.ts 手動接線').toEqual([])

    for (const l of langs) {
      const m = JSON.parse(fs.readFileSync(path.join(dir, l, 'manifest.json'), 'utf8'))
      expect(Object.keys(m.provides ?? {}).sort(),
        `${l} 的 manifest 沒說完它提供什麼——少一項就是那一項回到 app.ts`)
        .toEqual(['blocks', 'categories', 'components', 'styles', 'targets', 'topics'])
    }
  })

  it('★ 反向：中立性護欄對 app.ts 的豁免要【附數字】', () => {
    const baseline = JSON.parse(fs.readFileSync(
      path.join(REPO_ROOT, 'tests/baselines/neutrality.json'), 'utf8'))
    expect(baseline.imports?.compositionRootWiring,
      '⚠️ 豁免只寫一句「它知道自己裝了什麼是正常的」而不印數字 → '
      + '它今天豁免了幾筆沒有人答得出來（experience 的判準）').toBe(0)
  })
})
