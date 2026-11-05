/**
 * **拿我們的積木面板 ＋ 即時互轉**——不經 `app.ts`，只靠出貨的兩支套件（spec 217 第四刀）。
 *
 * ```
 * dist-sdk/semorphe.mjs   核心：匯流排、同步、lift、產生器、語言套件
 * dist-sdk/panels.mjs     面板：panelById('blocks').mount(...) 與它要的組裝
 * ```
 *
 * 程式碼那一格是一個 `<textarea>`（自己寫的 ViewHost，二十行），積木那一格是**我們的面板**。
 * 積木改 → 程式碼變；程式碼改 → 積木變。
 *
 * 🔴 **失敗模式是安靜的**：積木定義沒註冊、渲染器沒設、兩支套件各帶一份核心
 * ——三種都是「工作區一顆積木都沒有」，不會丟錯。所以 `assemble` 回傳的摘要問的是
 * **工作區裡有幾顆積木**，護欄斷言它 > 0。
 */
import * as Blockly from 'blockly'
import {
  SemanticBus, registerViewsIn, connectViews, resetViews, SyncController,
  Lifter, PatternLifter, TransformRegistry, registerCoreTransforms, LiftStrategyRegistry,
  BlockSpecRegistry, loadAllLanguagePacks, allLanguagePacks, componentLiftPatterns, setCommentLanguage,
  type LiftPattern, type StylePreset, type SemanticNode, type ViewHost, type SemanticUpdateEvent,
} from '../../../dist-sdk/semorphe.mjs'
import {
  loadPanels, panelById, BlockRegistrar, PatternRenderer, setPatternRenderer, RenderStrategyRegistry,
  setDegradationLanguage, LocaleLoader, setMessageSource, createNode,
} from '../../../dist-sdk/panels.mjs'

/** 程式碼那一格——一個 textarea。ViewHost 只要這幾個成員。 */
class TextareaView implements ViewHost {
  readonly viewId = 'textarea-code'
  readonly viewType = 'text-buffer'
  readonly capabilities = { editable: true, needsLanguageProjection: true, consumedAnnotations: [] }
  constructor(readonly el: HTMLTextAreaElement) {}
  async initialize(): Promise<void> {}
  dispose(): void {}
  onSemanticUpdate(e: SemanticUpdateEvent): void {
    if (e.source !== 'code' && typeof e.code === 'string') this.el.value = e.code
  }
  onExecutionState(): void {}
}

export interface Assembled {
  /** 程式碼 → 積木（等它畫完） */
  codeToBlocks(code: string): Promise<void>
  /** 積木 → 程式碼（使用者動了積木之後，面板的 onChange 會自己呼叫這一支） */
  blocksToCode(): void
  workspace(): Blockly.WorkspaceSvg
}

export async function assemble(opts: { blocksEl: HTMLElement; codeEl: HTMLTextAreaElement; language?: string; wasmDir: string }): Promise<Assembled> {
  const language = opts.language ?? 'cpp'

  // ① 語言套件與積木登錄表
  loadAllLanguagePacks()
  setCommentLanguage(language)
  const pack = allLanguagePacks().find((p) => p.id === language)
  if (!pack) throw new Error(`沒有 ${language} 語言套件`)
  const specs = new BlockSpecRegistry()
  const comps: unknown[] = []
  const projs: unknown[] = []
  for (const lp of allLanguagePacks()) {
    const d = lp.declarations?.()
    if (d) { comps.push(...d.components); projs.push(...d.projections) }
  }
  specs.loadFromSplit(comps as never, projs as never)

  // ② 積木上的字 ＋ 積木定義註冊進 Blockly（面板畫得出一顆真的積木的前提）
  const locale = new LocaleLoader()
  locale.setBlocklyMsg(Blockly.Msg as Record<string, string>)
  await locale.load('zh-TW')
  setMessageSource((k) => (Blockly.Msg as Record<string, string>)[k])
  let ws: Blockly.WorkspaceSvg | null = null
  new BlockRegistrar(specs).registerAll({ getWorkspace: () => ws })

  // ③ lift ＋ 渲染策略（語言套件一次裝好兩邊）
  const transforms = new TransformRegistry()
  registerCoreTransforms(transforms)
  for (const lp of allLanguagePacks()) lp.liftTransforms?.(transforms)
  const strategies = new LiftStrategyRegistry()
  const renderStrategies = new RenderStrategyRegistry()
  const pl = new PatternLifter()
  pl.setTransformRegistry(transforms)
  pl.setLiftStrategyRegistry(strategies)
  pl.setGrammar(pack.grammar)
  const skip = new Map<string, ReadonlySet<string>>()
  for (const lp of allLanguagePacks()) skip.set(lp.grammar, new Set(lp.liftSkipNodeTypes ?? []))
  pl.loadBlockSpecs(specs.getAll(), skip)
  pl.loadLiftPatterns([...allLanguagePacks().flatMap((lp) => lp.liftPatterns ?? []), ...componentLiftPatterns()] as LiftPattern[])
  const lifter = new Lifter()
  lifter.setPatternLifter(pl)
  lifter.setGrammar(pack.grammar)
  for (const lp of allLanguagePacks()) lp.installLifters?.(lifter, { transformRegistry: transforms, liftStrategyRegistry: strategies, renderStrategyRegistry: renderStrategies })
  pack.install?.()
  const renderer = new PatternRenderer()
  renderer.setRenderStrategyRegistry(renderStrategies)
  renderer.loadBlockSpecs(specs.getAll())
  setPatternRenderer(renderer)
  setDegradationLanguage(language)

  const parser = pack.createParser()
  await parser.init(opts.wasmDir)
  const bus = new SemanticBus()
  const sync = new SyncController(bus, language, pack.styles[0] as StylePreset)
  sync.setCodeToBlocksPipeline(lifter, parser as never)

  // ④ 🔴 積木那一格：我們的面板，經它自己的 mount（不經 app.ts）
  const problems = loadPanels()
  if (problems.length) throw new Error(problems.join('\n'))
  const spec = panelById('blocks')
  if (!spec?.mount) throw new Error('面板登錄表裡沒有 blocks——套件沒有帶到面板')
  const inst = spec.mount(opts.blocksEl, {
    profile: undefined as never, // 積木那一格不讀宿主設定檔
    msg: (k, fb) => (Blockly.Msg as Record<string, string>)[k] ?? fb ?? k,
    blockSpecs: specs,
    blocks: {
      toolbox: { kind: 'categoryToolbox', contents: [] },
      buildProgramRoot: (body: SemanticNode[] = []) => createNode(pack.programRoot, {}, { body }),
      installExtractStrategies: (x: unknown) => { for (const lp of allLanguagePacks()) lp.installExtractStrategies?.(x) },
    },
  })
  const blocks = inst.view as ViewHost & { getWorkspace(): Blockly.WorkspaceSvg; extractSemanticTree(): SemanticNode; onChange(cb: () => void): void }
  ws = blocks.getWorkspace()

  // ⑤ 兩格都上匯流排；積木一動就送回程式碼
  resetViews()
  registerViewsIn({ blocks, code: new TextareaView(opts.codeEl) })
  connectViews(bus)
  const blocksToCode = (): void => sync.syncBlocksToCode(blocks.extractSemanticTree())
  blocks.onChange(blocksToCode)

  return {
    codeToBlocks: (code) => sync.syncCodeToBlocks(code),
    blocksToCode,
    workspace: () => blocks.getWorkspace(),
  }
}
