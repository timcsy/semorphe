/**
 * **自帶視圖 ＋ 即時互轉**——不經 Vite、不開瀏覽器、不用我們的任何面板。
 *
 * 這支程式做的事：
 *
 * ```
 * ① 組裝引擎（語言套件 ＋ parser ＋ lifter ＋ 同步控制器）
 * ② 把一個【自己寫的】視圖登錄上匯流排
 * ③ 程式碼 → 語義樹      （發 edit:code，視圖收到 semantic:update）
 * ④ 語義樹 → 程式碼      （把樹送回去，視圖收到帶 code 的更新）
 * ```
 *
 * 🔴 **失敗模式是安靜的**：`src/vscode/sync/messages.ts:23` 記著
 * 「esbuild 建得出來，而**膠囊一顆都沒打包進去**」——那時 ③ 會產出
 * 一棵只有根節點的樹，而**程式不會丟任何錯誤**。
 * 所以這支程式最後印出的摘要裡有 `capsules`，而護欄斷言它 > 100。
 *
 * ⚠️ **下面這段組裝有 30 行，而那是一個發現，不是一個範例的長度。**
 * 第三方要接上即時互轉，今天得抄這 30 行——沒有一個「給我一具引擎」的入口。
 * 那筆記在 `knowledge/draft/2026-08-24-可嵌入與可插拔的四個軸.md`。
 */
import {
  SemanticBus,
  registerViewsIn,
  connectViews,
  resetViews,
  SyncController,
  Lifter,
  PatternLifter,
  TransformRegistry,
  registerCoreTransforms,
  LiftStrategyRegistry,
  BlockSpecRegistry,
  loadAllLanguagePacks,
  allLanguagePacks,
  componentComponents,
  componentBlocks,
  componentLiftPatterns,
  setCommentLanguage,
  type LiftPattern,
  type StylePreset,
} from '../../../dist-sdk/semorphe.mjs'
import { TextView } from './text-view'

const SOURCE = `x = 5
if x > 3:
    print("big")
`

async function main(): Promise<void> {
  // ① 引擎
  loadAllLanguagePacks()
  setCommentLanguage('python')
  const pack = allLanguagePacks().find((p) => p.id === 'python')
  if (!pack) throw new Error('沒有 python 語言套件——載入路徑在這個宿主下沒有生效')

  const specs = new BlockSpecRegistry()
  const components = componentComponents()
  specs.loadFromSplit(components as never, componentBlocks() as never)

  const transforms = new TransformRegistry()
  registerCoreTransforms(transforms)
  for (const lp of allLanguagePacks()) lp.liftTransforms?.(transforms)

  // 🟢 **第三個發現已修（2026-08-26）**——這裡本來要自己補一行：
  //
  //     for (const reg of componentLiftStrategyRegistrars()) reg(strategies)
  //
  //    因為膠囊的具名 lift 策略（**語言中立**）當時掛在 `registerCppLifters`
  //    底下，於是只用 Python 的宿主拿不到它，而**症狀是 `if` 安靜降級成
  //    `unresolved`，程式不會報錯**。
  //    現在 `LiftStrategyRegistry` 的建構子自己長出來——**收成一個入口**。
  const strategies = new LiftStrategyRegistry()

  const patternLifter = new PatternLifter()
  patternLifter.setTransformRegistry(transforms)
  patternLifter.setLiftStrategyRegistry(strategies)
  patternLifter.setGrammar(pack.grammar)
  const skipByGrammar = new Map<string, ReadonlySet<string>>()
  for (const lp of allLanguagePacks()) skipByGrammar.set(lp.grammar, new Set(lp.liftSkipNodeTypes ?? []))
  patternLifter.loadBlockSpecs(specs.getAll(), skipByGrammar)
  patternLifter.loadLiftPatterns([
    ...allLanguagePacks().flatMap((lp) => lp.liftPatterns ?? []),
    ...componentLiftPatterns(),
  ] as LiftPattern[])

  const lifter = new Lifter()
  lifter.setPatternLifter(patternLifter)
  lifter.setGrammar(pack.grammar)

  // ⚠️ **第四個發現**：產生器那一路要靠 `pack.install()`。
  // 🟢 **2026-08-26：漏掉它現在會出聲**——`generateCode` 問「這個語言有套件
  //    而一個產生器都沒有嗎」，是就丟一個指名那一步的錯。
  //    ⚠️ 而**未知語言仍然誠實降級**（FR-014：註解不得無聲消失）——
  //    兩者產出同一種字串，而只有前者是缺陷。
  pack.install?.()

  const parser = pack.createParser()
  await parser.init(process.env['SEMORPHE_WASM_DIR'] ?? 'public')

  const bus = new SemanticBus()
  // ⚠️ `styles` 是 `StylePreset[]` 本身，不是 `{ preset }` 的包裝——
  // 猜錯的症狀是**產出沒有縮排**（`if` 的身體貼在最左邊），而不是報錯。
  const style: StylePreset = pack.styles[0]
  const sync = new SyncController(bus, 'python', style)

  // ⚠️ **第二個發現**：`setCodeToBlocksPipeline` 收的 parser 介面是**同步**的
  // （`parse(code): { rootNode }`），而每一個真的 parser 都是非同步的
  // （要抓 wasm）。於是每個消費者都得自己做同一個 shim——網頁版的組裝點
  // 也有一份一模一樣的（`src/ui/app.ts` 的 `codeParser`）。
  //
  // > **一個介面如果每個實作者都要在它前面加同一層轉接，那層轉接就是介面的一部分。**
  const shim = { tree: null as unknown, parse(_code: string) { return { rootNode: this.tree } } }
  sync.setCodeToBlocksPipeline(lifter, shim as never)

  // ② 自帶的視圖——**由掃描器收，不是被硬接的**
  resetViews()
  const view = new TextView()
  const hosts = registerViewsIn({ view })
  if (hosts.length !== 1) throw new Error('掃描器沒有把這個視圖認成 ViewHost——協定對不上')
  connectViews(bus)

  // ③ 程式碼 → 語義樹
  shim.tree = (await parser.parse(SOURCE)).rootNode
  bus.emit('edit:code', { code: SOURCE })
  const afterLift = view.tree
  if (!afterLift) throw new Error('視圖沒有收到語義樹')

  // ④ 語義樹 → 程式碼（把視圖手上的那棵送回去）
  sync.syncBlocksToCode(afterLift)

  const ids: string[] = []
  const walk = (n: { componentId: string; children: Record<string, unknown[]> }): void => {
    ids.push(n.componentId)
    for (const kids of Object.values(n.children ?? {})) for (const k of kids ?? []) walk(k as never)
  }
  walk(afterLift as never)

  // 🔴 摘要是**行為的**，不是「建置成功」——見檔頭那個安靜的失敗模式
  console.log(JSON.stringify({
    capsules: components.length,
    updates: view.updates,
    componentIds: ids,
    code: view.code,
  }))
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
