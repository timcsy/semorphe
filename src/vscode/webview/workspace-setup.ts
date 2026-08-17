/**
 * 把「一份組態」變成「一個畫得出來的工作區」。
 *
 * ## 它做什麼
 *
 * ```
 * PanelConfig（targetId…） → target → topic → 可見概念 → 工具箱
 *                                          → 風格 preset（產生程式碼用）
 * ```
 *
 * ## 🔴 用 glob 掃 topics／targets，不寫清單
 *
 * `src/ui/app.ts:122-133` 手寫了 4 個 topic ＋ 4 個 target 的 import 與註冊。
 * 這裡**不複製那份清單**——理由與膠囊登錄表同一條
 * （`core/component/registry.ts` 檔頭）：
 *
 * > **手寫清單的話「加一個」＝ 編輯一個既有的共用檔，
 * > 而掃描之後「加一個」＝ 新增一個檔案，零編輯。**
 *
 * ⚠️ **而更重要的是它在這裡防的是【漂移】**：
 * 兩份手寫清單一定會分岔，而症狀是「網頁版有這個課程而擴充沒有」
 * ——**那不會有任何測試變紅**（`history/072` 的形狀）。
 *
 * 🟢 一個 glob **在構造上不可能少列**。
 *
 * ⚠️ 而 `app.ts` 那份清單本輪**不動**：它是既有的，改它要動網頁版
 * （spec 139 的 Complexity Tracking 只授權動 `createDarkTheme` 一處）。
 * **本檔留下這段註記，讓它成為一個看得見的重複，而不是一個沒人知道的重複。**
 */
import * as Blockly from 'blockly'
import { TopicRegistry } from '../../core/topic-registry'
import { TargetRegistry } from '../../core/target-registry'
import { getVisibleConcepts } from '../../core/level-tree'
import { buildToolbox } from '../../ui/toolbox-builder'
import { cppCategoryDefs } from '../../languages/cpp/toolbox-categories'
import { CATEGORY_COLORS } from '../../ui/theme/category-colors'
import type { BlockSpecRegistry } from '../../core/block-spec-registry'
import type { Target, Topic, StylePreset } from '../../core/types'
import type { PanelConfig } from '../sync/settings'

const TOPIC_FILES = import.meta.glob('/src/languages/cpp/topics/*.json', { eager: true }) as Record<
  string,
  { default: Topic }
>
const TARGET_FILES = import.meta.glob('/src/languages/cpp/targets/*.json', { eager: true }) as Record<
  string,
  { default: Target }
>
const STYLE_FILES = import.meta.glob('/src/languages/cpp/styles/*.json', { eager: true }) as Record<
  string,
  { default: StylePreset }
>

export interface WorkspaceSetup {
  target: Target
  topic: Topic
  style: StylePreset
  visibleConcepts: Set<string>
  toolbox: object
}

/** ⚠️ 顯式的預設：組態指不到東西時要**看得出來**，不是靜默用第一個。 */
function requireOr<T>(map: Map<string, T>, id: string, fallbackId: string, what: string): T {
  const hit = map.get(id) ?? map.get(fallbackId)
  if (!hit) {
    throw new Error(
      `找不到${what}「${id}」，而預設的「${fallbackId}」也不在（掃到 ${map.size} 個）。` +
        '若這個數字是 0，代表登錄表根本沒被打包進來。',
    )
  }
  return hit
}

export function setupWorkspace(
  blockSpecRegistry: BlockSpecRegistry,
  config: PanelConfig,
): WorkspaceSetup {
  const topicRegistry = new TopicRegistry()
  const targetRegistry = new TargetRegistry()
  const topics = new Map<string, Topic>()
  const targets = new Map<string, Target>()
  const styles = new Map<string, StylePreset>()

  for (const m of Object.values(TOPIC_FILES)) {
    topicRegistry.register(m.default)
    topics.set(m.default.id, m.default)
  }
  for (const m of Object.values(TARGET_FILES)) {
    targetRegistry.register(m.default)
    targets.set(m.default.id, m.default)
  }
  for (const m of Object.values(STYLE_FILES)) styles.set(m.default.id, m.default)

  const target = requireOr(targets, config.targetId, 'cpp', '目標')
  // 組態可以直接指定 topic／style（覆寫 target 的選擇）——
  // ⚠️ 而**沒指定時以 target 為準**，那正是「目標 ＝ 具名組合」的意義。
  const topic = requireOr(topics, config.topicId ?? target.topic, target.topic, '課程清單')
  const style = requireOr(styles, config.styleId ?? target.style, target.style, '風格')

  // 只開根節點——與網頁版的預設相同（`app.ts:138`）。
  const enabledBranches = new Set([topic.levelTree.id])
  const visibleConcepts = getVisibleConcepts(topic, enabledBranches)

  return {
    target,
    topic,
    style,
    visibleConcepts,
    toolbox: buildToolbox({
      blockSpecRegistry,
      visibleConcepts,
      // ⚠️ 由風格導出，不是另外選一個——與網頁版同一條規則。
      ioPreference: style.io_style === 'printf' ? 'cstdio' : 'iostream',
      msgs: Blockly.Msg as Record<string, string>,
      categoryColors: CATEGORY_COLORS,
      categoryDefs: cppCategoryDefs,
    }),
  }
}
