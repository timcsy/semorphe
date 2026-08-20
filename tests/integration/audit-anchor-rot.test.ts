/**
 * **第三十五條護欄：錨點會爛**——注入與健康檢查不得錨在「缺陷還在不在」上。
 *
 * ## 它防的是什麼
 *
 * ```ts
 * it('★ 健康檢查…', () => {
 *   expect(違規清單).toContain('cpp:func_def')   // ← 錯的錨
 * })
 * ```
 *
 * 那句斷言在**缺陷被修好的那天變紅**——而那正是最容易誤判的時刻：
 * 看起來像「我的修法弄壞了一支測試」，而實際上是測試在慶祝失敗。
 *
 * > **錨在「工具吃到輸入沒有」上是對的；錨在「缺陷還在不在」上必然會爛。**
 *
 * ## ⚠️ 為什麼是這一條值得蓋，而前兩條被否決
 *
 * `specs/111` 立了判準：「數到了東西，不代表那些東西會發生」。
 * 依它否決過兩件事。**這一條的證據不同**：
 *
 * | | 歷史上發生過 | 現存 | 判定 |
 * |---|---|---|---|
 * | 產生器的回退 | **0 次** | 26 處 | 否決——防禦性死分支 |
 * | `#33` 缺子節點 | **0 次** | 8 筆 | 移出棘輪 |
 * | **錨點爛掉** | **8 次** | **0 筆** | **蓋** |
 *
 * **它們每次都被修掉，所以現存是 0——那是「已經在還」，不是「不會發生」。**
 * 而第八次是**全套測試在同一輪抓到的，不是被人看出來的**：
 * 補宣告的那個 commit 讓注入當場爛掉。本護欄把那個訊號提前到寫的時候。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測錨得對不對**——只檢測「期望值裡有沒有真實的元件身分」。
 *   一個錨在合成輸入上、而判定邏輯寫錯的注入，本護欄看不到。
 * - **不檢測非護欄的測試**——只掃 `audit-*.test.ts` 的注入與健康檢查。
 * - **不判定合法與否**：`build-guardrail` 第 6 步**明確要求**用「已知答案的樣本」
 *   驗判準，而那種樣本就是真實身分。所以命中要人判，落點在
 *   `tests/assets/anchor-rot-decisions.json`。
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * > **如果「掃到的 audit 檔數」或「載入的真實身分數」是 0，
 * > 代表工具壞了，不是世界長這樣。**
 *
 * 錨在**掃描的輸入量**上（第 9 步的「入口條件」，而那一步是
 * `history/042` 補的——第七條護欄量了四天的空註冊表而三支注入全綠）。
 *
 * ## ⚠️ 第一次跑是**綠**的，而那是誠實的
 *
 * `build-guardrail` 6.5 說「第一次跑必須是紅的」，理由是
 * 「那個世界裡一定有東西不合規——否則這條規範早就自動被遵守了」。
 *
 * **這一條的世界不同：規範已經被遵守了**——八次都被修掉過（最後一次是
 * 全套測試在同一輪抓到的）。而 `components/執行機構.md` 有先例：
 *
 * > 「第六條不同。它量的三種違規在它裝上去之前就已經被同一個功能修完了，
 * > 所以基線是 0／0。**而這時候「數字不為零」那招反過來會逼你造假。**」
 *
 * → 所以這條靠的是**注入**，不是靠第一次的紅：
 * 「一條回報零違規的健康護欄，與一條什麼都沒量到的護欄，產出完全相同。」
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, loadBaseline, writeBaseline, printReport, assertRatchet, RATCHET_NOTE, decisionKey } from '../helpers/guardrail'

const GUARD = 'anchor-rot'
const decisionFile = path.join(REPO_ROOT, 'tests/assets/anchor-rot-decisions.json')

interface hits {
  /**
   * 識別碼。
   *
   * ⚠️ **第一版用 `檔:行號`，而這是同一個坑的第三次**：
   * `specs/110` 是「前 80 字元會碰撞」、`specs/113` 是「刪一行讓行號全漂移」，
   * 而本護欄在 `specs/113` 的**同一天**蓋起來，又寫了一次行號。
   *
   * 更糟的是**它掃的是測試檔**——那些檔每一輪都在改，
   * 所以行號漂移在這裡不是偶爾，是**每一輪**。
   *
   * > **識別碼必須識別得出那個東西**——行號識別的是位置，不是東西。
   * → 同一個處方第三次：**顯示與識別分開**。
   */
  key: string
  position: string
  block: string
  identity: string
  sourceCode: string
}


interface decision {
  key: string
  position: string
  decision: '已知答案樣本' | '錨錯了'
  reason: string
}

interface Baseline {
  _meta: { note: string; ratchet: string }
  scanned: { auditFileCount: number; trueIdentityCount: number }
  badAnchor: number
}

