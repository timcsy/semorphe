/**
 * SC-003：**一份遷移前存的檔案，載入後產出的程式碼逐字相同**
 *
 * 這一支釘的是整個 D 項唯一不可逆的風險：改名動的是**真實**，
 * 而使用者的存檔裡寫著舊名字。P8 的範圍（`knowledge/history/026`）
 * 因此要求這類變更 MUST 附一次性轉換——這裡驗它真的成立。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { UPGRADES, upgrade, CURRENT_VERSION } from '../../src/core/storage-version'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import '../../src/languages/cpp/all-declarations'

const STYLE = apcs as unknown as StylePreset

/** 一份 v2 存檔的語義樹——**全部是舊格式身分**，逐字保留當時的樣子 */
const v2Tree = {
  componentId: 'program',
  properties: {},
  children: {
    body: [
      {
        componentId: 'func_def',
        properties: { name: 'main', return_type: 'int' },
        children: {
          params: [],
          body: [
            {
              componentId: 'var_declare',
              properties: { name: 'x', type: 'int' },
              children: { initializer: [{ componentId: 'number_literal', properties: { value: '42' }, children: {} }] },
            },
            {
              componentId: 'cpp_vector_declare',
              properties: { name: 'v', type: 'int' },
              children: {},
            },
            {
              componentId: 'print',
              properties: {},
              children: { values: [{ componentId: 'var_ref', properties: { name: 'x' }, children: {} }] },
            },
          ],
        },
      },
    ],
  },
}

describe('SC-003：v2 存檔升級後產出不變', () => {
  beforeAll(() => registerCppLanguage())

  // ⚠️ 走**完整的升級鏈**，不是只呼叫 `UPGRADES[2]`。
  // D1 之後 v2 的目標（`lang:*`）又被 v4→v5 帶到 `cpp:*`——
  // 只跑一段會停在中繼點上，而那個 id 不存在。
  // ⚠️ **升到 v10 為止，不是最新**：v11 把 `tree` 從存檔裡拿掉了
  //    （沒有任何還原路徑在讀它），而這一支要驗的正是 v1→v9 那八個改寫 `tree` 的步驟。
  //    **一個沒有辦法被單獨驗證的升級步驟，等於沒有被驗證過。**
  const rise = (tree: unknown): SemanticNode => {
    // ⚠️ `upgrade()` 走完鏈之後會用 `judge()` 驗形狀，所以必填欄位要齊——
    // 只給 `{ version, tree }` 會以「升級後仍然不是可用的存檔」失敗，
    // 而那個訊息與「遷移壞了」長得不一樣，值得一眼看得出來。
    const r = upgrade(
      {
        version: 2, tree, blocklyState: {}, code: '', language: 'cpp',
        styleId: 'apcs', lastModified: 0,
      } as Record<string, unknown>,
      2,
      10, // ⚠️ 停在 `tree` 還在的最後一版——見上面那段
    )
    if (!r.ok) throw new Error(`升級失敗：${r.reason}`)
    return (r.value as { tree: SemanticNode }).tree
  }

  it('★ 升級後每一顆身分都是新格式', () => {
    void UPGRADES
    const ids: string[] = []
    const walk = (n: SemanticNode): void => {
      ids.push(n.componentId)
      for (const arr of Object.values(n.children ?? {})) arr.forEach(walk)
    }
    walk(rise(v2Tree))
    expect(ids.filter((i) => !i.includes(':')), '升級後仍有舊格式身分').toEqual([])
  })

  it('★ 產出的程式碼是完整可讀的 C++（不是一串 ⟨unknown⟩）', () => {
    const code = generateCode(rise(v2Tree), 'cpp', STYLE)
    expect(code).toContain('int x = 42;')
    expect(code).toContain('vector<int> v;')
    expect(code).toContain('cout << x')
    expect(code, '有身分沒轉成功 → 產生器找不到它，會退化成佔位符').not.toContain('⟨')
  })

  it('★ 反向：不升級直接產出 → **必須**是壞的', () => {
    // 沒有這一支的話，上一支綠可能只是因為「舊身分本來也產得出來」——
    // 那樣的話整個轉換就是白做的。
    const code = generateCode(v2Tree as unknown as SemanticNode, 'cpp', STYLE)
    expect(code, '舊身分不升級也產得出正確程式碼 → 那這個轉換沒有存在的必要').toContain('⟨')
  })
})
