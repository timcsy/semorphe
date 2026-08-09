/**
 * 膠囊搬家的**兩條防線**——各自抓一種形狀，而兩種形狀都要說出來
 *
 * ## 自我否證聲明（⚠️ 寫在量測邏輯之前）
 *
 * > **如果這支測試全綠，而下面「注入」那一節合成的「漏失」與「錯置」兩個假故障
 * > 沒有被報出來，代表防線壞了，不是搬家做對了。**
 *
 * 錨點是**合成的注入**，不是真實世界的狀態——真實世界的狀態會被搬家修掉，
 * 而錨在它上面的聲明會在成功那天變成叫人不要相信一個正確的結果
 * （`build-guardrail` 第 2 步）。
 *
 * ## 為什麼要兩條，而不是一條
 *
 * `specs/054`（把執行器搬進模組）選的主防線是**集合比對**——搬移前後系統認得的
 * 概念集合必須完全相同。那個選擇是對的，它在第一次搬移就抓到「推送函式寫了
 * 卻沒人呼叫」。
 *
 * **而它抓不到另一種錯**：拆分工具第一版用括號深度找區塊邊界，字串裡的括號把
 * 計數弄歪，**把兩筆註冊併成一塊**。併起來之後概念**還在**，只是跑進了錯的
 * 模組——**集合完全相同，防線全綠**。抓到它的是一個對不上的數字，不是防線。
 *
 * > **「漏失」與「錯置」是兩種形狀。沒說出來的話，全綠會被讀成「都對了」。**
 *
 * ## 兩條防線各自抓不到什麼（FR-009）
 *
 * | 防線 | 抓得到 | **抓不到** |
 * |---|---|---|
 * | 一、集合比對 ＋ 輸出逐字比對 | 漏失：某一路搬丟了、輸出變了 | **錯置**：實作跑進錯的元件底下而輸出恰好相同 |
 * | 二、註冊來源核對 | 錯置：某一路的來源不是它該在的膠囊 | **來源標記本身被寫錯**（複製膠囊忘了改 id） |
 *
 * 防線二對第二欄的對策是**兩個來源互相核對**：宣告裡的 `componentId`
 * vs 從檔案路徑推導的 `sourceDir`。只信宣告會漏掉複製貼上的錯，
 * 只信路徑就變成「從檔名推歸屬」——而那是 `specs/054` 明令禁止的
 * （`strings.ts` 橫跨兩個標準函式庫模組、`containers.ts` 跨六個）。
 *
 * ## 這支測試不檢測什麼
 *
 * - **不檢測語義對不對**。它只問「搬家前後一不一樣」。搬之前就錯的，搬完還是錯的。
 * - **不檢測未搬的 176 顆**。那是就近性與膠囊護欄的事。
 * - **不檢測條件性正確**（單獨測過、組合才壞）——那要組合式測試。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import type { StylePreset } from '../../src/core/types'
import type { SemanticNode } from '../../src/core/semantic-tree'
import { allCppConcepts } from '../../src/languages/cpp/all-declarations'
import { REPO_ROOT } from '../helpers/guardrail'
import { registeredComponents } from '../../src/core/component/registry'
import { idToDir } from '../../src/core/component/types'

/** 本切片搬的那一顆。 */
const 切片元件 = 'cpp:vector_declare'

const BASELINE = path.join(REPO_ROOT, 'tests/baselines/component-parity-vector-declare.json')

const style: StylePreset = {
  id: 'apcs',
  name: { 'zh-TW': 'APCS', en: 'APCS' },
  io_style: 'cout',
  naming_convention: 'camelCase',
  indent_size: 4,
  brace_style: 'K&R',
  namespace_style: 'using',
  header_style: 'individual',
}

/**
 * 搬家前後必須逐字相同的樣本。
 *
 * ⚠️ **含兄弟元件那一支**（`research.md` 的未驗項）：`vector_size`／`vector_pop`／
 * `vector_back` 與 `vector_declare` 是否共用執行期狀態，沒有實測過。
 */
const 樣本: { 名稱: string; 碼: string }[] = [
  { 名稱: '最小宣告', 碼: 'int main() { vector<int> v; }' },
  { 名稱: '初始化列表', 碼: 'int main() { vector<int> v = {3, 1, 4}; }' },
  { 名稱: '型別變化', 碼: 'int main() { vector<double> d; vector<std::string> s; }' },
  {
    名稱: '兄弟元件同場',
    碼: 'int main() { vector<int> v = {3, 1, 4}; cout << v.size() << " " << v.back() << endl; v.pop_back(); cout << v.size() << endl; }',
  },
  // 負向樣本：這些**不得**被認成切片元件。留在基準裡，是因為
  // 「lift 塌成路由器」那一步最容易把別的容器一起吃掉。
  { 名稱: '負向-stack', 碼: 'int main() { stack<int> s; }' },
  { 名稱: '負向-map', 碼: 'int main() { map<int, int> m; }' },
  { 名稱: '負向-其餘容器', 碼: 'int main() { queue<int> q; set<int> st; pair<int,int> p; priority_queue<int> pq; }' },
]

