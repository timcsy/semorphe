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
 * 全套測試在同一輪抓到的）。而 `concepts/執行機構.md` 有先例：
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
import { REPO_ROOT, loadBaseline, writeBaseline, printReport, assertRatchet, RATCHET_NOTE } from '../helpers/guardrail'

const GUARD = 'anchor-rot'
const 判定檔 = path.join(REPO_ROOT, 'tests/assets/anchor-rot-decisions.json')

interface 命中 {
  位置: string
  區塊: string
  身分: string
  程式碼: string
}

interface 判定 {
  位置: string
  判定: '已知答案樣本' | '錨錯了'
  理由: string
}

interface 基線 {
  _meta: { note: string; ratchet: string }
  掃描: { audit檔數: number; 真實身分數: number }
  錨錯了: number
}

/** 從概念宣告撈真實身分——**這是入口條件的一半**。 */
function 真實身分(): Set<string> {
  const ids = new Set<string>()
  const 走 = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) 走(p)
      else if (e.name === 'concepts.json' || /universal-concepts\.json$/.test(e.name)) {
        try {
          const j = JSON.parse(fs.readFileSync(p, 'utf8')) as unknown
          const arr = Array.isArray(j) ? j : ((j as { concepts?: unknown[] }).concepts ?? [])
          for (const c of arr as { conceptId?: string }[]) if (c?.conceptId) ids.add(c.conceptId)
        } catch {
          /* 壞掉的 JSON 由別條護欄管 */
        }
      }
    }
  }
  走(path.join(REPO_ROOT, 'src'))
  return ids
}

/**
 * 找「注入／健康檢查的**期望值**裡出現真實身分」。
 *
 * ⚠️ 只看 matcher **之後**的文字——身分出現在「查表的鍵」上是正常的
 * （`實際.get('cpp:func_def')`），出現在**期望值**裡才是錨在缺陷上。
 */
