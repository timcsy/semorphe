/**
 * **積木**——理解的「空間」那一層，而它是這個產品的主體。
 *
 * 🟢 **自己 `mount`**（spec 217 第三刀）——畫法在 `view.ts`（與兩個拖曳輔助、深色主題同一個目錄）；
 * 宿主經 context 給：積木登錄表（`blockSpecs`）、工具箱與語言的接線（`blocks`）、通知（`notify`）。
 * ⚠️ 面板不認得任何一個語言：使用者 2026-11-04 定 A'——接點與角色日後讀契約，顏色與形狀留在這裡。
 */
import type { PanelSpec } from '../../core/host/panel-spec'
import { BlocklyPanel } from './view'

const spec: PanelSpec = {
  id: 'blocks',
  layer: 'space',
  nameKey: 'LAYER_SPACE',
  mount: (container, ctx) => {
    if (!ctx.blockSpecs || !ctx.blocks) throw new Error('積木這一格要宿主給積木登錄表與工具箱（ctx.blockSpecs／ctx.blocks）')
    const view = new BlocklyPanel({
      container,
      blockSpecRegistry: ctx.blockSpecs,
      buildProgramRoot: ctx.blocks.buildProgramRoot as never,
      installExtractStrategies: ctx.blocks.installExtractStrategies as never,
      media: ctx.blocks.media,
      notify: ctx.notify,
    })
    view.init(ctx.blocks.toolbox as never)
    return { view }
  },
}
export default spec
