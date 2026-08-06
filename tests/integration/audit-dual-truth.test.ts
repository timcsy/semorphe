/**
 * 雙重真相：JSON blockDef 與動態註冊（第十條護欄）
 *
 * ## 這條量的是什麼
 *
 * 44 個積木在 `block-registrar.ts` 裡**動態註冊**，其中 **34 個在 JSON 裡也有
 * `blockDef`**。同一顆積木有兩處定義。
 *
 * 專案記憶裡點名過這個坑：
 *
 * > `universal.json` 曾經把 `u_if` 的 input 命名為 `COND`，而動態註冊用的是
 * > `CONDITION`。PatternRenderer 從 JSON 自動推導 → 產出錯的 input 名 →
 * > **只在切換積木風格（序列化→反序列化）時才炸**。
 *
 * ## 分歧不一定是錯的
 *
 * 動態積木（可變參數）的執行期 input 本來就比靜態宣告多——`ARG_0`、`MINUS_BTN`
 * 這些是 mutator 生出來的。**所以這條護欄量的不是「有沒有分歧」，是「分歧有多大、
 * 在哪裡」**，讓「哪一份是消費者的真相」這個問題有得談。
 *
 * ## 失效樣態
 *
 * ⚠️ 如果「兩處都有定義」是 0，先確認兩份清單真的取到了——這個專案已知有 34 個。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { loadBaseline, writeBaseline, printReport, RATCHET_NOTE, REPO_ROOT, listSourceFiles, type BaselineMeta , assertRatchet , assertRatchet } from '../helpers/guardrail'

const RULE = '比對 block-registrar 的動態註冊與 JSON blockDef 的 input 名稱集合。'

const SELF_FALSIFICATION =
  '⚠️ 「兩處都有定義」若是 0，先確認兩份清單真的取到了——已知有 34 個。'

const NOT_DETECTED =
  '本護欄**不檢測**：input 名稱以外的分歧（欄位型別、tooltip、顏色）、' +
  '動態註冊之間的衝突、mutator 產生的執行期 input 是否正確。'

interface DualBaseline {
  _meta: BaselineMeta
  bothDefined: number
  diverging: number
  blocks: string[]
  hardcodedWithJsonCounterpart: number
  viaConstant: number
  hardcodedList?: string[]
}

function jsonBlockDefs(): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>()
  for (const rel of listSourceFiles('src', ['.json'])) {
    if (!rel.includes('block')) continue
    let data: unknown
    try {
      data = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'))
    } catch {
      continue
    }
    const arr = Array.isArray(data) ? data : ((data as { blocks?: unknown[] }).blocks ?? [])
    for (const b of arr as { id?: string; conceptId?: string; blockDef?: Record<string, unknown> }[]) {
      if (b?.blockDef) out.set(b.id ?? b.conceptId ?? '', b.blockDef)
    }
  }
  return out
}

function inputNamesFromJson(bd: Record<string, unknown>): Set<string> {
  const s = new Set<string>()
  for (const [k, v] of Object.entries(bd)) {
    if (!k.startsWith('args') || !Array.isArray(v)) continue
    for (const a of v as { name?: string }[]) if (a?.name) s.add(a.name)
  }
  return s
}

const registrar = fs.readFileSync(path.join(REPO_ROOT, 'src/ui/block-registrar.ts'), 'utf8')
/**
 * 用「下一個定義的起點」當邊界，**不靠縮排**。
 *
 * 第一版用 `\n    }` 當結尾，漏掉 10 個縮排不同的定義（33 vs 43）。
 * 抓到它的是與簡單計數對不上——又一次「量測工具的第一版會安靜地量錯」。
 */
