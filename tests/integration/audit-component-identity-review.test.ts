/**
 * 元件身分健檢（第十八條護欄）
 *
 * 量：**181 顆元件裡，有幾顆的身分本身可疑**——該合併、該改層、該刪、或從來沒被驗過。
 *
 * ## 為什麼在膠囊之前蓋這一條
 *
 * **膠囊會固化身分。** 今天改一個 componentId 是一次 codemod（089 做過，131 檔／560 處）；
 * 膠囊之後，改身分＝搬資料夾 ＋ 改存檔 ＋ **通知社群**。一旦開放貢獻，第三方會引用你的 id，
 * 改名的成本從「我的問題」變成「所有人的問題」。
 *
 * 這是同一個病的第三次：
 *
 * > 「AI 元件管線把碎裂模板一起規模化」——管線放大**形狀**
 * > 膠囊固化**身分**
 *
 * **搬一顆身分錯的元件進膠囊，膠囊會忠實地保存那個錯。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * **這條護欄只排順序，不下結論。**（`build-guardrail` 第 6 步：「靜態判斷不能下結論，
 * 只能排順序」——這專案撞過一次靜態分類給出**反的**答案。）
 *
 * 判定分三桶：**確定**（結構上可證）／**要看**（信號成立但要實測）／乾淨。
 * **「要看」不算違規也不算安全。**
 *
 * 如果結果長成這樣，代表這條護欄壞了而不是世界長這樣：
 *
 * - **任一桶是 0**——181 顆元件不可能全部乾淨（`if_else` 已知是死概念），也不可能全部可疑
 * - **「從來沒被測試碰到」是 0**——那代表偵測沒接上，不是覆蓋率完美；
 *   這專案有過「五支通過是假的，被測概念根本沒進到樹裡」的前科
 *
 * ## 本護欄不檢測什麼
 *
 * **維度**：只看**宣告**（`concepts.json` 的欄位）與**名字的形狀**。
 * 不看實作品質、不看語義是否正確、不看形態長得好不好。
 * 一顆宣告完美而執行器全錯的元件，這裡是乾淨的。
 *
 * 範圍：不檢測 meta 概念（`raw_code` 等降級標記）是否該算元件——那要先定義「元件的邊界」。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { printReport, listSourceFiles, REPO_ROOT } from '../helpers/guardrail'
import { splitCodeAndComments, maskNonIdentityPositions, scanText } from '../helpers/component-scan'
import universalConcepts from '../../src/blocks/semantics/universal-concepts.json'
import { coreConcepts } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'

interface ConceptDef {
  conceptId: string
  layer?: string
  properties?: string[]
  children?: Record<string, unknown>
  role?: string
  skipPaths?: string[]
  skipReasons?: Record<string, string>
}

const ALL: ConceptDef[] = [
  ...(universalConcepts as unknown as ConceptDef[]).map((c) => ({ ...c, layer: c.layer ?? 'universal' })),
  ...(coreConcepts as unknown as ConceptDef[]).map((c) => ({ ...c, layer: c.layer ?? 'lang-core' })),
  ...allStdModules.flatMap((m) => (m.concepts as unknown as ConceptDef[]).map((c) => ({ ...c, layer: c.layer ?? 'lang-library' }))),
]
const IDS = ALL.map((c) => c.conceptId)
const BY_ID = new Map(ALL.map((c) => [c.conceptId, c]))

/**
 * 檔案分三類——**不分開的話有三個信號是結構上死的**。
 *
 * ⚠️ 第一版沒分，於是：
 * - 「零測試足跡」**全部沒中**，因為 `tests/baselines/*.json` 與 `tests/assets/*.json`
 *   **本身就列出每一顆元件**——那是清冊不是測試。
 * - 「標 universal 但只有語言側」**永遠不會中**，因為每顆通用元件的宣告都在
 *   `universal-concepts.json`（非 `languages/`），中立側永遠 ≥ 1。
 * - 「足跡極小」也幾乎不會中，因為任何元件至少出現在自己的 concepts.json ＋ blocks.json。
 *
 * **抓到第一個的是本檔的自我否證聲明**（「這個是 0 就代表偵測沒接上」），
 * 另外兩個是順著它推出來的。
 */
