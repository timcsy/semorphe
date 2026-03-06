export class IOSystem {
  private stdout: string[] = []
  private stdinQueue: string[] = []
  private stdinIndex = 0
  private outputCallback: ((text: string) => void) | null = null

  constructor(stdinQueue: string[] = []) {
    this.stdinQueue = [...stdinQueue]
  }

  /** Register a callback for real-time output streaming */
  onOutput(callback: ((text: string) => void) | null): void {
    this.outputCallback = callback
  }

  write(text: string): void {
    this.stdout.push(text)
    this.outputCallback?.(text)
  }

  writeNewline(): void {
    this.stdout.push('\n')
    this.outputCallback?.('\n')
  }

  getOutput(): string[] {
    return [...this.stdout]
  }

  hasInput(): boolean {
    return this.stdinIndex < this.stdinQueue.length
  }

  read(): string | null {
    if (!this.hasInput()) return null
    return this.stdinQueue[this.stdinIndex++]
  }

  reset(newStdin?: string[]): void {
    this.stdout = []
    this.stdinQueue = newStdin ? [...newStdin] : []
    this.stdinIndex = 0
  }
}
