import { describe, it, expect } from 'vitest'
import type { ViewHost, ViewCapabilities, ViewConfig, SemanticUpdateEvent, ExecutionStateEvent } from '../../../src/core/view-host'

class MockBlocksView implements ViewHost {
  readonly viewId = 'blocks-1'
  readonly viewType = 'blocks'
  readonly capabilities: ViewCapabilities = {
    editable: true,
    needsLanguageProjection: true,
    consumedAnnotations: ['cognitive_level'],
  }

  initialized = false
  disposed = false
  lastSemanticEvent: SemanticUpdateEvent | null = null
  lastExecutionEvent: ExecutionStateEvent | null = null

  async initialize(_config: ViewConfig): Promise<void> {
    this.initialized = true
  }

  dispose(): void {
    this.disposed = true
  }

  onSemanticUpdate(event: SemanticUpdateEvent): void {
    this.lastSemanticEvent = event
  }

  onExecutionState(event: ExecutionStateEvent): void {
    this.lastExecutionEvent = event
  }
}

class MockReadOnlyView implements ViewHost {
  readonly viewId = 'dataflow-1'
  readonly viewType = 'dataflow'
  readonly capabilities: ViewCapabilities = {
    editable: false,
    needsLanguageProjection: false,
    consumedAnnotations: ['control_flow', 'body_execution', 'side_effects'],
  }

  async initialize(_config: ViewConfig): Promise<void> {}
  dispose(): void {}
  onSemanticUpdate(_event: SemanticUpdateEvent): void {}
  onExecutionState(_event: ExecutionStateEvent): void {}
}

describe('ViewHost', () => {
  it('should allow mock implementation of editable view', () => {
    const view = new MockBlocksView()
    expect(view.viewId).toBe('blocks-1')
    expect(view.viewType).toBe('blocks')
    expect(view.capabilities.editable).toBe(true)
    expect(view.capabilities.needsLanguageProjection).toBe(true)
    expect(view.capabilities.consumedAnnotations).toEqual(['cognitive_level'])
  })

  it('should allow mock implementation of read-only view', () => {
    const view = new MockReadOnlyView()
    expect(view.viewId).toBe('dataflow-1')
    expect(view.capabilities.editable).toBe(false)
    expect(view.capabilities.needsLanguageProjection).toBe(false)
    expect(view.capabilities.consumedAnnotations).toContain('control_flow')
  })

  it('should support initialize lifecycle', async () => {
    const view = new MockBlocksView()
    expect(view.initialized).toBe(false)
    await view.initialize({ language: 'cpp' })
    expect(view.initialized).toBe(true)
  })

  it('should support dispose lifecycle', () => {
    const view = new MockBlocksView()
    expect(view.disposed).toBe(false)
    view.dispose()
    expect(view.disposed).toBe(true)
  })

  it('should receive semantic update events', () => {
    const view = new MockBlocksView()
    const event: SemanticUpdateEvent = {
      tree: { id: '1', concept: 'program', properties: {}, children: {} },
    }
    view.onSemanticUpdate(event)
    expect(view.lastSemanticEvent).toBe(event)
  })

  it('should receive execution state events', () => {
    const view = new MockBlocksView()
    const event: ExecutionStateEvent = { status: 'running' }
    view.onExecutionState(event)
    expect(view.lastExecutionEvent).toBe(event)
  })

  it('should have empty consumedAnnotations for simple views', () => {
    const view: ViewHost = {
      viewId: 'console-1',
      viewType: 'console',
      capabilities: { editable: false, needsLanguageProjection: false, consumedAnnotations: [] },
      initialize: async () => {},
      dispose: () => {},
      onSemanticUpdate: () => {},
      onExecutionState: () => {},
    }
    expect(view.capabilities.consumedAnnotations).toHaveLength(0)
  })
})