/** 從概念宣告撈真實身分——**這是入口條件的一半**。 */
function trueIdentity(): Set<string> {
  const ids = new Set<string>()
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      // ⚠️ **膠囊的宣告檔叫 `component.json`，不叫 `components.json`。**
      //
      // 這條護欄的入口條件錨在「載入幾顆真實身分」上，而 F（膠囊搬家）
      // 會把身分從共用的 `components.json` 一顆一顆搬走。只認舊檔名的話，
      // **這個數字隨 F 下降，而它是這條護欄自己的健康錨點**
      // ——2026-08-11 它跌破 100 當場變紅。
      //
      // > **一條「錨點會爛」的護欄，自己的錨點爛了。**
      // > 而它爛的方式正是它在講的那一種：錨在一個會隨進度改變的數字上。
      else if (e.name === 'components.json' || e.name === 'component.json' || /universal-components\.json$/.test(e.name)) {
        try {
          const j = JSON.parse(fs.readFileSync(p, 'utf8')) as unknown
          const arr = Array.isArray(j)
            ? j
            : (j as { components?: unknown[]; componentId?: string }).componentId
              ? [j]                                   // 膠囊的 component.json 是單一物件
              : ((j as { components?: unknown[] }).components ?? [])
          for (const c of arr as { componentId?: string }[]) if (c?.componentId) ids.add(c.componentId)
        } catch {
          /* 壞掉的 JSON 由別條護欄管 */
        }
      }
    }
  }
  walk(path.join(REPO_ROOT, 'src'))
  return ids
}

/**
 * 找「注入／健康檢查的**期望值**裡出現真實身分」。
 *
 * ⚠️ 只看 matcher **之後**的文字——身分出現在「查表的鍵」上是正常的
 * （`實際.get('cpp:func_def')`），出現在**期望值**裡才是錨在缺陷上。
 */
