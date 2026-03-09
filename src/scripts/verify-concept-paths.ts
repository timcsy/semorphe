/**
 * ConceptRegistry 完備性驗證腳本
 *
 * 掃描所有概念來源，檢查每個概念的四條路徑：
 * lift（AST→Semantic）、render（Semantic→Block）、extract（Block→Semantic）、generate（Semantic→Code）
 *
 * 用法：npx tsx src/scripts/verify-concept-paths.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ─── Types ───

export interface ConceptPathReport {
  conceptId: string
  sources: string[]
  paths: {
    lift: boolean
    render: boolean
    extract: boolean
    generate: boolean
  }
  missing: string[]
}

// ─── Concept Collection ───

/** 從 BlockSpec JSON 檔案收集 conceptId */
export function collectFromBlockSpecs(jsonPaths: string[]): Map<string, string[]> {
  const result = new Map<string, string[]>()
  for (const p of jsonPaths) {
    const data = JSON.parse(fs.readFileSync(p, 'utf8')) as Array<{ concept?: { conceptId?: string } }>
    for (const spec of data) {
      const id = spec.concept?.conceptId
      if (!id) continue
      const sources = result.get(id) ?? []
      sources.push(path.basename(p))
      result.set(id, sources)
    }
  }
  return result
}

/** 從 LiftPattern JSON 收集 conceptId */
export function collectFromLiftPatterns(jsonPath: string): Map<string, string[]> {
  const result = new Map<string, string[]>()
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Array<{ concept?: { conceptId?: string } }>
  for (const pattern of data) {
    const id = pattern.concept?.conceptId
    if (!id) continue
    const sources = result.get(id) ?? []
    sources.push('lift-patterns.json')
    result.set(id, sources)
  }
  return result
}

/** 從 UniversalTemplate JSON 收集 conceptId */
export function collectFromUniversalTemplates(jsonPath: string): Map<string, string[]> {
  const result = new Map<string, string[]>()
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Array<{ conceptId?: string }>
  for (const tmpl of data) {
    if (!tmpl.conceptId) continue
    const sources = result.get(tmpl.conceptId) ?? []
    sources.push('universal-templates.json')
    result.set(tmpl.conceptId, sources)
  }
  return result
}