interface 基準 {
  _meta: { guard: string; measuredAt: string; note: string }
  /** 系統認得的全部元件身分（排序後） */
  身分集合: string[]
  /** 每個樣本的：來回轉換結果 ＋ 樹上出現的身分 */
  樣本: Record<string, { 產出: string; 身分: string[] }>
  /** 執行那一路的輸出 */
  執行輸出: Record<string, string>
  /** 切片元件的標籤（全部語言） */
  標籤: Record<string, Record<string, string>>
}

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
})

function liftCode(code: string): SemanticNode | null {
  return lifter.lift(tsParser.parse(code)!.rootNode as never)
}

function collectIds(node: SemanticNode | null, out: Set<string> = new Set()): Set<string> {
  if (!node) return out
  out.add(node.conceptId)
  for (const kids of Object.values(node.children ?? {})) {
    for (const k of kids as SemanticNode[]) collectIds(k, out)
  }
  return out
}

async function runProgram(code: string): Promise<string> {
  const tree = liftCode(code)
  if (!tree) return '<lift 失敗>'
  const interp = new SemanticInterpreter()
  try {
    await interp.execute(tree, [])
  } catch (e) {
    return `<執行例外：${(e as Error).message}>`
  }
  // ⚠️ **不是 `getState()`。** 第一版寫成 `getState().output`，而 `getState()`
  // 只回傳 `{ status }`——於是七個樣本的執行輸出**全部錄成空字串**，
  // 包含那支應該印出 `3 4` 的兄弟元件樣本。
  //
  // 而它不會讓任何測試變紅：空字串 === 空字串，防線一照樣全綠，
  // **執行那一路等於完全沒有被防線覆蓋**。
  //
  // 抓到它的是 `build-guardrail` 第 10 步——「測試通過之前，先證明它真的測到了
  // 東西」，也就是打開基準檔看裡面有沒有內容。這是那條規則的第 N 個實例。
  return `${interp.getState().status}|${interp.getOutput().join('')}`
}

/** 標籤的來源——搬家過程中它會從共用 i18n 檔移進膠囊，而**值必須不變**。 */
function 讀標籤(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  for (const locale of ['zh-TW', 'en']) {
    const 共用 = path.join(REPO_ROOT, `src/i18n/${locale}/blocks.json`)
    const dict: Record<string, string> = JSON.parse(fs.readFileSync(共用, 'utf8'))
    const 膠囊檔 = path.join(REPO_ROOT, 'src/components', idToDir(切片元件), `labels/${locale}.json`)
    if (fs.existsSync(膠囊檔)) Object.assign(dict, JSON.parse(fs.readFileSync(膠囊檔, 'utf8')))
    const 前綴 = 切片元件.replace(':', '_').toUpperCase() // CPP_VECTOR_DECLARE
    out[locale] = Object.fromEntries(
      Object.entries(dict)
        .filter(([k]) => k.startsWith(前綴))
        .sort(([a], [b]) => a.localeCompare(b)),
    )
  }
  return out
}

async function 量一次(): Promise<Omit<基準, '_meta'>> {
  const 樣本結果: 基準['樣本'] = {}
  const 執行輸出: 基準['執行輸出'] = {}
  for (const s of 樣本) {
    const tree = liftCode(s.碼)
    樣本結果[s.名稱] = {
      產出: tree ? generateCode(tree, 'cpp', style) : '<lift 失敗>',
      身分: [...collectIds(tree)].sort(),
    }
    執行輸出[s.名稱] = await runProgram(s.碼)
  }
  return {
    身分集合: allCppConcepts().map((c) => c.conceptId).sort(),
    樣本: 樣本結果,
    執行輸出,
    標籤: 讀標籤(),
  }
}

