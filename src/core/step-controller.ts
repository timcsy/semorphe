import type { ExecutionSpeed } from '../interpreter/types'

type StepStatus = 'idle' | 'stepping' | 'running' | 'paused' | 'completed'

const SPEED_DELAY: Record<ExecutionSpeed, number> = {
  slow: 800,
  medium: 300,
  fast: 50,
}

export class StepController {
  private status: StepStatus = 'idle'
  private speed: ExecutionSpeed = 'medium'
  private stepFn: (() => boolean) | null = null
  private stepCallback: (() => void) | null = null
  private stopCallback: (() => void) | null = null
  private timerId: ReturnType<typeof setTimeout> | null = null

  getStatus(): StepStatus {
    return this.status
  }

  getSpeed(): ExecutionSpeed {
    return this.speed
  }

  setSpeed(speed: ExecutionSpeed): void {
    this.speed = speed
  }

  setStepFn(fn: () => boolean): void {
    this.stepFn = fn
  }

  onStep(callback: () => void): void {
    this.stepCallback = callback
  }

  onStop(callback: () => void): void {
    this.stopCallback = callback
  }

  step(): void {
    if (!this.stepFn) return
    if (this.status === 'completed') return

    const hasMore = this.stepFn()

    // Set status BEFORE callback so callback sees correct state
    if (!hasMore) {
      this.status = 'completed'
      this.clearTimer()
    } else if (this.status === 'idle') {
      this.status = 'stepping'
    }

    this.stepCallback?.()
  }

  run(): void {
    if (!this.stepFn) return
    if (this.status === 'completed') return
    this.status = 'running'
    this.scheduleNext()
  }

  pause(): void {
    if (this.status === 'running') {
      this.status = 'paused'
      this.clearTimer()
    }
  }

  resume(): void {
    if (this.status === 'paused') {
      this.status = 'running'
      this.scheduleNext()
    }
  }

  stop(): void {
    this.clearTimer()
    this.status = 'idle'
    this.stopCallback?.()
  }

  private scheduleNext(): void {
    if (this.status !== 'running') return
    this.timerId = setTimeout(() => {
      if (this.status !== 'running' || !this.stepFn) return
      const hasMore = this.stepFn()
      // Set status BEFORE callback so callback sees correct state
      if (!hasMore) {
        this.status = 'completed'
      }
      this.stepCallback?.()
      if (hasMore) {
        this.scheduleNext()
      }
    }, SPEED_DELAY[this.speed])
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
  }
}
