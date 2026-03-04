import type { BlockSpec } from '../../core/types'
import type { ConceptId } from '../../core/semantic-model'
import type { NewLanguageModule, TypeEntry, ConceptDefinition, Generator, Parser, NewLanguageAdapter } from '../types'
import { CppParser } from './parser'
import { CppGenerator } from './generator'
import { CppLanguageAdapter } from './adapter'
import { BlockRegistry } from '../../core/block-registry'
import { CPP_ALL_TYPES } from './types'
import basicBlocks from './blocks/basic.json'
import specialBlocks from './blocks/special.json'
import advancedBlocks from './blocks/advanced.json'

/** Universal concepts that C++ supports */
const CPP_SUPPORTED_CONCEPTS: ConceptId[] = [
  'var_declare', 'var_assign', 'var_ref',
  'number_literal', 'string_literal',
  'arithmetic', 'compare', 'logic', 'logic_not',
  'if', 'count_loop', 'while_loop', 'break', 'continue',
  'func_def', 'func_call', 'return',
  'print', 'input',
  'array_declare', 'array_access',
]

/** C++ specific concepts (beyond universal) */
const CPP_ADDITIONAL_CONCEPTS: ConceptDefinition[] = [
  { id: 'cpp:char_literal' as ConceptId, descriptionKey: 'CONCEPT_CPP_CHAR_LITERAL', propertyNames: ['value'], childNames: [] },
  { id: 'cpp:increment' as ConceptId, descriptionKey: 'CONCEPT_CPP_INCREMENT', propertyNames: ['variable', 'op'], childNames: [] },
  { id: 'cpp:compound_assign' as ConceptId, descriptionKey: 'CONCEPT_CPP_COMPOUND_ASSIGN', propertyNames: ['variable', 'op'], childNames: ['value'] },
  { id: 'cpp:switch' as ConceptId, descriptionKey: 'CONCEPT_CPP_SWITCH', propertyNames: [], childNames: ['value', 'body'] },
  { id: 'cpp:case' as ConceptId, descriptionKey: 'CONCEPT_CPP_CASE', propertyNames: [], childNames: ['value', 'body'] },
  { id: 'cpp:for_loop' as ConceptId, descriptionKey: 'CONCEPT_CPP_FOR_LOOP', propertyNames: [], childNames: ['init', 'condition', 'update', 'body'] },
  { id: 'cpp:do_while' as ConceptId, descriptionKey: 'CONCEPT_CPP_DO_WHILE', propertyNames: [], childNames: ['body', 'condition'] },
  { id: 'cpp:printf' as ConceptId, descriptionKey: 'CONCEPT_CPP_PRINTF', propertyNames: ['format'], childNames: ['args'] },
  { id: 'cpp:scanf' as ConceptId, descriptionKey: 'CONCEPT_CPP_SCANF', propertyNames: ['format'], childNames: ['args'] },
  { id: 'cpp:include' as ConceptId, descriptionKey: 'CONCEPT_CPP_INCLUDE', propertyNames: ['header'], childNames: [] },
  { id: 'cpp:raw_code' as ConceptId, descriptionKey: 'CONCEPT_CPP_RAW_CODE', propertyNames: ['code'], childNames: [] },
  { id: 'cpp:raw_expression' as ConceptId, descriptionKey: 'CONCEPT_CPP_RAW_EXPRESSION', propertyNames: ['code'], childNames: [] },
]

/**
 * CppLanguageModule：C++ 語言模組的完整定義。
 * 實作 NewLanguageModule 介面，提供型別、概念、積木定義、生成器、解析器。
 */
export class CppLanguageModule implements NewLanguageModule {
  readonly languageId = 'cpp'
  readonly displayNameKey = 'LANG_CPP'

  private parser: CppParser
  private generator: CppGenerator
  private adapter: CppLanguageAdapter
  private blockSpecs: BlockSpec[]

  constructor(registry: BlockRegistry) {
    this.parser = new CppParser()
    this.adapter = new CppLanguageAdapter()
    this.generator = new CppGenerator(registry, this.adapter)
    this.blockSpecs = [
      ...basicBlocks as BlockSpec[],
      ...specialBlocks as BlockSpec[],
      ...advancedBlocks as BlockSpec[],
    ]
  }

  getTypes(): TypeEntry[] {
    return CPP_ALL_TYPES
  }

  getSupportedConcepts(): ConceptId[] {
    return CPP_SUPPORTED_CONCEPTS
  }

  getAdditionalConcepts(): ConceptDefinition[] {
    return CPP_ADDITIONAL_CONCEPTS
  }

  getTooltipOverrides(): Record<string, string> {
    // C++ specific tooltip overrides (using i18n key values)
    return {}
  }

  getBlockSpecs(): BlockSpec[] {
    return this.blockSpecs
  }

  getGenerator(): Generator {
    return this.generator as unknown as Generator
  }

  getParser(): Parser {
    return this.parser as unknown as Parser
  }

  getAdapter(): NewLanguageAdapter {
    return this.adapter
  }
}