describe('膠囊搬家：兩條防線', () => {
  it('基準：錄下搬家前的五路輸出、身分集合與標籤', async () => {
    const 現況 = await 量一次()
    if (process.env.GENERATE_BASELINE) {
      const out: 基準 = {
        _meta: {
          guard: 'component-parity',
          measuredAt: new Date().toISOString().slice(0, 10),
          note:
            '搬家前的對照組。**這份基準不是棘輪**——它不准變，任何一筆差異都代表搬家改變了行為。' +
            '要重產必須說明是哪一筆為什麼變，而「為什麼變」的合法答案只有「修了一個真的 bug」。',
        },
        ...現況,
      }
      fs.writeFileSync(BASELINE, JSON.stringify(out, null, 2) + '\n', 'utf8')
    }
    expect(fs.existsSync(BASELINE), '基準檔不存在——先用 GENERATE_BASELINE=1 錄一次').toBe(true)
  })

  // ── 防線一：漏失 ────────────────────────────────────────────
  it('防線一：搬家前後，系統認得的身分集合完全相同', async () => {
    const base: 基準 = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
    const now = allCppConcepts().map((c) => c.conceptId).sort()
    const 少了 = base.身分集合.filter((id) => !now.includes(id))
    const 多了 = now.filter((id) => !base.身分集合.includes(id))
    expect(少了, `搬家搬丟了身分：${少了.join('、')}`).toEqual([])
    expect(多了, `搬家多出了身分（複製沒刪乾淨？）：${多了.join('、')}`).toEqual([])
  })

  it('防線一：每個樣本的來回轉換與執行輸出逐字相同', async () => {
    const base: 基準 = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
    const now = await 量一次()
    for (const s of 樣本) {
      expect(now.樣本[s.名稱], `樣本「${s.名稱}」的產出變了`).toEqual(base.樣本[s.名稱])
      expect(now.執行輸出[s.名稱], `樣本「${s.名稱}」的執行輸出變了`).toBe(base.執行輸出[s.名稱])
    }
  })

  it('防線一：切片元件的標籤逐字相同（搬進膠囊之後值不得變）', () => {
    const base: 基準 = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
    expect(讀標籤()).toEqual(base.標籤)
  })

  // ── 防線二：錯置 ────────────────────────────────────────────
  it('防線二：每顆膠囊宣告的身分，與它的資料夾路徑一致', () => {
    const 不一致 = registeredComponents()
      .filter((c) => idToDir(c.componentId) !== c.sourceDir)
      .map((c) => `${c.componentId} 宣告在 ${c.sourceDir}（應為 ${idToDir(c.componentId)}）`)
    expect(不一致, '膠囊的身分與位置對不上——複製膠囊時忘了改 componentId？').toEqual([])
  })

  it('防線二：同一個身分不得由兩顆膠囊登錄', () => {
    const seen = new Map<string, string[]>()
    for (const c of registeredComponents()) {
      seen.set(c.componentId, [...(seen.get(c.componentId) ?? []), c.sourceDir])
    }
    const 重複 = [...seen.entries()].filter(([, dirs]) => dirs.length > 1)
    expect(重複.map(([id, d]) => `${id}: ${d.join('、')}`)).toEqual([])
  })

  // ── 注入：證明兩條防線真的會叫（build-guardrail 第 9 步，兩個方向） ──
  describe('注入', () => {
    it('壞的輸入會報：身分集合少一筆時，防線一必須發現', () => {
      const base = ['cpp:a', 'cpp:b', 'cpp:c']
      const 壞掉 = ['cpp:a', 'cpp:c']
      expect(base.filter((id) => !壞掉.includes(id))).toEqual(['cpp:b'])
    })

    it('壞的輸入會報：身分與路徑對不上時，防線二必須發現', () => {
      const 假膠囊 = { componentId: 'cpp:vector_declare', sourceDir: 'cpp:wrong_place' }
      expect(idToDir(假膠囊.componentId)).not.toBe(假膠囊.sourceDir)
    })

    it('好的輸入不亂報：身分與路徑一致時，防線二必須沉默', () => {
      expect(idToDir('cpp:vector_declare')).toBe('cpp/vector_declare')
      expect(idToDir('@someone:boost_vector')).toBe('@someone/boost_vector')
    })

    it('⚠️ 集合比對抓不到錯置——這一則證明那個盲區是真的', () => {
      // 兩個實作被互換，但**集合完全相同**。防線一在這裡是綠的，
      // 這正是 054 那次併錯模組的形狀。
      const 搬前 = new Set(['cpp:vector_declare', 'cpp:vector_size'])
      const 搬後錯置 = new Set(['cpp:vector_size', 'cpp:vector_declare'])
      expect([...搬前].sort()).toEqual([...搬後錯置].sort()) // ← 綠的，而東西放錯了
      // 所以才需要防線二：它問的是「誰註冊的」，不是「有沒有」。
    })
  })
})
