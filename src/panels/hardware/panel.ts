/**
 * **硬體**（spec 184，重構階段 5c）——板子上的程式做了什麼：每支腳一條時間軸、結束時的板子狀態。
 * 資料來自 Cella 的判決（`core/hardware.ts`），不另外執行一次。
 *
 * 🟢 **第一個自己 `mount` 的面板**——畫法住在這個資料夾（`view.ts`），不在組裝點（第一百二十五條護欄數著還在組裝點的那幾個）。
 * 組裝點要餵資料時從面板實例的 `view` 拿到 `HardwarePanel`。
 */
import type { PanelSpec } from '../../core/host/panel-spec'
import { HardwarePanel } from './view'

const spec: PanelSpec = {
  id: 'hardware',
  layer: 'state',
  order: 3,
  nameKey: 'PANEL_HARDWARE',
  mount: (container) => ({ view: new HardwarePanel(container) }),
}
export default spec
