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

/**
 * 🔴 **兩個維度，各自一個數字**——而它們是不同的東西。
 *
 * ```
 * 選單接線   topic／target／style／分類／解析器   ← 「加一個語言」的直接代價
 * 語言管線   產生器／lifters／鷹架／診斷           ← 舊債，與 vision 的「app.ts 的 35 處」同一筆
 * ```
 *
 * ⚠️ **第一版把兩個混成一個數字（47），而那讓「做完了沒」問不出答案**：
 * 選單接線是 spec 160 弄壞的、可以當天還完；語言管線是既有的、
 * 要把整個 bootstrap 搬進安裝鉤（它們與 `app.ts` 自己的物件深度交織）。
 *
 * > **一個把兩種債加在一起的數字，會讓還完的那一半看起來沒還。**
 */
const MENU_WIRING = /topics?\/|targets?\/|styles?\/|toolbox-categories|\/parser['"]/
const PIPELINE = /diagnostics|auto-include|generators|extractors|block-input-names|style-exceptions|\/std['"]|scaffold|code-patcher|lifters|lift-patterns|all-declarations/

/** `app.ts` 裡**指名某一個語言**的行——組裝點該認得「語言」這個概念，不該認得語言的名字。 */
function perLanguageWiring(text: string): string[] {
  const langs = fs.readdirSync(path.join(REPO_ROOT, 'src/languages'), { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name)
  const hits: string[] = []
  text.split('\n').forEach((line, i) => {
    if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return
    for (const l of langs) {
      // ⚠️ **截斷只用在顯示，分類要看整行**——第一版把截斷後的字串拿去分類，
      // 於是兩行的關鍵字落在第 80 字之後、兩類都不屬於。
      // > **一個為了好讀而截斷的字串，拿去做判斷就會少判。**
      if (new RegExp(`languages/${l}\\b|['"\`]${l}['"\`]`).test(line)) { hits.push(`${i + 1}\t${line.trim()}`); break }
    }
  })
  return hits
}

/** 只在**顯示**時截斷——分類永遠看整行。 */
const show = (hits: string[]): string => hits.map((h) => '    ' + h.slice(0, 100)).join('\n')

describe('spec 161 · 加一個語言，app.ts 一行都不用改', () => {
  // ⚠️ **錨點與注入不是同一件事，不能互相代替**（2026-08-21 量出來的）：
  //
  // ```
  // 錨點   問「我有沒有吃到東西」        → 防空語料
  // 注入   問「我的偵測器認得出違規嗎」  → 防【壞掉的偵測器】
  // ```
  //
  // 一條讀了 500 個檔、而正則寫錯的護欄——**錨點會過，計數永遠 0，全綠**。
  it('★ 注入①：一行語言接線【必須】被報出', () => {
    const hit = perLanguageWiring("import { x } from '../languages/cpp/styles/apcs.json'")
    expect(hit.length, '偵測器認不出最典型的那一行 → 它壞了').toBe(1)
  })

  it('★ 注入②：註解裡提到語言不得被誤報', () => {
    expect(perLanguageWiring("  // 見 languages/cpp 的說明")).toEqual([])
    expect(perLanguageWiring("   * languages/python 那一份")).toEqual([])
  })

  it('★ 注入③：關鍵字落在第 80 字之後照樣要被抓到', () => {
    // 🔴 這是這個檔頭記著的那個坑：截斷只用在顯示，分類要看整行。
    //    沒有這一支的話，那個修法哪天被改回去也不會有人知道。
    const long = '  '.repeat(45) + "const a = require('cpp')"
    expect(long.indexOf('cpp'), '前置沒有把關鍵字推過 80 字 → 這支注入本身失效').toBeGreaterThan(80)
    expect(perLanguageWiring(long).length).toBe(1)
  })

  it('★ 錨點：真的讀到 app.ts 了（否則下面在驗空集合）', () => {
    expect(src().length, '讀不到 app.ts → 是掃描壞了').toBeGreaterThan(10_000)
    expect(fs.readdirSync(path.join(REPO_ROOT, 'src/languages'), { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name).sort(),
      '語言資料夾少了 → 這條的判準會整個空掉').toEqual(['cpp', 'python'])
  })

  it('🔴 硬性零：`app.ts` 不得有【選單接線】——加一個語言不必編輯它', () => {
    const hits = perLanguageWiring(src()).filter((l) => MENU_WIRING.test(l))
    expect(hits,
      '⚠️ topic／target／style／分類／解析器是「加一個語言」的直接代價。'
      + '這一項是**硬性零**：spec 160 在這裡加了 8 處，而 161 還完了。\n'
      + show(hits)).toEqual([])
  })

  it('🟡 棘輪：`app.ts` 的【語言管線】只准下降', () => {
    const hits = perLanguageWiring(src()).filter((l) => PIPELINE.test(l))
    const baseline = JSON.parse(fs.readFileSync(
      path.join(REPO_ROOT, 'tests/baselines/language-plugin.json'), 'utf8'))
    // eslint-disable-next-line no-console
    console.log(`\n  語言管線：${hits.length} 處（基線 ${baseline.pipeline}）\n` + show(hits))
    expect(hits.length,
      '⚠️ 這一項【不是】硬性零——把整個 bootstrap 搬進安裝鉤是另一刀'
      + '（它們與 `app.ts` 自己的物件深度交織）。而它**有數字了**，'
      + '那正是 spec 161 要買的：豁免答得出「它今天豁免了幾筆」。')
      .toBeLessThanOrEqual(baseline.pipeline)
  })

  it('★ 兩個維度加起來要等於全部——否則有一類漏出分類', () => {
    const all = perLanguageWiring(src())
    const classified = all.filter((l) => MENU_WIRING.test(l) || PIPELINE.test(l))
    expect(all.filter((l) => !classified.includes(l)),
      '⚠️ 有指名語言的行**兩類都不屬於** → 分類器漏了一種形狀，而漏掉的那種不會被任何一個數字看見')
      .toEqual([])
  })

  it('🔴 每個語言都要有 manifest，而 manifest 要說得出它提供什麼', () => {
    const dir = path.join(REPO_ROOT, 'src/languages')
    const langs = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    const missing = langs.filter((l) => !fs.existsSync(path.join(dir, l, 'manifest.json')))
    expect(missing, '沒有 manifest 的語言只能靠 app.ts 手動接線').toEqual([])

    for (const l of langs) {
      const m = JSON.parse(fs.readFileSync(path.join(dir, l, 'manifest.json'), 'utf8'))
      // ⚠️ **至少六項，不是剛好六項**——cpp 另有 `templates`／`liftPatterns`，
      // 而「多提供一種東西」不是違規。第一版寫 `toEqual` 於是把既有的兩項判成錯。
      // > **一條「必須有 X」的規則，寫成「只能有 X」就會擋住合法的成長。**
      const required = ['blocks', 'categories', 'components', 'styles', 'targets', 'topics']
      const missing = required.filter((k) => !(k in (m.provides ?? {})))
      expect(missing, `${l} 的 manifest 少了這幾項——少一項就是那一項回到 app.ts`).toEqual([])
    }
  })

  /**
   * 🎯 **這一支才是 P3 的直接檢驗**：不是數字，是**真的加一個語言**。
   *
   * ⚠️ 實測用的 stub 是**臨時建立、當場刪掉**的——留在 `src/languages/` 裡的話
   * 每一條吃語言清單的護欄都會多一筆假資料（`錨點` 那支就是這樣抓到的）。
   * 這裡改成**檢查機制的形狀**：載入器的 glob 樣式必須涵蓋任何一個
   * `languages/<新語言>/pack.ts`，而 `app.ts` 不得有「哪些語言」的清單。
   *
   * 🟢 2026-08-20 的一次性實測結論記在 `specs/161-manifest-language-loading/`：
   * 建一個 `src/languages/stub/pack.ts` 之後，**`app.ts` 一個 byte 都沒動**，
   * 而 `stub` 進了語言登記表與目標登記表。
   */
  it('🎯 機制上「加一個語言＝加一個資料夾」——載入器不指名任何語言', () => {
    const loader = fs.readFileSync(path.join(REPO_ROOT, 'src/core/load-language-packs.ts'), 'utf8')
    expect(loader).toContain("import.meta.glob('/src/languages/*/pack.ts'")
    // 反向：載入器自己不得指名語言（那會讓 glob 變成一份手寫清單）
    const langs = fs.readdirSync(path.join(REPO_ROOT, 'src/languages'), { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name)
    expect(langs.filter((l) => new RegExp(`['"\`/]${l}['"\`/]`).test(loader)),
      '載入器指名了語言 → 它不是 glob，是一份手寫清單').toEqual([])
  })

  it('★ 反向：中立性護欄對 app.ts 的豁免要【附數字】', () => {
    const baseline = JSON.parse(fs.readFileSync(
      path.join(REPO_ROOT, 'tests/baselines/neutrality.json'), 'utf8'))
    expect(baseline.imports?.compositionRootWiring,
      '⚠️ 豁免只寫一句「它知道自己裝了什麼是正常的」而不印數字 → '
      + '它今天豁免了幾筆沒有人答得出來（experience 的判準）').toBe(0)
  })
})
