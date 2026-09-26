/**
 * **探針：形式化的殘差表**——第六路（`formalize`）今天到不了哪裡，第一次是一個數得出來的東西。
 *
 * ## 🔴 它為什麼存在
 *
 * 路線圖〈🔜 下一步〉第一格「軟體域的 vericoding 閉環」的第三個框逐字是
 * 「**母體從 2 變成一個量得出來的數**」——而 `PATH_JUDGE.formalize` 的
 * `coverage` 今天寫死 `{ covered: 2, of: 2 }`。
 *
 * ⚠️ **2 / 2 是 100%，而它量的是「宣告了形式核的那兩顆」**。
 * 那個讀數對「一支程式的保證說不出來」這件事**保持沉默**。
 *
 * > **一份「全部證明通過」的報告，先問那些命題裡有幾條是空洞為真的。**
 * >（`concepts/契約.md:246`）
 *
 * ## 🔴 它刻意量【兩個】母體，而混起來會問不出「做完了沒」
 *
 * ```
 * 母體 A  課文解答裡的【函式】          走訪器產得出項的比例 ＝ 形狀的覆蓋
 * 母體 B  那些函式的樹裡出現的【身分】   有幾顆宣告了 paths.formalize ＝ 宣告的覆蓋
 * ```
 *
 * 分開的理由是這個 repo 自己的規矩：**一個每次做對事情都要上調的數字，量的是兩件事。**
 * 支援一個新形狀會動 A 而不動 B；給一顆元件寫形式核會動 B 而不一定動 A。
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * **如果「掃到的解答檔數」或「lift 出來的函式數」是 0，代表路徑寫錯了或 lifter 沒載入
 * ——不是走訪器完美。**
 *
 * 🔴 而錨**刻意不放在**「產不出項的支數」上：那正是這支探針要推向零的東西，
 * 拿它當入口條件的話，**成功的那天就會紅**（這個 repo 犯過九次，見 `build-guardrail` 第 2 步）。
 * 兩個錨都是**輸入量**：走訪器多學一個形狀，它們一個都不會變小。
 *
 * ## 本探針不檢測什麼
 *
 * - **不驗證產出的項是對的**——那要 cella，在 `cella-formalize-guard.test.ts`
 *   （判定版 0 洞 ＋ 布林版 1 洞且洞的型別逐字）。**本檔到「產得出項」為止。**
 *   ⚠️ 所以「產得出項」**不等於**「那個項說了這支程式的事」。
 * - **不判一個理由該不該被支援**——它只排順序。
 * - **不量效果**（I/O、全域狀態）：只量「不碰 I/O 的那一群」，其餘記成一個可見的數字。
 *
 * ## 🔴 而「它是探針所以沒人跑」這個前提是錯的（規劃時判錯，量完才發現）
 *
 * 規劃時我寫「它不進 `npm test`，所以不給棘輪——一個沒有人跑的數字，
 * 與一條永遠不動的棘輪是同一件事」。而 `vitest.config.ts:41` 逐字：
 *
 * `include` 收的是 `tests` 底下**所有**的 `.test.ts`（含 `src/components` 的膠囊自證）
 * ——⚠️ 那一行原本抄在這裡，而它含著會提前關掉這段註解的序列。
 *
 * **`tests/probes/` 本來就在裡面。**前例之所以看起來「沒人跑」，是因為它們
 * 缺 `STUDYCPP_DIR`／`CELLA_BIN` 就跳過——而**這一支不需要任何外部工具**
 * （不編譯、不叫 cella），4 秒跑完，兩台機器上同一個數字。
 *
 * > **「它是探針」講的是它住哪個目錄，不是有沒有人跑它。**
 *
 * ⟹ 所以棘輪的理由成立了。而它**分兩個機制**，因為那是兩件事：
 *
 * ```
 * assertCorpus   課文解答檔數 · 函式數 · 不碰 I/O 的函式數   加一課會長 → 上調並寫理由
 * assertRatchet  不碰 I/O 而【產不出項】的個數                走訪器學會一個形狀就掉
 * ```
 *
 * 混成一個數字的話，「加一課」會長得像「走訪器退步」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { formalizeFunction, CellaFormalizeError, type ContractSources } from './cella-formalize'
import { assertCorpus, assertRatchet, writeBaseline, RATCHET_NOTE } from '../helpers/guardrail'
import type { SemanticNode } from '../../src/core/types'

const GUARD = 'formalize-residual'

/** 已知走得通的形狀（`AP325/7/7_6.cpp` 的骨架）——正向對照用，**合成的**。 */
const KNOWN_GOOD = `int pick(int n, int u, int fallback) {
  int A[n];
  if (u < n) return A[u];
  return fallback;
}`

