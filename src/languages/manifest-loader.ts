import type { LanguageManifest, ComponentDefJSON, BlockProjectionJSON, LiftPattern, UniversalTemplate } from '../core/types'

export interface ManifestResources {
  concepts: ComponentDefJSON[]
  projections: BlockProjectionJSON[]
  templates: UniversalTemplate[]
  liftPatterns: LiftPattern[]
}

/**
 * Load all resources declared in a language manifest.
 * Accepts a resolver function to handle path→data mapping
 * (since JSON imports work differently in bundler vs Node).
 */
export function loadManifestResources(
  manifest: LanguageManifest,
  resolveJSON: (relativePath: string) => unknown[],
): ManifestResources {
  const concepts: ComponentDefJSON[] = []
  for (const p of manifest.provides.concepts) {
    concepts.push(...resolveJSON(p) as ComponentDefJSON[])
  }

  const projections: BlockProjectionJSON[] = []
  for (const p of manifest.provides.blocks) {
    projections.push(...resolveJSON(p) as BlockProjectionJSON[])
  }

  const templates: UniversalTemplate[] = []
  for (const p of manifest.provides.templates) {
    templates.push(...resolveJSON(p) as UniversalTemplate[])
  }

  const liftPatterns: LiftPattern[] = []
  for (const p of manifest.provides.liftPatterns) {
    liftPatterns.push(...resolveJSON(p) as LiftPattern[])
  }

  return { concepts, projections, templates, liftPatterns }
}
