/**
 * ComponentRegistry 完備性驗證腳本
 *
 * 掃描所有概念來源，檢查每個概念的四條路徑：
 * lift（AST→Semantic）、render（Semantic→Block）、extract（Block→Semantic）、generate（Semantic→Code）
 *
 * 用法：npx tsx src/scripts/verify-component-paths.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { programRootComponent } from '../core/component/traits'

// ─── Types ───

export interface ComponentPathReport {
  componentId: string
  sources: string[]
  paths: {
    lift: boolean
    render: boolean
    extract: boolean
    generate: boolean
  }
  missing: string[]
}

// ─── Component Collection ───

/** 從 BlockSpec JSON 檔案收集 componentId */
export function collectFromBlockSpecs(jsonPaths: string[]): Map<string, string[]> {
  const result = new Map<string, string[]>()
  for (const p of jsonPaths) {
    // ⚠️ **兩種形狀都要認**：舊的投影檔把身分包在 `component.componentId` 裡，
    // 而拆分之後（Phase 3）它是**頂層的 `componentId`**。只認前者的話，
    // 這份腳本會說「這個專案只有 23 顆概念」——而那些概念的積木好端端地在。
    const data = JSON.parse(fs.readFileSync(p, 'utf8')) as Array<{ component?: { componentId?: string }; componentId?: string }>
    for (const spec of data) {
      const id = spec.component?.componentId ?? spec.componentId
      if (!id) continue
      const sources = result.get(id) ?? []
      sources.push(path.basename(p))
      result.set(id, sources)
    }
  }
  return result
}

/** 從 LiftPattern JSON 收集 componentId */
export function collectFromLiftPatterns(jsonPath: string): Map<string, string[]> {
  const result = new Map<string, string[]>()
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Array<{ component?: { componentId?: string } }>
  for (const pattern of data) {
    const id = pattern.component?.componentId
    if (!id) continue
    const sources = result.get(id) ?? []
    sources.push('lift-patterns.json')
    result.set(id, sources)
  }
  return result
}

/** 從 UniversalTemplate JSON 收集 componentId */
export function collectFromUniversalTemplates(jsonPath: string): Map<string, string[]> {
  const result = new Map<string, string[]>()
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Array<{ componentId?: string }>
  for (const tmpl of data) {
    if (!tmpl.componentId) continue
    const sources = result.get(tmpl.componentId) ?? []
    sources.push('universal-templates.json')
    result.set(tmpl.componentId, sources)
  }
  return result
}

