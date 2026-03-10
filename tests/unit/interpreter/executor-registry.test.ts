/**
 * TDD tests for Phase D: Interpreter 47-case switch → ConceptExecutorRegistry
 *
 * After refactoring, executeNode should dispatch through a registry
 * instead of a switch statement. All existing interpreter tests should still pass.
 */
import { describe, it, expect } from 'vitest'
import { ConceptExecutorRegistry, type ConceptExecutor, type ExecutionContext } from '../../../src/interpreter/executor-registry'
import type { SemanticNode } from '../../../src/core/types'

describe('ConceptExecutorRegistry', () => {
  it('register and get executor', () => {
    const registry = new ConceptExecutorRegistry()
    const executor: ConceptExecutor = async (_node, _ctx) => ({ type: 'int', value: 42 })
    registry.register('test_concept', executor)
    expect(registry.get('test_concept')).toBe(executor)
  })

  it('returns undefined for unregistered concept', () => {
    const registry = new ConceptExecutorRegistry()
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  it('registerAll registers multiple executors', () => {
    const registry = new ConceptExecutorRegistry()
    const exec1: ConceptExecutor = async () => ({ type: 'int', value: 1 })
    const exec2: ConceptExecutor = async () => ({ type: 'int', value: 2 })
    registry.registerAll({ concept_a: exec1, concept_b: exec2 })
    expect(registry.get('concept_a')).toBe(exec1)
    expect(registry.get('concept_b')).toBe(exec2)
  })

  it('has() checks registration', () => {
    const registry = new ConceptExecutorRegistry()
    registry.register('exists', async () => {})
    expect(registry.has('exists')).toBe(true)
    expect(registry.has('nope')).toBe(false)
  })
})
