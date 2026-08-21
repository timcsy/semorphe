/**
 * **第三十三條護欄：靜默回退**——執行器遇到處理不了的輸入時，有沒有出聲。
 *
 * ## 它量什麼
 *
 * ```ts
 * if (arr.type !== 'array' || !Array.isArray(arr.value)) {
 *   return { type: 'int', value: 0 }        // ← 這個
 * }
 * ```
 *
 * 「這個容器是空的」與「**這根本不是容器**」在輸出上一模一樣。
 * 而 `components/執行機構.md` 早就給這個形狀命名了：
 *
 * > 「**靜默降級反模式**——多層 fallback 都用同一個預設值 `'x'`，
 * > 於是資料遺失和正常路徑長得一樣」
 *
 * ## ⚠️ 它為什麼值得一條護欄：它讓**別的**缺陷看不見
 *
 * 觸發本護欄的實例（`specs/110`）：`s.size()` 在字串上被辨識成
 * `cpp:vector_size`（身分錯），而 `vector_size` 對非陣列回 0
 * ——於是 `for (int i = 0; i < s.size(); i++)` **一次都不跑**，
 * 字串原樣輸出，而**沒有任何地方說出錯了**。
 *
 * **辨識的錯躲在執行的回退後面躲了很久。**
 *
 * ## 本護欄不檢測什麼
 *
 * - **不判定哪一筆是錯的。** 合法的預設值與靜默回退在**語法上一模一樣**
 *   （`strcmp` 相等時回 0 是語義，不是回退）。
 *   → 第 6 步：**靜態判斷只能排順序，不能下結論。**
 *   判定的落點是 `tests/assets/silent-fallback-decisions.json`，每筆要有理由。
 * - **不檢測回退之外的靜默失敗**（吞例外、回 `null`）——另一個維度。
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * > **如果「掃到的執行器檔數」或「掃到的 return 總數」是 0，
 * > 代表工具壞了，不是世界長這樣。**
 *
 * 錨在**掃描的輸入量**上，不錨在回退筆數——後者正是這條護欄要推向零的東西，
 * 錨在它上面的健康檢查**會在成功的那天變紅**（`build-guardrail` 第 2 步，
 * 已經犯過七次的形狀）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, loadBaseline, writeBaseline, printReport, assertRatchet, assertCorpus, RATCHET_NOTE, decisionKey } from '../helpers/guardrail'

const GUARD_NAME = 'silent-fallback'
const decisionFile = path.join(REPO_ROOT, 'tests/assets/silent-fallback-decisions.json')

/**
 * 回退的**兩種形狀**——而它們的發生時機根本不同（`specs/111` 實測）。
 *
 * ```
 * 型別不符   if (x.type !== 'array')       上游辨識判錯身分時發生   ← 415 段語料裡**會**發生
 * 缺子節點   if (!v) / (nodes.length === 0) 語義樹本身壞掉時發生     ← 實測 **0 次**
 * ```
 *
 * `specs/110` 把兩者混成一個數字並全部判為「靜默回退」，於是基線的 8 筆
 * **全部是死分支**。一條數字永遠不動的棘輪，與一條沒有人跑的護欄是同一件事。
 *
 * ⚠️ 分不出來的歸 `未分類` 並**計入要看**——不得靜靜歸進防禦欄
 * （`build-guardrail` 第 5 步：判不出來就說判不出來，且不計入安全）。
 */
type shape = '型別不符' | '缺子節點' | '值判斷' | '失敗傳遞' | '未分類'

interface hits {
  /**
   * 識別碼。
   *
   * ⚠️ **第一版用 `檔:行號`，而行號會漂移**——`specs/113` 把一顆元件搬進膠囊、
   * 從 `cctype/executors.ts` 刪掉一行，底下每一筆的行號全部 −1，
   * 於是**所有判定同時變成孤兒，而程式碼一個字都沒改**。
   *
   * 這與「截斷的鍵會碰撞」是同一族：**識別碼必須識別得出那個東西**。
   * 行號識別的是**位置**，不是東西。
   * → 同一個處方：**顯示與識別分開**——`檔名#條件的雜湊`。
   */
  key: string
  position: string
  condition: string
  returns: string
  shape: shape
}