export function 掃(檔案文字: string, 檔名: string, ids: ReadonlySet<string>): 命中[] {
  const out: 命中[] = []
  const lines = 檔案文字.split('\n')
  let 區塊 = ''
  let 在註解 = false
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    // ⚠️ **註解裡的範例不是斷言。** 第一版沒剝註解，於是本檔檔頭那段
    // 「錯的錨長這樣」的示範程式碼自己被報了出來。
    // 而這正是既有教訓的第三次：**以文字為基礎的掃描要先問「註解算不算」**。
    if (/^\s*\/\*/.test(l)) 在註解 = true
    if (在註解) { if (l.includes('*/')) 在註解 = false; continue }
    if (/^\s*\/\//.test(l)) continue
    const m = /it(?:\.\w+)?\(\s*['"]([^'"]*(?:注入|健康檢查)[^'"]*)/.exec(l)
    if (m) 區塊 = m[1].slice(0, 40)
    else if (/^\s*(it|describe)\(/.test(l)) 區塊 = ''
    if (!區塊) continue
    const mm = /\.(toContain|toEqual|toStrictEqual|toMatchObject)\((.*)$/.exec(l)
    if (!mm) continue
    const 期望值 = mm[2]
    for (const id of ids) {
      if (期望值.includes(`'${id}'`) || 期望值.includes(`"${id}"`)) {
        out.push({ 位置: `${檔名}:${i + 1}`, 區塊, 身分: id, 程式碼: l.trim().slice(0, 90) })
        break
      }
    }
  }
  return out
}

const audit檔 = (): string[] =>
  fs
    .readdirSync(path.join(REPO_ROOT, 'tests/integration'))
    .filter((f) => /^audit-.*\.test\.ts$/.test(f))
    .map((f) => path.join(REPO_ROOT, 'tests/integration', f))

const 讀判定 = (): 判定[] =>
  fs.existsSync(判定檔) ? (JSON.parse(fs.readFileSync(判定檔, 'utf8')) as 判定[]) : []

describe('第三十五條護欄：錨點會爛', () => {
  // ── 入口條件（history/042 補的那一步） ────────────────────────────
  it('★ 入口條件：真的掃到 audit 檔、真的載入身分', () => {
    expect(audit檔().length, '一個 audit 檔都沒掃到 → 量測壞了，不是世界長這樣').toBeGreaterThan(20)
    expect(真實身分().size, '一個真實身分都沒載入 → 這條護欄什麼都比不出來').toBeGreaterThan(100)
  })

  // ── 雙向注入 ────────────────────────────────────────────────────
  it('★ 注入①：錨在真實身分上的期望值必須被報出', () => {
    // ⚠️ 素材用**合成身分**，不用真實的——用真實身分當注入素材，
    // 正是這條護欄要抓的那個味道（而第一版就這樣寫，被自己抓到了）。
    const 合成 = new Set(['zz:合成的假身分'])
    const 假檔 = [
      `it('★ 注入：壞的會報', () => {`,
      `  expect(違規清單).toContain('zz:合成的假身分')`,
      `})`,
    ].join('\n')
    const h = 掃(假檔, 'fake.test.ts', 合成)
    expect(h, '故意錨在身分上的期望值沒被報 → 這條護欄抓不到東西').toHaveLength(1)
    expect(h[0].身分).toBe('zz:合成的假身分')
  })

  it('★ 注入②：身分出現在**查表的鍵**上不得被誤報', () => {
    // 這是合法且常見的寫法——`build-guardrail` 第 6 步要的已知答案樣本
    // 通常長這樣。沒有這一支，一個「凡是提到身分都報」的掃描器也會通過①。
    const 假檔 = [
      `it('★ 健康檢查：量測看得到 lift 的實際產出', () => {`,
      `  expect(實際.get('zz:合成的假身分')).toContain('params')`,
      `})`,
    ].join('\n')
    expect(掃(假檔, 'fake.test.ts', new Set(['zz:合成的假身分'])), '查表的鍵被誤報 → 合法的已知答案樣本會被逼著改掉').toHaveLength(0)
  })

  it('★ 注入③：注入／健康檢查以外的區塊不看', () => {
    const 假檔 = [`it('棘輪：不得上升', () => {`, `  expect(x).toContain('zz:合成的假身分')`, `})`].join('\n')
    expect(掃(假檔, 'fake.test.ts', new Set(['zz:合成的假身分'])), '棘輪那種區塊本來就會提到真實身分').toHaveLength(0)
  })

  // ── 棘輪：硬性零 ────────────────────────────────────────────────
  it('錨錯了必須是 0（硬性零——留一筆，它就會在成功的那天變紅）', () => {
    const ids = 真實身分()
    const 檔s = audit檔()
    const 命中 = 檔s.flatMap((f) => 掃(fs.readFileSync(f, 'utf8'), path.basename(f), ids))
    const 判定s = 讀判定()
    const 已判定 = new Map(判定s.map((d) => [d.位置, d]))
    const 要看 = 命中.filter((h) => !已判定.has(h.位置))
    const 錨錯了 = 命中.filter((h) => 已判定.get(h.位置)?.判定 === '錨錯了')
    const 孤兒 = 判定s.filter((d) => !命中.some((h) => h.位置 === d.位置))

    printReport('錨點會爛（注入／健康檢查錨在缺陷還在不在上）', [
      `掃描   ${檔s.length} 個 audit 檔｜${ids.size} 個真實身分`,
      `命中   ${命中.length}（已判定 ${命中.length - 要看.length}，要看 ${要看.length}）`,
      `其中判為**錨錯了** ${錨錯了.length} 筆 ← 硬性零`,
      '',
      ...要看.map((h, i) => `  ${i + 1}. ${h.位置}  [${h.區塊}]\n       ${h.程式碼}`),
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
        掃描: { audit檔數: 檔s.length, 真實身分數: ids.size },
        錨錯了: 錨錯了.length,
      })
      return
    }

    const base = loadBaseline<基線>(GUARD)
    expect(孤兒.map((d) => d.位置), '判定過期了——底下的程式碼變了').toEqual([])
    expect(
      判定s.filter((d) => !d.理由 || d.理由.length < 4),
      '沒有理由的判定是把「懶得看」寫成「看過了」',
    ).toHaveLength(0)
    expect(要看.map((h) => `${h.位置} ${h.程式碼}`), '有未判定的命中——護欄只排順序，判定要人做').toEqual([])
    assertRatchet([['錨錯了', 錨錯了.length, base.錨錯了]])
  })
})
