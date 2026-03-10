// ─── DependencyResolver: Language-agnostic dependency resolution ───

export interface DependencyEdge {
  /** Complete import directive, ready to insert (e.g., '#include <iostream>') */
  directive: string
  /** Dependency source classification */
  sourceType: 'builtin' | 'stdlib' | 'external'
  /** Header/module identifier (e.g., '<iostream>') */
  header: string
  /** The concept that triggered this dependency (for tooltip display) */
  reason?: string
}

export interface DependencyResolver {
  /**
   * Resolve concept IDs to dependency edges.
   * Returns deduplicated, sorted edges.
   */
  resolve(conceptIds: string[]): DependencyEdge[]
}
