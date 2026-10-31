/**
 * **硬體**（spec 184，重構階段 5c）——板子上的程式做了什麼：每支腳一條時間軸、結束時的板子狀態。
 * 資料來自 Cella 的判決（`core/hardware.ts`），不另外執行一次。
 */
import type { PanelSpec } from '../../core/host/panel-spec'

const spec: PanelSpec = {
  id: 'hardware',
  layer: 'state',
  order: 3,
  nameKey: 'PANEL_HARDWARE',
  mountedByShell: true,
}
export default spec