const dynamicBodies = (() => {
  const starts = [...registrar.matchAll(/Blockly\.Blocks\['([^']+)'\] = \{/g)]
  const m = new Map<string, string>()
  starts.forEach((s, i) => {
    const from = s.index! + s[0].length
    const to = i + 1 < starts.length ? starts[i + 1].index! : registrar.length
    m.set(s[1], registrar.slice(from, to))
  })
  return m
})()
const json = jsonBlockDefs()
const both = [...dynamicBodies.keys()].filter((id) => json.has(id)).sort()

/**
 * **真正的雙重真相面**：動態註冊裡寫**字串字面**的插槽名，而那個名字在 JSON
 * 裡有對應物。
 *
 * 之前的量法（比對兩邊的名稱集合）量錯過三次：
 *   1. 動態側只算輸入不算欄位——兩邊定義沒對齊
 *   2. 用常數寫的插槽名被判成「動態側沒有」——那些恰恰是唯一真相的正例
 *   3. mutator 容器、執行期插槽（`PARAM_0`）、純排版輸入（`TAIL`）沒有 JSON
 *      對應物**是設計如此**，把它們算進來會讓分母灌水
 *
 * 現在量的是單邊、可數、不需要對齊的東西：**寫死才會分歧，用常數不會。**
 */
const hardcoded = both.flatMap((id) => {
  const body = dynamicBodies.get(id)!
  const js = inputNamesFromJson(json.get(id)!)
  return [...body.matchAll(/append(?:Value|Statement|Dummy)Input\('([A-Z0-9_]+)'\)/g)]
    .map((m) => m[1])
    .filter((n) => js.has(n))
    .map((n) => `${id}.${n}`)
})
const viaConstant = [...dynamicBodies.values()].reduce(
  (n, b) => n + [...b.matchAll(/append(?:Value|Statement|Dummy)Input\([A-Z_]+_INPUTS\./g)].length,
  0,
)

const diverging = both
  .map((id) => {
    // JSON 側算的是 args（**欄位與輸入都算**），動態側也要一起算——
    // 第一版只抓 `appendXxxInput('X')`，漏掉 `appendField(..., 'X')`，
    // 於是兩邊其實一致的積木被報成分歧。**兩側的定義要對齊，才叫比對。**
    const body = dynamicBodies.get(id)!
    const dyn = new Set([
      ...[...body.matchAll(/append\w*Input\('([A-Z0-9_]+)'\)/g)].map((m) => m[1]),
      ...[...body.matchAll(/appendField\([^)]*?,\s*'([A-Z0-9_]+)'\s*\)/g)].map((m) => m[1]),
      ...[...body.matchAll(/\.appendField\([\s\S]{0,120}?'([A-Z0-9_]+)'\s*\)/g)].map((m) => m[1]),
    ])
    const js = inputNamesFromJson(json.get(id)!)
    const onlyDyn = [...dyn].filter((x) => !js.has(x)).sort()
    const onlyJson = [...js].filter((x) => !dyn.has(x)).sort()
    return { id, onlyDyn, onlyJson }
  })
  .filter((x) => x.onlyDyn.length > 0 || x.onlyJson.length > 0)

describe('護欄：雙重真相（JSON blockDef ／ 動態註冊）', () => {
  it('產出可讀報表', () => {
    printReport('雙重真相護欄', [
      SELF_FALSIFICATION,
      NOT_DETECTED,
      '',
      `判定規則：${RULE}`,
      '',
      `動態註冊：${dynamicBodies.size}｜兩處都有定義：${both.length}`,
      '',
      `**有 JSON 對應卻仍寫死：${hardcoded.length} 處**｜用唯一真相常數：${viaConstant} 處` +
        `（採用率 ${Math.round((viaConstant / Math.max(1, viaConstant + hardcoded.length)) * 100)}%）`,
      '',
      ...hardcoded.map((h) => `  ${h}`),
      '',
      '**分歧不一定是錯的**——可變參數積木的執行期 input 本來就比靜態宣告多。',
      '這條量的是「分歧有多大、在哪裡」，讓「哪一份是消費者的真相」有得談。',
      '',
      ...diverging.map((d) => `  ${d.id}：只在動態 [${d.onlyDyn}]｜只在 JSON [${d.onlyJson}]`),
      '',
      '已知的咬人方式：PatternRenderer 從 JSON 自動推導 input 名，',
      '**只在切換積木風格（序列化→反序列化）時才炸**。',
    ])
    expect(both.length).toBeGreaterThanOrEqual(0)
  })

  it('★ 兩處都有定義的數量不是 0——0 代表清單沒取到', () => {
    expect(both.length).toBeGreaterThan(10)
  })

  it('★ 有 JSON 對應的插槽名不得**新增**寫死', () => {
    const b = loadBaseline<DualBaseline>('dual-truth')
    const known = b.hardcodedList ?? []
    const 新增 = hardcoded.filter((h) => !known.includes(h))
    expect(
      新增,
      '這些插槽名在 JSON 裡有對應物，卻在動態註冊裡寫死。兩邊不一致時**只在切換' +
        '積木外觀（存檔再讀回）時才炸**，平常測試全綠。改用 block-input-names 導出的常數。',
    ).toEqual([])
    expect(hardcoded.length).toBeLessThanOrEqual(b.hardcodedWithJsonCounterpart)
  })

  it('基線裡剩下的都是「機制目前涵蓋不到」的，不是懶得改', () => {
    // block-input-names 只載入 universal 積木。語言專屬積木要涵蓋，那個模組
    // 得引用語言套件——與「核心不認識語言」相衝。那是另一個決定。
    expect(hardcoded.every((h) => /^(c_|cpp_)/.test(h))).toBe(true)
  })

  it('棘輪：兩處都有定義的數量不得上升', () => {
    const b = loadBaseline<DualBaseline>('dual-truth')
    const 新增 = both.filter((x) => !b.blocks.includes(x))
    expect(
      新增,
      `新增的雙重定義：${新增.join('、')}\n` +
        '同一顆積木不該有兩處定義——JSON 是消費者（PatternRenderer）讀的那一份。',
    ).toEqual([])
    assertRatchet([['兩處都有定義', both.length, b.bothDefined]])
  })
})

/** 產生基線：`GENERATE_BASELINE=1 npx vitest run tests/integration/audit-dual-truth.test.ts` */
if (process.env.GENERATE_BASELINE) {
  writeBaseline('dual-truth', {
    _meta: {
      guard: 'dual-truth',
      measuredAt: new Date().toISOString().slice(0, 10),
      rule: RULE,
      note: RATCHET_NOTE + ' ' + SELF_FALSIFICATION,
    },
    bothDefined: both.length,
    diverging: diverging.length,
    hardcodedWithJsonCounterpart: hardcoded.length,
    viaConstant,
    hardcodedList: hardcoded,
    blocks: both,
  })
}
