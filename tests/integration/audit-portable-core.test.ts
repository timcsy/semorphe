/**
 * **第五十八條護欄：核心出貨之後，別人不必用我們的建置工具。**
 *
 * 路線圖項目：`vision.md` 階段 8「核心可獨立出貨」的第一條驗收。
 * 使用者的情境逐字：「本身就有 Blockly 或是 Flow 了，**但是想要加入程式碼
 * 即時互轉功能**」——那個人一個面板都不要，他要的是引擎 ＋ 自己的 `ViewHost`。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果這支護欄在「膠囊一顆都沒打包進去」的情況下仍然報綠，
 * > 代表它量的是「建置有沒有成功」而不是「引擎有沒有真的在跑」——那是工具壞了。**
 *
 * 判斷依據是 `★ 合成注入：膠囊為零一定要被判成失敗`，**不是**真實那一支跑綠。
 * 這個區分不是形式：`src/vscode/sync/messages.ts:23` 記著同一個坑逐字——
 * 「**esbuild 建得出來，而膠囊一顆都沒打包進去**」。那是一個**安靜的**失敗。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測 webpack／rollup／Next.js**——只用 esbuild 建那個例子。
 *   一個 bundler 過了不代表全部過了；它擋的是「**需要 Vite 專屬轉換**」這一類。
 * - **不檢測瀏覽器**——這一支跑在 Node，而那是刻意的：Node 沒有 DOM，
 *   所以「核心純淨性：Node.js 環境可執行」（`principles.md:174`）在這裡才真的被考。
 * - **不檢測執行期**——只到「程式碼 ↔ 語義樹」。直譯器跑不跑得動是另一條。
 *
 * ## 為什麼是硬性零而不是棘輪
 *
 * 判準是 `build-guardrail` 第 6.8 步的第一問：**「留一筆在那裡，這條規範還成立嗎？」**
 * 「核心可以獨立出貨」如果有**一條**路徑非我們的建置工具不可，那句話就是假的。
 *
 * ## ⚠️ 第一次跑不是紅的——而那是具名的例外
 *
 * `build-guardrail` 6.5 說新護欄第一次跑必須是紅的。這一條不是，因為
 * **它要守的東西是與它同一輪做出來的**（那個例子在寫這支測試之前就跑通了）。
 * 而它在做的過程中**真的紅過四次**，每一次都指得出名：
 *
 * ```
 * ① import.meta.glob is not a function          core/component/registry.ts:54
 * ② Dynamic require of "path"（jsdom）           languages/<lang>/pack.ts import 了 ui + blockly
 * ③ if 安靜地降級成 unresolved                    膠囊的 lift 策略沒人登記
 * ④ ⟨unknown component: python:program⟩         產生器沒人登記（pack.install()）
 * ```
 *
 * 所以這一條的健康檢查**只能靠注入**（6.5 明文的那個例外）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

interface Summary {
  capsules: number
  updates: number
  componentIds: string[]
  code: string
}

const SOURCE = 'x = 5\nif x > 3:\n    print("big")\n'

/**
 * 判定——**純函式，所以注入餵得進合成輸入**。
 *
 * 回傳失敗的理由清單（空的＝通過）。
 */
export function judge(s: Summary): string[] {
  const bad: string[] = []
  // 🔴 這一條就是那個安靜的失敗模式
  if (s.capsules < 100) bad.push(`膠囊只載到 ${s.capsules} 顆——產物建起來了而膠囊沒進去`)
  if (s.updates < 2) bad.push(`視圖只收到 ${s.updates} 次更新——雙向沒有各走一次`)
  if (!s.componentIds.includes('python:if')) bad.push('語義樹裡沒有 python:if——辨識降級了')
  if (s.componentIds.includes('unresolved')) bad.push('語義樹裡有 unresolved 節點')
  if (s.code.trim() !== SOURCE.trim()) bad.push(`往返走樣：\n${JSON.stringify(s.code)}`)
  return bad
}

/** 三種結局要分得開——「沒跑起來」不准被讀成綠的（`build-guardrail` 第 9 步） */
function runExample(): { ok: true; summary: Summary } | { ok: false; stage: string; detail: string } {
  const sh = (cmd: string, args: string[]): string =>
    execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    sh('node', ['tools/build-sdk.mjs'])
  } catch (e) {
    return { ok: false, stage: '出貨產物建不起來', detail: String(e) }
  }
  try {
    sh('node', ['examples/bring-your-own-view/build.mjs'])
  } catch (e) {
    return { ok: false, stage: '例子在 esbuild 下建不起來', detail: String(e) }
  }
  let out: string
  try {
    out = sh('node', ['examples/bring-your-own-view/dist/main.mjs'])
  } catch (e) {
    return { ok: false, stage: '例子在 Node 跑不起來', detail: String(e) }
  }
  try {
    return { ok: true, summary: JSON.parse(out.trim().split('\n').pop() ?? '{}') as Summary }
  } catch {
    return { ok: false, stage: '例子沒有印出摘要', detail: out.slice(0, 400) }
  }
}

let result: ReturnType<typeof runExample>

beforeAll(() => {
  result = runExample()
}, 120_000)

describe('護欄：核心可獨立出貨（第五十八條）', () => {
  it('★ 合成注入：膠囊為零一定要被判成失敗', () => {
    const bad = judge({ capsules: 0, updates: 2, componentIds: ['python:if'], code: SOURCE })
    expect(bad.join('｜'), '「建得出來而膠囊一顆都沒進去」是這條護欄唯一要抓的東西').toContain('膠囊只載到 0 顆')
  })

  it('★ 合成注入：往返走樣一定要被判成失敗', () => {
    expect(judge({ capsules: 332, updates: 2, componentIds: ['python:if'], code: 'x = 5' })).not.toEqual([])
  })

  it('★ 合成注入：只走了單向一定要被判成失敗', () => {
    expect(judge({ capsules: 332, updates: 1, componentIds: ['python:if'], code: SOURCE })).not.toEqual([])
  })

  it('★ 合成注入：正確的輸入不得亂報', () => {
    expect(judge({
      capsules: 332,
      updates: 2,
      componentIds: ['python:program', 'python:if'],
      code: SOURCE,
    })).toEqual([])
  })

  it('★ 三種結局分得開——「沒跑起來」不是綠的', () => {
    // 這一支釘的是 `runExample` 的形狀：失敗時要說得出**哪一段**失敗
    if (!result.ok) expect(result.stage, '失敗時必須指名是哪一段').toBeTruthy()
    else expect(result.summary).toBeTypeOf('object')
  })

  it('★ 入口條件：例子真的載到了膠囊（不是計數器會數）', () => {
    if (!result.ok) throw new Error(`${result.stage}：${result.detail}`)
    // ⚠️ 錨在**輸入量**上：膠囊數只會隨著新增元件變大，
    //    **不會因為這條護欄想推向零的東西被修好而變小**（第 2 步的簽名三）
    expect(result.summary.capsules).toBeGreaterThan(100)
  })

  it('🔴 硬性零：非 Vite 的宿主跑得通程式碼↔語義樹雙向', () => {
    if (!result.ok) throw new Error(`${result.stage}：${result.detail}`)
    expect(judge(result.summary).join('\n')).toBe('')
  })

  it('★ 例子裡不得出現 `src/` 的 import——否則它證明的是「repo 裡面的人接得上」', () => {
    const grep = (): string => {
      try {
        return execFileSync('grep', ['-rn', "from '../../../src/", 'examples/'], { cwd: ROOT, encoding: 'utf8' })
      } catch {
        return ''
      }
    }
    expect(grep()).toBe('')
  })
})
