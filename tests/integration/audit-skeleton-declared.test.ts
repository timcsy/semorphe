/**
 * **第八十六條護欄**：鷹架是一份宣告，而每一段都說得出自己為什麼在那裡。
 *
 * ## 它從哪來
 *
 * 2026-08-28 使用者問「**鷹架應該也不只一個吧？算不算是一種元件？**」。
 * 量完現況，`Target.skeleton` 的值域只有 **`'main'` 與 `'none'`**
 * ——也就是「**有**」跟「**沒有**」，而四段骨架寫死在兩個地方：
 *
 * ```
 * cpp-scaffold.ts   'using namespace std;' · 'int main() {' · '    return 0;' · '}'
 * auto-include.ts   'int main() {\n…\n    return 0;\n}'      ← 同一個決定的第二份實作
 * ```
 *
 * 🔴 而 `'none'` **不是「Arduino 的鷹架」，它是「沒有鷹架」**
 * ——`if (skeleton === 'none') return {…全空}`。
 *
 * > **鷹架不是一顆新積木，是「哪幾段組成骨架，以及它們為什麼在那裡」。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果註冊的鷹架少於 1 份，代表語言套件沒載入——這份報表不算數，
 * > 不是「鷹架都宣告好了」。**
 *
 * 錨在**註冊了幾份**（合成量）。🔴 刻意不錨在「還寫死幾段」——那正是要推向零的。
 *
 * ## 硬性零
 *
 * ```
 * 留一筆規範還成立嗎？  ❌ 一段沒有理由的鷹架，與一段學生看不懂的雜訊長得一樣
 * 修一筆要付多少？      便宜——JSON 加一句話
 * 別台機器一樣嗎？      ✅ 純宣告讀取
 * ```
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測產出對不對**——那是 `board-library-headers-output` 與 round-trip 那一族。
 * - **不檢測「還有沒有別處寫死」**——那要靜態掃描，而判準會誤報（字串長得像程式碼）。
 */
import { describe, it, expect } from 'vitest'
import { printReport } from '../helpers/guardrail'
import { findFiles } from '../helpers/find-files'
import { parseSkeleton, allSkeletons } from '../../src/core/skeleton'
import '../../src/core/load-language-packs'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const LANGS = path.join(ROOT, 'src/languages')

describe('★ 第八十六條：鷹架是一份宣告', () => {
  const shells = allSkeletons()
  const targets = findFiles(LANGS, 'targets')
    .map((rel) => {
      const d = JSON.parse(fs.readFileSync(path.join(LANGS, rel), 'utf8')) as { id: string; skeleton?: string; topic: string }
      // 目標的語言由它的主題說——`topic` 檔在 `topics/`
      const t = findFiles(LANGS, 'topics')
        .map((r) => ({ r, j: JSON.parse(fs.readFileSync(path.join(LANGS, r), 'utf8')) as { id: string; language?: string } }))
        .find((x) => x.j.id === d.topic)
      return { ...d, language: t?.j.language }
    })

  it('入口條件——鷹架真的註冊進來了', () => {
    printReport('骨架宣告', [
      `註冊了       ${shells.size} 份`,
      ...[...shells.values()].map((s) =>
        `  ${s.id.padEnd(12)} ${s.name}　${s.preamble.length}+${s.entryPoint.length}+${s.epilogue.length} 段` +
        `　進入點函式 ${s.entryFunctions.map((f) => f.name).join('／') || '（無）'}`),
      `目標數       ${targets.length}`,
    ])
    // ⚠️ 錨在**註冊了幾份**（合成量），不是「還寫死幾段」
    expect(shells.size, '🔴 一份鷹架都沒註冊 → 套件沒載入，這份報表不算數').toBeGreaterThanOrEqual(1)
    expect(targets.length, '🔴 一個目標都沒讀到').toBeGreaterThanOrEqual(1)
  })

  it('硬性零——每一個目標指到的鷹架都存在', () => {
    const bad = targets
      .filter((t) => !shells.has(t.skeleton ?? 'main'))
      .map((t) => `${t.id} → ${t.skeleton ?? 'main'}`)
    expect(
      bad,
      '🔴 目標指向一份沒有登記的骨架——產出會是一支少了進入點的程式，' +
        '**而它看起來像 Arduino**：',
    ).toEqual([])
  })

  it('🔴 硬性零——每一段鷹架都有理由', () => {
    const silent: string[] = []
    for (const s of shells.values()) {
      for (const [seg, lines] of [['preamble', s.preamble], ['entryPoint', s.entryPoint], ['epilogue', s.epilogue]] as const) {
        for (const l of lines) if (!l.reason) silent.push(`${s.id}.${seg}：${l.code}`)
      }
    }
    expect(
      silent,
      '🔴 一段沒有理由的鷹架——`ghost` 模式下學生會看到一行看不懂的東西，' +
        '而那正是那個模式存在的意義：',
    ).toEqual([])
  })

  it('🔴 硬性零——每一份鷹架都宣告了 `language`', () => {
    // 少了它，`skeletonById('none')` 會**跨語言撿到別人的宣告**
    // ——2026-08-28 實測：Python 撿到 C++ 的 `none`，
    // 而症狀是「狀態列那句話碰巧是對的，**而選單裡骨架那一組整個不見**」。
    expect(
      [...shells.values()].filter((s) => !s.language).map((s) => s.id),
      '🔴 一份沒有語言的鷹架，在第二個語言進來的那天會安靜地撿到別人的宣告：',
    ).toEqual([])
  })

  it('🔴 硬性零——每一個語言至少有一份鷹架（否則選單那一組會整個不見）', () => {
    const langs = new Set(targets.map((t) => t.language).filter(Boolean))
    const covered = new Set([...shells.values()].map((s) => s.language))
    expect(
      [...langs].filter((l) => !covered.has(l as string)),
      '🔴 這些語言沒有任何骨架宣告——使用者在那個目標上「骨架」那一組是空的：',
    ).toEqual([])
  })

  it('🪦 「沒有骨架」是一份【空的宣告】，不是一個特例的 if', () => {
    const none = shells.get('none')
    expect(none, '🔴 `none` 這份宣告不見了').toBeTruthy()
    expect(
      [none!.preamble.length, none!.entryPoint.length, none!.epilogue.length],
      '🔴 `none` 不是空的——那它就不是「沒有骨架」了',
    ).toEqual([0, 0, 0])
  })
})