/** 從手寫 lifter/generator TS 檔案中提取 componentId（via regex） */
export function collectFromHandWritten(tsFiles: string[], type: 'lifter' | 'generator'): Set<string> {
  const components = new Set<string>()
  for (const f of tsFiles) {
    const code = fs.readFileSync(f, 'utf8')
    if (type === 'lifter') {
      // Match createNode('componentId', ...) patterns
      const matches = code.matchAll(/createNode\(\s*['"]([^'"]+)['"]/g)
      for (const m of matches) components.add(m[1])
    } else {
      // Match g.set('componentId', ...) or .register('componentId', ...) patterns
      const setMatches = code.matchAll(/\.set\(\s*['"]([^'"]+)['"]/g)
      for (const m of setMatches) components.add(m[1])
      const regMatches = code.matchAll(/\.register\(\s*['"]([^'"]+)['"]/g)
      for (const m of regMatches) components.add(m[1])
    }
  }
  return components
}

// ─── Path Checking ───

/** 哪些概念有 lift path */
export function getComponentsWithLift(
  blockSpecComponentIds: Set<string>,
  liftPatternComponentIds: Set<string>,
  handWrittenLifterComponents: Set<string>,
): Set<string> {
  const result = new Set<string>()
  // BlockSpec 的 astPattern 提供 lift path
  for (const id of blockSpecComponentIds) result.add(id)
  // LiftPattern 提供 lift path
  for (const id of liftPatternComponentIds) result.add(id)
  // 手寫 lifter 透過 createNode 產出概念
  for (const id of handWrittenLifterComponents) result.add(id)
  return result
}

/** 哪些概念有 render path（BlockSpec 存在即可，PatternRenderer 自動 derive） */
export function getComponentsWithRender(blockSpecComponentIds: Set<string>, renderStrategyComponents: Set<string>): Set<string> {
  const result = new Set<string>(blockSpecComponentIds)
  for (const id of renderStrategyComponents) result.add(id)
  return result
}

/** 哪些概念有 extract path（同 render，PatternExtractor 依 renderMapping 反向） */
export function getComponentsWithExtract(blockSpecComponentIds: Set<string>, renderStrategyComponents: Set<string>): Set<string> {
  return getComponentsWithRender(blockSpecComponentIds, renderStrategyComponents)
}

/** 哪些概念有 generate path */
export function getComponentsWithGenerate(
  blockSpecWithTemplate: Set<string>,
  universalTemplateComponents: Set<string>,
  handWrittenGeneratorComponents: Set<string>,
): Set<string> {
  const result = new Set<string>()
  for (const id of blockSpecWithTemplate) result.add(id)
  for (const id of universalTemplateComponents) result.add(id)
  for (const id of handWrittenGeneratorComponents) result.add(id)
  return result
}

/** 從 BlockSpec 中提取有 codeTemplate 的概念 */
export function collectBlockSpecsWithTemplate(jsonPaths: string[]): Set<string> {
  const result = new Set<string>()
  for (const p of jsonPaths) {
    const data = JSON.parse(fs.readFileSync(p, 'utf8')) as Array<{
      component?: { componentId?: string }
      codeTemplate?: { pattern?: string }
    }>
    for (const spec of data) {
      const id = spec.component?.componentId
      if (id && spec.codeTemplate?.pattern) result.add(id)
    }
  }
  return result
}

/** 從 render strategy TS 檔案中提取 registered component IDs */
export function collectRenderStrategyComponents(tsFiles: string[]): Set<string> {
  const components = new Set<string>()
  for (const f of tsFiles) {
    const code = fs.readFileSync(f, 'utf8')
    // render strategies map to components indirectly; the strategy name encodes the component
    // e.g., 'cpp:renderInput' → input, 'cpp:renderPrint' → print
    // We check what components BlockSpecs point to via renderMapping.strategy
    // For simplicity, we parse the strategy registration and the BlockSpec references
  }
  return components
}

// ─── Excluded Components ───

/** 不需要完整四條路徑的內部/特殊概念 */
const INTERNAL_COMPONENTS = new Set([
  '_compound',     // 內部展開用
  'raw_code',      // 降級概念，不需要 lift pattern
  'unresolved',    // 內部降級概念
  // ⚠️ **樹根**。它不需要 render／extract，而它現在是一顆膠囊
  // ——身分寫在這裡會被就近性護欄指名，所以問性狀。
  ...(programRootComponent() ? [programRootComponent() as string] : []),
])

// ─── Main Verification ───

export function verify(rootDir: string): { reports: ComponentPathReport[]; exitCode: number } {
  // Discover std module block files dynamically
  const stdDir = path.join(rootDir, 'src/languages/cpp/std')
  const stdBlockPaths: string[] = []
  if (fs.existsSync(stdDir)) {
    for (const entry of fs.readdirSync(stdDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const blocksPath = path.join(stdDir, entry.name, 'blocks.json')
        if (fs.existsSync(blocksPath)) stdBlockPaths.push(blocksPath)
      }
    }
  }

  // ⚠️ **膠囊的積木也要掃。**
  //
  // 這份腳本原本只列三種來源（universal／core／std 模組）——而元件搬進
  // `src/components/<scope>/<name>/forms/blocks.json` 之後就不在那三種裡。
  // 症狀是「這顆概念沒有任何投影」，而它的積木好端端地在膠囊裡。
  //
  // 這是**第 N 份各自列來源**（第三十七條護欄只掃 `tests/`，掃不到 `src/scripts/`）。
  const componentsDir = path.join(rootDir, 'src/components')
  const componentBlockPaths: string[] = []
  if (fs.existsSync(componentsDir)) {
    for (const scope of fs.readdirSync(componentsDir, { withFileTypes: true })) {
      if (!scope.isDirectory()) continue
      const scopeDir = path.join(componentsDir, scope.name)
      for (const comp of fs.readdirSync(scopeDir, { withFileTypes: true })) {
        if (!comp.isDirectory()) continue
        const p2 = path.join(scopeDir, comp.name, 'forms/blocks.json')
        if (fs.existsSync(p2)) componentBlockPaths.push(p2)
      }
    }
  }

  const blockSpecPaths = [
    path.join(rootDir, 'src/core/universal-blocks.json'),
    path.join(rootDir, 'src/languages/cpp/core/blocks.json'),
    ...stdBlockPaths,
    ...componentBlockPaths,
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

  // Collect all component IDs and their sources
  const blockSpecComponents = collectFromBlockSpecs(blockSpecPaths)
  const liftPatternComponents = collectFromLiftPatterns(liftPatternsPath)
  const universalTemplateComponents = collectFromUniversalTemplates(universalTemplatesPath)

  // Merge all sources
  const allComponents = new Map<string, string[]>()
  for (const [id, sources] of blockSpecComponents) {
    allComponents.set(id, [...(allComponents.get(id) ?? []), ...sources])
  }
  for (const [id, sources] of liftPatternComponents) {
    allComponents.set(id, [...(allComponents.get(id) ?? []), ...sources])
  }
  for (const [id, sources] of universalTemplateComponents) {
    allComponents.set(id, [...(allComponents.get(id) ?? []), ...sources])
  }

  // Collect path coverage
  const handWrittenLifters = collectFromHandWritten(lifterFiles, 'lifter')
  const handWrittenGenerators = collectFromHandWritten(generatorFiles, 'generator')
  const blockSpecIds = new Set(blockSpecComponents.keys())
  const liftPatternIds = new Set(liftPatternComponents.keys())
  const universalTemplateIds = new Set(universalTemplateComponents.keys())
  const blockSpecsWithTemplate = collectBlockSpecsWithTemplate(blockSpecPaths)

  // Render strategies produce components that are registered in BlockSpec.renderMapping.strategy
  // But the strategy registry maps component→strategy via the PatternRenderer
  // For path checking, if a BlockSpec exists for a component, render+extract paths exist
  // (because PatternRenderer.deriveRenderMapping auto-generates)
  // Additionally, render strategies registered in strategies.ts cover specific components
  const renderStrategyComponents = new Set<string>()
  for (const f of rendererFiles) {
    const code = fs.readFileSync(f, 'utf8')
    const matches = code.matchAll(/registry\.register\(\s*['"]([^'"]+)['"]/g)
    for (const m of matches) renderStrategyComponents.add(m[1])
  }
  // Map strategy names to their target components by scanning BlockSpec renderMapping.strategy
  const strategyToComponent = new Map<string, string>()
  for (const p of blockSpecPaths) {
    const data = JSON.parse(fs.readFileSync(p, 'utf8')) as Array<{
      component?: { componentId?: string }
      renderMapping?: { strategy?: string }
    }>
    for (const spec of data) {
      if (spec.component?.componentId && spec.renderMapping?.strategy) {
        strategyToComponent.set(spec.renderMapping.strategy, spec.component.componentId)
      }
    }
  }
  const renderCoveredComponents = new Set<string>()
  for (const [strategy, component] of strategyToComponent) {
    if (renderStrategyComponents.has(strategy)) renderCoveredComponents.add(component)
  }

  const liftCovered = getComponentsWithLift(blockSpecIds, liftPatternIds, handWrittenLifters)
  const renderCovered = getComponentsWithRender(blockSpecIds, renderCoveredComponents)
  const extractCovered = getComponentsWithExtract(blockSpecIds, renderCoveredComponents)
  const generateCovered = getComponentsWithGenerate(blockSpecsWithTemplate, universalTemplateIds, handWrittenGenerators)

  // Build reports
  const reports: ComponentPathReport[] = []
  let hasMissing = false

  for (const [componentId, sources] of [...allComponents.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (INTERNAL_COMPONENTS.has(componentId)) continue

    const missing: string[] = []
    if (!liftCovered.has(componentId)) missing.push('lift')
    if (!renderCovered.has(componentId)) missing.push('render')
    if (!extractCovered.has(componentId)) missing.push('extract')
    if (!generateCovered.has(componentId)) missing.push('generate')

    reports.push({
      componentId,
      sources: [...new Set(sources)],
      paths: {
        lift: liftCovered.has(componentId),
        render: renderCovered.has(componentId),
        extract: extractCovered.has(componentId),
        generate: generateCovered.has(componentId),
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

  console.log('Scanning component sources...\n')

  let totalComponents = 0
  let missingCount = 0

  for (const r of reports) {
    totalComponents++
    const mark = r.missing.length === 0 ? '✓' : '✗'
    const pathStatus = ['lift', 'render', 'extract', 'generate']
      .map(p => `${p} ${(r.paths as Record<string, boolean>)[p] ? '✓' : '✗'}`)
      .join(' ')
    console.log(`${mark} ${r.componentId}: ${pathStatus}`)

    if (r.missing.length > 0) {
      missingCount++
      console.log(`  Missing: ${r.missing.join(', ')} (sources: ${r.sources.join(', ')})`)
    }
  }

  console.log(`\nResult: ${totalComponents - missingCount}/${totalComponents} components fully covered (${missingCount} with missing paths)`)
  process.exit(exitCode)
}

// Run if executed directly
const isMain = import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('verify-component-paths.ts')
if (isMain) {
  main()
}
