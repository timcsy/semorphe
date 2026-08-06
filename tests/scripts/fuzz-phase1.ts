/**
 * Phase 1 Fuzz Runner: lift → generate → compile → compare
 */
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import type { StylePreset, SemanticNode } from '../../src/core/types'
import { readFileSync, writeFileSync, readdirSync } from 'fs'

const style: StylePreset = {
  id: 'apcs',
  name: { 'zh-TW': 'APCS', en: 'APCS' },
  io_style: 'cout',
  naming_convention: 'camelCase',
  indent_size: 4,
  brace_style: 'K&R',
  namespace_style: 'using',
  header_style: 'individual',
}

function countNodes(node: SemanticNode): { total: number; raw: number; rawList: string[] } {
  let total = 1
  let raw = 0
  const rawList: string[] = []
  if (node.conceptId === 'cpp_raw_code' || node.conceptId === 'cpp_raw_expression' || node.conceptId === 'unresolved') {
    raw++
    rawList.push(node.conceptId + (node.metadata?.rawCode ? `: ${node.metadata.rawCode.substring(0, 40)}` : ''))
  }
  for (const children of Object.values(node.children || {})) {
    for (const child of children) {
      const c = countNodes(child)
      total += c.total
      raw += c.raw
      rawList.push(...c.rawList)
    }
  }
  return { total, raw, rawList }
}

async function main() {
  await Parser.init({
    locateFile: (scriptName: string) => `${process.cwd()}/public/${scriptName}`,
  })
  const parser = new Parser()
  const lang = await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`)
  parser.setLanguage(lang)

  const lifter = createTestLifter()
  registerCppLanguage()

  const programs = JSON.parse(readFileSync('/tmp/semorphe-fuzz/agent_a_programs.json', 'utf8'))

  const results: any[] = []

  for (const p of programs) {
    const id = p.id
    try {
      const code = readFileSync(`/tmp/semorphe-fuzz/${id}.cpp`, 'utf8')
      const tree = parser.parse(code)
      const sem = lifter.lift(tree.rootNode as any)

      if (!sem) {
        results.push({ id, status: 'LIFT_FAIL', detail: 'Lifter returned null' })
        continue
      }

      const { total, raw, rawList } = countNodes(sem)
      const generated = generateCode(sem, 'cpp', style)

      writeFileSync(`/tmp/semorphe-fuzz/${id}_generated.cpp`, generated)

      // Second roundtrip check
      const tree2 = parser.parse(generated)
      const sem2 = lifter.lift(tree2.rootNode as any)
      let drift = false
      if (sem2) {
        const generated2 = generateCode(sem2, 'cpp', style)
        drift = generated !== generated2
        if (drift) {
          writeFileSync(`/tmp/semorphe-fuzz/${id}_generated2.cpp`, generated2)
        }
      }

      if (raw > 0) {
        results.push({ id, status: 'DEGRADED', detail: `${raw}/${total} raw nodes: ${rawList.join('; ')}` })
      } else if (drift) {
        results.push({ id, status: 'ROUNDTRIP_DRIFT', detail: 'Code differs after 2nd roundtrip' })
      } else {
        results.push({ id, status: 'PIPELINE_PASS', detail: `${total} nodes, clean` })
      }
    } catch (e: any) {
      results.push({ id, status: 'ERROR', detail: e.message?.substring(0, 120) })
    }
  }

  // Print results
  console.log('\n## Fuzz 管線結果\n')
  console.log('| # | ID | 管線 | 細節 |')
  console.log('|---|-----|------|------|')
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const sym = r.status === 'PIPELINE_PASS' ? '✅' : r.status === 'DEGRADED' ? '🟡' : '❌'
    console.log(`| ${i + 1} | ${r.id} | ${sym} ${r.status} | ${r.detail} |`)
  }

  writeFileSync('/tmp/semorphe-fuzz/phase1_pipeline_results.json', JSON.stringify(results, null, 2))
}

main().catch(console.error)