function classify(rel: string): '宣告' | '清單' | '實作' | '清冊' {
  if (/\/(concepts|blocks)\.json$/.test(rel) || /universal-(concepts|blocks)\.json$/.test(rel)) return '宣告'
  if (/\/(topics|templates)\//.test(rel) || /toolbox-categories\.ts$/.test(rel)) return '清單'
  if (/^tests\/(baselines|assets|reports)\//.test(rel)) return '清冊'
  return '實作'
}

function scanTree(dirs: readonly string[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const dir of dirs) {
    for (const rel of listSourceFiles(dir, ['.ts', '.json'])) {
      const raw = readFileSync(join(REPO_ROOT, rel), 'utf8')
      const hits = scanText(raw, IDS)
      if (hits.code.length > 0) out.set(rel, new Set(hits.code))
    }
  }
  return out
}

const srcFiles = scanTree(['src'])
const allTestFiles = scanTree(['tests'])
/** 真正的測試——**排除清冊**（基線與清單檔列出每一顆元件，那不是「被測到」） */
const testFiles = new Map([...allTestFiles].filter(([rel]) => classify(rel) !== '清冊'))
/** 實作足跡——排除宣告與清單（一顆元件的定義不是它的實作） */
const implFiles = new Map([...srcFiles].filter(([rel]) => classify(rel) === '實作'))

function footprint(map: Map<string, Set<string>>, id: string): string[] {
  const out: string[] = []
  for (const [rel, s] of map) if (s.has(id)) out.push(rel)
  return out
}

type Bucket = '確定' | '要看'
interface Finding { id: string; bucket: Bucket; signal: string; why: string }

const findings: Finding[] = []

// ── 信號 1：statement／expression 雙版本 ＝ 重複身分（結構上可證）
// 協定說 `role: 'statement' | 'expression'` 是**屬性**，所以同概念兩個 id 是雙重身分。
for (const c of ALL) {
  const base = c.conceptId.replace(/_expr$/, '')
  if (c.conceptId.endsWith('_expr') && BY_ID.has(base)) {
    findings.push({
      id: c.conceptId, bucket: '確定', signal: 'statement/expression 雙版本',
      why: `與 ${base} 是同一個概念的兩個位置。協定裡 role 是**屬性**，兩個 id 就是雙重身分`,
    })
  }
}

// ── 信號 2：宣告了 skipPaths（要逐條驗理由，history/018 的門檻）
for (const c of ALL) {
  for (const p of c.skipPaths ?? []) {
    const reason = c.skipReasons?.[p]
    findings.push({
      id: c.conceptId, bucket: '要看', signal: `skipPaths:${p}`,
      why: reason ? `理由「${reason}」——要驗它成不成立` : '**沒有理由**——history/018 的門檻直接不過',
    })
  }
}

// ── 信號 3：**實作**足跡極小 → 死概念或殼
// 用實作足跡而非總足跡：任何元件至少出現在自己的 concepts.json ＋ blocks.json，
// 用總足跡的話這個信號幾乎不可能中。
for (const c of ALL) {
  const n = footprint(implFiles, c.conceptId).length
  if (n <= 1) {
    findings.push({
      id: c.conceptId, bucket: '要看', signal: `實作足跡只有 ${n} 檔`,
      why: '不是死概念就是殼——兩者要用完全不同的方式處理',
    })
  }
}

// ── 信號 4：從來沒被測試碰到（**最重要的一條**）
for (const c of ALL) {
  if (footprint(testFiles, c.conceptId).length === 0) {
    findings.push({
      id: c.conceptId, bucket: '確定', signal: '零測試足跡',
      why: '沒有任何測試提到它。**它的五路是否真的работает，現在沒有人知道**',
    })
  }
}

// ── 信號 5：標 universal 卻只被單一語言引用（分層錯，059 的 comment 家族同型）
for (const c of ALL) {
  if (c.layer !== 'universal') continue
  // 用**實作**足跡——通用元件的宣告永遠在中立側，用總足跡的話這個信號結構上死的
  const files = footprint(implFiles, c.conceptId)
  const langFiles = files.filter((f) => f.startsWith('src/languages/'))
  const neutralFiles = files.filter((f) => !f.startsWith('src/languages/'))
  if (langFiles.length > 0 && neutralFiles.length === 0) {
    findings.push({
      id: c.conceptId, bucket: '確定', signal: '標 universal 但只有語言側實作',
      why: '通用層的元件不該只有一個語言認得它——059 的 comment 家族同型',
    })
  }
}

// ── 信號 6：同前綴族 ＋ 宣告幾乎相同 → 型別可能是參數而非身分
// 例：cpp_{vector,stack,queue,map,set,pair,string}_declare 九顆都是「宣告一個 T 的容器」
const declareFamily = ALL.filter((c) => /_declare$/.test(c.conceptId))
const sig = (c: ConceptDef): string =>
  JSON.stringify({ p: [...(c.properties ?? [])].sort(), ch: Object.keys(c.children ?? {}).sort(), r: c.role })
const bySig = new Map<string, string[]>()
for (const c of declareFamily) {
  const k = sig(c)
  if (!bySig.has(k)) bySig.set(k, [])
  bySig.get(k)!.push(c.conceptId)
}
for (const [, group] of bySig) {
  if (group.length < 3) continue
  for (const id of group) {
    findings.push({
      id, bucket: '要看', signal: `宣告與另外 ${group.length - 1} 顆完全相同`,
      why: `同組：${group.join('、')}。**型別是身分還是參數？** 反證：cpp_container_push 已經是共用的`,
    })
  }
}

// ── 信號 7：參數欠規格（全體，不是個別問題）
const withUntypedParams = ALL.filter((c) => (c.properties ?? []).length > 0)

const byBucket = (b: Bucket): Finding[] => findings.filter((f) => f.bucket === b)
const suspectIds = new Set(findings.map((f) => f.id))

describe('護欄：元件身分健檢（膠囊化之前）', () => {
  it('產出可讀報表', () => {
    const lines: string[] = [
      '⚠️ **這條護欄只排順序，不下結論。**「要看」不算違規也不算安全。',
      '本護欄只看**宣告**與**名字的形狀**，不看實作品質、不看語義對錯。',
      '',
      `元件 ${ALL.length} 顆｜可疑 ${suspectIds.size} 顆｜確定 ${byBucket('確定').length} 筆｜要看 ${byBucket('要看').length} 筆`,
      `參數欠規格：${withUntypedParams.length} 顆宣告了 properties，而型別側是 string[]（無型別／範圍／預設值）`,
      '',
    ]
    for (const b of ['確定', '要看'] as const) {
      const g = byBucket(b)
      lines.push(`── ${b}（${g.length} 筆）──`)
      const bySignal = new Map<string, Finding[]>()
      for (const f of g) {
        const k = f.signal.replace(/\d+/g, 'N')
        if (!bySignal.has(k)) bySignal.set(k, [])
        bySignal.get(k)!.push(f)
      }
      for (const [k, fs] of [...bySignal].sort((a, b2) => b2[1].length - a[1].length)) {
        lines.push(`  ${k}：${fs.length} 筆`)
        for (const f of fs.slice(0, 8)) lines.push(`     ${f.id} — ${f.why}`)
        if (fs.length > 8) lines.push(`     …另 ${fs.length - 8} 筆`)
      }
      lines.push('')
    }
    printReport('元件身分健檢（第十八條護欄）', lines)
    expect(ALL.length).toBeGreaterThan(0)
  })

  it('★ 三個桶都不是空的——任一為 0 代表偵測沒接上', () => {
    expect(ALL.length - suspectIds.size, '全部可疑 → 信號太寬').toBeGreaterThan(0)
    expect(byBucket('確定').length, '確定桶是空的 → if_else 那類死概念沒被抓到').toBeGreaterThan(0)
    expect(byBucket('要看').length, '要看桶是空的 → skipPaths 與極小足跡沒被掃到').toBeGreaterThan(0)
  })

  it('★ 掃描範圍不是空的——沒掃到檔的話每個數字都是假的', () => {
    expect(srcFiles.size, 'src 一個檔都沒掃到').toBeGreaterThan(50)
    expect(testFiles.size, 'tests 一個檔都沒掃到 → 「零測試足跡」會全中，那是假的').toBeGreaterThan(50)
  })

  it('★ 合成注入（正向）：雙版本身分必須被報出', () => {
    const fake: ConceptDef[] = [{ conceptId: 'synth_thing' }, { conceptId: 'synth_thing_expr' }]
    const map = new Map(fake.map((c) => [c.conceptId, c]))
    const hit = fake.filter((c) => c.conceptId.endsWith('_expr') && map.has(c.conceptId.replace(/_expr$/, '')))
    expect(hit.map((c) => c.conceptId)).toEqual(['synth_thing_expr'])
  })

  it('★ 合成注入：檔案分類——清冊不得算成測試、宣告不得算成實作', () => {
    // 這一支釘的是**上面那三個信號死掉的根因**。分類錯了它們會回報 0，
    // 而 0 與健康的 0 長得一模一樣。
    expect(classify('tests/baselines/locality.json'), '基線列出每顆元件，算成測試的話「零測試足跡」永遠是 0').toBe('清冊')
    expect(classify('tests/assets/executor-inventory.json')).toBe('清冊')
    expect(classify('tests/integration/sstream-input.test.ts'), '真正的測試不得被當成清冊排除掉').toBe('實作')
    expect(classify('src/languages/cpp/std/vector/concepts.json'), '元件自己的定義不是它的實作').toBe('宣告')
    expect(classify('src/blocks/semantics/universal-concepts.json')).toBe('宣告')
    expect(classify('src/languages/cpp/topics/cpp-beginner.json'), '課程清單是登錄表的視圖，不是實作').toBe('清單')
    expect(classify('src/languages/cpp/std/vector/executors.ts'), '執行器是實作').toBe('實作')
  })

  it('★ 「零測試足跡」信號是活的——排除清冊之後才量得到', () => {
    // 正向：報出來的那幾顆，在**排除清冊後**的測試樹裡確實一次都沒出現
    const zero = findings.filter((f) => f.signal === '零測試足跡').map((f) => f.id)
    expect(zero.length, '一顆都沒有 → 清冊沒排乾淨，這個 0 是假的').toBeGreaterThan(0)
    for (const id of zero) {
      expect(footprint(testFiles, id), `${id} 被報成零測試足跡，但測試樹裡找得到它`).toEqual([])
    }
    // 反向：一顆有測試的元件不得被報出
    expect(zero, 'if 有大量測試，報出來的話信號太寬').not.toContain('if')
  })

  it('★ 「標 universal 但只有語言側」信號是活的——用合成元件證明', () => {
    // 這個信號在真實資料上是 0。**0 必須是可證的**，否則它與「信號死掉」長得一樣。
    const synth = { layer: 'universal', impl: ['src/languages/cpp/core/generators/statements.ts'] }
    const fires = synth.layer === 'universal'
      && synth.impl.filter((f) => f.startsWith('src/languages/')).length > 0
      && synth.impl.filter((f) => !f.startsWith('src/languages/')).length === 0
    expect(fires, '合成的「通用元件只有語言側實作」沒被判為違規 → 信號是死的').toBe(true)

    const ok = { layer: 'universal', impl: ['src/interpreter/executors/control-flow.ts', 'src/languages/cpp/core/generators/statements.ts'] }
    const firesOk = ok.layer === 'universal'
      && ok.impl.filter((f) => f.startsWith('src/languages/')).length > 0
      && ok.impl.filter((f) => !f.startsWith('src/languages/')).length === 0
    expect(firesOk, '有中立實作的通用元件被報出 → 信號太寬，30 顆會全中').toBe(false)
  })

  it('★ 合成注入（反向）：名字剛好以 _expr 結尾但沒有對應版本的，不得被報出', () => {
    // 沒有 `synth_lone` 的話，`synth_lone_expr` 只是一個名字，不是雙重身分
    const fake: ConceptDef[] = [{ conceptId: 'synth_lone_expr' }]
    const map = new Map(fake.map((c) => [c.conceptId, c]))
    const hit = fake.filter((c) => c.conceptId.endsWith('_expr') && map.has(c.conceptId.replace(/_expr$/, '')))
    expect(hit, '沒有配對版本卻報出來 → 每個以 _expr 結尾的名字都會變違規').toEqual([])
  })
})
