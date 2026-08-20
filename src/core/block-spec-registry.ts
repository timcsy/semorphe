import type { BlockSpec, AstConstraint, ComponentDefJSON, BlockProjectionJSON, Topic } from './types'
import { applyBlockOverride } from './block-override'
import { paramNames } from './param-spec'

export class BlockSpecRegistry {
  private specs = new Map<string, BlockSpec>()
  private byConceptId = new Map<string, BlockSpec>()
  /** 一個元件身分的**所有**形態（含中性與各變體） */
  private formsByConceptId = new Map<string, BlockSpec[]>()
  private byBlockType = new Map<string, BlockSpec>()
  private conceptToBlockType = new Map<string, string>()

  /** Load from split concept + projection JSON (Phase 3 architecture) */
  loadFromSplit(concepts: ComponentDefJSON[], projections: BlockProjectionJSON[]): void {
    const conceptMap = new Map<string, ComponentDefJSON>()
    for (const c of concepts) conceptMap.set(c.componentId, c)
    const specs: BlockSpec[] = projections.map(proj => {
      const concept = conceptMap.get(proj.componentId)
      return {
        // ⚠️ **展開合併，不要逐欄位列舉。**
        //
        // 第一版是列舉的，於是 097 新增的 `form` 欄位被安靜地丟掉——症狀看起來
        // 像形態選擇函式壞掉，而其實資料在進到它之前就沒了。
        //
        // 而這個處方 `experience.md` 早就寫下來了（「展開合併 → 漏欄位不可能」），
        // **只是當時只套用在發現它的那一處（存檔），沒有掃同形的地方。**
        // 一個教訓被記下來、處方也被記下來，而程式碼仍然帶著那個病。
        ...proj,
        componentMapping: {
          componentId: proj.componentId,
          // ⚠️ **這個欄位今天沒有生產消費者**（2026-08-11）。
          //
          // 116 把「呈現層別看名字前綴，問這個欄位」寫進來；而 2026-08-11
          // 那個唯一的消費者（工具箱的 I/O 排序）改問**等價邊**了
          // （同 `ioRole` ＝同一個等價類、`ioStyle` ＝哪個成員），
          // 因為 `layer` 只是碰巧對——`cpp:print` 剛好標 universal。
          //
          // 欄位還在，是因為它記著「這顆概念當初被認為多通用」——
          // 那是一份**還沒被驗證過的外延主張**，而驗它需要第二個語言。
          // 見 `concepts/等價與觀察集.md` 剪枝力②：**「通用」是外延的，不住在名字裡**。
          abstractConcept: concept?.abstractConcept ?? undefined,
          properties: paramNames(concept?.properties),
          children: concept?.children,
          role: concept?.role,
          annotations: concept?.annotations,
        },
        blockDef: proj.blockDef,
        codeTemplate: proj.codeTemplate ?? { pattern: '', imports: [], order: 0 },
        astPattern: proj.astPattern ?? { nodeType: '_none', constraints: [] },
        renderMapping: proj.renderMapping,
      }
    })
    this.loadFromJSON(specs)
  }

  loadFromJSON(specs: BlockSpec[]): void {
    // ⚠️ **中性形態必須先進表**（2026-08-11）。
    //
    // 下面好幾張表都寫著「第一個勝出——後者覆寫的話，改變 JSON 順序就會改變行為」。
    // 那句話擋住了覆寫，**而沒有擋住「中性的那一顆排在變體後面」**：
    // 一顆多形態元件搬進膠囊時，`forms/blocks.json` 的順序由批次工具決定，
    // 而它把 `cpp_var_declare_expression` 排在 `cpp_var_declare` 前面
    // ——結果類別成員的積木**渲染出來欄位是空的**，來回轉換後三個成員
    // 全部變成同一個名字（`int x; int y; int z;` → 三個 `int x;`）。
    //
    // > **「第一個勝出」只在「該贏的那個排第一」時才是規則，
    // > 否則它只是把順序偽裝成規則。**
    //
    // 處置：在這裡就把中性排到前面，讓輸入順序**不再有影響**。
    const neutralFirst = [...specs].sort((a, b) => (a.form ? 1 : 0) - (b.form ? 1 : 0))
    for (const spec of neutralFirst) {
      this.specs.set(spec.id, spec)
      if (spec.componentMapping?.componentId) {
        const cid = spec.componentMapping.componentId
        // ⚠️ **一個元件身分可以有多個形態**（097）。
        //
        // 在此之前這裡是直接 `set`，於是第二顆積木會蓋掉第一顆——
        // 而「統一身分」因此被迫連帶「統一形態」，那產生了一個真實的使用者困惑
        // （見 `knowledge/episodes/2026-08-07-學生說積木寫錯了.md`）。
        //
        // `byConceptId` 保留「中性形態」給既有呼叫端；完整的形態清單走
        // `getFormsByConceptId()`。中性 = 沒有宣告 `form` 的那一顆，
        // **第一個勝出**——後者覆寫的話，改變 JSON 順序就會改變行為。
        if (!spec.form && !this.byConceptId.has(cid)) this.byConceptId.set(cid, spec)
        const list = this.formsByConceptId.get(cid) ?? []
        list.push(spec)
        this.formsByConceptId.set(cid, list)
      }
      const blockType = (spec.blockDef as Record<string, unknown>)?.type as string | undefined
      if (blockType) {
        this.byBlockType.set(blockType, spec)
        // 只記中性形態——這張表的消費者要的是「這個概念預設長什麼樣」
        if (spec.componentMapping?.componentId && !spec.form) {
          const cid = spec.componentMapping.componentId
          if (!this.conceptToBlockType.has(cid)) this.conceptToBlockType.set(cid, blockType)
        }
      }
    }
  }

