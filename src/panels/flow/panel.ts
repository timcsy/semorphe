/**
 * **流程**——理解的「關係」那一層。
 *
 * 🔴 它是 **flow-based 的節點圖，不是 flow chart**（history/148）。
 */
import type { PanelSpec } from '../../core/host/panel-spec'

const spec: PanelSpec = {
  id: 'flow',
  layer: 'relation',
  nameKey: 'LAYER_RELATION',
  mountedByShell: true,
}
export default spec
