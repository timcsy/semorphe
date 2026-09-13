/**
 * **程式碼**——理解的「元素」那一層。
 *
 * ⚠️ 它在有些宿主上不存在（VSCode 用自己的編輯器），所以 `availableIn`
 * 問的是**能力**不是宿主的名字：`profile.features.codeEditorPane`。
 */
import type { PanelSpec } from '../../core/host/panel-spec'

const spec: PanelSpec = {
  id: 'code',
  layer: 'element',
  nameKey: 'LAYER_ELEMENT',
  availableIn: (profile) => profile.features.codeEditorPane,
  mountedByShell: true,
}
export default spec
