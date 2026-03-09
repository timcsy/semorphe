import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SemanticBus } from '../../../src/core/semantic-bus'
import type { SemanticEvents, ViewRequests } from '../../../src/core/semantic-bus'

describe('SemanticBus', () => {
  let bus: SemanticBus

  beforeEach(() => {
    bus = new SemanticBus()
  })

  describe('on/emit basics', () => {
    it('should deliver event to subscriber', () => {
      const handler = vi.fn()
      bus.on('semantic:update', handler)

      const tree = { id: '1', concept: 'program', properties: {}, children: {} }
      bus.emit('semantic:update', { tree })

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith({ tree })
    })

    it('should deliver ViewRequests events', () => {
      const handler = vi.fn()
      bus.on('edit:code', handler)
      bus.emit('edit:code', { code: 'int main() {}' })
      expect(handler).toHaveBeenCalledWith({ code: 'int main() {}' })
    })

    it('should not deliver events to wrong channel', () => {
      const handler = vi.fn()
      bus.on('semantic:update', handler)
      bus.emit('execution:output', { text: 'hello', stream: 'stdout' })
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('multiple subscribers', () => {
    it('should notify all subscribers of the same event', () => {
      const h1 = vi.fn()
      const h2 = vi.fn()
      const h3 = vi.fn()
      bus.on('execution:output', h1)
      bus.on('execution:output', h2)
      bus.on('execution:output', h3)

      bus.emit('execution:output', { text: 'hi', stream: 'stdout' })

      expect(h1).toHaveBeenCalledOnce()
      expect(h2).toHaveBeenCalledOnce()
      expect(h3).toHaveBeenCalledOnce()
    })
  })

  describe('off (unsubscribe)', () => {
    it('should stop receiving events after off', () => {
      const handler = vi.fn()
      bus.on('semantic:update', handler)

      const tree = { id: '1', concept: 'program', properties: {}, children: {} }
      bus.emit('semantic:update', { tree })
      expect(handler).toHaveBeenCalledOnce()

      bus.off('semantic:update', handler)
      bus.emit('semantic:update', { tree })
      expect(handler).toHaveBeenCalledOnce() // still 1, not 2
    })

    it('should not affect other subscribers when one unsubscribes', () => {
      const h1 = vi.fn()
      const h2 = vi.fn()
      bus.on('execution:output', h1)
      bus.on('execution:output', h2)

      bus.off('execution:output', h1)
      bus.emit('execution:output', { text: 'x', stream: 'stdout' })

      expect(h1).not.toHaveBeenCalled()
      expect(h2).toHaveBeenCalledOnce()
    })
  })

  describe('error isolation', () => {
    it('should not stop other handlers when one throws', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const bad = vi.fn(() => { throw new Error('boom') })
      const good = vi.fn()
      bus.on('semantic:update', bad)
      bus.on('semantic:update', good)

      const tree = { id: '1', concept: 'program', properties: {}, children: {} }
      bus.emit('semantic:update', { tree })

      expect(bad).toHaveBeenCalledOnce()
      expect(good).toHaveBeenCalledOnce()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('no subscribers', () => {
    it('should not throw when emitting with no subscribers', () => {
      expect(() => {
        bus.emit('semantic:update', { tree: { id: '1', concept: 'program', properties: {}, children: {} } })
      }).not.toThrow()
    })
  })

  describe('type safety', () => {
    it('should have correct SemanticEvents keys', () => {
      // These should compile without errors — type-level test
      const _check: keyof SemanticEvents = 'semantic:update'
      const _check2: keyof SemanticEvents = 'semantic:full-sync'
      const _check3: keyof SemanticEvents = 'execution:state'
      const _check4: keyof SemanticEvents = 'execution:output'
      const _check5: keyof SemanticEvents = 'diagnostics:update'
      expect(_check).toBe('semantic:update')
      expect(_check2).toBe('semantic:full-sync')
      expect(_check3).toBe('execution:state')
      expect(_check4).toBe('execution:output')
      expect(_check5).toBe('diagnostics:update')
    })

    it('should have correct ViewRequests keys', () => {
      const _check: keyof ViewRequests = 'edit:code'
      const _check2: keyof ViewRequests = 'edit:blocks'
      const _check3: keyof ViewRequests = 'execution:run'
      const _check4: keyof ViewRequests = 'execution:input'
      const _check5: keyof ViewRequests = 'config:change'
      expect(_check).toBe('edit:code')
      expect(_check2).toBe('edit:blocks')
      expect(_check3).toBe('execution:run')
      expect(_check4).toBe('execution:input')
      expect(_check5).toBe('config:change')
    })
  })
})
