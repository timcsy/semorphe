/**
 * `code → blocks` —— **parse ＋ lift ＋ render，全部在 Webview**。
 *
 * ## 🔴 為什麼在這一側
 *
 * lift 需要**膠囊登錄表**（`lift-pattern.json` 由 `import.meta.glob` 掃出），
 * 而 `core/component/registry.ts:22-48` 記著：
 *
 * ```
 * Vite    → CJS 269 KB → 189 顆膠囊全部載入   🟢
 * esbuild → CJS 4.6 KB → 🔴 import_meta.glob is not a function
 * ```
 *
 * ⚠️ 而重點是 **esbuild 建得出來、只發一則 warning、執行期才炸**。
 * **把 lift 放主行程 ＝ 主動踩坑。**
 *
 * ## ⚠️ 而它的代價是一條 CSP 權限
 *
 * tree-sitter 是 WebAssembly，而 Webview 的 CSP 預設擋掉 `WebAssembly.compile`：
 *
 * ```
 * script-src 'self'                       → 🔴 CompileError（可被 catch，很容易吞掉）
 * script-src 'self' 'wasm-unsafe-eval'    → 🟢 152 項匯出
 * ```
 *
 * 那條權限加在 `webview-html.ts` 的 `csp()`，而**只加那一項**。
 *
 * ## 組裝照 `ui/app.ts:409-427`
 *
 * 🔴 **不自己串一份**：`tests/helpers/setup-lifter.ts:25` 的檔頭記著
 * 「這是**第四份**被找到的各自組裝」，而那一份漏掉膠囊時的症狀是
 * 「`vector<int> v = f()` 的初始值被丟掉」。
 *
 * > **一份「自己串起來的管線」與正式的那份，
 * > 差別要到某個具體的積木壞掉才看得見。**
 */
import { Lifter } from '../../core/lift/lifter'
import { PatternLifter } from '../../core/lift/pattern-lifter'
import { PatternRenderer } from '../../core/projection/pattern-renderer'
import { setPatternRenderer } from '../../core/projection/block-renderer'
import {
  TransformRegistry,
  registerCoreTransforms,
  LiftStrategyRegistry,
  RenderStrategyRegistry,
} from '../../core/registry'
import { registerCppLifters } from '../../languages/cpp/lifters'
import { CppParser } from '../../languages/cpp/parser'
import liftPatternsJson from '../../languages/cpp/lift-patterns.json'
import type { BlockSpecRegistry } from '../../core/block-spec-registry'
import type { LiftPattern, SemanticNode, Topic } from '../../core/types'

/**
 * ⚠️ 這一組節點型別由 `PatternLifter` 交給專屬的 lifter 處理。
 * 🔴 與 `ui/app.ts:419` **必須一致**——不一致的症狀是某些語法安靜地降級。
 */
const SKIP_NODE_TYPES = new Set([
  'call_expression', 'using_declaration', 'for_statement', 'assignment_expression',
  'update_expression', 'switch_statement', 'case_statement', 'do_statement',
  'conditional_expression', 'cast_expression', 'preproc_ifdef',
])

export interface CodeLifter {
  /** 把程式碼變成語義樹。⚠️ 語法不完整時仍然要回得出東西（降級），不得整片消失。 */
  lift(code: string): Promise<SemanticNode | null>
  readonly ready: boolean
}

/**
 * @param wasmDir Webview 裡的 wasm 目錄 URI（由宿主算出來的資源根）。
 *   ⚠️ **不可省**：預設值走 `process.cwd()`，而 Webview 裡沒有 `process`。
 */
export async function createCodeLifter(
  registry: BlockSpecRegistry,
  topic: Topic,
  wasmDir: string,
): Promise<CodeLifter> {
  const lifter = new Lifter()
  const transformRegistry = new TransformRegistry()
  registerCoreTransforms(transformRegistry)
  const liftStrategyRegistry = new LiftStrategyRegistry()
  const renderStrategyRegistry = new RenderStrategyRegistry()
  const allSpecs = registry.getAll()

  const pl = new PatternLifter()
  pl.setTransformRegistry(transformRegistry)
  pl.setLiftStrategyRegistry(liftStrategyRegistry)
  pl.loadBlockSpecs(allSpecs, SKIP_NODE_TYPES)
  pl.loadLiftPatterns(liftPatternsJson as unknown as LiftPattern[])
  lifter.setPatternLifter(pl)

  const pr = new PatternRenderer()
  pr.setRenderStrategyRegistry(renderStrategyRegistry)
  pr.loadBlockSpecsWithTopic(allSpecs, topic)
  setPatternRenderer(pr)

  registerCppLifters(lifter, { transformRegistry, liftStrategyRegistry, renderStrategyRegistry })

  const parser = new CppParser()
  await parser.init(wasmDir)

  return {
    ready: true,
    async lift(code: string): Promise<SemanticNode | null> {
      const tree = await parser.parse(code)
      // ⚠️ **語法不完整時 tree-sitter 仍然回得出一棵樹**（帶 ERROR 節點），
      //    而 lift 會把不認得的部分降級成 `raw_code`。
      //    🔴 **那是刻意的**：使用者正在打字時積木不該整片消失。
      return lifter.lift(tree.rootNode as never) as SemanticNode | null
    },
  }
}
