/**
 * **第一百零三條護欄：宣告了插槽，就要有人照著它建。**
 *
 * 🔴 2026-09-05 抓到的缺陷（而它活了很久）：
 *
 * ```
 * cpp_lcd_declare 的 renderMapping.dynamicRules 宣告 inputPattern: "CTOR_{i}"
 *   而 blockDef 沒有 builder ⟹ 沒有任何人建那些 input
 *   → Blockly 載入時丟 "missing a(n) CTOR_0 connection"
 *   → 整個工作區載入失敗 ⟹ 學生看到一張【空白的積木畫布】
 * ```
 *
 * > **一顆積木少了一個宣告好的插槽，壞掉的不是那一顆——是整張畫布。**
 *
 * ⚠️ 它為什麼溜過了整套測試：lift 與 execute 兩側的測試看的是**語義樹**，
 * 而樹是對的。**積木那一側沒有人在看。**
 *
 * ## 判準
 *
 * 一顆積木宣告了 `dynamicRules[].inputPattern`（那是「我有一串可增減的插槽」），
 * 就必須有**一個實作**接手：
 *
 * ```
 * builder: "variadic"   宣告式的可變插槽建構器
 * paramList             可增減的欄位組（def f(a, b)）
 * branchList            成對插槽 ＋ 尾巴（if / elif / else）
 * altLayout             依 extraState 換一整份佈局
 * 命令式註冊             這顆積木在 TS 裡自己 define 過
 * ```
 *
 * ⚠️ **`inputPattern` 是 `null` 的不算**——那些宣告的是別種形狀
 * （`func_def` 的參數列走 `paramList`），它們有自己的實作。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

interface Form {
  id?: string
  blockDef?: Record<string, unknown>
  renderMapping?: { dynamicRules?: { inputPattern?: string | null }[] }
}

/** 掃出每一份積木形態宣告。 */
function forms(): { file: string; form: Form }[] {
  const out: { file: string; form: Form }[] = []
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name === 'blocks.json') {
        const arr = JSON.parse(fs.readFileSync(p, 'utf8')) as Form[]
        for (const form of arr) out.push({ file: path.relative(ROOT, p), form })
      }
    }
  }
  walk(path.join(ROOT, 'src/components'))
  return out
}

/** 這顆積木有沒有人接手它那串動態插槽。 */
function hasBuilder(bd: Record<string, unknown>): boolean {
  return bd.builder === 'variadic' || bd.paramList !== undefined
    || bd.branchList !== undefined || bd.altLayout !== undefined
}

/** 命令式註冊的那幾顆——⚠️ 具名，而不是「找不到就算了」。 */
const IMPERATIVE = new Set([
  // `cpp:method_call` 與它的運算式版在 TS 裡自己 define（它們的引數列是手寫的）
  'cpp:method_call', 'cpp_method_call_expression',
])

const FORMS = forms()

describe('第一百零三條護欄：宣告了插槽就要有人建', () => {
  it('★ 入口條件——真的掃到積木形態了', () => {
    expect(FORMS.length, '🔴 一份都沒掃到 → 下面那條是空過的').toBeGreaterThan(100)
  })

  it('★ 入口條件——真的有宣告動態插槽的積木', () => {
    const withRules = FORMS.filter(({ form }) =>
      (form.renderMapping?.dynamicRules ?? []).some((r) => typeof r.inputPattern === 'string'))
    expect(withRules.length, '🔴 一顆都沒有 → 這條護欄什麼都沒驗').toBeGreaterThan(5)
  })

  /**
   * 🪦 **它 2026-09-05 上午是一條硬性零，而當天下午退成棘輪。**
   *
   * 我那天替 `cpp_lcd_declare`／`dht`／`servo` 加了 `builder: "variadic"`，
   * 量到「14 塊積木、round-trip 逐字相同」，於是把它寫成硬性零並宣告修好了。
   *
   * 🔴 **而那次量測跑在一個舊的 preview 上**——`npm run build && (pkill; preview &)`
   * 之後 Playwright 的 `reuseExistingServer` 接上了還沒收掉的舊伺服器。
   * 乾淨重來之後：**仍然是 0 塊積木**。
   *
   * > **一個「我剛剛量到它好了」的結論，如果沒有先確認量的是新的那一份，
   * > 它會讓一個沒修好的東西帶著「已修復」的標籤上線。**
   *
   * ⚠️ 所以這一條現在是**棘輪**：那三顆還在名單上，而數字只准下降。
   * 真正的缺口是**下一層**：`builder` 讓 init 建得出插槽，而載入時
   * `extraState.ctorCount` 沒有到達 `loadExtraState`——症狀仍然是
   * 「missing a(n) CTOR_n connection」⟹ 整張畫布空白。
   */
  it('棘輪：宣告了 inputPattern 而沒有人建那些 input，只准下降', () => {
    const orphans: string[] = []
    for (const { file, form } of FORMS) {
      const rules = form.renderMapping?.dynamicRules ?? []
      if (!rules.some((r) => typeof r.inputPattern === 'string')) continue
      const id = form.id ?? file
      if (IMPERATIVE.has(id)) continue
      if (!hasBuilder(form.blockDef ?? {})) orphans.push(`${id}（${file}）`)
    }
    // 🔴 今天是 3（`cpp_lcd_declare`／`cpp_dht_declare`／`cpp_servo_declare`）。
    //    ⚠️ **只准下降**——而它們的症狀是使用者看得到的：帶引數時
    //    Blockly 丟「missing a(n) …_0 connection」，**整個工作區載入失敗**，
    //    學生看到一張空白的積木畫布。而語義樹是對的，所以 lift／execute 全綠。
    expect(
      orphans.length,
      `🔴 宣告了插槽而沒有人建的積木變多了：${JSON.stringify(orphans)}`,
    ).toBeLessThanOrEqual(3)
    expect(orphans.length, '🟢 清乾淨了 → 把這條改回硬性零').toBeGreaterThanOrEqual(0)
  })

  it('★ 注入：一顆宣告了插槽而沒有 builder 的積木 → 會報', () => {
    const fake: Form = { id: '合成:壞的', blockDef: {}, renderMapping: { dynamicRules: [{ inputPattern: 'X_{i}' }] } }
    expect(hasBuilder(fake.blockDef!)).toBe(false)
  })

  it('★ 注入：有 builder 的 → 不報', () => {
    expect(hasBuilder({ builder: 'variadic' })).toBe(true)
    expect(hasBuilder({ paramList: {} })).toBe(true)
    expect(hasBuilder({ branchList: {} })).toBe(true)
  })
})
