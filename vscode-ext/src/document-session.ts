import type { SemanticNode } from '../../src/core/types'

export class DocumentSession {
  readonly uri: string
  semanticTree: SemanticNode | null = null
  blocklyState: object | null = null
  lastSyncSource: 'code' | 'blocks' = 'code'

  constructor(uri: string) {
    this.uri = uri
  }
}

export class DocumentSessionManager {
  private sessions = new Map<string, DocumentSession>()

  getOrCreate(uri: string): DocumentSession {
    let session = this.sessions.get(uri)
    if (!session) {
      session = new DocumentSession(uri)
      this.sessions.set(uri, session)
    }
    return session
  }

  get(uri: string): DocumentSession | undefined {
    return this.sessions.get(uri)
  }

  delete(uri: string): void {
    this.sessions.delete(uri)
  }
}
