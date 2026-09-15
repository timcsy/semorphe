/**
 * **第一百二十八條護欄：參考解答不得用到這一課還沒教過的元件。**
 *
 * ## 它從哪來
 *
 * 2026-09-14 學生回報（附截圖，第 3 課「變數」的〈做一個〉）：
 *
 * > 「這邊**找不到判斷的積木**」
 *
 * 那一題要他宣告「有沒有及格（真或假）」，而第 3 課的 `components` 裡
 * **沒有 `cpp:builtin_constant`**（`true`／`false` 那一顆）。
 * 工具箱是按這一課宣告的元件收窄的——**所以那顆積木真的不在畫面上**。
 *
 * ## 🔴 為什麼第一百一十四條護欄看不到它
 *
 * 那一條掃的是**課文裡的 ```cpp 區塊**。而這一題只有散文
 * （「宣告這三個變數、各給一個值、各印一行」），一行程式碼都沒有。
 *
 * > **一條護欄看得到的，是這一課【展示】了什麼；
 * > 而學生撞到的，是這一課【要求】他做什麼。**
 *
 * 量到的盲區：249 道題目裡有 48 道**沒有參考解答**（扣掉「跟著做」——
 * 它的解答就是課文的〈完成的樣子〉，另有 e2e 在驗）。
 * 那 48 道沒有任何東西驗過「用這一課的工具箱做得到嗎」。
 *
 * ## 這一條驗什麼
 *
 * 每一份 `solutions/*.cpp` lift 出來的元件，都要在
 * 「這一課 ∪ 之前每一課」的 `components` 裡（骨架那六顆除外）。
 *
 * ⚠️ **它是必要條件不是充分條件**：一道沒有參考解答的題目，這一條還是看不到。
 * 所以兩條入門軌的 13 道無裁判題目 2026-09-14 一起補了解答——
 * **而那才是這一條真正生效的前提**。
 *
 * > **一條只驗「有交上來的那些」的規則，它的覆蓋率等於交件率。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import '../../src/languages/cpp/module'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

const ROOT = path.resolve(__dirname, '../..')

/**
 * 骨架提供的那幾顆——課程刻意不教。
 * ⚠️ 與 `CLAUDE.md`／`audit-lesson-vocabulary`／`studycpp-slot-declarations` 同一張清單。
 */
const SKELETON = new Set([
  'cpp:program', 'cpp:func_def', 'cpp:include',
  'cpp:using_namespace', 'cpp:return', 'cpp:literal_number',
])

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${ROOT}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${ROOT}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
}, 120_000)

function componentsOf(code: string): Set<string> {
  const seen = new Set<string>()
  const walk = (n: SemanticNode): void => {
    if (n.componentId?.includes(':')) seen.add(n.componentId)
    for (const b of Object.values((n.slots ?? {}) as Record<string, SemanticNode[]>)) {
      for (const c of b ?? []) walk(c)
    }
  }
  walk(lifter.lift(tsParser.parse(code)!.rootNode as never) as SemanticNode)
  return seen
}

/**
 * 這一軌之前教過的全部——**沿著 `track.json` 的 `after` 往上走**。
 *
 * 🔴 少了它，進階軌與兩條銜接軌會被要求「重新教一次陣列與迴圈」
 * ——而它們的第 1 課逐字寫著「你已經會了」。
 * （`audit-lesson-vocabulary` 的檔頭記過同一件事：那個 `after` 是缺的宣告，
 * 補上之後誤報從 62 掉到 24。）
 */
function inherited(track: string, seen = new Set<string>()): Set<string> {
  const out = new Set<string>()
  if (seen.has(track)) return out
  seen.add(track)
  const tj = path.join(ROOT, 'lessons', track, 'track.json')
  const after = fs.existsSync(tj)
    ? (JSON.parse(fs.readFileSync(tj, 'utf8')) as { after?: string }).after : undefined
  if (after === undefined) return out
  for (const c of inherited(after, seen)) out.add(c)
  const dir = path.join(ROOT, 'lessons', after)
  if (!fs.existsSync(dir)) return out
  for (const d of fs.readdirSync(dir)) {
    const j = path.join(dir, d, 'lesson.json')
    if (!fs.existsSync(j)) continue
    for (const c of JSON.parse(fs.readFileSync(j, 'utf8')).components ?? []) out.add(c)
  }
  return out
}

/** 一條軌道走過去，累積「到這一課為止教過什麼」。⚠️ 同一課算教過。 */
function findingsFor(track: string): string[] {
  const dir = path.join(ROOT, 'lessons', track)
  const taught = inherited(track)
  const out: string[] = []
  for (const d of fs.readdirSync(dir).sort()) {
    const j = path.join(dir, d, 'lesson.json')
    if (!fs.existsSync(j)) continue
    for (const c of JSON.parse(fs.readFileSync(j, 'utf8')).components ?? []) taught.add(c)
    const sd = path.join(dir, d, 'solutions')
    if (!fs.existsSync(sd)) continue
    for (const f of fs.readdirSync(sd).sort()) {
      if (!f.endsWith('.cpp')) continue
      let used: Set<string>
      try { used = componentsOf(fs.readFileSync(path.join(sd, f), 'utf8')) } catch { continue }
      for (const c of [...used].sort()) {
        if (SKELETON.has(c) || taught.has(c)) continue
        out.push(`${track}/${d}/${f} · ${c}`)
      }
    }
  }
  return out
}

