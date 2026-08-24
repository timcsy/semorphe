import { describe, it, expect, vi } from 'vitest'
import { StepController } from '../../src/core/step-controller'

describe('StepController', () => {
  it('should start in idle state', () => {
    const ctrl = new StepController()
    expect(ctrl.getStatus()).toBe('idle')
  })

  it('should execute single step via step()', () => {
    const ctrl = new StepController()
    const onStep = vi.fn()
    ctrl.onStep(onStep)
    ctrl.setStepFn(() => true) // returns true = has more steps
    ctrl.step()
    expect(onStep).toHaveBeenCalledTimes(1)
  })

  it('should report completed when step returns false', () => {
    const ctrl = new StepController()
    ctrl.setStepFn(() => false) // no more steps
    ctrl.step()
    expect(ctrl.getStatus()).toBe('completed')
  })

  it('should set speed', () => {
    const ctrl = new StepController()
    ctrl.setSpeed('slow')
    expect(ctrl.getSpeed()).toBe('slow')
    ctrl.setSpeed('fast')
    expect(ctrl.getSpeed()).toBe('fast')
  })

  it('should stop and reset', () => {
    const ctrl = new StepController()
    const onStop = vi.fn()
    ctrl.onStop(onStop)
    ctrl.setStepFn(() => true)
    ctrl.step()
    expect(ctrl.getStatus()).toBe('stepping')
    ctrl.stop()
    expect(ctrl.getStatus()).toBe('idle')
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('should pause and resume auto-run', async () => {
    const ctrl = new StepController()
    let stepCount = 0
    ctrl.setStepFn(() => {
      stepCount++
      return stepCount < 5
    })
    ctrl.setSpeed('fast')
    ctrl.run()
    expect(ctrl.getStatus()).toBe('running')
    ctrl.pause()
    expect(ctrl.getStatus()).toBe('paused')
    const pausedCount = stepCount
    // Wait a tick to confirm no more steps after pause
    await new Promise(r => setTimeout(r, 50))
    expect(stepCount).toBe(pausedCount)
  })
})
