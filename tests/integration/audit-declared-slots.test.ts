/**
 * 第三十條護欄：**宣告完整性**——lift 產出的接點，宣告裡有嗎
 *
 * ## 自我否證聲明（⚠️ 寫在量測邏輯之前）
 *
 * > **如果下面「注入」那一節合成的輸入沒有得到預期的判定
 * > ——(a) 產出了宣告裡沒有的接點必須被報，
 * > (b) 產出的接點宣告裡都有必須**不**被報，
 * > (c) 語料完全沒碰到的元件必須進「無法確定」而不是進「安全」——
 * > 代表護欄壞了，不是宣告乾淨。**
 *
 * 第二個錨是**語料量**（掃到幾段程式碼、碰到幾顆元件）——
 * 那不是這條護欄要推向零的東西。
 *
 * ## 這是 [第二十九條（符合性）](audit-conformance.test.ts) 的**另一半**
 *
 * | 方向 | 問什麼 | 抓什麼 |
 * |---|---|---|
 * | #29 正向 | **宣告的**接點，投影回得來嗎 | 形態表達不出來 |
 * | **#30 反向** | **產出的**接點，宣告過嗎 | **宣告漏了** |
 *
 * `experience.md`：「護欄常常只問了一個方向……**把規範的主詞與受詞對調再讀一次**，
 * 對調之後讀起來成立的，就是漏掉的那一半。」
 *
 * ## 為什麼漏一個接點宣告比看起來嚴重
 *
 * 宣告是**三個消費者**的輸入：
 *
 * 1. 第二十九條護欄的合成節點（從 `children` 造子節點）
 * 2. 完備性護欄的合成節點（同上）
 * 3. 膠囊契約裡未來的共同測 harness（「從宣告推導」）
 *
 * > **一個沒宣告的接點會讓那三個一起變瞎，而且它們全都回報綠色。**
 *
 * 已知的具體例子：`cpp:func_def` 宣告把 `params` 寫成**屬性**，而 lift 產出
 * **接點**——於是 #29 從宣告合成時根本沒放 `params` 進去，也就測不到它會不會掉。
 * 那顆元件因此在 #29 上一直是綠的（`specs/105` 診斷）。
 *
 * ## 為什麼是實測不是靜態掃描
 *
 * 靜態掃 `createNode('x', …)` 的呼叫看得到「產生了什麼概念」，
 * **看不到它被掛在哪個接點下**——而後者才是這條護欄要問的。
 *
 * 上一條護欄（#29）在同一個地方連續錯了兩版：兩版都在量名字對不對，
 * 而那是代理。判準是「**我量的這個東西，與我想知道的那件事，
 * 中間隔了幾層推論？**」——這裡答案必須是零層：跑 lift，看樹。
 *
 * ## 三個桶——判不出來的不計入安全
 *
 * | 桶 | 意義 |
 * |---|---|
 * | **確定違規** | 語料碰到了這顆元件，而它產出了宣告裡沒有的接點 |
 * | **無法確定** | 語料**沒碰到**這顆元件——不知道它會產出什麼 |
 * | 安全 | 語料碰到了，且產出的接點宣告裡都有 |
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測宣告了卻從來沒產出的接點**——那可能是還沒實作，也可能是
 *   語料沒覆蓋到，兩者這裡分不出來。
 * - **不檢測接點裡裝的東西對不對**——只問「這個接點名宣告過嗎」。
 * - **不檢測 `properties`**——同一個病在屬性上也會發生（`cpp:func_def` 就是
 *   把 `params` 錯放在屬性），但那要另一條。
 * - **覆蓋率受語料限制**。語料是掃測試檔裡的 C++ 片段，所以
 *   **「無法確定」的顆數是這條護欄的誠實度指標**，不是雜訊。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { loadBaseline, writeBaseline, RATCHET_NOTE, assertRatchet, printReport, REPO_ROOT } from '../helpers/guardrail'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { allCppConcepts } from '../../src/languages/cpp/all-declarations'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

const GUARD = 'declared-slots'

interface 判定 {
  conceptId: string
  桶: '確定違規' | '無法確定' | '安全'
  未宣告: string[]
  reason: string
}

/**
 * 「語料沒碰到」的**逐筆判定**（`build-guardrail` 第 11 步）。
 *
 * ## ⚠️ 為什麼這條護欄需要它——它的「誠實度指標」說不出誠實在哪
 *
 * 檔頭寫著「**『無法確定』的顆數是這條護欄的誠實度指標**」。而 2026-08-11
 * 逐筆看那 8 筆時發現它**混了至少三種原因**：
 *
 * ```
 * cpp:if_else                     宣告過的降級目標    ← 正確，不是缺口
 * cpp:raw_code / raw_expression   元概念              ← 正確
 * cpp:queue_back / string_empty   **辨識歧義到不了**  ← 真的缺口
 * 其餘                            可能只是語料沒覆蓋
 * ```
 *
 * > **一個桶裡混了不同原因的東西，而報表上長得一樣。**
 * > 「無法確定 8」讀起來像「語料再補一點就好」，而其中兩筆
 * > **補再多語料也永遠碰不到**。
 *
 * ⚠️ 這條護欄是四條有判定落點的護欄裡**唯一沒有的**（#32／#33／#35 都有）。
 *
 * ## 鍵用 conceptId，不用行號或截斷的字串
 *
 * `conceptId` 是**穩定身分**——它天生沒有那兩個坑
 * （`specs/110` 的截斷碰撞、`specs/113` 的行號漂移）。
 */
