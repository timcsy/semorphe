/**
 * `pickSimplestBlock` 的自證測——**本輪唯一能 TDD 的一塊**。
 *
 * ## 自我否證聲明（⚠️ 寫在斷言之前）
 *
 * > **如果登錄表載不到膠囊，這整份測試會【空過】而不是變紅**
 * > ——一個對空陣列做的挑選，「決定性」與「順序不敏感」都自動成立。
 *
 * 所以第一支測是**正向錨點**：先證明量到了東西（≥ 200 顆膠囊），
 * 後面的性質斷言才有意義。這條慣例在 `component-generate` skill 步驟六：
 * 「每條負向前面先釘一個正向」——**一支空過的測試與健康的長得一模一樣**。
 *
 * ## 為什麼這個函式必須存在
 *
 * FR-004：畫布上那顆積木的定義 MUST 來自登錄表。
 * ⚠️ 手寫一顆假的也能讓畫布上有東西——**而那證明的是「Blockly 能跑」，
 * 不是「Semorphe 的核搬得過去」**，那是兩件完全不同的事。
 */
import { describe, it, expect } from 'vitest'
import { initCppModule } from '../../src/languages/cpp/module'
import { registeredComponents } from '../../src/core/component/registry'
import { pickSimplestBlock, placeableSpecs } from '../../src/vscode/pick-block'

/** 洗牌——⚠️ 固定種子，不用 Math.random（測試要可重現）。 */
function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items]
  let s = seed
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648
    const j = s % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

describe('pickSimplestBlock —— 畫布上那顆積木來自登錄表', () => {
  // ─── 正向錨點：先證明量到了東西 ───

  it('登錄表載得到膠囊——🔴 這個數字就是「核搬過去了沒」', () => {
    // `registry.ts:31` 記著 esbuild 那次的症狀：**建得出來，而 189 顆膠囊
    // 一顆都沒被打包進去**，只發一則 warning，執行期才炸。
    // 所以這裡錨的是「載到幾顆」，不是「有沒有拋錯」。
    expect(registeredComponents().length).toBeGreaterThanOrEqual(200)
  })

  it('登錄表產得出積木規格', () => {
    const { registry } = initCppModule()
    expect(registry.getAll().length).toBeGreaterThan(0)
  })

  it('挑得出一顆——而它有身分', () => {
    const { registry } = initCppModule()
    const spec = pickSimplestBlock(registry.getAll())
    expect(spec.blockDef?.type).toBeTruthy()
    expect(spec.conceptMapping?.conceptId).toBeTruthy()
  })

  // ─── 契約（contracts/webview-host.md 第五節） ───

  it('只挑中性形態——變體在空白畫布上接不到東西', () => {
    // `block-spec-registry.ts:76` 記著「一個元件身分可以有多個形態」，
    // 而 expression 變體 `setOutput` 卻沒有 `previousStatement`。
    const { registry } = initCppModule()
    expect(pickSimplestBlock(registry.getAll()).form).toBeUndefined()
  })

  it('只挑站得住的——有 previousStatement 或 nextStatement', () => {
    const { registry } = initCppModule()
    const def = pickSimplestBlock(registry.getAll()).blockDef as Record<string, unknown>
    const standsAlone = 'previousStatement' in def || 'nextStatement' in def
    expect(standsAlone).toBe(true)
  })

  it('🔴 只挑「JSON 真的描述了它」的——`message0` 必須存在', () => {
    // ⚠️ 這一條是實測撞出來的（2026-08-17）。沒有它的話「欄位最少」會挑到
    // `cpp_array_2d_declare`——而那顆的 `blockDef` **沒有 message0 也沒有
    // args0**，因為它的真正定義是命令式的，住在 `ui/block-registrar.ts:503`。
    //
    // > **一顆定義住在別處的積木，證明不了「積木來自登錄表」。**
    //
    // 而 FR-004 要證的正是那件事。
    const { registry } = initCppModule()
    const def = pickSimplestBlock(registry.getAll()).blockDef as { message0?: string }
    expect(def.message0).toBeTruthy()
  })

  it('候選數說得出來——而它比「站得住」那一群少', () => {
    // 正向錨點：兩個數都要 > 0，否則上面那條可能是空過的
    const all = initCppModule().registry.getAll()
    const standsAlone = all.filter((s) => {
      const d = (s.blockDef ?? {}) as Record<string, unknown>
      return !s.form && d.type && ('previousStatement' in d || 'nextStatement' in d)
    })
    expect(standsAlone.length).toBeGreaterThan(0)
    expect(placeableSpecs(all).length).toBeGreaterThan(0)
    expect(placeableSpecs(all).length).toBeLessThan(standsAlone.length)
  })

  it('🔴 對輸入順序不敏感——打亂三次結果都一樣', () => {
    // ⚠️ 這一條有病歷。`lift-branches.ts:26` 逐字：
    // 「登錄順序來自 `import.meta.glob` 的檔名排序，**那不是任何人設計的**」
    //
    // > 一個依賴載入順序的挑選，會在有人新增一顆膠囊的那天
    // > **安靜地換一顆積木**——而沒有任何東西會提醒你。
    const all = initCppModule().registry.getAll()
    const baseline = pickSimplestBlock(all).blockDef?.type
    for (const seed of [1, 7, 99]) {
      expect(pickSimplestBlock(shuffle(all, seed)).blockDef?.type).toBe(baseline)
    }
  })

  it('🔴 空輸入拋錯，不回 undefined', () => {
    // 回 `undefined` 的話，呼叫端會在別的地方炸，而錯誤離根因很遠
    // ——`experience` 的「靜默降級反模式」。
    expect(() => pickSimplestBlock([])).toThrow()
  })

  it('沒有可放置的候選時也拋錯——而不是回一顆放不上去的', () => {
    const { registry } = initCppModule()
    // 只餵變體（全部有 form）→ 候選為空
    const variantsOnly = registry.getAll().filter((s) => s.form)
    expect(variantsOnly.length).toBeGreaterThan(0) // 正向錨點：確實有變體
    expect(() => pickSimplestBlock(variantsOnly)).toThrow()
  })

  it('挑的是「最簡單的」——沒有別的候選欄位更少', () => {
    const all = initCppModule().registry.getAll()
    const chosen = pickSimplestBlock(all)
    const argsOf = (s: typeof chosen): number =>
      ((s.blockDef as { args0?: unknown[] })?.args0 ?? []).length
    for (const other of placeableSpecs(all)) {
      expect(argsOf(other)).toBeGreaterThanOrEqual(argsOf(chosen))
    }
  })
})
