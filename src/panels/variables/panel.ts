/**
 * **變數**——理解的「狀態」那一層的第二頁。見 `console/panel.ts` 的說明。
 */
import type { PanelSpec } from '../../core/host/panel-spec'

const spec: PanelSpec = {
  id: 'variables',
  layer: 'state',
  order: 2,
  nameKey: 'PANEL_VARIABLES',
  mountedByShell: true,
}
export default spec
