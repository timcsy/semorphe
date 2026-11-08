/**
 * C 家族的情境種類（spec 218）——登記進核心的情境登記處。核心不認得任何一種；種類的名字只寫在這裡與各自的檔案。
 * ⚠️ 冪等：測試裡 `registerCppLanguage` 可能被同一個檔呼叫不只一次。
 */
import { registerScenarioKind } from '../../../core/disambiguation/scenario-registry'
import { STDIN_KIND, stdinScenarios } from './stdin'
import { BOARD_INPUTS_KIND, boardInputScenarios } from './board-inputs'

let done = false
export function registerCppScenarioKinds(): void {
  if (done) return
  done = true
  registerScenarioKind(STDIN_KIND, stdinScenarios)
  registerScenarioKind(BOARD_INPUTS_KIND, boardInputScenarios)
}
