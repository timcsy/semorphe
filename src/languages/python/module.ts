import type { ConceptId } from '../../core/semantic-model'
import type { NewLanguageModule, TypeEntry, ConceptDefinition, Generator, Parser, NewLanguageAdapter } from '../types'
import { PYTHON_ALL_TYPES } from './types'

/** Universal concepts that Python supports */
const PYTHON_SUPPORTED_CONCEPTS: ConceptId[] = [
  'var_declare', 'var_assign', 'var_ref',
  'number_literal', 'string_literal',
  'arithmetic', 'compare', 'logic', 'logic_not',
  'if', 'count_loop', 'while_loop', 'break', 'continue',
  'func_def', 'func_call', 'return',
  'print', 'input',
  // Python uses lists instead of arrays — array_declare/array_access are NOT supported
]

/** Degradation level for unsupported concepts */
export type DegradationLevel = 'exact' | 'approximate' | 'raw_code' | 'unsupported'

/** Strategy for handling unsupported concepts */
export interface DegradationStrategy {
  level: DegradationLevel
  description: string
  /** For 'approximate', the concept to use instead */
  approximateConcept?: ConceptId
}

/** Degradation strategies for concepts Python doesn't support natively */
const DEGRADATION_MAP: Record<string, DegradationStrategy> = {
  array_declare: {
    level: 'approximate',
    description: 'Python uses list instead of array',
    approximateConcept: 'var_declare' as ConceptId,
  },
  array_access: {
    level: 'approximate',
    description: 'Python list indexing via var_ref + subscript',
    approximateConcept: 'var_ref' as ConceptId,
  },
  endl: {
    level: 'unsupported',
    description: 'Python print adds newline by default',
  },
}

/**
 * PythonLanguageModule：Python stub 語言模組。
 * 最小實作，用於驗證多語言架構。
 */
export class PythonLanguageModule implements NewLanguageModule {
  readonly languageId = 'python'
  readonly displayNameKey = 'LANG_PYTHON'

  getTypes(): TypeEntry[] {
    return PYTHON_ALL_TYPES
  }

  getSupportedConcepts(): ConceptId[] {
    return PYTHON_SUPPORTED_CONCEPTS
  }

  getAdditionalConcepts(): ConceptDefinition[] {
    // Stub: no Python-specific concepts yet
    return []
  }

  getTooltipOverrides(): Record<string, string> {
    return {}
  }

  getBlockSpecs(): unknown[] {
    // Stub: no Python-specific blocks yet
    return []
  }

  getGenerator(): Generator {
    // Stub: no generator yet
    throw new Error('Python generator not implemented (stub module)')
  }

  getParser(): Parser {
    // Stub: no parser yet
    throw new Error('Python parser not implemented (stub module)')
  }

  getAdapter(): NewLanguageAdapter {
    // Stub: no adapter yet
    throw new Error('Python adapter not implemented (stub module)')
  }

  /**
   * P6 Graceful degradation: returns strategy for handling unsupported concepts.
   * - exact: concept maps directly (always for supported concepts)
   * - approximate: use a similar concept
   * - raw_code: fall back to raw code string
   * - unsupported: concept not available in this language
   */
  getDegradationStrategy(conceptId: ConceptId): DegradationStrategy {
    if (PYTHON_SUPPORTED_CONCEPTS.includes(conceptId)) {
      return { level: 'exact', description: 'Directly supported' }
    }
    return DEGRADATION_MAP[conceptId] ?? {
      level: 'raw_code',
      description: `No Python equivalent for '${conceptId}'`,
    }
  }
}