/** 依條件的語法形狀分類。**新的寫法會落到「未分類」而不是被默許。** */
function classify(condition: string): shape {
  if (/\.type\s*[!=]==|typeof\s|instanceof\s|!Array\.isArray|Array\.isArray/.test(condition)) return '型別不符'
  // ⚠️ **第四種形狀**（2026-08-21，`cin` 的 `failbit` 落地之後才出現）：
  // 條件讀的是**一個已經記錄下來的失敗**，不是「東西在不在」。
  //
  // > **「前一步失敗了」與「東西不見了」在語法上都是一個 if，
  // > 而只有後者是防禦性的——前者是那個失敗被【傳下去】。**
  //
  // 它必須排在「缺子節點」**前面**：`!got.ok` 會被 `^!\w` 先吃掉，
  // 而那會把一筆失敗傳遞記成防禦性的退路。
  // ⚠️ 這條規則寫成「失敗旗標」而不是變數名——比對過既有 24 筆命中，命中 0 筆。
  if (/[Ff]ail(ed)?\b|\.ok\b/.test(condition)) return '失敗傳遞'
  if (/^!\w|\.length\s*===\s*0|\.length\s*<\s*1|=== undefined|== null|!\w+\?\./.test(condition)) return '缺子節點'
  // ⚠️ **第三種形狀**（2026-08-11，掃描範圍擴大到共用執行器之後才出現）：
  // 分支條件是**執行期的值**，不是「東西在不在」。`ctx.toBool(condition)`
  // 是三元運算子的兩個分支、`!ctx.toBool(left)` 是 `&&` 的短路——
  // **那是運算子的語義本身，不是檢查失敗後的退路。**
  //
  // 它需要自己一欄而不是塞進既有兩欄：`相容` 表讓「值判斷」判成
  // 「缺子節點」時會矛盾出聲。
  if (/ctx\.toBool\(|\.toBool\(/.test(condition)) return '值判斷'
  return '未分類'
}

/**
 * 人的判定。
 *
 * ⚠️ **值域在 `specs/111` 分欄之後補了第三個值**：原本只有
 * `合法 | 靜默回退`，而分欄之後那 8 筆缺子節點**兩個都不是**——
 * 它們不合法（回 0 確實掩蓋資訊），但也不是待修的缺陷（實測 0 次觸發）。
 *
 * 少了這個值的後果是**判定檔與護欄互相矛盾**：判定檔寫「8 筆靜默回退」
 * 讀起來是 8 個缺陷，而護欄刻意把它們排除在棘輪外。
 * **兩份紀錄對同一批東西給出不同的說法，而沒有任何地方會叫。**
 */
interface decision {
  key: string
  position: string
  signal: string
  decision: '合法' | '靜默回退' | '防禦性'
  reason: string
}

/** 判定與機器分類的對應關係——**兩者不得互相矛盾**。 */
// ⚠️ **鍵要寫成字串字面值。** 這些中文是 `shape` 這個型別的**值**
// （領域詞彙），不是識別字——寫成 `型別不符: [...]` 的話 TS 把它當
// identifier，於是改名工具會改它，而 `shape` 那一側的字串不會跟著改。
//
// > **同一個詞在型別的值與物件的鍵上，只有寫法決定它是不是識別字。**
const compatible: Record<shape, decision['decision'][]> = {
  '型別不符': ['靜默回退', '合法'],
  '缺子節點': ['防禦性', '合法'],
  // 值判斷不會是「防禦性」——它不是在防什麼，它就是那個運算子在做的事。
  '值判斷': ['合法', '靜默回退'],
  // 失敗傳遞**只可能是合法**：那個失敗已經被記下來了，而回傳值帶著
  // 一個明說的失敗欄位。它既不是在防什麼，也沒有把失敗偽裝成合法結果。
  '失敗傳遞': ['合法'],
  '未分類': ['靜默回退', '合法', '防禦性'],
}

interface Baseline {
  _meta: { note: string; ratchet: string }
  scanned: { fileCount: number; "return 總數": number }
  hits: { entryCount: number; details: hits[] }
}

/** 執行器檔案——語言套件與核心的執行那一路。 */
function executorFiles(): string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      // ⚠️ **檔名也要跟著膠囊走。** 共用檔叫 `executors.ts`，膠囊的叫 `execute.ts`
      // ——只認前者的話，搬進膠囊的執行器**整批從掃描裡消失**，
      // 而「掃到的 return 數」會安靜地掉下去。這是「掃描範圍沒跟著走」的第二面：
      // **目錄跟上了，檔名沒跟上。**
      // ⚠️ **檔名規則漏掉了共用執行器**（2026-08-11 補）。
      //
      // `src/languages/cpp/core/executors/` 底下 14 個檔叫 `operators.ts`、
      // `arrays.ts`、`containers.ts`……**一個都不叫 `executors.ts`**
      // ——於是這條護欄從落地起就沒掃過它們。
      //
      // 發現的方式是搬家：五顆轉型元件的執行器**一個字都沒改**地從
      // `operators.ts` 搬進膠囊，護欄立刻多報 5 筆。
      //
      // > **一個「按檔名認人」的規則，會漏掉所有沒照那個命名的地方——
      // > 而它報零的樣子與健康的完全一樣。**
      //
      // 改成：**住在 `executors/` 目錄裡的都算**，加上檔名規則（膠囊沒有那個目錄）。
      else if (/^(executors?|execute)\.ts$/.test(e.name) || /[/\\]executors[/\\][^/\\]+\.ts$/.test(p)) {
        if (!/[/\\]index\.ts$/.test(p)) out.push(p)
      }
    }
  }
  walk(path.join(REPO_ROOT, 'src/languages'))
  walk(path.join(REPO_ROOT, 'src/interpreter'))
  // ⚠️ **膠囊也要掃。**
  //
  // 2026-08-11 發現：這條護欄只掃 `src/languages` 與 `src/interpreter`，
  // 於是**一顆元件搬進 `src/components/` 之後，它的靜默回退就從視野裡消失**
  // ——判定變成孤兒，而數字下降看起來像「修好了」。
  //
  // > **膠囊化會讓元件離開所有「按舊目錄結構」寫死的護欄。**
  // > 每搬一批就要問一次：**哪條護欄的掃描範圍沒跟著走？**
  walk(path.join(REPO_ROOT, 'src/components'))
  return out
}

