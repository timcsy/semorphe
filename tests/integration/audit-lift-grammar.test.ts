/**
 * spec 167：**lift pattern 的文法歸屬**
 *
 * ## 這條護欄量的是什麼
 *
 * `astNodeType: "if_statement"` 這個字串**沒有意義，除非說明它屬於哪個文法**。
 * tree-sitter-cpp 與 tree-sitter-python 大量同名——
 * `if_statement`／`while_statement`／`for_statement`／`return_statement`／`identifier`／`call`。
 *
 * > **兩個文法各自獨立命名，而它們自然會撞名——因為它們描述的是同一批程式語言概念。
 * > 撞名不是巧合，是必然。而 pattern 的比對鍵剛好只有那個名字。**
 *
 * ## 🔴 動手之前它必須是紅的
 *
 * 基準量測（2026-08-20，spec 167 動手前）：
 *
 * ```
 * 18×  unresolved
 * 14×  cpp:var_ref          🔴
 *  1×  cpp:if  1× cpp:loop_while  1× cpp:loop_for  1× cpp:return
 * ────────────────────────────
 * 總節點 47，**其中降級 0**
 * ```
 *
 * **「降級 0」不是好消息**：不是都認對了，是都被自信地認錯了。
 * 而 `cpp:if` 畫得出積木、產得回 C++ 程式碼——**一段 Python 貼進去，產出來是 C++**。
 *
 * > **一個錯的身分比一個誠實的降級更糟，因為它不出聲。**
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../helpers/guardrail'
import { componentLiftPatterns, componentLiftPatternSources } from '../../src/core/component/lift-patterns'
import { liftPython, componentIdsOf, PYTHON_BASELINE } from '../helpers/python-lift'

describe('spec 167 · lift pattern 的文法歸屬', () => {
  // ─────────────────────────────────────────────────────────
  // ★ 正向錨點——先證明量得到東西，否則下面的負向斷言會空過
  // ─────────────────────────────────────────────────────────
  it('★ 錨點：那段基準 Python 真的 lift 得出東西（否則負向斷言在驗空集合）', async () => {
    const ids = componentIdsOf(await liftPython(PYTHON_BASELINE))
    expect(ids.length, '一棵空樹會讓下面每一條負向斷言都無意義').toBeGreaterThan(20)
    expect(ids, 'python:print 應該早就認得出來（spec 156/160）').toContain('python:print')
  })

  it('★ 錨點：膠囊 lift pattern 掃得到（否則文法完備性在驗空集合）', () => {
    expect(componentLiftPatterns().length).toBeGreaterThan(50)
  })

  // ─────────────────────────────────────────────────────────
  // FR-002 / SC-001：Python 底下不得出現 C++ 元件
  // ─────────────────────────────────────────────────────────
  it('🔴 FR-002：一段 Python lift 出來，不得出現任何 `cpp:` 元件', async () => {
    const ids = componentIdsOf(await liftPython(PYTHON_BASELINE))
    const cpp = ids.filter((i) => i.startsWith('cpp:'))
    const counts: Record<string, number> = {}
    for (const c of cpp) counts[c] = (counts[c] ?? 0) + 1
    expect(cpp, `🔴 Python 的節點被套上了 C++ 的身分：${JSON.stringify(counts)}\n` +
      '   而它不會拋錯、畫得出積木、產得回程式碼——產出來的會是 C++。').toEqual([])
  })

  // ─────────────────────────────────────────────────────────
  // FR-005 / SC-002：認不出來要【看得見】
  // ─────────────────────────────────────────────────────────
  it('🔴 FR-005：認不出來的節點降級成 **Python 的**灰色積木，不是 C++ 的', async () => {
    // ⚠️ **這一條要問【渲染】那一層，不是語義樹那一層。**
    //
    // 第一版問的是「樹裡有沒有 raw_code」——**答案永遠是 0，而那不是缺陷**：
    // 核心降級時建的是**裸的 `unresolved`**（`core/lift/lifter.ts`），
    // 而「要用哪一顆積木裝它」是 `block-renderer` 查降級登記處決定的。
    //
    // > **一條問錯層的斷言，會把一個健康的系統判成有病。**
    const { setDegradationLanguage, degradationBlocks } = await import('../../src/core/degradation-blocks')
    await import('../../src/languages/python/pack')
    await import('../../src/languages/cpp/generators/index')

    setDegradationLanguage('python')
    const py = degradationBlocks()
    expect(py, '★ 錨點：python 要宣告過降級積木，否則下面在驗 null').toBeTruthy()
    expect(py!.statement, '🔴 Python 的降級用了別的語言的積木').toBe('python_raw_code')
    expect(py!.expression).toBe('python_raw_expression')

    setDegradationLanguage('cpp')
    expect(degradationBlocks()!.statement, '⚠️ 反向：C++ 那側不得被 Python 換掉').toBe('cpp_raw_code')

    setDegradationLanguage('一個沒有宣告過的語言')
    expect(degradationBlocks(),
      '🔴 回了某個語言的降級積木 → 登記處又變回全域單槽了').toBeNull()
  })

  it('🔴 FR-005 之二：沒有 Python 身分的節點一律是 `unresolved`——**不得穿別人的身分**', async () => {
    const ids = componentIdsOf(await liftPython(PYTHON_BASELINE))
    expect(ids.length, '★ 錨點').toBeGreaterThan(10)
    const foreign = ids.filter((i) => i.includes(':') && !i.startsWith('python:'))
    expect(foreign,
      '🔴 一個錯的身分比一個誠實的降級更糟，因為它不出聲。').toEqual([])
  })

  // ─────────────────────────────────────────────────────────
  // FR-001 / FR-003 / SC-004：每一筆都要明說，而缺的要指名
  // ─────────────────────────────────────────────────────────
  it('🔴 FR-001/003：每一筆 lift pattern 都宣告了文法，缺的要被指名', () => {
    const pats = componentLiftPatterns() as { id?: string; grammar?: string }[]
    const sources = componentLiftPatternSources()
    // ⚠️ 兩個函式走同一個 glob、同一個 flatMap 順序，所以索引對得起來。
    expect(sources.length, '★ 索引必須對齊，否則指名的會是別人').toBe(pats.length)
    const missing = pats
      .map((p, i) => ({ id: p.id ?? `#${i}`, owner: sources[i]?.[0] ?? '?', g: p.grammar }))
      .filter((x) => !x.g)
    expect(missing.map((m) => `${m.owner} · ${m.id}`),
      '🔴 沒有文法宣告的 pattern【不得】預設成任何文法——' +
      '一個會被預設補上的宣告，第二年就安靜失效了。').toEqual([])
  })

  it('🔴 FR-001：共用檔那 5 筆也要明說（位置不代表歸屬）', () => {
    const shared = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'src/languages/cpp/lift-patterns.json'), 'utf8'),
    ) as { id?: string; grammar?: string }[]
    const missing = shared.filter((p) => !p.grammar).map((p) => p.id)
    expect(missing, '它住在 src/languages/cpp/ 底下——而【住在哪裡】是慣例，不是宣告。').toEqual([])
  })

  // ─────────────────────────────────────────────────────────
  // 🔴 附帶：pattern 裡不得有【不存在的鍵】
  //
  // 2026-08-21 實測撞到：`constraints: [{ field, textIn: [...] }]`
  // ——`textIn` **不是 `AstConstraint` 的欄位**，於是那個限制被**靜默忽略**，
  // 而 `a is b` 照樣被認成比較。JSON 沒有型別檢查，**沒有任何東西會說話**。
  //
  // > **一個不存在的欄位不會報錯，它只會讓你以為那個限制生效了。**
  // ─────────────────────────────────────────────────────────
  it('🔴 lift pattern 不得有不存在的鍵——JSON 沒有型別檢查，拼錯了沒有人會說', () => {
    const PATTERN_KEYS = new Set(['id', 'grammar', 'astNodeType', 'component', 'patternType',
      'constraints', 'fieldMappings', 'operatorDispatch', 'chain', 'composite', 'unwrapChild',
      'contextTransform', 'multiResult', 'extract', 'priority', 'liftStrategy'])
    const CONSTRAINT_KEYS = new Set(['field', 'text', 'nodeType', 'match'])
    const MAPPING_KEYS = new Set(['semantic', 'ast', 'extract', 'transform'])
    const bad: string[] = []
    const check = (obj: Record<string, unknown>, allowed: Set<string>, where: string) => {
      for (const k of Object.keys(obj)) {
        if (k.startsWith('_')) continue // `_why` 那一族是刻意的註解慣例
        if (!allowed.has(k)) bad.push(`${where} · ${k}`)
      }
    }
    const walk = (pats: Record<string, unknown>[], src: string) => {
      for (const p of pats) {
        const id = String(p.id ?? '(無 id)')
        check(p, PATTERN_KEYS, `${src} · ${id}`)
        for (const c of (p.constraints ?? []) as Record<string, unknown>[])
          check(c, CONSTRAINT_KEYS, `${src} · ${id} · constraints`)
        for (const m of (p.fieldMappings ?? []) as Record<string, unknown>[])
          check(m, MAPPING_KEYS, `${src} · ${id} · fieldMappings`)
        const od = p.operatorDispatch as { fieldMappings?: Record<string, unknown>[] } | undefined
        for (const m of od?.fieldMappings ?? [])
          check(m, MAPPING_KEYS, `${src} · ${id} · operatorDispatch.fieldMappings`)
      }
    }
    walk(componentLiftPatterns() as Record<string, unknown>[], '膠囊')
    for (const f of ['src/languages/cpp/lift-patterns.json', 'src/languages/python/lift-patterns.json']) {
      walk(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')) as Record<string, unknown>[], f)
    }
    expect(bad, '🔴 這些鍵不在型別上——它們【被靜默忽略】，而寫的人以為限制生效了。').toEqual([])
  })

  // ─────────────────────────────────────────────────────────
  // FR-006 / SC-005：跨語言硬編的節點型別清單
  // ─────────────────────────────────────────────────────────
  it('🔴 FR-006：組裝點不得硬編一串跨語言共用的 C++ 節點型別', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'src/ui/app.ts'), 'utf8')
    const hit = /loadBlockSpecs\([^)]*new Set\(\[[^\]]*['"]call_expression['"]/s.test(src)
    expect(hit,
      '🔴 `liftSkipNodeTypes` 是一串 C++ 的節點型別，而它套用在所有語言上。\n' +
      '   跳過哪些節點是【文法】的性質——它該由文法那一側宣告。').toBe(false)
  })
})