export function scan(fileText: string, fileName2: string, ids: ReadonlySet<string>): hits[] {
  const out: hits[] = []
  const lines = fileText.split('\n')
  let block = ''
  let inComment = false
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    // ⚠️ **註解裡的範例不是斷言。** 第一版沒剝註解，於是本檔檔頭那段
    // 「錯的錨長這樣」的示範程式碼自己被報了出來。
    // 而這正是既有教訓的第三次：**以文字為基礎的掃描要先問「註解算不算」**。
    if (/^\s*\/\*/.test(l)) inComment = true
    if (inComment) { if (l.includes('*/')) inComment = false; continue }
    if (/^\s*\/\//.test(l)) continue
    const m = /it(?:\.\w+)?\(\s*['"]([^'"]*(?:注入|健康檢查)[^'"]*)/.exec(l)
    if (m) block = m[1].slice(0, 40)
    else if (/^\s*(it|describe)\(/.test(l)) block = ''
    if (!block) continue
    const mm = /\.(toContain|toEqual|toStrictEqual|toMatchObject)\((.*)$/.exec(l)
    if (!mm) continue
    const expectedValue = mm[2]
    for (const id of ids) {
      if (expectedValue.includes(`'${id}'`) || expectedValue.includes(`"${id}"`)) {
        const code = l.trim().slice(0, 90)
        out.push({ key: decisionKey(fileName2, code), position: `${fileName2}:${i + 1}`, block, identity: id, sourceCode: code })
        break
      }
    }
  }
  return out
}

const auditFiles = (): string[] =>
  fs
    .readdirSync(path.join(REPO_ROOT, 'tests/integration'))
    .filter((f) => /^audit-.*\.test\.ts$/.test(f))
    .map((f) => path.join(REPO_ROOT, 'tests/integration', f))

const readDecisions = (): decision[] =>
  fs.existsSync(decisionFile) ? (JSON.parse(fs.readFileSync(decisionFile, 'utf8')) as decision[]) : []

describe('第三十五條護欄：錨點會爛', () => {
  // ── 入口條件（history/042 補的那一步） ────────────────────────────
  it('★ 入口條件：真的掃到 audit 檔、真的載入身分', () => {
    expect(auditFiles().length, '一個 audit 檔都沒掃到 → 量測壞了，不是世界長這樣').toBeGreaterThan(20)
    expect(trueIdentity().size, '一個真實身分都沒載入 → 這條護欄什麼都比不出來').toBeGreaterThan(100)
  })

  // ── 雙向注入 ────────────────────────────────────────────────────
  it('★ 注入①：錨在真實身分上的期望值必須被報出', () => {
    // ⚠️ 素材用**合成身分**，不用真實的——用真實身分當注入素材，
    // 正是這條護欄要抓的那個味道（而第一版就這樣寫，被自己抓到了）。
    const synthetic = new Set(['zz:合成的假身分'])
    const fakeFile = [
      `it('★ 注入：壞的會報', () => {`,
      `  expect(違規清單).toContain('zz:合成的假身分')`,
      `})`,
    ].join('\n')
    const h = scan(fakeFile, 'fake.test.ts', synthetic)
    expect(h, '故意錨在身分上的期望值沒被報 → 這條護欄抓不到東西').toHaveLength(1)
    expect(h[0].identity).toBe('zz:合成的假身分')
  })

  it('★ 注入②：身分出現在**查表的鍵**上不得被誤報', () => {
    // 這是合法且常見的寫法——`build-guardrail` 第 6 步要的已知答案樣本
    // 通常長這樣。沒有這一支，一個「凡是提到身分都報」的掃描器也會通過①。
    const fakeFile = [
      `it('★ 健康檢查：量測看得到 lift 的實際產出', () => {`,
      `  expect(實際.get('zz:合成的假身分')).toContain('params')`,
      `})`,
    ].join('\n')
    expect(scan(fakeFile, 'fake.test.ts', new Set(['zz:合成的假身分'])), '查表的鍵被誤報 → 合法的已知答案樣本會被逼著改掉').toHaveLength(0)
  })

  it('★ 注入③：注入／健康檢查以外的區塊不看', () => {
    const fakeFile = [`it('棘輪：不得上升', () => {`, `  expect(x).toContain('zz:合成的假身分')`, `})`].join('\n')
    expect(scan(fakeFile, 'fake.test.ts', new Set(['zz:合成的假身分'])), '棘輪那種區塊本來就會提到真實身分').toHaveLength(0)
  })

  // ── 棘輪：硬性零 ────────────────────────────────────────────────
  it('錨錯了必須是 0（硬性零——留一筆，它就會在成功的那天變紅）', () => {
    const ids = trueIdentity()
    const files = auditFiles()
    const hits = files.flatMap((f) => scan(fs.readFileSync(f, 'utf8'), path.basename(f), ids))
    const decisions = readDecisions()
    const decided = new Map(decisions.map((d) => [d.key, d]))
    const toReview = hits.filter((h) => !decided.has(h.key))
    const badAnchor = hits.filter((h) => decided.get(h.key)?.decision === '錨錯了')
    const orphans = decisions.filter((d) => !hits.some((h) => h.key === d.key))

    printReport('錨點會爛（注入／健康檢查錨在缺陷還在不在上）', [
      `掃描   ${files.length} 個 audit 檔｜${ids.size} 個真實身分`,
      `命中   ${hits.length}（已判定 ${hits.length - toReview.length}，要看 ${toReview.length}）`,
      `其中判為**錨錯了** ${badAnchor.length} 筆 ← 硬性零`,
      '',
      ...toReview.map((h, i) => `  ${i + 1}. ${h.position}  [${h.block}]\n       ${h.sourceCode}`),
      '',
      '⚠️ 命中不等於錯——`build-guardrail` 第 6 步**要求**用已知答案的樣本驗判準，',
      '   而那種樣本就是真實身分。判定在 tests/assets/anchor-rot-decisions.json。',
    ])

    if (process.env.GENERATE_BASELINE) {
      writeBaseline(GUARD, {
        _meta: {
          note:
            '錨點會爛：注入／健康檢查錨在「缺陷還在不在」上，會在缺陷被修好的那天變紅。\n' +
            '⚠️ 而那正是最容易誤判的時刻——看起來像「我的修法弄壞了一支測試」。\n' +
            '⚠️ 這條收**硬性零**：留一筆，它就會在成功的那天變紅，而規範本身就不成立了。\n' +
            '⚠️ 命中不等於錯：第 6 步要求用已知答案的樣本驗判準，而那種樣本就是真實身分。\n' +
            '  判準是**身分出現在期望值裡（錨在缺陷上）還是查表的鍵上（錨在事實上）**。\n' +
            '  分不出來的進「要看」，由人判並留理由。\n' +
            '⚠️ 為什麼值得蓋：歷史上這個錯犯過 **8 次**（build-guardrail 第 2 步記著），\n' +
            '  而現存 0 筆——那是「每次都被修掉」，不是「不會發生」。\n' +
            '  第八次是**全套測試在同一輪抓到的**（補宣告的 commit 讓注入當場爛掉），\n' +
            '  本護欄把那個訊號提前到寫的時候。',
          ratchet: RATCHET_NOTE,
        },
        scanned: { auditFileCount: files.length, trueIdentityCount: ids.size },
        badAnchor: badAnchor.length,
      })
      return
    }

    const base = loadBaseline<Baseline>(GUARD)
    expect(orphans.map((d) => d.key), '判定過期了——底下的程式碼變了').toEqual([])
    expect(
      decisions.filter((d) => !d.reason || d.reason.length < 4),
      '沒有理由的判定是把「懶得看」寫成「看過了」',
    ).toHaveLength(0)
    expect(toReview.map((h) => `${h.position} ${h.sourceCode}`), '有未判定的命中——護欄只排順序，判定要人做').toEqual([])
    assertRatchet([['錨錯了', badAnchor.length, base.badAnchor]])
  })
})
