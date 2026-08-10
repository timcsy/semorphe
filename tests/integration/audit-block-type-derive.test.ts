/**
 * 第三十六條護欄：**積木型別必須從概念身分導出**
 *
 * 量：專案宣告的積木裡，`blockDef.type` 不等於 `deriveBlockType(conceptId, form)`
 * 的筆數。
 *
 * ## 自我否證聲明（寫在量測之前）
 *
 * > **如果這條護欄掃到的積木數少於 150，代表工具壞了，不是世界長這樣。**
 *
 * 專案今天有 186 顆宣告過的積木（實測）。掃到遠少於這個數，代表
 * `allCppProjections()` 沒有真的被載入——而那時「不符 0 筆」會是假的綠。
 *
 * ⚠️ **錨在「掃到幾顆」上，不是錨在「還有幾筆不符」上。**
 * 後者是這條護欄要推向零的數字——錨在那上面的話，**它會在成功的那天變紅**。
 * 這個專案已經犯過五次同一個錯（辨識歧義、雙重真相、分類、完備性、元件身分健檢）。
 *
 * ## 本護欄不檢測什麼
 *
 * - **使用者上傳的自訂積木**。它們沒有 conceptId，導出規則對它們不成立
 *   （`onUploadCustomBlocks` → `Blockly.common.defineBlocksWithJsonArray`）。
 *   範圍是「**專案宣告的**積木」，不是「Blockly 執行期認得的積木」——
 *   而這兩者在執行期是同一個 registry。
 * - **積木的長相**（欄位順序、顏色、形狀）。那需要一套設計語彙，而它還不存在。
 * - **積木型別在程式碼裡的引用是否跟著改**。那由既有的雙重真相護欄與
 *   來回轉換測試覆蓋。
 *
 * 見 `specs/116-block-type-derive/`
 */
import { describe, it, expect } from 'vitest'
import { printReport } from '../helpers/guardrail'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { deriveBlockType, assertDerivedNamesUnique, type 積木宣告 } from '../../src/core/component/derive-block-type'
import { registerCppLanguage } from '../../src/languages/cpp/generators'

registerCppLanguage()

interface 不符 {
  conceptId: string
  實際: string
  應該: string
  種類: '只差前綴' | '主體不同'
}

function 量(): { 全部: 積木宣告[]; 不符們: 不符[] } {
  const 全部: 積木宣告[] = []
  const 不符們: 不符[] = []
  for (const p of allCppProjections()) {
    const t = (p.blockDef as { type?: string } | undefined)?.type
    if (!p.conceptId || !t) continue
    全部.push({ conceptId: p.conceptId, form: p.form ?? null, blockType: t })
    const 應該 = deriveBlockType(p.conceptId, p.form ?? null)
    if (t === 應該) continue
    // 去掉前綴之後主體還一樣的，是「只差前綴」那一批——它們便宜。
    const 去前綴 = (x: string) => x.replace(/^(u_|c_|cpp_)/, '')
    不符們.push({
      conceptId: p.conceptId,
      實際: t,
      應該,
      種類: 去前綴(t) === 去前綴(應該) ? '只差前綴' : '主體不同',
    })
  }
  return { 全部, 不符們 }
}