interface 無法確定判定 {
  conceptId: string
  原因: '宣告過的降級目標' | '元概念' | '辨識到不了' | '語料沒覆蓋'
  reason: string
}

interface Baseline {
  _meta: { guard: string; measuredAt: string; rule: string; note: string }
  確定違規: number
  無法確定: number
  違規清單: string[]
}

/**
 * 判定一顆元件。**純函式**——注入才餵得進合成輸入。
 *
 * @param 宣告的 `concepts.json` 裡 `children` 的鍵
 * @param 產出的 語料裡實際出現過的、非空的接點名；`null` = 語料沒碰到這顆
 */
export function 判定宣告完整性(conceptId: string, 宣告的: readonly string[], 產出的: readonly string[] | null): 判定 {
  if (產出的 === null) {
    return {
      conceptId,
      桶: '無法確定',
      未宣告: [],
      reason: '語料沒有碰到這顆元件——不知道它會產出什麼接點；判不出來不計入安全',
    }
  }
  const 未宣告 = 產出的.filter((k) => !宣告的.includes(k))
  if (!未宣告.length) {
    return { conceptId, 桶: '安全', 未宣告: [], reason: '產出的接點宣告裡都有' }
  }
  return {
    conceptId,
    桶: '確定違規',
    未宣告,
    reason:
      `lift 產出了接點 [${未宣告.join('、')}]，而宣告裡只有 [${宣告的.join('、') || '（空）'}]` +
      `——**宣告是三個消費者的輸入**（#29 的合成、完備性的合成、未來的共同測 harness），少一個接點它們會一起變瞎`,
  }
}

/**
 * 語料：掃測試檔裡的 C++ 片段。
 *
 * **自我維護**——測試長，語料就跟著長。手寫一份語料清單的話，
 * 新增的測試不會自動進來，而覆蓋率會安靜地退化。
 */
