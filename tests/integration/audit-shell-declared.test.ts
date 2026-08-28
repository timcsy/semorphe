/**
 * **第八十六條護欄**：鷹架是一份宣告，而每一段都說得出自己為什麼在那裡。
 *
 * ## 它從哪來
 *
 * 2026-08-28 使用者問「**鷹架應該也不只一個吧？算不算是一種元件？**」。
 * 量完現況，`Target.entryShell` 的值域只有 **`'main'` 與 `'none'`**
 * ——也就是「**有**」跟「**沒有**」，而四段外框寫死在兩個地方：
 *
 * ```
 * cpp-scaffold.ts   'using namespace std;' · 'int main() {' · '    return 0;' · '}'
 * auto-include.ts   'int main() {\n…\n    return 0;\n}'      ← 同一個決定的第二份實作
 * ```
 *
 * 🔴 而 `'none'` **不是「Arduino 的鷹架」，它是「沒有鷹架」**
 * ——`if (entryShell === 'none') return {…全空}`。
 *
 * > **鷹架不是一顆新積木，是「哪幾段組成外框，以及它們為什麼在那裡」。**
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
import { parseShell, allShells } from '../../src/core/shell'
import '../../src/core/load-language-packs'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const LANGS = path.join(ROOT, 'src/languages')

describe('★ 第八十六條：鷹架是一份宣告', () => {
  const shells = allShells()
  const targets = findFiles(LANGS, 'targets')
    .map((rel) => {
      const d = JSON.parse(fs.readFileSync(path.join(LANGS, rel), 'utf8')) as { id: string; entryShell?: string; topic: string }
      // 目標的語言由它的主題說——`topic` 檔在 `topics/`
      const t = findFiles(LANGS, 'topics')
        .map((r) => ({ r, j: JSON.parse(fs.readFileSync(path.join(LANGS, r), 'utf8')) as { id: string; language?: string } }))
        .find((x) => x.j.id === d.topic)
      return { ...d, language: t?.j.language }
    })

  it('入口條件——鷹架真的註冊進來了', () => {
    printReport('鷹架宣告', [
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
      .filter((t) => !shells.has(t.entryShell ?? 'main'))
      .map((t) => `${t.id} → ${t.entryShell ?? 'main'}`)
    expect(
      bad,
      '🔴 目標指向一份沒有登記的外框——產出會是一支少了進入點的程式，' +
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
    // 少了它，`shellById('none')` 會**跨語言撿到別人的宣告**
    // ——2026-08-28 實測：Python 撿到 C++ 的 `none`，
    // 而症狀是「狀態列那句話碰巧是對的，**而選單裡外框那一組整個不見**」。
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
      '🔴 這些語言沒有任何鷹架宣告——使用者在那個目標上「外框」那一組是空的：',
    ).toEqual([])
  })

  it('🪦 「沒有外框」是一份【空的宣告】，不是一個特例的 if', () => {
    const none = shells.get('none')
    expect(none, '🔴 `none` 這份宣告不見了').toBeTruthy()
    expect(
      [none!.preamble.length, none!.entryPoint.length, none!.epilogue.length],
      '🔴 `none` 不是空的——那它就不是「沒有外框」了',
    ).toEqual([0, 0, 0])
  })
})

describe('★ 注入——證明它會報，也證明它不亂報', () => {
  const OK = { id: 'ㄒ', name: 'ㄒ', language: 'ㄒ語', preamble: [], entryPoint: [{ code: 'a', reason: 'b' }], epilogue: [] }

  it('★ 注入：正確的宣告 → 讀得出來', () => {
    expect(parseShell(OK).entryPoint[0].code).toBe('a')
  })

  it('★ 注入：缺 language → 丟錯（不然它會跨語言被撿走）', () => {
    const { language: _l, ...noLang } = OK
    expect(() => parseShell(noLang)).toThrow(/language/)
  })

  it('★ 注入：一段沒有理由 → 丟錯', () => {
    expect(() => parseShell({ ...OK, entryPoint: [{ code: 'a' }] })).toThrow(/reason/)
    expect(() => parseShell({ ...OK, entryPoint: [{ code: 'a', reason: '' }] })).toThrow(/reason/)
  })

  it('★ 注入：缺 code → 丟錯', () => {
    expect(() => parseShell({ ...OK, epilogue: [{ reason: 'x' }] })).toThrow(/code/)
  })

  it('★ 注入：某一段不是陣列 → 丟錯', () => {
    expect(() => parseShell({ ...OK, preamble: 'x' })).toThrow(/preamble/)
  })

  it('★ 注入：全空是合法的（那就是「沒有外框」）', () => {
    expect(() => parseShell({ id: 'z', name: 'z', language: 'z語', preamble: [], entryPoint: [], epilogue: [] })).not.toThrow()
  })
})

/**
 * **第八十六條的第二半**（2026-08-28）：樹裡**哪一塊是外框**也要由宣告回答。
 *
 * ## 它從哪來
 *
 * 使用者：「**我希望 Arduino 系列也有腳手架**」。量完之後：外框「長什麼樣」
 * 已經是宣告了，而「**哪一塊是外框**」寫死在**三個地方**：
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
 * > **一份宣告如果只說得出「外框印出來長怎樣」，
 * > 那「畫面上哪一塊是外框」就會回去寫死在消費者身上。**
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
describe('★ 第八十六條之二：樹裡哪一塊是外框，也由宣告回答', () => {
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
  //    ——`'int main() {'` 是外框的**程式碼文字**，那是正當的。
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
    printReport('外框的辨識', [
      `掃到       ${files.length} 個 .ts`,
      `讀進       ${chars} 字`,
      `寫死比對   ${hits.length} 處`,
      ...hits.map((h) => `  🔴 ${h}`),
    ])
    // ⚠️ 錨在**讀進幾個字**（合成量）——它不會因為寫死被清掉而變小
    expect(chars, '🔴 掃描器沒讀到東西 → 這份報表不算數，不是「清光了」').toBeGreaterThan(200_000)
    expect(files.length).toBeGreaterThanOrEqual(200)
  })

  it('🔴 硬性零——不得把「哪一顆函式是外框」寫死成 `main`', () => {
    expect(
      hits,
      '🔴 這幾處把外框的辨識寫死了。Arduino 的外框是 `setup` ＋ `loop`——\n' +
        '**兩個**進入點，所以寫死 `main` 不只是名字錯，數量也錯。\n' +
        '🟢 改成問宣告：`entryFunctionOf(shellById(id), node.properties.name)`。',
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

  it('★ 而 Arduino 真的有【兩顆】進入點——否則上面那條規範沒有第二個形狀在撐', () => {
    const ard = allShells().get('arduino')
    expect(ard, '🔴 沒有 arduino 這份外框').toBeTruthy()
    expect(
      ard!.entryFunctions.map((f) => f.name),
      '🔴 Arduino 的進入點不是 setup／loop',
    ).toEqual(['setup', 'loop'])
    // ★ 而每一顆都說得出自己為什麼在那裡（與「每一段都有理由」同一條）
    expect(ard!.entryFunctions.filter((f) => !f.reason), '🔴 有進入點沒有理由').toEqual([])
  })
})