/** 從手寫 lifter/generator TS 檔案中提取 conceptId（via regex） */
export function collectFromHandWritten(tsFiles: string[], type: 'lifter' | 'generator'): Set<string> {
  const concepts = new Set<string>()
  for (const f of tsFiles) {
    const code = fs.readFileSync(f, 'utf8')
    if (type === 'lifter') {
      // Match createNode('conceptId', ...) patterns
      const matches = code.matchAll(/createNode\(\s*['"]([^'"]+)['"]/g)
      for (const m of matches) concepts.add(m[1])
    } else {
      // Match g.set('conceptId', ...) or .register('conceptId', ...) patterns
      const setMatches = code.matchAll(/\.set\(\s*['"]([^'"]+)['"]/g)
      for (const m of setMatches) concepts.add(m[1])
      const regMatches = code.matchAll(/\.register\(\s*['"]([^'"]+)['"]/g)
      for (const m of regMatches) concepts.add(m[1])
    }
  }
  return concepts
}

// ─── Path Checking ───

/** 哪些概念有 lift path */
export function getConceptsWithLift(
  blockSpecConceptIds: Set<string>,
  liftPatternConceptIds: Set<string>,
  handWrittenLifterConcepts: Set<string>,
): Set<string> {
  const result = new Set<string>()
  // BlockSpec 的 astPattern 提供 lift path
  for (const id of blockSpecConceptIds) result.add(id)
  // LiftPattern 提供 lift path
  for (const id of liftPatternConceptIds) result.add(id)
  // 手寫 lifter 透過 createNode 產出概念
  for (const id of handWrittenLifterConcepts) result.add(id)
  return result
}

/** 哪些概念有 render path（BlockSpec 存在即可，PatternRenderer 自動 derive） */
export function getConceptsWithRender(blockSpecConceptIds: Set<string>, renderStrategyConcepts: Set<string>): Set<string> {
  const result = new Set<string>(blockSpecConceptIds)
  for (const id of renderStrategyConcepts) result.add(id)
  return result
}

/** 哪些概念有 extract path（同 render，PatternExtractor 依 renderMapping 反向） */
export function getConceptsWithExtract(blockSpecConceptIds: Set<string>, renderStrategyConcepts: Set<string>): Set<string> {
  return getConceptsWithRender(blockSpecConceptIds, renderStrategyConcepts)
}

/** 哪些概念有 generate path */
export function getConceptsWithGenerate(
  blockSpecWithTemplate: Set<string>,
  universalTemplateConcepts: Set<string>,
  handWrittenGeneratorConcepts: Set<string>,
): Set<string> {
  const result = new Set<string>()
  for (const id of blockSpecWithTemplate) result.add(id)
  for (const id of universalTemplateConcepts) result.add(id)
  for (const id of handWrittenGeneratorConcepts) result.add(id)
  return result
}

/** 從 BlockSpec 中提取有 codeTemplate 的概念 */
export function collectBlockSpecsWithTemplate(jsonPaths: string[]): Set<string> {
  const result = new Set<string>()
  for (const p of jsonPaths) {
    const data = JSON.parse(fs.readFileSync(p, 'utf8')) as Array<{
      concept?: { conceptId?: string }
      codeTemplate?: { pattern?: string }
    }>
    for (const spec of data) {
      const id = spec.concept?.conceptId
      if (id && spec.codeTemplate?.pattern) result.add(id)
    }
  }
  return result
}

/** 從 render strategy TS 檔案中提取 registered concept IDs */
export function collectRenderStrategyConcepts(tsFiles: string[]): Set<string> {
  const concepts = new Set<string>()
  for (const f of tsFiles) {
    const code = fs.readFileSync(f, 'utf8')
    // render strategies map to concepts indirectly; the strategy name encodes the concept
    // e.g., 'cpp:renderInput' → input, 'cpp:renderPrint' → print
    // We check what concepts BlockSpecs point to via renderMapping.strategy
    // For simplicity, we parse the strategy registration and the BlockSpec references
  }
  return concepts
}

// ─── Excluded Concepts ───

/** 不需要完整四條路徑的內部/特殊概念 */
const INTERNAL_CONCEPTS = new Set([
  '_compound',     // 內部展開用
  'raw_code',      // 降級概念，不需要 lift pattern
  'unresolved',    // 內部降級概念
  'program',       // 根節點，不需要 render/extract
])

// ─── Main Verification ───

export function verify(rootDir: string): { reports: ConceptPathReport[]; exitCode: number } {
  const blockSpecPaths = [
    path.join(rootDir, 'src/blocks/projections/blocks/universal-blocks.json'),
    path.join(rootDir, 'src/languages/cpp/projections/blocks/basic.json'),
    path.join(rootDir, 'src/languages/cpp/projections/blocks/advanced.json'),
    path.join(rootDir, 'src/languages/cpp/projections/blocks/special.json'),
    path.join(rootDir, 'src/languages/cpp/projections/blocks/stdlib-algorithms.json'),
    path.join(rootDir, 'src/languages/cpp/projections/blocks/stdlib-containers.json'),
  ]

  const liftPatternsPath = path.join(rootDir, 'src/languages/cpp/lift-patterns.json')
  const universalTemplatesPath = path.join(rootDir, 'src/languages/cpp/templates/universal-templates.json')

  const lifterFiles = [
    'declarations.ts', 'statements.ts', 'expressions.ts', 'io.ts', 'strategies.ts', 'transforms.ts',
  ].map(f => path.join(rootDir, 'src/languages/cpp/lifters', f)).filter(f => fs.existsSync(f))

  const generatorFiles = [
    'declarations.ts', 'statements.ts', 'expressions.ts', 'io.ts',
  ].map(f => path.join(rootDir, 'src/languages/cpp/generators', f)).filter(f => fs.existsSync(f))

  const rendererFiles = [
    path.join(rootDir, 'src/languages/cpp/renderers/strategies.ts'),
  ].filter(f => fs.existsSync(f))

  // Collect all concept IDs and their sources
  const blockSpecConcepts = collectFromBlockSpecs(blockSpecPaths)
  const liftPatternConcepts = collectFromLiftPatterns(liftPatternsPath)
  const universalTemplateConcepts = collectFromUniversalTemplates(universalTemplatesPath)

  // Merge all sources
  const allConcepts = new Map<string, string[]>()
  for (const [id, sources] of blockSpecConcepts) {
    allConcepts.set(id, [...(allConcepts.get(id) ?? []), ...sources])
  }
  for (const [id, sources] of liftPatternConcepts) {
    allConcepts.set(id, [...(allConcepts.get(id) ?? []), ...sources])
  }
  for (const [id, sources] of universalTemplateConcepts) {
    allConcepts.set(id, [...(allConcepts.get(id) ?? []), ...sources])
  }

  // Collect path coverage
  const handWrittenLifters = collectFromHandWritten(lifterFiles, 'lifter')
  const handWrittenGenerators = collectFromHandWritten(generatorFiles, 'generator')
  const blockSpecIds = new Set(blockSpecConcepts.keys())
  const liftPatternIds = new Set(liftPatternConcepts.keys())
  const universalTemplateIds = new Set(universalTemplateConcepts.keys())
  const blockSpecsWithTemplate = collectBlockSpecsWithTemplate(blockSpecPaths)

  // Render strategies produce concepts that are registered in BlockSpec.renderMapping.strategy
  // But the strategy registry maps concept→strategy via the PatternRenderer
  // For path checking, if a BlockSpec exists for a concept, render+extract paths exist
  // (because PatternRenderer.deriveRenderMapping auto-generates)
  // Additionally, render strategies registered in strategies.ts cover specific concepts
  const renderStrategyConcepts = new Set<string>()
  for (const f of rendererFiles) {
    const code = fs.readFileSync(f, 'utf8')
    const matches = code.matchAll(/registry\.register\(\s*['"]([^'"]+)['"]/g)
    for (const m of matches) renderStrategyConcepts.add(m[1])
  }
  // Map strategy names to their target concepts by scanning BlockSpec renderMapping.strategy
  const strategyToConcept = new Map<string, string>()
  for (const p of blockSpecPaths) {
    const data = JSON.parse(fs.readFileSync(p, 'utf8')) as Array<{
      concept?: { conceptId?: string }
      renderMapping?: { strategy?: string }
    }>
    for (const spec of data) {
      if (spec.concept?.conceptId && spec.renderMapping?.strategy) {
        strategyToConcept.set(spec.renderMapping.strategy, spec.concept.conceptId)
      }
    }
  }
  const renderCoveredConcepts = new Set<string>()
  for (const [strategy, concept] of strategyToConcept) {
    if (renderStrategyConcepts.has(strategy)) renderCoveredConcepts.add(concept)
  }

  const liftCovered = getConceptsWithLift(blockSpecIds, liftPatternIds, handWrittenLifters)
  const renderCovered = getConceptsWithRender(blockSpecIds, renderCoveredConcepts)
  const extractCovered = getConceptsWithExtract(blockSpecIds, renderCoveredConcepts)
  const generateCovered = getConceptsWithGenerate(blockSpecsWithTemplate, universalTemplateIds, handWrittenGenerators)

  // Build reports
  const reports: ConceptPathReport[] = []
  let hasMissing = false

  for (const [conceptId, sources] of [...allConcepts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (INTERNAL_CONCEPTS.has(conceptId)) continue

    const missing: string[] = []
    if (!liftCovered.has(conceptId)) missing.push('lift')
    if (!renderCovered.has(conceptId)) missing.push('render')
    if (!extractCovered.has(conceptId)) missing.push('extract')
    if (!generateCovered.has(conceptId)) missing.push('generate')

    reports.push({
      conceptId,
      sources: [...new Set(sources)],
      paths: {
        lift: liftCovered.has(conceptId),
        render: renderCovered.has(conceptId),
        extract: extractCovered.has(conceptId),
        generate: generateCovered.has(conceptId),
      },
      missing,
    })

    if (missing.length > 0) hasMissing = true
  }

  return { reports, exitCode: hasMissing ? 1 : 0 }
}

// ─── CLI ───

function main(): void {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const rootDir = path.resolve(__dirname, '../..')
  const { reports, exitCode } = verify(rootDir)

  console.log('Scanning concept sources...\n')

  let totalConcepts = 0
  let missingCount = 0

  for (const r of reports) {
    totalConcepts++
    const mark = r.missing.length === 0 ? '✓' : '✗'
    const pathStatus = ['lift', 'render', 'extract', 'generate']
      .map(p => `${p} ${(r.paths as Record<string, boolean>)[p] ? '✓' : '✗'}`)
      .join(' ')
    console.log(`${mark} ${r.conceptId}: ${pathStatus}`)

    if (r.missing.length > 0) {
      missingCount++
      console.log(`  Missing: ${r.missing.join(', ')} (sources: ${r.sources.join(', ')})`)
    }
  }

  console.log(`\nResult: ${totalConcepts - missingCount}/${totalConcepts} concepts fully covered (${missingCount} with missing paths)`)
  process.exit(exitCode)
}

// Run if executed directly
const isMain = import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('verify-concept-paths.ts')
if (isMain) {
  main()
}