interface FnRow {
  file: string
  name: string
  ok: boolean
  /** 擲例外時：`componentId` ＋ 理由的類別 */
  componentId?: string
  reason?: string
}

let parser: Parser
let contracts: ContractSources
let prelude: string
let files: string[] = []
let fns: { file: string; fn: SemanticNode }[] = []
let rows: FnRow[] = []
let pure: { file: string; fn: SemanticNode }[] = []
/** 不碰 I/O **而且**產不出項的個數——棘輪盯的就是這個。 */
let pureUnformalized = 0

/** 這一顆（含子樹）碰不碰 I/O。 */
const IO_IDS = new Set(['cpp:print', 'cpp:input', 'cpp:endl'])
function hasIO(n: SemanticNode): boolean {
  if (IO_IDS.has(n.componentId)) return true
  return Object.values(n.slots ?? {}).some((kids) => kids.some((k) => hasIO(k)))
}

/** 理由字串 → 類別（把「還不認得型別 std::string」這種尾巴切掉，否則直方圖只會有一堆各一筆）。 */
function bucket(msg: string): string {
  const body = msg.replace(/^形式化編不了 [^：]+：/, '')
  return body
    .replace(/型別 .+$/, '型別 …')
    .replace(/還沒有 .+ 的宣告.*$/, '還沒有某個運算子的宣告')
    .replace(/找不到 .+ 的長度宣告$/, '找不到某個陣列的長度宣告')
    .replace(/陣列名 .+ 被遮蔽了.*$/, '陣列名被遮蔽了')
    .replace(/謂詞 .+ 已經在場.*$/, '謂詞已經在場')
    .replace(/槽 .+ 要恰好一個子節點，實際 \d+ 個/, '槽要恰好一個子節點')
}

function cppFiles(dir: string): string[] {
  const out: string[] = []
  if (!fs.existsSync(dir)) return out
  const rec = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue
      const p = path.join(d, e.name)
      if (e.isDirectory()) rec(p)
      else if (/\.(cpp|cc)$/.test(e.name)) out.push(p)
    }
  }
  rec(dir)
  return out
}

/** 收出這棵樹裡所有的函式定義（含巢狀——今天不會有，而判準不假設它）。 */
function funcDefs(n: SemanticNode, out: SemanticNode[]): SemanticNode[] {
  if (n.componentId === 'cpp:func_def') out.push(n)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids) funcDefs(k, out)
  return out
}

function idsIn(n: SemanticNode, seen: Set<string>): Set<string> {
  seen.add(n.componentId)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids) idsIn(k, seen)
  return seen
}

beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))

  // 🔴 讀的是**宣告說的那個檔**（`paths.formalize`），與 guard 同一條路
  //    ——宣告與形式核分岔的話，下面的入口條件要紅。
  const m = new Map<string, string>()
  for (const dir of fs.readdirSync('src/components/cpp')) {
    const manifest = path.join('src/components/cpp', dir, 'component.json')
    if (!fs.existsSync(manifest)) continue
    const decl = JSON.parse(fs.readFileSync(manifest, 'utf8')) as {
      componentId: string
      paths?: Record<string, string | null>
    }
    const rel = decl.paths?.formalize
    if (typeof rel !== 'string') continue
    m.set(decl.componentId, fs.readFileSync(path.join('src/components/cpp', dir, rel), 'utf8'))
  }
  contracts = m
  prelude = fs.readFileSync('src/languages/cpp/cella-prelude.cella', 'utf8')

  files = cppFiles('lessons')
  const lifter = createTestLifter()
  for (const f of files) {
    const tree = parser.parse(fs.readFileSync(f, 'utf8'))
    if (!tree) continue
    const root = lifter.lift(tree.rootNode as never) as SemanticNode | null
    if (!root) continue
    for (const fn of funcDefs(root, [])) fns.push({ file: f, fn })
  }

  rows = fns.map(({ file, fn }) => {
    const name = String(fn.properties?.name ?? '(匿名)')
    try {
      formalizeFunction(fn, { contracts, prelude })
      return { file, name, ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return {
        file, name, ok: false,
        componentId: e instanceof CellaFormalizeError ? e.componentId : '(不是 CellaFormalizeError)',
        reason: bucket(msg),
      }
    }
  })
  pure = fns.filter(({ fn }) => !hasIO(fn))
  pureUnformalized = pure.filter(({ file, fn }) => {
    const name = String(fn.properties?.name ?? '(匿名)')
    return rows.find((r) => r.file === file && r.name === name)?.ok !== true
  }).length
}, 180_000)

