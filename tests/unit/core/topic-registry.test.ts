import { describe, it, expect, beforeEach } from 'vitest'
import { TopicRegistry } from '../../../src/core/topic-registry'
import type { Topic } from '../../../src/core/types'

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 'cpp-beginner',
    language: 'cpp',
    name: '初學 C++',
    default: true,
    levelTree: {
      id: 'L0',
      level: 0,
      label: 'L0',
      concepts: ['cpp:print', 'cpp:var_declare'],
      children: [],
    },
    ...overrides,
  }
}

describe('TopicRegistry', () => {
  let registry: TopicRegistry

  beforeEach(() => {
    registry = new TopicRegistry()
  })

  describe('register', () => {
    it('should register a topic', () => {
      const topic = makeTopic()
      registry.register(topic)
      expect(registry.get('cpp-beginner')).toBe(topic)
    })

    it('should throw on duplicate ID', () => {
      registry.register(makeTopic())
      expect(() => registry.register(makeTopic())).toThrow(/duplicate/i)
    })

    it('should throw on multiple defaults for same language', () => {
      registry.register(makeTopic({ id: 'cpp-beginner', default: true }))
      expect(() =>
        registry.register(makeTopic({ id: 'cpp-advanced', default: true }))
      ).toThrow(/default/i)
    })

    it('should allow multiple topics for same language if only one default', () => {
      registry.register(makeTopic({ id: 'cpp-beginner', default: true }))
      registry.register(makeTopic({ id: 'cpp-competitive', default: false }))
      expect(registry.listForLanguage('cpp')).toHaveLength(2)
    })
  })

  describe('get', () => {
    it('should return undefined for unknown ID', () => {
      expect(registry.get('nonexistent')).toBeUndefined()
    })
  })

  describe('getDefault', () => {
    it('should return the default topic for a language', () => {
      const topic = makeTopic({ default: true })
      registry.register(topic)
      expect(registry.getDefault('cpp')).toBe(topic)
    })

    it('should return undefined for language with no topics', () => {
      expect(registry.getDefault('python')).toBeUndefined()
    })

    it('should auto-set first topic as default if none marked', () => {
      const topic = makeTopic({ default: false })
      registry.register(topic)
      expect(registry.getDefault('cpp')).toBe(topic)
    })
  })

  describe('listForLanguage', () => {
    it('should return empty array for unknown language', () => {
      expect(registry.listForLanguage('python')).toEqual([])
    })

    it('should return all topics for a language', () => {
      registry.register(makeTopic({ id: 'cpp-beginner', default: true }))
      registry.register(makeTopic({ id: 'cpp-competitive', default: false }))
      expect(registry.listForLanguage('cpp')).toHaveLength(2)
    })

    it('should not mix languages', () => {
      registry.register(makeTopic({ id: 'cpp-beginner', language: 'cpp', default: true }))
      registry.register(makeTopic({ id: 'py-beginner', language: 'python', default: true }))
      expect(registry.listForLanguage('cpp')).toHaveLength(1)
      expect(registry.listForLanguage('python')).toHaveLength(1)
    })
  })
})
