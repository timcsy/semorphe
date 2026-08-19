import type { ConceptDef, ConceptDefJSON } from './types'
import { paramNames } from './param-spec'

export class ConceptRegistry {
  private concepts = new Map<string, ConceptDef>()

  register(def: ConceptDef): void {
    if (this.concepts.has(def.id)) {
      throw new Error(`Concept '${def.id}' is already registered`)
    }
    this.concepts.set(def.id, def)
  }

  get(id: string): ConceptDef | undefined {
    return this.concepts.get(id)
  }

  /**
   * ⚠️ **零生產呼叫者**（2026-08-11 查證）——只有測試在用它，
   * 而那些測試測的是 `layer` 這個欄位自己。
   *
   * 沒有刪掉，是因為 `layer` 該不該存在是一個**還開著的設計題**：
   * 它是一份被放在內涵位置（宣告）的**外延主張**（「任何語言都滿足得了」），
   * 而 `concepts/等價與觀察集.md` 說外延該是**導出的**，不是宣告的。
   * 導出它需要跨語言的等價邊，而今天只有一個語言。
   *
   * → 見 `draft/2026-08-11-universal是一份還沒被驗證的外延主張.md`
   */

  findAbstract(concreteId: string): ConceptDef | undefined {
    const concrete = this.concepts.get(concreteId)
    if (!concrete?.abstractConcept) return undefined
    return this.concepts.get(concrete.abstractConcept)
  }

  listAll(): ConceptDef[] {
    return [...this.concepts.values()]
  }

  /** Register or update a concept (overwrites if already exists) */
  registerOrUpdate(def: ConceptDef): void {
    this.concepts.set(def.id, def)
  }

  /** Batch load from concepts.json format */
  loadFromJSON(concepts: ConceptDefJSON[]): void {
    for (const c of concepts) {
      this.registerOrUpdate({
        id: c.conceptId,
        abstractConcept: c.abstractConcept ?? undefined,
        propertyNames: paramNames(c.properties),
        childNames: Object.keys(c.children),
        annotations: c.annotations,
      })
    }
  }

  /** Query an annotation value for a concept */
  getAnnotation(conceptId: string, key: string): unknown {
    const def = this.concepts.get(conceptId)
    return def?.annotations?.[key]
  }
}