  /** 中性形態（沒有宣告 `form` 的那一顆）。要全部請用 `getFormsByConceptId` */
  getByConceptId(componentId: string): BlockSpec | undefined {
    return this.byConceptId.get(componentId)
  }

  /** 一個元件身分的**所有**積木形態 */
  getFormsByConceptId(componentId: string): BlockSpec[] {
    return this.formsByConceptId.get(componentId) ?? []
  }

  getByBlockType(blockType: string): BlockSpec | undefined {
    return this.byBlockType.get(blockType)
  }

  /** Get the block type string for a given concept ID */
  getBlockTypeForConcept(componentId: string): string | undefined {
    return this.conceptToBlockType.get(componentId)
  }

  /** Get the auto-built concept→blockType map (replaces hardcoded CONCEPT_TO_BLOCK) */
  getConceptToBlockMap(): Record<string, string> {
    const map: Record<string, string> = {}
    for (const [concept, blockType] of this.conceptToBlockType) {
      map[concept] = blockType
    }
    return map
  }

  getByAstPattern(nodeType: string, constraints: AstConstraint[]): BlockSpec[] {
    return [...this.specs.values()].filter(spec => {
      if (spec.astPattern.nodeType !== nodeType) return false
      // All spec constraints must be satisfied by the provided constraints
      return spec.astPattern.constraints.every(sc =>
        constraints.some(c => c.field === sc.field && c.text === sc.text)
      )
    })
  }

  /** Get all patterns suitable for the PatternLifter */
  getAllPatterns(): BlockSpec[] {
    return [...this.specs.values()].filter(
      spec => spec.astPattern && !spec.astPattern.nodeType.startsWith('_')
    )
  }

  listByCategory(category: string, visibleConcepts?: Set<string>): BlockSpec[] {
    return [...this.specs.values()].filter(spec => {
      if (spec.category !== category) return false
      if (!visibleConcepts) return true
      if (!spec.componentMapping?.componentId) return true
      return visibleConcepts.has(spec.componentMapping.componentId)
    })
  }

  /**
   * 一個**段落**的成員：某個來源（模組／核心／通用）底下某個登錄分類的積木。
   *
   * 回傳順序 = 載入順序 = 該來源 `blocks.json` 的宣告順序。
   * **那個順序就是學生在工具箱裡看到的順序**——所以把一顆積木放進
   * `blocks.json` 的正確位置，它在工具箱裡就會出現在正確的位置。
   */
  listBySource(owner: string, category: string, visibleConcepts?: Set<string>): BlockSpec[] {
    return [...this.specs.values()].filter(spec => {
      if (spec.owner !== owner || spec.category !== category) return false
      if (!visibleConcepts) return true
      if (!spec.componentMapping?.componentId) return true
      return visibleConcepts.has(spec.componentMapping.componentId)
    })
  }

  getAll(): BlockSpec[] {
    return [...this.specs.values()]
  }

  /** Check if a block type is visible given a set of visible concepts */
  isBlockVisible(blockType: string, visibleConcepts?: Set<string>): boolean {
    if (!visibleConcepts) return true
    const spec = this.byBlockType.get(blockType)
    if (!spec) return true
    if (!spec.componentMapping?.componentId) return true
    return visibleConcepts.has(spec.componentMapping.componentId)
  }

  /** Get a BlockSpec with Topic override applied (if any) */
  getWithOverride(componentId: string, topic?: Topic): BlockSpec | undefined {
    const spec = this.byConceptId.get(componentId)
    if (!spec) return undefined
    if (!topic?.blockOverrides) return spec
    const override = topic.blockOverrides[componentId]
    if (!override) return spec
    return applyBlockOverride(spec, override)
  }

  /** 取得所有不重複的類別名稱 */
  getCategories(): string[] {
    const cats = new Set<string>()
    for (const spec of this.specs.values()) {
      if (spec.category) cats.add(spec.category)
    }
    return [...cats]
  }
}