describe('★ 注入——證明它會報，也證明它不亂報', () => {
  // 🔴 **2026-08-31 換 schema**：`entryPoint`／`epilogue` 從「宣告的」變成
  //    「由 `entryFunctions` 的 `open`／`close` **導出的**」——因為
  //    「一個進入點包住一個本體」這個形狀裝不下 Arduino 的兩顆。
  //    ⚠️ 這些注入本來寫著舊 schema，換掉它們**不是**放寬判準：
  //    每一支釘的性質（理由必填／code 必填／型別／全空合法）逐條保留。
  const fn = (over: object = {}) => ({
    name: 'ㄒ函式', reason: 'ㄅ', open: [{ code: 'a', reason: 'b' }], close: [], ...over,
  })
  const OK = { id: 'ㄒ', name: 'ㄒ', language: 'ㄒ語', preamble: [], entryFunctions: [fn()] }

  it('★ 注入：正確的宣告 → 讀得出來', () => {
    expect(parseSkeleton(OK).entryPoint[0].code).toBe('a')
  })

  it('★ 注入：缺 language → 丟錯（不然它會跨語言被撿走）', () => {
    const { language: _l, ...noLang } = OK
    expect(() => parseSkeleton(noLang)).toThrow(/language/)
  })

  it('★ 注入：一段沒有理由 → 丟錯', () => {
    expect(() => parseSkeleton({ ...OK, entryFunctions: [fn({ open: [{ code: 'a' }] })] })).toThrow(/reason/)
    expect(() => parseSkeleton({ ...OK, entryFunctions: [fn({ open: [{ code: 'a', reason: '' }] })] })).toThrow(/reason/)
  })

  it('★ 注入：缺 code → 丟錯', () => {
    expect(() => parseSkeleton({ ...OK, entryFunctions: [fn({ close: [{ reason: 'x' }] })] })).toThrow(/code/)
  })

  it('★ 注入：某一段不是陣列 → 丟錯', () => {
    expect(() => parseSkeleton({ ...OK, preamble: 'x' })).toThrow(/preamble/)
  })

  it('★ 注入：全空是合法的（那就是「沒有骨架」）', () => {
    expect(() => parseSkeleton({ id: 'z', name: 'z', language: 'z語', preamble: [] })).not.toThrow()
  })

  it('🆕 注入：一顆印不出來的進入點 → 丟錯', () => {
    // 🔴 這一支釘的正是 2026-08-31 那個缺陷：宣告了 `setup`／`loop`，
    //    而「印出來長怎樣」是空的——使用者選了骨架會看到空畫面
    expect(() => parseSkeleton({ ...OK, entryFunctions: [fn({ open: [] })] })).toThrow(/open/)
  })

  it('🆕 注入：舊 schema（entryPoint／epilogue）→ 丟錯，不要兩邊各寫一份', () => {
    expect(() => parseSkeleton({ ...OK, entryPoint: [{ code: 'a', reason: 'b' }] })).toThrow(/entryFunctions/)
    expect(() => parseSkeleton({ ...OK, epilogue: [] })).toThrow(/entryFunctions/)
  })

  it('🆕 注入：兩顆都標 hostsBody → 丟錯（鬆散語句只能有一個去處）', () => {
    expect(() => parseSkeleton({
      ...OK, entryFunctions: [fn({ hostsBody: true }), fn({ name: 'ㄆ', hostsBody: true })],
    })).toThrow(/hostsBody/)
  })
})

