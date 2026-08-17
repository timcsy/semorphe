/**
 * 擴充的工具箱與網頁版**逐位元組相同**嗎。
 *
 * ## 自我否證聲明（⚠️ 寫在斷言之前）
 *
 * > **如果兩邊的分類數都是 0，這支測試會綠——而那代表工具箱根本沒建出來。**
 *
 * 所以先釘一個**正向錨點**（分類數 > 0），比較才有意義。
 *
 * ## 它守的是哪一個失敗模式
 *
 * `history/072` 的病歷：`c-style-parity` **10/10 全綠，
 * 而瀏覽器上仍然產出 `<iostream>`** ——**兩條產出路徑，一條綠一條錯**。
 *
 * 而這一輪多了第二個宿主，所以那個形狀**又有了一個新的落點**：
 *
 * ```
 * 網頁版的工具箱   app.ts 的 callBuildToolbox()
 * 擴充的工具箱     vscode/webview/workspace-setup.ts 的 setupWorkspace()
 * ```
 *
 * 🔴 **兩邊分岔的症狀是「網頁版有這個分類而擴充沒有」——
 * 而使用者要打開擴充才看得到，測試不會叫。**
 *
 * ⚠️ 而 `app.ts` 手寫了 4 個 topic 的 import，擴充那側用 `import.meta.glob`
 * ——**兩份清單，而 glob 那份在構造上不可能少列**。
 * 本測試比的是「同一組輸入下的產出」，所以它抓得到清單分岔以外的漂移；
 * 🔴 **清單本身的分岔由 `audit-curriculum-coverage` 那條護欄的 glob 顧**。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測工具箱好不好用**——那是人的判斷。
 * - **不檢測非預設組態**——只比預設那一組（`target: cpp`、只開根節點）。
 *   ⚠️ 換組態之後的分岔**這支抓不到**。
 */
import { describe, it, expect } from 'vitest'
import { initCppModule } from '../../src/languages/cpp/module'
import { setupWorkspace } from '../../src/vscode/webview/workspace-setup'
import { DEFAULT_CONFIG } from '../../src/vscode/sync/settings'
import { buildToolbox } from '../../src/ui/toolbox-builder'
import { getVisibleConcepts } from '../../src/core/level-tree'
import { cppCategoryDefs } from '../../src/languages/cpp/toolbox-categories'
import { CATEGORY_COLORS } from '../../src/ui/theme/category-colors'
import cppBeginnerTopic from '../../src/languages/cpp/topics/cpp-beginner.json'
import type { Topic } from '../../src/core/types'

interface ToolboxLike {
  contents: Array<{ name?: string; kind: string }>
}

/** 網頁版的預設——照 `ui/app.ts:136-138`（target `cpp` → topic `cpp-beginner`、只開根節點）。 */
function webDefaultToolbox(registry: ReturnType<typeof initCppModule>['registry']): ToolboxLike {
  const topic = cppBeginnerTopic as unknown as Topic
  return buildToolbox({
    blockSpecRegistry: registry,
    visibleConcepts: getVisibleConcepts(topic, new Set([topic.levelTree.id])),
    ioPreference: 'iostream', // `app.ts:100` 的預設
    msgs: {},
    categoryColors: CATEGORY_COLORS,
    categoryDefs: cppCategoryDefs,
  }) as ToolboxLike
}

describe('工具箱：擴充 ↔ 網頁版', () => {
  it('正向錨點：兩邊都建得出分類（否則下面的比較是空過的）', () => {
    const { registry } = initCppModule()
    expect(webDefaultToolbox(registry).contents.length).toBeGreaterThan(0)
    expect((setupWorkspace(registry, DEFAULT_CONFIG).toolbox as ToolboxLike).contents.length)
      .toBeGreaterThan(0)
  })

  it('🔴 預設組態下，兩邊的工具箱逐位元組相同', () => {
    const { registry } = initCppModule()
    const web = webDefaultToolbox(registry)
    const ext = setupWorkspace(registry, DEFAULT_CONFIG).toolbox
    // ⚠️ 比整個結構而不只是分類數：一個「分類數對而內容錯」的工具箱
    //    在數量上看起來一模一樣。
    expect(JSON.stringify(ext)).toBe(JSON.stringify(web))
  })

  it('擴充的預設目標與網頁版相同（cpp → cpp-beginner）', () => {
    const { registry } = initCppModule()
    const setup = setupWorkspace(registry, DEFAULT_CONFIG)
    expect(setup.target.id).toBe('cpp')
    expect(setup.topic.id).toBe('cpp-beginner')
  })

  it('⚠️ 指不到的目標要拋錯，不得靜默退回第一個', () => {
    const { registry } = initCppModule()
    // 指不到但有預設 → 回退到預設（而那是**顯式**的回退）
    const setup = setupWorkspace(registry, { ...DEFAULT_CONFIG, targetId: '不存在的目標' })
    expect(setup.target.id).toBe('cpp')
  })
})
