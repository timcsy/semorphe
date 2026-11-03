/**
 * **程式碼**——理解的「元素」那一層。
 *
 * ⚠️ 它在有些宿主上不存在（VSCode 用自己的編輯器），所以 `availableIn`
 * 問的是**能力**不是宿主的名字：`profile.features.codeEditorPane`。
 *
 * 🟢 **自己 `mount`**（第 241 刀，〈階段 8〉第 ① 條）——而「這一格是哪個編輯器」**仍由宿主決定**（`profile.createCodeView`）：
 * 這份宣告不認識任何一個具體的編輯器。⚠️ 實例**每次都建**：沒有這一格的宿主（VSCode）建的是橋接那一份，同步照樣要它。
 */
import type { PanelSpec } from '../../core/host/panel-spec'

const spec: PanelSpec = {
  id: 'code',
  layer: 'element',
  nameKey: 'LAYER_ELEMENT',
  availableIn: (profile) => profile.features.codeEditorPane,
  mount: (container, ctx) => ({ view: ctx.profile.createCodeView(container) }),
}
export default spec