/**
 * 找「檢查失敗後回傳預設值」。
 *
 * ⚠️ **判準刻意寬**——寧可多報讓人判，也不要自己發明一個分得出合法與回退的
 * 規則。`build-guardrail` 第 5 步：判不出來就說判不出來，且不計入安全。
 */
function scan(files: readonly string[]): { hits: hits[]; "return 總數": number } {
  const hits: hits[] = []
  let total = 0
  const defaultValue = /value:\s*(0|''|""|false|null|\[\]|\{\})\s*[,}]/
  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split('\n')
    const rel = path.relative(REPO_ROOT, f)
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (!/\breturn\b/.test(l) || !/value:/.test(l)) continue
      total++
      if (!defaultValue.test(l)) continue
      // 條件：同一行的 `if (…) return`，或往上找最近的 `if (`
      let condition = ''
      const sameLine = /if\s*\((.+?)\)\s*return/.exec(l)
      if (sameLine) condition = sameLine[1]
      else {
        for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
          // ⚠️ **跳過「單行 `if (…) return …`」**。它是一個完整的敘述，
          // **不是包住這一行的條件**——把它當條件會抓出一段語法上不成立的字串
          // （`targetScope) return targetScope.get(targetName)`），
          // 然後那段字串分類不了，於是一個**無條件的尾端 return**
          // 被誤報成有條件的回退。
          if (/if\s*\(.*\)\s*return\b/.test(lines[j])) continue
          const m = /if\s*\((.+?)\)\s*\{?\s*$/.exec(lines[j])
          if (m) { condition = m[1]; break }
        }
      }
      if (!condition) continue // 無條件的回傳不是回退
      const c = condition.trim().slice(0, 80)
      const ret = l.trim().slice(0, 60)
      hits.push({
        key: decisionKey(rel, c + '|' + ret),
        position: `${rel}:${i + 1}`,
        condition: c,
        returns: ret,
        shape: classify(c),
      })
    }
  }
  return { hits, "return 總數": total }
}

const readDecisions = (): decision[] =>
  fs.existsSync(decisionFile) ? (JSON.parse(fs.readFileSync(decisionFile, 'utf8')) as decision[]) : []