describe('護欄：積木型別必須從概念身分導出', () => {
  const { 全部, 不符們 } = 量()

  it('自我否證：掃到的積木數不得少於 150——少於就是沒真的載入（SC-001 的前提）', () => {
    // ⚠️ 這一句錨在「工具吃到輸入沒有」上。它**不會**因為不符數歸零而變紅。
    expect(全部.length, '掃到的積木太少，代表 allCppProjections() 沒被載入').toBeGreaterThanOrEqual(150)
  })

  it('產出可讀報表：不符的每一筆都指名', () => {
    const 前綴 = 不符們.filter((x) => x.種類 === '只差前綴')
    const 主體 = 不符們.filter((x) => x.種類 === '主體不同')
    const lines = [
      `判定規則：blockDef.type 必須等於 conceptId 把 ':' 換成 '_'；` +
        `非中性形態再接 '_' + form.value。`,
      '',
      `專案宣告的積木 ${全部.length} 顆｜不符 ${不符們.length}` +
        `（只差前綴 ${前綴.length}、主體不同 ${主體.length}）`,
      '',
      '⚠️ 兩批的性質不同：只差前綴是機械的；主體不同的是**化石**' +
        '（用了命名整理已經換掉的詞，例如 top → peek）。',
      '',
      ...不符們.slice(0, 20).map((x) => `  ${x.種類}  ${x.實際}  應該是  ${x.應該}`),
      不符們.length > 20 ? `  …其餘 ${不符們.length - 20} 筆` : '',
    ].filter(Boolean)
    printReport('積木型別導出', lines)
    expect(全部.length).toBeGreaterThan(0)
  })

  it('★ 導出名唯一——兩顆積木不得導出同一個型別（不變式 I1／I2）', () => {
    // 撞名的症狀是**安靜的**：Blockly registry 以 type 為鍵，後登錄的蓋掉先登錄的。
    // 這個專案已經被「後註冊的贏」咬過三次。
    expect(() => assertDerivedNamesUnique(全部)).not.toThrow()
  })

  it('★ 不符數 = 0（硬性零）', () => {
    // 硬性零而不是棘輪：留一筆在那裡，「一個名字」那句話就是假的
    // ——護欄會變成在替第二份命名背書。
    expect(
      不符們.map((x) => `${x.conceptId}｜宣告 ${x.實際}，導出應是 ${x.應該}（${x.種類}）`),
      '積木型別不等於身分的導出名——這顆元件有兩個名字。',
    ).toEqual([])
  })
})

describe('護欄自我驗證：兩個方向都要釘', () => {
  // ⚠️ 基線是 0 的時候這是**唯一**的健康檢查——一條回報零違規的健康護欄，
  // 與一條什麼都沒量到的護欄，產出完全相同。

  it('注入①：不導出的名字**會被報**，而且指得出是哪一顆', () => {
    // ⚠️ 這個「壞名字」是**合成的**（`__不導出的名字__`），不是真實世界的舊名。
    // 第一版用了真的舊名 `cpp_stack_top`——而改名腳本把它一起改掉了，
    // 於是**壞的輸入變成對的，注入測試靜靜地失去意義**。
    // build-guardrail 第 2 步：**錨點要挑合成的，不要挑真實世界的狀態。**
    const 壞的: 積木宣告[] = [
      { conceptId: 'cpp:stack_peek', form: null, blockType: '__不導出的名字__' },
    ]
    const 報出 = 壞的.filter((b) => b.blockType !== deriveBlockType(b.conceptId, b.form))
    expect(報出).toHaveLength(1)
    expect(報出[0].conceptId, '報出來的必須指名是哪一顆').toBe('cpp:stack_peek')
  })

  it('注入②：正確的輸入**不亂報**——三種形狀各一', () => {
    const 好的: 積木宣告[] = [
      { conceptId: 'cpp:stack_peek', form: null, blockType: 'cpp_stack_peek' },
      {
        conceptId: 'cpp:var_declare',
        form: { axis: 'role', value: 'expression' },
        blockType: 'cpp_var_declare_expression',
      },
      {
        conceptId: 'cpp:container_push',
        form: { axis: 'container_kind', value: 'stack' },
        blockType: 'cpp_container_push_stack',
      },
    ]
    expect(好的.filter((b) => b.blockType !== deriveBlockType(b.conceptId, b.form))).toEqual([])
  })

  it('注入③：兩個形態導出同名時，唯一性檢查**會丟錯**', () => {
    expect(() =>
      assertDerivedNamesUnique([
        { conceptId: 'cpp:x', form: { axis: 'a', value: 'v' }, blockType: 'cpp_x_v' },
        { conceptId: 'cpp:x', form: { axis: 'b', value: 'v' }, blockType: 'cpp_x_v' },
      ]),
    ).toThrow(/撞名/)
  })

  it('注入④：兩顆**不同身分**導出同名時也要丟錯', () => {
    expect(() =>
      assertDerivedNamesUnique([
        { conceptId: 'cpp:a_b', form: null, blockType: 'cpp_a_b' },
        { conceptId: 'cpp:a', form: { axis: 'x', value: 'b' }, blockType: 'cpp_a_b' },
      ]),
    ).toThrow(/導出同一個型別/)
  })
})
