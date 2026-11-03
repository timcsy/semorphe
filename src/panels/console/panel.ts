/**
 * **主控台**——理解的「狀態」那一層的第一頁。
 *
 * ⚠️ `state` 這一層有**兩份宣告**（主控台與變數），而那時它們是
 * 那一格的**分頁**，不是兩格——見 `PanelSpec.layer` 的說明。
 * 順序由 `order` 決定，不靠 `import.meta.glob` 的鍵順序。
 *
 * 🟢 **自己 `mount`**（第 240 刀，〈階段 8〉第 ① 條；同 `variables/panel.ts`）——畫法住在這個資料夾（`view.ts`）。
 * ⚠️ 實例**每次都建**：它是執行的輸出／輸入端點，宿主那側的終端機是它的鏡射——「不畫那一格」與「沒有主控台」是兩件事。
 */
import type { PanelSpec } from '../../core/host/panel-spec'
import { ConsolePanel } from './view'

const spec: PanelSpec = {
  id: 'console',
  layer: 'state',
  order: 1,
  nameKey: 'PANEL_CONSOLE',
  mount: (container) => ({ view: new ConsolePanel(container) }),
}
export default spec