describe('第三十三條護欄：靜默回退', () => {
  // ── 健康檢查：錨在掃描的輸入量（合成量），不錨在命中數 ─────────────
  it('★ 健康檢查：掃描真的吃到東西', () => {
    const files = executorFiles()
    expect(files.length, '一個執行器檔都沒掃到 → 量測壞了，不是世界長這樣').toBeGreaterThan(10)
    const returnTotal = scan(files)["return 總數"]
    expect(returnTotal, '一個帶 value 的 return 都沒有 → 掃描器沒吃到內容').toBeGreaterThan(20)
  })

  // ── 雙向注入 ────────────────────────────────────────────────────
  it('★ 注入①：檢查失敗後回預設值必須被報出', () => {
    const tmp = path.join(REPO_ROOT, 'tests/assets/_inject-fallback-executors.ts')
    fs.writeFileSync(tmp, `export const x = () => {\n  if (v.type !== 'array') return { type: 'int', value: 0 }\n  return { type: 'int', value: v.length }\n}\n`)
    try {
      const { hits } = scan([tmp])
      expect(hits, '故意寫的回退沒被報 → 這條護欄什麼都抓不到').toHaveLength(1)
      expect(hits[0].condition).toContain("!== 'array'")
    } finally {
      fs.rmSync(tmp, { force: true })
    }
  })

  it('★ 注入②：無條件的回傳不得被誤報', () => {
    // 沒有這一支，一個「凡是 value: 0 都報」的掃描器也會通過注入①。
    const tmp = path.join(REPO_ROOT, 'tests/assets/_inject-clean-executors.ts')
    fs.writeFileSync(tmp, `export const x = () => {\n  return { type: 'int', value: 0 }\n}\n`)
    try {
      expect(scan([tmp]).hits, '無條件回 0 是正常的初始值，報它會讓這條護欄失去意義').toHaveLength(0)
    } finally {
      fs.rmSync(tmp, { force: true })
    }
  })

  it('★ 注入③：兩種形狀要分得開，而認不得的條件要落到「未分類」', () => {
    // 沒有這一支，一個「什麼都歸缺子節點」的分類器也會讓棘輪永遠是 0。
    expect(classify("arr.type !== 'array'")).toBe('型別不符')
    expect(classify('!Array.isArray(v.value)')).toBe('型別不符')
    expect(classify('!v')).toBe('缺子節點')
    expect(classify('valueNodes.length === 0')).toBe('缺子節點')
    // ⚠️ 認不得的**不得**被默許歸進防禦欄——那會讓一個會發生的回退靜靜消失
    // 🔴 失敗傳遞要排在缺子節點**前面**——`!got.ok` 開頭就是 `!\w`
    expect(classify('!got.ok')).toBe('失敗傳遞')
    expect(classify('ctx.cinFailed')).toBe('失敗傳遞')
    expect(classify('someWeirdPredicate(x)')).toBe('未分類')
  })

  it('★ 注入④：人的判定與機器分類矛盾時必須被抓到', () => {
    // 沒有這一支，那條矛盾斷言可能永遠是空陣列而沒有人知道它有沒有在看。
    // ⚠️ 用**合成的**組合，不用真實的判定檔——真實的今天是相容的，
    // 錨在它上面等於錨在「現況剛好沒事」上（第 2 步）。
    expect(compatible['缺子節點'].includes('靜默回退'), '缺子節點判成靜默回退應該是矛盾').toBe(false)
    expect(compatible['型別不符'].includes('防禦性'), '型別不符判成防禦性應該是矛盾').toBe(false)
    // 而合法在哪一欄都成立——strcmp 相等回 0 可能出現在任何形狀底下
    expect(compatible['缺子節點'].includes('合法')).toBe(true)
    expect(compatible['型別不符'].includes('合法')).toBe(true)
    expect(compatible['失敗傳遞'].includes('防禦性'), '失敗傳遞判成防禦性應該是矛盾').toBe(false)
  })

  // ── 判定落點（第 11 步） ────────────────────────────────────────
  it('每一筆判定必須有理由，且判定不得過期', () => {
    const now = scan(executorFiles()).hits
    const decisions = readDecisions()
    const orphans = decisions.filter((d) => !now.some((h) => h.key === d.key))
    expect(
      decisions.filter((d) => !d.reason || d.reason.length < 4),
      '沒有理由的判定是把「懶得看」寫成「看過了」',
    ).toHaveLength(0)
    expect(orphans.map((d) => d.key), '判定過期了——底下的程式碼變了，留著會讓過期的結論繼續生效').toEqual([])
  })

  // ── 棘輪 ────────────────────────────────────────────────────────
  it('靜默回退只准下降', () => {
    const files = executorFiles()
    const scanResult = scan(files)
    const hits = scanResult.hits
    const returnTotal = scanResult["return 總數"]
    const decisions = readDecisions()
    const decided = new Map(decisions.map((d) => [d.key, d]))
    const toReview = hits.filter((h) => !decided.has(h.key))
    const typeMismatch = hits.filter((h) => h.shape === '型別不符')
    const missingChild = hits.filter((h) => h.shape === '缺子節點')
    const unclassified = hits.filter((h) => h.shape === '未分類')

    printReport('靜默回退（執行器遇到處理不了的輸入時有沒有出聲）', [
      `掃描   ${files.length} 個執行器檔｜${returnTotal} 個帶 value 的 return`,
      `命中   ${hits.length}（已判定 ${hits.length - toReview.length}，要看 ${toReview.length}）`,
      '',
      `  **型別不符** ${typeMismatch.length} 筆 ← 棘輪盯這一欄（上游辨識判錯時**會**走到）`,
      `  缺子節點   ${missingChild.length} 筆   防禦性；415 段語料實測走到 **0** 次`,
      `  失敗傳遞   ${hits.filter((h) => h.shape === '失敗傳遞').length} 筆   前一步的失敗被傳下去，帶著明說的失敗欄位`,
      `  未分類     ${unclassified.length} 筆   ⚠️ 新的條件寫法，要人看`,
      '',
      ...toReview.map((h, i) => `  ${i + 1}. ${h.position}\n       if (${h.condition})\n       ${h.returns}`),
      '',
      '⚠️ 合法與回退在語法上一模一樣（strcmp 相等回 0 是語義不是回退）——',
      '   本護欄只排順序，判定在 tests/assets/silent-fallback-decisions.json。',
    ])

    if (process.env.GENERATE_BASELINE) {
      writeBaseline(GUARD_NAME, {
        _meta: {
          note:
            '靜默回退：執行器遇到處理不了的輸入時回傳一個與合法結果無法區分的預設值。\n' +
            '⚠️ 它的危害不只是自己錯，是**讓別的缺陷看不見**——觸發本護欄的實例是\n' +
            '`s.size()` 被辨識成 cpp:vector_size（身分錯），而 vector_size 對非陣列回 0，\n' +
            '於是 `for (i=0; i<s.size(); i++)` 一次都不跑而沒有任何訊號。辨識的錯躲在執行的回退後面。\n' +
            '⚠️ 棘輪盯的是**判為「靜默回退」的筆數**，不是命中總數——命中裡有合法的\n' +
            '（strcmp 相等回 0 是語義）。只盯總數的話，把一筆改判成「合法」就能讓數字下降。\n' +
            '⚠️ 判準刻意寬：寧可多報讓人判，也不要發明一個分得出合法與回退的規則——它們語法上相同。',
          ratchet: RATCHET_NOTE,
        },
        scanned: { fileCount: files.length, 'return 總數': returnTotal },
        typeMismatch: typeMismatch.length,
        missingChild: missingChild.length,
        hits: { entryCount: hits.length, details: hits },
      })
      return
    }

    const base = loadBaseline<Baseline>(GUARD_NAME)
    const b = base as unknown as { typeMismatch?: number; missingChild?: number }
    expect(toReview, '有未判定的命中——護欄只排順序，判定要人做').toHaveLength(0)
    expect(unclassified.map((h) => `${h.position} if(${h.condition})`), '出現了分類器認不得的條件寫法——不得靜靜歸進防禦欄').toEqual([])

    // ⚠️ **人的判定與機器的分類不得互相矛盾。**
    // 兩份紀錄對同一批東西給出不同的說法時，讀哪一份決定你以為有幾個缺陷
    // ——而沒有這條斷言的話，它們會安靜地各說各話。
    const contradictions = hits
      .map((h) => ({ h, d: decided.get(h.key) }))
      .filter(({ h, d }) => d && !compatible[h.shape].includes(d.decision))
      .map(({ h, d }) => `${h.position}：機器判「${h.shape}」而人判「${d!.decision}」`)
    expect(contradictions, '判定檔與護欄對同一筆的說法不一致——讀哪一份決定你以為有幾個缺陷').toEqual([])
    expect(
      typeMismatch.length + missingChild.length,
      '兩欄總和變了。只做重新分類時總和必須不變——變了代表真的多了或少了一處回退。',
    ).toBe((b.typeMismatch ?? 0) + (b.missingChild ?? 0))
    assertCorpus([
      ['掃描檔數', files.length, base.scanned.fileCount],
      ['帶 value 的 return', returnTotal, base.scanned['return 總數']],
    ])
    assertRatchet([['型別不符', typeMismatch.length, b.typeMismatch ?? 0]])
  })
})