/**
 * **第八十六條的第二半**（2026-08-28）：樹裡**哪一塊是骨架**也要由宣告回答。
 *
 * ## 它從哪來
 *
 * 使用者：「**我希望 Arduino 系列也有腳手架**」。量完之後：骨架「長什麼樣」
 * 已經是宣告了，而「**哪一塊是骨架**」寫死在**三個地方**：
 *
 * ```
 * cpp-scaffold-filter.ts   isFunctionDefinition(n) && n.properties.name === 'main'
 * cpp-scaffold-filter.ts   （同一條，第二個函式裡再寫一次）
 * app.ts                   （第三次）
 * ```
 *
 * 🔴 症狀：切到 Arduino、把顯示切成「淡的」，畫面上**什麼都不會變**
 * ——`setup`／`loop` 不叫 `main`。
 *
 * > **一份宣告如果只說得出「骨架印出來長怎樣」，
 * > 那「畫面上哪一塊是骨架」就會回去寫死在消費者身上。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果掃到的 `src/` 檔少於 200 個，代表掃描器沒讀到東西，這份報表不算數
 * > ——不是「寫死都清光了」。**
 *
 * 錨在**掃到幾個檔**（合成量）。🔴 刻意不錨在「還寫死幾處」——那正是要推向零的。
 *
 * ## 硬性零
 *
 * ```
 * 留一筆規範還成立嗎？  ❌ 留一處，Arduino 的鷹架就有一條路認不得它
 * 修一筆要付多少？      便宜——改成問 `entryFunctionOf(shell, name)`
 * 別台機器一樣嗎？      ✅ 純文字掃描
 * ```
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測「認對了沒」**——那是 e2e（`scaffold-code-complete.spec.ts`）。
 * - **不檢測別的寫死**（`'setup'`／`'loop'` 的字面值）：那兩個字在
 *   Arduino 的元件與探針語料裡到處都是，判準會誤報。
 */
