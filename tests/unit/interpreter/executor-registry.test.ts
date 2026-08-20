/**
 * TDD tests for Phase D: Interpreter 47-case switch → ComponentExecutorRegistry
 *
 * After refactoring, executeNode should dispatch through a registry
 * instead of a switch statement. All existing interpreter tests should still pass.
 */
import { describe, it, expect } from 'vitest'
import { ComponentExecutorRegistry, type ComponentExecutor, type ExecutionContext } from '../../../src/interpreter/executor-registry'
import type { SemanticNode } from '../../../src/core/types'

describe('ComponentExecutorRegistry', () => {
  it('register and get executor', () => {
    const registry = new ComponentExecutorRegistry()
    const executor: ComponentExecutor = async (_node, _ctx) => ({ type: 'int', value: 42 })
    registry.register('test_component', executor)
    expect(registry.get('test_component')).toBe(executor)
  })

  it('returns undefined for unregistered component', () => {
    const registry = new ComponentExecutorRegistry()
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  it('registerAll registers multiple executors', () => {
    const registry = new ComponentExecutorRegistry()
    const exec1: ComponentExecutor = async () => ({ type: 'int', value: 1 })
    const exec2: ComponentExecutor = async () => ({ type: 'int', value: 2 })
    registry.registerAll({ component_a: exec1, component_b: exec2 })
    expect(registry.get('component_a')).toBe(exec1)
    expect(registry.get('component_b')).toBe(exec2)
  })

  it('has() checks registration', () => {
    const registry = new ComponentExecutorRegistry()
    registry.register('exists', async () => {})
    expect(registry.has('exists')).toBe(true)
    expect(registry.has('nope')).toBe(false)
  })
})