function 取語料(): string[] {
  const dir = path.join(REPO_ROOT, 'tests/integration')
  const out: string[] = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.test.ts')) continue
    const src = fs.readFileSync(path.join(dir, f), 'utf8')
    for (const m of src.matchAll(/`([^`]{4,400})`/g)) {
      const code = m[1]
      // 粗篩：看起來像 C++ 陳述或宣告的才留。
      if (!/[;{]/.test(code)) continue
      if (/\$\{/.test(code)) continue // 樣板插值，不是完整程式碼
      out.push(code)
    }
  }
  return out
}

/** 跑一段程式碼，回傳「每顆元件實際產出的非空接點」。健康檢查用。 */
export function 取實際產出(l: Lifter, p: Parser, code: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const 走 = (n: SemanticNode): void => {
    const 有值 = Object.keys(n.children ?? {}).filter((k) => (n.children[k] ?? []).length > 0)
    out.set(n.conceptId, [...new Set([...(out.get(n.conceptId) ?? []), ...有值])])
    for (const kids of Object.values(n.children ?? {})) for (const c of kids) 走(c)
  }
  const t = l.lift(p.parse(code)!.rootNode as never)
  if (t) 走(t)
  return out
}

let 快取: { 判定: 判定[]; 語料數: number; 碰到數: number } | null = null

function 量一次(lifter: Lifter, p: Parser): NonNullable<typeof 快取> {
  if (快取) return 快取
  const 宣告 = new Map(
    (allCppConcepts() as never as { conceptId: string; children?: Record<string, unknown> }[]).map((c) => [
      c.conceptId,
      Object.keys(c.children ?? {}),
    ]),
  )
  const 實際 = new Map<string, Set<string>>()
  const 走 = (n: SemanticNode): void => {
    if (!實際.has(n.conceptId)) 實際.set(n.conceptId, new Set())
    const s = 實際.get(n.conceptId)!
    for (const [k, kids] of Object.entries(n.children ?? {})) {
      if ((kids ?? []).length > 0) s.add(k)
    }
    for (const kids of Object.values(n.children ?? {})) for (const c of kids) 走(c)
  }
  const 語料 = 取語料()
  let 成功 = 0
  for (const code of 語料) {
    try {
      const t = lifter.lift(p.parse(code)!.rootNode as never)
      if (t) { 走(t); 成功++ }
    } catch { /* 解析不了的片段直接跳過——它們不是 C++ */ }
  }
  const 判定 = [...宣告.entries()].map(([id, decl]) =>
    判定宣告完整性(id, decl, 實際.has(id) ? [...實際.get(id)!] : null),
  )
  快取 = { 判定, 語料數: 成功, 碰到數: 實際.size }
  return 快取
}

let lifter: Lifter
let tsParser: Parser

describe('護欄：宣告完整性（lift 產出的接點，宣告裡有嗎）', () => {
  beforeAll(async () => {
    await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
    tsParser = new Parser()
    tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
    lifter = createTestLifter()
    registerCppLanguage()
  })

  // ── 健康檢查：錨在語料量，不在違規數 ────────────────────
  it('★ 健康檢查：語料與碰到的元件數不得為零', () => {
    const { 語料數, 碰到數 } = 量一次(lifter, tsParser)
    expect(語料數, '語料一段都沒 lift 成功 → 下面的「零違規」是假的').toBeGreaterThan(100)
    expect(碰到數, '一顆元件都沒碰到 → 同上').toBeGreaterThan(30)
  })

  it('★ 健康檢查：量測看得到 lift 的實際產出（不是只讀宣告）', () => {
    // ⚠️ **這一則的第一版錨錯了**，而錯法正是 `build-guardrail` 第 2 步記了
    // 五次的那個形狀——它斷言「`cpp:func_def` 必須在**違規清單**裡」，
    // 於是 `specs/106` 把那顆修好的當天，**這條健康檢查自己變紅**。
    //
    // 那是第六個實例，而且發生在**寫下那條規則的同一輪**。
    // 語法簽名擋得住散文擋不住的：斷言的數字若是這條護欄想推向零的，錨就錯了。
    //
    // 正確的錨是**不隨修復而改變的事實**：lift 對 `int f(int a)`
    // 產出的樹上，`cpp:func_def` 底下有一個非空的 `params` 接點。
    // 那句話在修好宣告之前與之後都成立——它證明的是「量測跑到了 lift 的
    // 實際產出」，而不是「缺陷還在」。
    const 實際 = 取實際產出(lifter, tsParser, 'int f(int a) { return a; }')
    expect(實際.get('cpp:func_def'), '量測沒看到 func_def 的 params 接點 → 它沒跑到 lift 的實際產出').toContain('params')
  })

  // ── 棘輪 ────────────────────────────────────────────────
  it('棘輪：確定違規與無法確定都只准下降', () => {
    const { 判定: 全部, 語料數, 碰到數 } = 量一次(lifter, tsParser)
    const 違規 = 全部.filter((d) => d.桶 === '確定違規')
    const 待查 = 全部.filter((d) => d.桶 === '無法確定')

    printReport(
      `宣告完整性：確定違規（語料 ${語料數} 段，碰到 ${碰到數} 顆）`,
      違規.map((d) => `  ✘ ${d.conceptId} — 產出 [${d.未宣告.join('、')}] 而宣告裡沒有`),
    )
    printReport(
      `宣告完整性：語料沒碰到（${待查.length} 顆，不計入安全）`,
      [`  ？ ${待查.slice(0, 10).map((d) => d.conceptId).join('、')}${待查.length > 10 ? ' …' : ''}`],
    )

    // ── 判定落點：逐筆說出「為什麼無法確定」 ────────────────
    const 判定檔 = path.join(REPO_ROOT, 'tests/assets/declared-slots-decisions.json')
    const 判定s: 無法確定判定[] = fs.existsSync(判定檔)
      ? (JSON.parse(fs.readFileSync(判定檔, 'utf8')) as 無法確定判定[])
      : []
    const 已判定 = new Map(判定s.map((d) => [d.conceptId, d]))
    const 要看 = 待查.filter((d) => !已判定.has(d.conceptId))
    const 孤兒 = 判定s.filter((d) => !待查.some((x) => x.conceptId === d.conceptId))
    const 依原因 = (r: 無法確定判定['原因']): number =>
      待查.filter((d) => 已判定.get(d.conceptId)?.原因 === r).length

    printReport('宣告完整性：「無法確定」的原因分佈', [
      `  辨識到不了     ${依原因('辨識到不了')} 顆 ← **真的缺口**（補語料也碰不到）`,
      `  宣告過的降級目標 ${依原因('宣告過的降級目標')} 顆   正確`,
      `  元概念         ${依原因('元概念')} 顆   正確`,
      `  語料沒覆蓋     ${依原因('語料沒覆蓋')} 顆   補語料就會動`,
      `  要看           ${要看.length} 顆`,
      '',
      '⚠️ 只看總數的話，「辨識到不了」與「語料沒覆蓋」讀起來一樣',
      '   ——而前者補再多語料也永遠碰不到。',
    ])

    if (process.env.GENERATE_BASELINE) {
      writeBaseline(GUARD, {
        _meta: {
          guard: GUARD,
          measuredAt: new Date().toISOString().slice(0, 10),
          rule:
            '跑 lift 在真實語料上（掃測試檔裡的 C++ 片段），比對「實際產出的非空接點」與「concepts.json 宣告的 children 鍵」。' +
            '⚠️ **是實測不是靜態掃描**——靜態掃 `createNode(` 看得到產生了什麼概念，' +
            '看不到它被掛在**哪個接點**下，而後者才是這條護欄要問的。' +
            '語料沒碰到的元件歸「無法確定」，**不計入安全**——那個數字是這條護欄的誠實度指標。',
          note: RATCHET_NOTE,
        },
        確定違規: 違規.length,
        無法確定: 待查.length,
        違規清單: 違規.map((d) => `${d.conceptId}: ${d.未宣告.join('、')}`).sort(),
      } satisfies Baseline)
    }

    const base = loadBaseline<Baseline>(GUARD)
    expect(要看.map((d) => d.conceptId), '有未判定的「無法確定」——它的原因要人說').toEqual([])
    expect(孤兒.map((d) => d.conceptId), '判定過期了——那顆已經不在「無法確定」裡了').toEqual([])
    expect(
      判定s.filter((d) => !d.reason || d.reason.length < 4),
      '沒有理由的判定是把「懶得看」寫成「看過了」',
    ).toHaveLength(0)
    assertRatchet([
      ['確定違規', 違規.length, base.確定違規],
      ['無法確定', 待查.length, base.無法確定],
    ])
  })

  // ── 注入：三個方向（第 8、9 步）─────────────────────────
  describe('注入', () => {
    it('(a) 壞的輸入會報：產出了宣告裡沒有的接點 → 確定違規', () => {
      const d = 判定宣告完整性('cpp:fake', ['condition'], ['condition', 'else_body'])
      expect(d.桶).toBe('確定違規')
      expect(d.未宣告).toEqual(['else_body'])
      // 釘**理由**不只釘結果（第 8 步）。
      expect(d.reason).toContain('lift 產出了接點')
      expect(d.reason).toContain('else_body')
      expect(d.reason).toContain('condition') // 理由要說得出「宣告裡有什麼」
    })

    it('(a2) 宣告是空的時候，理由要說得出「（空）」而不是空白', () => {
      // `cpp:func_call` 就是這種——宣告零個接點卻有 `args`。
      // 理由印成 `宣告裡只有 []` 的話，讀的人分不出「沒宣告」與「渲染壞了」。
      const d = 判定宣告完整性('cpp:fake', [], ['args'])
      expect(d.reason).toContain('（空）')
    })

    it('(b) 好的輸入不亂報：產出的接點宣告裡都有 → 安全', () => {
      // 不可省。沒有它，一個「什麼都報」的判定器也能通過 (a)。
      const d = 判定宣告完整性('cpp:fake', ['condition', 'then_body'], ['condition', 'then_body'])
      expect(d.桶).toBe('安全')
      expect(d.reason).toBe('產出的接點宣告裡都有')
    })

    it('(b2) 好的輸入不亂報：宣告比產出多不算違規', () => {
      // 宣告了但語料沒觸發的接點**不是**這條護欄的事（見「不檢測什麼」）。
      const d = 判定宣告完整性('cpp:fake', ['a', 'b', 'c'], ['a'])
      expect(d.桶).toBe('安全')
    })

    it('(c) 判不出來的不計入安全：語料沒碰到 → 無法確定', () => {
      const d = 判定宣告完整性('cpp:fake', ['a'], null)
      expect(d.桶).toBe('無法確定')
      expect(d.reason).toContain('不計入安全')
      // ⚠️ 特別釘：**沒碰到不得被判成安全**。這是最容易寫錯的一格
      // ——`[]` 與 `null` 差一個字元，而前者會讓沒測到的元件全部變綠。
      expect(判定宣告完整性('cpp:fake', ['a'], []).桶).toBe('安全')
    })

    it('★ 語料抓得到真的 C++ 片段，而不是抓到一堆雜訊', () => {
      // 第 10 步：測試通過之前，先證明它真的測到了東西。
      const 語料 = 取語料()
      expect(語料.length).toBeGreaterThan(100)
      expect(語料.some((c) => /\bint\s+\w+\s*\(/.test(c)), '語料裡一個函式定義都沒有').toBe(true)
    })
  })
})
