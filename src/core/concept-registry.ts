import type { ConceptId, UniversalConcept } from './semantic-model'

export interface ConceptDef {
  propertyNames: string[]
  childNames: string[]
}

const UNIVERSAL_CONCEPTS: Record<UniversalConcept, ConceptDef> = {
  program: { propertyNames: [], childNames: ['body'] },
  var_declare: { propertyNames: ['name', 'type'], childNames: ['initializer'] },
  var_assign: { propertyNames: ['name'], childNames: ['value'] },
  var_ref: { propertyNames: ['name'], childNames: [] },
  number_literal: { propertyNames: ['value'], childNames: [] },
  string_literal: { propertyNames: ['value'], childNames: [] },
  arithmetic: { propertyNames: ['operator'], childNames: ['left', 'right'] },
  compare: { propertyNames: ['operator'], childNames: ['left', 'right'] },
  logic: { propertyNames: ['operator'], childNames: ['left', 'right'] },
  logic_not: { propertyNames: [], childNames: ['operand'] },
  if: { propertyNames: [], childNames: ['condition', 'then_body', 'else_body'] },
  count_loop: { propertyNames: ['var_name'], childNames: ['from', 'to', 'body'] },
  while_loop: { propertyNames: [], childNames: ['condition', 'body'] },
  break: { propertyNames: [], childNames: [] },
  continue: { propertyNames: [], childNames: [] },
  func_def: { propertyNames: ['name', 'return_type', 'params'], childNames: ['body'] },
  func_call: { propertyNames: ['name'], childNames: ['args'] },
  return: { propertyNames: [], childNames: ['value'] },
  print: { propertyNames: [], childNames: ['values'] },
  input: { propertyNames: ['variable'], childNames: [] },
  endl: { propertyNames: [], childNames: [] },
  array_declare: { propertyNames: ['name', 'type', 'size'], childNames: [] },
  array_access: { propertyNames: ['name'], childNames: ['index'] },
}

export class ConceptRegistry {
  private universals = new Map<string, ConceptDef>()
  private languageSpecific = new Map<string, ConceptDef>()

  constructor() {
    for (const [id, def] of Object.entries(UNIVERSAL_CONCEPTS)) {
      this.universals.set(id, def)
    }
  }

  registerLanguageSpecific(id: ConceptId, def: ConceptDef): void {
    this.languageSpecific.set(id, def)
  }

  isRegistered(id: string): boolean {
    return this.universals.has(id) || this.languageSpecific.has(id)
  }

  getUniversalConcepts(): ConceptId[] {
    return [...this.universals.keys()] as ConceptId[]
  }

  getLanguageSpecificConcepts(): ConceptId[] {
    return [...this.languageSpecific.keys()] as ConceptId[]
  }

  listAll(): ConceptId[] {
    return [...this.getUniversalConcepts(), ...this.getLanguageSpecificConcepts()]
  }

  getDefinition(id: string): ConceptDef | undefined {
    return this.universals.get(id) ?? this.languageSpecific.get(id)
  }
}
