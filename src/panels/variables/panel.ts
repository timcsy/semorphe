/**
 * **變數**——理解的「狀態」那一層的第二頁。見 `console/panel.ts` 的說明。
 *
 * 🟢 **自己 `mount`**（第 239 刀，〈階段 8〉「面板拆成可獨立掛載的視圖套件」第 ① 條；同 `hardware/panel.ts`）——畫法住在這個資料夾（`view.ts`）。
 * ⚠️ 而它與硬體不同的一點：**實例每次都建**，即使這個宿主不把它畫在下方面板（擴充：變數在 IDE 的 panel 區）——
 * 組裝點拿這個實例轉送快照給 IDE（`app.ts` 的 `onSnapshot` → `reportVariables`）。「建不建實例」與「加不加分頁」是兩件事。
 */
import type { PanelSpec } from '../../core/host/panel-spec'
import { VariablePanel } from './view'

const spec: PanelSpec = {
  id: 'variables',
  layer: 'state',
  order: 2,
  nameKey: 'PANEL_VARIABLES',
  mount: (container) => ({ view: new VariablePanel(container) }),
}
export default spec