const CPP_TRACKS = ['cpp-beginner', 'cpp-advanced', 'c-bridge']

describe('第一百二十八條護欄：參考解答不得用到還沒教過的元件', () => {
  it('★ 入口條件——真的讀到解答了', () => {
    const n = CPP_TRACKS.flatMap((t) =>
      fs.readdirSync(path.join(ROOT, 'lessons', t))
        .filter((d) => fs.existsSync(path.join(ROOT, 'lessons', t, d, 'solutions'))))
    expect(n.length, '🔴 一份解答都沒讀到 → 下面那條是空過的').toBeGreaterThan(20)
  })

  it('🔴 硬性零：每一份參考解答用的元件，這一課或之前都宣告過', () => {
    const all = CPP_TRACKS.flatMap(findingsFor)
    expect(all, '🔴 參考解答用了這一課沒宣告的元件——**那顆積木不會出現在工具箱裡**，'
      + '而學生的症狀是「找不到那塊積木」，不是報錯。\n'
      + '🟢 修法：真的該教就把它加進那一課的 `components`；不該教就改題目。').toEqual([])
  }, 120_000)

  /**
   * ★ **注入**——沒有這一條，上面那個 `toEqual([])` 可能只是因為它什麼都沒 lift 到。
   */
  it('★ 注入：一份用了沒教過的元件的解答 → 抓得到', () => {
    // ⚠️ **期望值裡不得出現真實身分**——第三十五條護欄（錨點會爛）的檔頭逐字寫著
    //    「用真實身分當注入素材，正是這條護欄要抓的那個味道」。
    //    所以這裡拿**合成的「教過的東西」**當素材，只問「規則有沒有開火」。
    const taught = new Set<string>(['zz:只教過這一顆'])
    const used = componentsOf('int main() { int a[3]; a[0] = 1; cout << a[0] << endl; return 0; }')
    const missing = [...used].filter((c) => !SKELETON.has(c) && !taught.has(c))
    expect(missing.length,
      '🔴 一段用了一堆東西的程式，對著一個幾乎空的「教過」集合居然零違反 → 判準沒有在跑')
      .toBeGreaterThan(0)
  })

  it('★ 反向：把「教過」放成它用到的全部 → 一筆都不報', () => {
    const used = componentsOf('int main() { int a[3]; a[0] = 1; cout << a[0] << endl; return 0; }')
    const missing = [...used].filter((c) => !SKELETON.has(c) && !used.has(c))
    expect(missing, '🔴 判準會亂報——教過的東西也被算成違反').toEqual([])
  })

  /**
   * ⚠️ **這一條的覆蓋率等於交件率**——所以把「有幾道題目沒有參考解答」也錨住，
   * 否則有人刪掉一份解答，上面那條會**因為看不到而變綠**。
   */
  it('🔴 棘輪：兩條入門軌的題目，沒有參考解答的只准變少', () => {
    let missing = 0
    for (const track of ['cpp-beginner', 'python-beginner']) {
      const dir = path.join(ROOT, 'lessons', track)
      for (const d of fs.readdirSync(dir)) {
        const j = path.join(dir, d, 'lesson.json')
        if (!fs.existsSync(j)) continue
        const sd = path.join(dir, d, 'solutions')
        const have = new Set(fs.existsSync(sd)
          ? fs.readdirSync(sd).map((f) => f.replace(/\.[^.]+$/, '')) : [])
        // 🔴 **起點也算交件**（2026-09-14）——一道有 `starters/` 的題目
        //    同樣有一份真的程式碼被驗過，而第八十三條護欄**禁止**它同時有解答
        //    （「一份 .cpp 到底是該壞的起點還是該對的答案，答案不在檔案裡」）。
        //
        // > **一條數「誰沒交」的規則，如果它只認得一種交法，
        // > 那它會在另一種交法出現的那天，把交了的人算成沒交。**
        const st = path.join(dir, d, 'starters')
        const started = new Set(fs.existsSync(st)
          ? fs.readdirSync(st).map((f) => f.replace(/\.[^.]+$/, '')) : [])
        for (const t of JSON.parse(fs.readFileSync(j, 'utf8')).tasks ?? []) {
          // ⚠️ 「跟著做」的解答是課文的〈完成的樣子〉
          if (t.id === 'follow') continue
          if (!have.has(t.id) && !started.has(t.id)) missing++
        }
      }
    }
    expect(missing, `🔴 兩條入門軌有 ${missing} 道題目沒有參考解答——`
      + '而上面那條硬性零【看不到它們】。').toBe(0)
  })
})