describe('探針：形式化的殘差表（第六路今天到不了哪裡）', () => {
  // ── ★ 入口條件：兩個錨都是輸入量 ───────────────────────────────
  it('★ 入口條件：課文的解答檔要讀到（母體不是空的）', () => {
    expect(files.length, '🔴 `lessons/` 底下讀不到 .cpp —— 路徑寫錯了，不是覆蓋率完美')
      .toBeGreaterThan(50)
  })

  it('★ 入口條件：lift 要產得出函式（否則下面在量一個空集合）', () => {
    expect(fns.length, '🔴 88 支解答裡 lift 不出任何 cpp:func_def —— lifter 沒載入或抽取壞了')
      .toBeGreaterThan(50)
  })

  it('★ 入口條件：那兩顆元件的形式核讀得到（宣告與檔案不得分岔）', () => {
    expect(contracts.get('cpp:compare'), 'cpp:compare 的 paths.formalize 讀不到').toBeTruthy()
    expect(contracts.get('cpp:array_at'), 'cpp:array_at 的 paths.formalize 讀不到').toBeTruthy()
  })

  // ── ★ 兩個方向都要釘 ──────────────────────────────────────────
  it('★ 正向對照：已知走得通的形狀，不得被算成殘差（否則這支在量自己）', () => {
    const root = createTestLifter().lift(parser.parse(KNOWN_GOOD)!.rootNode as never) as SemanticNode
    const fn = funcDefs(root, [])[0]
    expect(fn, '合成輸入自己就 lift 不出函式').toBeTruthy()
    expect(() => formalizeFunction(fn, { contracts, prelude }),
      '🔴 已知走得通的形狀產不出項 → 殘差表把走訪器的迴歸算成了語料的形狀').not.toThrow()
  })

  it('★ 負向對照：認不得的東西要擲 CellaFormalizeError，不准猜', () => {
    const root = createTestLifter().lift(parser.parse(KNOWN_GOOD)!.rootNode as never) as SemanticNode
    const fn = funcDefs(root, [])[0]
    const bad = { ...fn, properties: { ...fn.properties, return_type: 'std::string' } } as SemanticNode
    expect(() => formalizeFunction(bad, { contracts, prelude })).toThrow(CellaFormalizeError)
  })

  // ── 🔴 讀數 ───────────────────────────────────────────────────
  it('🔴 母體 A（形狀）：88 支解答的函式裡，走訪器產得出項的有幾個', () => {
    const ok = rows.filter((r) => r.ok)
    console.log(`\n╔══ 母體 A：形狀的覆蓋 ══╗`)
    console.log(`解答檔 ${files.length} 支｜函式 ${rows.length} 個｜產得出項 ${ok.length} 個`)
    console.log(`殘差 ${rows.length - ok.length} 個（${Math.round((rows.length - ok.length) * 100 / rows.length)}%）`)

    // 理由直方圖 —— 🔴 每一類都帶一個最小重現，否則它不指路
    const hist = new Map<string, FnRow[]>()
    for (const r of rows.filter((x) => !x.ok)) {
      const key = `${r.componentId}｜${r.reason}`
      hist.set(key, [...(hist.get(key) ?? []), r])
    }
    console.log(`\n待建清單（按支數排序，每一類附一個重現）：`)
    for (const [key, rs] of [...hist.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const ex = rs[0]
      console.log(`  ${String(rs.length).padStart(4)} 個  ${key}`)
      console.log(`            ↳ ${path.relative(process.cwd(), ex.file)}  ${ex.name}()`)
    }
    // 🔴 **最大那一格要拆開，否則它不指路。**
    //
    // 第一次跑：105 個函式裡 95 個落進「今天只認得『一個 if 加一個結尾 return』」
    // ——那是**同一個 throw 點**，而它說的是「不是我認得的那一個形狀」，
    // 一句套套邏輯。`build-guardrail`：**一叢違規看起來像一個根因，而那是假設不是結論。**
    //
    // 所以再問一層：**那些函式的 body 裡實際上有什麼。**那才是待建的順序。
    const shapeBucket = '今天只認得「一個 if 加一個結尾 return」那個形狀'
    const shaped = rows.filter((r) => !r.ok && r.reason === shapeBucket)
    const stmtHist = new Map<string, number>()
    for (const r of shaped) {
      const fn = fns.find((x) => x.file === r.file && String(x.fn.properties?.name ?? '(匿名)') === r.name)?.fn
      if (!fn) continue
      // 只看 body 的**直接**子節點——「這個函式的頂層有哪幾種語句」
      const kinds = new Set((fn.slots?.body ?? []).map((k) => k.componentId))
      for (const k of kinds) stmtHist.set(k, (stmtHist.get(k) ?? 0) + 1)
    }
    console.log(`\n  ↳ 最大那一格（${shaped.length} 個）拆開：body 頂層出現過哪些語句`)
    console.log(`     （一個函式含多種就各算一次 —— 這是「有幾個函式碰到它」不是「出現幾次」）`)
    for (const [k, n] of [...stmtHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)) {
      console.log(`     ${String(n).padStart(4)} / ${shaped.length} 個函式  ${k}`)
    }

    // ── 🔴 而那張表指出一件比「多支援幾個形狀」更根本的事 ───────────────
    //
    // 61 / 95 含 `cpp:print`、17 / 95 含 `cpp:input`——**課文的解答是
    // 「有副作用的 main」，不是「純函式」**。一支有 I/O 的程式要形式化，
    // 缺的不是語句形狀，是**效果模型**。
    //
    // 所以這裡量的是**今天最接近閉環的那一群**：不碰 I/O 的函式有幾個。
    // ⚠️ 它是**上界**——不含 I/O 不代表其餘部分走訪器認得。
    console.log(`\n  ↳ 🔴 不碰 I/O 的函式：${pure.length} / ${fns.length} 個（上界）`)
    console.log(`     —— 有 I/O 的那些缺的不是語句形狀,是【效果模型】。`)
    const pureReasons = new Map<string, number>()
    for (const { file, fn } of pure) {
      const name = String(fn.properties?.name ?? '(匿名)')
      const r = rows.find((x) => x.file === file && x.name === name)
      const key = r?.ok ? '🟢 產得出項' : `${r?.componentId}｜${r?.reason}`
      pureReasons.set(key, (pureReasons.get(key) ?? 0) + 1)
    }
    for (const [k, n] of [...pureReasons.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`     ${String(n).padStart(4)} 個  ${k}`)
    }

    // 🔴 不是「殘差必須是 N」——那會在做對事的那天紅。這裡只要求它量到了東西。
    expect(rows.length, '一個函式都沒走到').toBeGreaterThan(0)
    expect([...hist.keys()].length + ok.length, '既沒有成功也沒有失敗 → 迴圈沒有跑').toBeGreaterThan(0)
    expect(stmtHist.size, '最大那一格拆不出任何語句種類 → body 槽名寫錯了').toBeGreaterThan(0)
  })

  // ── 🔴 兩個機制，因為它們是兩件事 ──────────────────────────────
  it('產基線（只在 GENERATE_BASELINE=1 時）', () => {
    if (!process.env.GENERATE_BASELINE) return
    // ⚠️ **順序：先重生，再寫註記。**反了的話註記會被靜靜吃掉，而測試是綠的。
    writeBaseline(GUARD, {
      _meta: {
        note:
          '第六路（`formalize`）的殘差：課文的解答裡，走訪器產得出 cella 項的有幾個。\n'
          + '🔴 兩個機制刻意分開——語料（加一課會長）vs 棘輪（走訪器學會一個形狀就掉）。\n'
          + '⚠️ 「產得出項」不等於「那個項說了這支程式的事」：驗那件事要 cella，\n'
          + '  在 `cella-formalize-guard.test.ts`（判定版 0 洞 ＋ 布林版 1 洞且洞的型別逐字）。\n',
        ratchet: RATCHET_NOTE,
      },
      // 🔴 鍵要與 `assertCorpus`／`assertRatchet` 的列名**逐字相同**——
      //    對不上的話 helper 會紅（它逐字說「少一項不是小事：那一項的棘輪完全沒有跑」）。
      '課文解答檔': files.length,
      '解答裡的函式': fns.length,
      '不碰 I/O 的函式': pure.length,
      '不碰 I/O 而產不出項的函式': pureUnformalized,
    })
    expect(true).toBe(true)
  })

  it('🔴 語料：解答檔數 · 函式數 · 不碰 I/O 的函式數（變大就上調並寫理由）', () => {
    assertCorpus([
      ['課文解答檔', files.length],
      ['解答裡的函式', fns.length],
      ['不碰 I/O 的函式', pure.length],
    ], 'formalize-residual')
  })

  it('🔴 棘輪：不碰 I/O 而產不出項的函式，只准下降', () => {
    // ⚠️ 這一格與上面那三個**刻意分開**：加一課會讓語料變大，而那不是退步。
    //    混成一個數字的話，「加一課」會長得像「走訪器退步」。
    //
    // 🟢 而它今天是 15 / 15 —— **走訪器一個都接不住**，
    //    卡的是形狀（10）· 型別（3）· 運算子宣告（2）。
    assertRatchet([['不碰 I/O 而產不出項的函式', pureUnformalized]], 'formalize-residual')
  })

  it('🔴 母體 B（宣告）：解答的樹裡出現的身分，有幾顆宣告了 paths.formalize', () => {
    const seen = new Set<string>()
    for (const { fn } of fns) idsIn(fn, seen)
    const cpp = [...seen].filter((i) => i.startsWith('cpp:')).sort()
    const declared = cpp.filter((i) => contracts.has(i))
    console.log(`\n╔══ 母體 B：宣告的覆蓋 ══╗`)
    console.log(`解答用到的 cpp 身分 ${cpp.length} 顆｜宣告了 paths.formalize 的 ${declared.length} 顆`)
    console.log(`  🔴 而 PATH_JUDGE.formalize 的 coverage 今天寫死 { covered: 2, of: 2 }`)
    console.log(`     ——那個分母是「已經寫了形式核的」，不是「要用到的」。`)
    console.log(`\n  宣告了的：${declared.join('、') || '（無）'}`)
    const missing = cpp.filter((i) => !contracts.has(i))
    console.log(`  沒宣告的前 20 顆（共 ${missing.length}）：\n    ${missing.slice(0, 20).join('、')}`)
    expect(cpp.length, '樹裡一顆 cpp 身分都沒有 → 走訪壞了').toBeGreaterThan(10)
  })
})
