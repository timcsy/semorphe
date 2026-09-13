/**
 * **主控台**——理解的「狀態」那一層的第一頁。
 *
 * ⚠️ `state` 這一層有**兩份宣告**（主控台與變數），而那時它們是
 * 那一格的**分頁**，不是兩格——見 `PanelSpec.layer` 的說明。
 * 順序由 `order` 決定，不靠 `import.meta.glob` 的鍵順序。
 */
import type { PanelSpec } from '../../core/host/panel-spec'

const spec: PanelSpec = {
  id: 'console',
  layer: 'state',
  order: 1,
  nameKey: 'PANEL_CONSOLE',
  mountedByShell: true,
}
export default spec