describe('★ 第八十六條之二：樹裡哪一塊是骨架，也由宣告回答', () => {
  const SRC = path.join(ROOT, 'src')
  // 🔴 **不能用 `findFiles`**——它只列兩層（`<root>/<第一層>/<段>/`），
  //    而 `src/` 有六七層。第一版用了它，於是掃到 **0 個檔**，
  //    而硬性零因此「綠」。
  //
  // > **一條掃不到東西的硬性零，與一條真的清乾淨了的硬性零，產出完全相同。**
  //
  // ⚠️ 抓到它的是入口條件（`build-guardrail` 第 9 步），不是 code review。
  const walk = (dir: string, base = ''): string[] => {
    const out: string[] = []
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = base ? `${base}/${e.name}` : e.name
      if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel))
      else if (e.name.endsWith('.ts')) out.push(rel)
    }
    return out.sort()
  }
  const files = walk(SRC)
  let chars = 0
  const hits: string[] = []
  // 🔴 認的是「**把名字比對成 main**」這個形狀，不是「出現 main 這個字」
  //    ——`'int main() {'` 是骨架的**程式碼文字**，那是正當的。
  const HARDCODED = /\.name\s*===\s*['"]main['"]|name\s*===\s*['"]main['"]/

  for (const rel of files) {
    const abs = path.join(SRC, rel)
    const text = fs.readFileSync(abs, 'utf8')
    chars += text.length
    text.split('\n').forEach((line, i) => {
      if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return
      if (HARDCODED.test(line)) hits.push(`${rel}:${i + 1}  ${line.trim()}`)
    })
  }

  it('入口條件——掃描器真的讀到了 src/', () => {
    printReport('骨架的辨識', [
      `掃到       ${files.length} 個 .ts`,
      `讀進       ${chars} 字`,
      `寫死比對   ${hits.length} 處`,
      ...hits.map((h) => `  🔴 ${h}`),
    ])
    // ⚠️ 錨在**讀進幾個字**（合成量）——它不會因為寫死被清掉而變小
    expect(chars, '🔴 掃描器沒讀到東西 → 這份報表不算數，不是「清光了」').toBeGreaterThan(200_000)
    expect(files.length).toBeGreaterThanOrEqual(200)
  })

  it('🔴 硬性零——不得把「哪一顆函式是骨架」寫死成 `main`', () => {
    expect(
      hits,
      '🔴 這幾處把骨架的辨識寫死了。Arduino 的骨架是 `setup` ＋ `loop`——\n' +
        '**兩個**進入點，所以寫死 `main` 不只是名字錯，數量也錯。\n' +
        '🟢 改成問宣告：`entryFunctionOf(skeletonById(id), node.properties.name)`。',
    ).toEqual([])
  })

  it('★ 注入①：一處寫死要報得出來', () => {
    const line = "    if (isFunctionDefinition(n.componentId) && n.properties.name === 'main') {"
    expect(HARDCODED.test(line), '🔴 判定沒認出一處明顯的寫死').toBe(true)
  })

  it('★ 注入②：正確的寫法不得被報', () => {
    for (const ok of [
      "    if (entryFunctionOf(shell, n.properties?.name)) {",
      "      { code: 'int main() {', reason: '程式進入點' },",
      "  const entry = shell?.entryFunctions[0]?.name",
    ]) {
      expect(HARDCODED.test(ok), `🔴 誤報了一行正確的寫法：${ok}`).toBe(false)
    }
  })

  it('🔴 硬性零——「現在用哪一份骨架」只准有一個指派點', () => {
    // 🔴 它從哪來（2026-08-28）：`applyLesson` 直接換了 `currentTarget` 而**沒有動骨架**，
    //    於是 `?lesson=arduino/01-閃一顆燈` 開的課停在 C++ 的骨架上
    //    ——Arduino 的 `setup`／`loop` 一顆都不算骨架。
    //
    // ⚠️ 而它**不會報錯**：畫面上就是「切成淡的而什麼都沒變」。
    //    抓到它的是 `lessons.spec.ts` 的一條入口條件，不是型別檢查、不是全套。
    //
    // > **同一個決定有兩個入口時，第二個入口不會報錯——它只是安靜地少做一件事。**
    //
    // 🟢 三個持有者（鷹架、補丁器、同步器）由 `adoptSkeleton` 一起換，
    //    而這一條擋的是「有人又在別處直接指派」。
    const app = fs.readFileSync(path.join(ROOT, 'src/ui/app.ts'), 'utf8')
    expect(app.length, '🔴 app.ts 沒讀到 → 這一條不算數').toBeGreaterThan(10_000)
    const sites = app.split('\n')
      .map((l, i) => ({ l: l.trim(), i: i + 1 }))
      .filter(({ l }) => /this\.currentSkeletonId\s*=/.test(l) && !l.startsWith('//') && !l.startsWith('*'))
    expect(
      sites.map((x) => `app.ts:${x.i}  ${x.l}`),
      '🔴 「現在用哪一份骨架」有不只一個指派點——而少做一件事的那個入口不會報錯。\n' +
        '🟢 走 `adoptSkeleton(id)`：它同時通知鷹架、補丁器與同步器。',
    ).toHaveLength(1)
  })

  it('★ 而 Arduino 真的有【兩顆】進入點——否則上面那條規範沒有第二個形狀在撐', () => {
    const ard = allSkeletons().get('arduino')
    expect(ard, '🔴 沒有 arduino 這份骨架').toBeTruthy()
    expect(
      ard!.entryFunctions.map((f) => f.name),
      '🔴 Arduino 的進入點不是 setup／loop',
    ).toEqual(['setup', 'loop'])
    // ★ 而每一顆都說得出自己為什麼在那裡（與「每一段都有理由」同一條）
    expect(ard!.entryFunctions.filter((f) => !f.reason), '🔴 有進入點沒有理由').toEqual([])
  })
})
