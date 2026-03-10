import { describe, it, expect } from 'vitest'
import { BlockExtractorRegistry } from '../../../src/core/registry/block-extractor-registry'
import type { BlockExtractorFn } from '../../../src/core/registry/block-extractor-registry'
import { createNode } from '../../../src/core/semantic-tree'
import { createCppExtractorRegistry } from '../../../src/languages/cpp/extractors/register'

describe('BlockExtractorRegistry', () => {
  it('should register and retrieve extractors', () => {
    const registry = new BlockExtractorRegistry()
    const fn: BlockExtractorFn = () => createNode('test', {})
    registry.register('u_test', fn)
    expect(registry.get('u_test')).toBe(fn)
    expect(registry.has('u_test')).toBe(true)
    expect(registry.has('u_nonexistent')).toBe(false)
  })

  it('should return null for unregistered types', () => {
    const registry = new BlockExtractorRegistry()
    expect(registry.get('not_registered')).toBeNull()
  })

  it('should report size correctly', () => {
    const registry = new BlockExtractorRegistry()
    expect(registry.size).toBe(0)
    registry.register('a', () => createNode('test', {}))
    registry.register('b', () => createNode('test', {}))
    expect(registry.size).toBe(2)
  })
})

describe('C++ ExtractorRegistry completeness', () => {
  it('should register all known block types via registry (no unhandled fallback)', () => {
    const registry = createCppExtractorRegistry()
    const knownTypes = [
      'u_var_declare', 'u_var_assign', 'u_var_ref', 'u_number', 'u_string',
      'u_arithmetic', 'u_compare', 'u_logic', 'u_logic_not', 'u_negate',
      'u_if', 'u_if_else', 'u_while_loop', 'u_count_loop', 'c_for_loop',
      'u_break', 'u_continue',
      'u_func_def', 'u_func_call', 'u_func_call_expr', 'u_return',
      'u_print', 'u_input', 'u_input_expr', 'u_endl',
      'c_printf', 'c_scanf',
      'u_array_declare', 'u_array_access', 'u_array_assign',
      'c_increment', 'c_compound_assign',
      'c_increment_expr', 'c_compound_assign_expr', 'c_scanf_expr', 'c_var_declare_expr',
      'c_do_while', 'c_ternary', 'c_char_literal', 'c_cast', 'c_bitwise_not',
      'c_builtin_constant', 'c_forward_decl',
      'c_raw_code', 'c_raw_expression', 'c_comment_line', 'c_comment_block', 'c_comment_doc',
      'c_include', 'c_include_local', 'c_using_namespace', 'c_define',
    ]
    for (const type of knownTypes) {
      expect(registry.has(type), `Missing extractor for ${type}`).toBe(true)
    }
  })

  it('should have at least 40 registered extractors', () => {
    const registry = createCppExtractorRegistry()
    expect(registry.size).toBeGreaterThanOrEqual(40)
  })
})
