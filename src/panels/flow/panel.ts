/**
 * **流程**——理解的「關係」那一層。
 *
 * 🔴 它是 **flow-based 的節點圖，不是 flow chart**（history/148）。
 *
 * 🟢 **自己 `mount`**（spec 217 第二刀）——畫法在 `view.ts`；積木登錄表由宿主經 context 給（`ctx.blockSpecs`）。
 */
import type { PanelSpec } from '../../core/host/panel-spec'
import { FlowPanel } from './view'

const spec: PanelSpec = {
  id: 'flow',
  layer: 'relation',
  nameKey: 'LAYER_RELATION',
  mount: (container, ctx) => ({ view: new FlowPanel(container, ctx.blockSpecs) }),
}
export default spec
