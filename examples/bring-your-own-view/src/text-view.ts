/**
 * **一個自帶的視圖**——它是一塊字串緩衝，不是積木也不是編輯器。
 *
 * 這個檔存在的理由是**否證一個結構假設**：
 * 「`ViewHost` 協定夠不夠讓 repo 外面的人接上即時互轉？」
 *
 * ⚠️ 同一招在這個 repo 用過一次而且成功了——`src/views/semantic-tree-view.ts`
 * 的註解逐字寫著它為什麼存在：
 * 「Used to **verify** that the concept/blockDef split enables views
 * independent of the Blockly projection layer」——而它逼出了今天的 `ViewHost`。
 *
 * 🔴 **它只 import 出貨的產物**（`dist-sdk/semorphe.mjs`），
 * 一行 `src/` 都沒有——這個例子裡如果出現 `../../../src/`，
 * 它就不再證明「repo 外面的人接得上」，只證明「repo 裡面的人接得上」。
 */
import type {
  ViewHost,
  ViewConfig,
  SemanticUpdateEvent,
  ExecutionStateEvent,
  SemanticNode,
} from '../../../dist-sdk/semorphe.mjs'

export class TextView implements ViewHost {
  readonly viewId = 'byo-text'
  readonly viewType = 'text-buffer'
  readonly capabilities = {
    editable: true,
    needsLanguageProjection: true,
    consumedAnnotations: [],
  }

  /** 這個視圖看到的最後一棵語義樹 */
  tree: SemanticNode | null = null
  /** 這個視圖看到的最後一份程式碼投影 */
  code = ''
  /** 收到幾次更新——**入口條件要用它證明線真的通了** */
  updates = 0

  async initialize(_config: ViewConfig): Promise<void> {}
  dispose(): void {}

  onSemanticUpdate(event: SemanticUpdateEvent): void {
    this.updates++
    this.tree = event.tree
    if (typeof event.code === 'string') this.code = event.code
  }

  /** 明確地不接——這個視圖不顯示執行狀態 */
  onExecutionState(_event: ExecutionStateEvent): void {}
}
