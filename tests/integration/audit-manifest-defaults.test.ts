/**
 * **第九十五條護欄**：擴充宣告的預設值，必須是登錄表裡真的存在的 id。
 *
 * ## 它從哪來
 *
 * 2026-08-31 使用者：「我用 Arduino IDE 把 semorphe 開起來，
 * 原本的 `setup` 和 `loop` 會被 C++ 預設骨架覆蓋」。
 *
 * 根因：`vscode/manifest.ts` 把 `semorphe.target` 的預設值宣告為
 * `'cpp-beginner'`——**而那不是一個目標，是一個課程清單的 id**
 * （登錄的目標是 `cpp`／`c`／`cpp-advanced`／`arduino`／`arduino-uno`／`esp32`…）。
 *
 * 認不得的 ID 在下游「回退到現況」而**不出聲**，於是目標停在 `cpp`，
 * C++ 的骨架把 `int main()` 接到使用者的 `.ino` 上。
 * 🟢 用 `tools/vscode-preflight` 重現過：把設定改成那個值，檔案當場被改。
 *
 * ## 🔴 而這個病【已經被診斷過一次】
 *
 * `vscode/sync/settings.ts:65` 逐字：
 *
 * > 「🔴 這裡曾經寫 `'cpp-beginner'`——**而那個目標不存在**……
 * >  ⚠️ 一個認不得的 ID 在下游是『回退到現況』，所以它**不會出聲**
 * >  ——設定看起來有在運作，實際上這一格從來沒有生效過。」
 *
 * **那次修好了 `DEFAULT_CONFIG`，而沒有修 `manifest.ts` 的那一份。**
 *
 * > **一個預設值如果在兩個地方各寫一次，
 * > 修好的那次不會把另一次帶走——而錯的那一份不會出聲。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果登錄表裡的目標數是 0，代表語言套件沒載入，這份結果不算數
 * > ——不是「預設值都合法」。**
 *
 * 錨在**登錄了幾個目標**（合成量）。它不會因為這個缺陷被修好而變小。
 * 🔴 **刻意不錨在「不合法的預設值有幾個」**——那正是要推向零的。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測預設值好不好**（`cpp` vs `arduino` 哪個當預設）——只檢測它**存在**
 * - **不檢測使用者自己設的值**：那是執行期的事，處置是「回退並**出聲**」
 *   （`ui/app.ts` 的 `applyHostConfig`，2026-08-31 補上）
 * - ⚠️ **不檢測其他設定格**（風格、積木外觀、語系）——它們的登錄表形狀不同，
 *   要各自加。**列舉已知的，等於保證下一個會被漏掉**，所以下面錨在
 *   「有幾格宣告了非 null 的預設」，加一格而沒被檢查時它會出聲。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { buildManifest } from '../../src/vscode/manifest'
import { loadAllLanguagePacks } from '../../src/core/load-language-packs'
import { allLanguagePacks } from '../../src/core/language-packs'

/**
 * 登錄的目標 id。
 *
 * ⚠️ **問語言套件，不自己讀 `targets/*.json`**——`arduino-pins.ts:54` 記著
 * 那個坑：「而產品讀的是 `targets/*.json`——護欄測的是一份沒有人在用的副本」。
 * 這裡走的是產品那條（`app.ts:287` 也是 `pack.targets`）。
 */
let targetIds: string[] = []

beforeAll(() => {
  loadAllLanguagePacks()
  targetIds = allLanguagePacks().flatMap((p) => p.targets.map((t) => t.id))
})

/** `contributes.configuration` 裡宣告了非 null 預設值的那幾格 */
function nonNullDefaults(): { key: string; value: unknown }[] {
  const m = buildManifest() as unknown as {
    contributes: { configuration?: { properties?: Record<string, { default?: unknown }> } }
  }
  const props = m.contributes.configuration?.properties ?? {}
  return Object.entries(props)
    .filter(([, v]) => v.default !== null && v.default !== undefined)
    .map(([key, v]) => ({ key, value: v.default }))
}

describe('第九十五條護欄：宣告的預設值必須存在', () => {
  it('★ 入口條件——目標登錄表真的載入了', () => {
    // 錨在**登錄了幾個目標**（合成量），見檔頭的自我否證
    expect(
      targetIds.length,
      '🔴 登錄表裡一個目標都沒有 → 語言套件沒載入，這份報表不算數。' +
        '⚠️ 這【不】代表預設值都合法。',
    ).toBeGreaterThan(3)
  })

  it('★ 入口條件——真的讀到 manifest 的設定格了', () => {
    const m = buildManifest() as unknown as {
      contributes: { configuration?: { properties?: Record<string, unknown> } }
    }
    expect(
      Object.keys(m.contributes.configuration?.properties ?? {}).length,
      '🔴 manifest 裡一格設定都沒有 → 讀錯地方了',
    ).toBeGreaterThan(2)
  })

  it('硬性零：`semorphe.target` 的預設值要嘛是 null，要嘛是一個真的目標', () => {
    const target = nonNullDefaults().find((d) => d.key === 'semorphe.target')
    if (!target) return   // null＝依副檔名自動判斷，那是現在的設計
    const ids = targetIds
    expect(
      ids,
      `🔴 \`semorphe.target\` 宣告的預設值是「${String(target.value)}」，而登錄表裡沒有它。\n` +
        `⚠️ 認不得的 ID 在下游【回退到現況】——設定看起來有在運作，而它從來沒有生效過。\n` +
        `登錄的目標：${ids.join('、')}`,
    ).toContain(String(target.value))
  })

  it('🔴 而「有幾格宣告了非 null 預設」要看得見——加一格而沒被檢查時它會出聲', () => {
    // ⚠️ 這一條**不是硬性零**：它是一個可見的數字。
    //    今天只有 `semorphe.blockStyle`（'default'）與 `semorphe.locale`（'follow-host'），
    //    而那兩格的合法值不住在 `TargetRegistry` 裡。
    //
    // > **列舉已知的，等於保證下一個會被漏掉**——所以這裡量的是【有幾格】，
    // > 而不是「這幾格對不對」。數字動了就要有人回來看它該不該進上面那條。
    const keys = nonNullDefaults().map((d) => d.key).sort()
    expect(
      keys,
      `🟡 宣告了非 null 預設值的設定格變了：${JSON.stringify(keys)}\n` +
        '——新增的那一格，它的合法值有人在檢查嗎？沒有的話請照上面那條加一條。',
    ).toEqual(['semorphe.blockStyle', 'semorphe.locale'])
  })
})
