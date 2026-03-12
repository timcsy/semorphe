/**
 * Phase 3 Fuzz Runner: Functions & I/O
 * lift → generate → roundtrip check → compile → compare stdout
 */
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import type { StylePreset, SemanticNode } from '../../src/core/types'
import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

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
  if (node.concept === 'cpp_raw_code' || node.concept === 'cpp_raw_expression' || node.concept === 'unresolved') {
    raw++
    rawList.push(node.concept + (node.metadata?.rawCode ? `: ${node.metadata.rawCode.substring(0, 60)}` : ''))
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

function tryCompileAndRun(cppPath: string, binPath: string): { ok: boolean; stdout?: string; error?: string } {
  try {
    execSync(`g++ -std=c++17 -o ${binPath} ${cppPath} 2>/tmp/semorphe-fuzz/_compile_err.txt`, { timeout: 15000 })
  } catch {
    const err = (() => { try { return readFileSync('/tmp/semorphe-fuzz/_compile_err.txt', 'utf8'); } catch { return 'unknown'; } })()
    return { ok: false, error: `COMPILE: ${err.substring(0, 200)}` }
  }
  try {
    const stdout = execSync(binPath, { timeout: 10000 }).toString()
    return { ok: true, stdout }
  } catch (e: any) {
    return { ok: false, error: `RUNTIME: ${e.message?.substring(0, 120)}` }
  }
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

  const programs = JSON.parse(readFileSync('/tmp/semorphe-fuzz/agent_a_functions_io.json', 'utf8'))

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

      // Second roundtrip: re-lift generated code and re-generate
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

      // Determine pipeline status
      if (raw > 0) {
        results.push({ id, status: 'DEGRADED', detail: `${raw}/${total} raw nodes: ${rawList.join('; ')}`, raw, total })
      } else if (drift) {
        results.push({ id, status: 'ROUNDTRIP_DRIFT', detail: 'Code differs after 2nd roundtrip' })
      } else {
        results.push({ id, status: 'PIPELINE_PASS', detail: `${total} nodes, clean` })
      }

      // Compile and run generated code, compare stdout
      const expected = readFileSync(`/tmp/semorphe-fuzz/${id}_expected.txt`, 'utf8')
      const genResult = tryCompileAndRun(
        `/tmp/semorphe-fuzz/${id}_generated.cpp`,
        `/tmp/semorphe-fuzz/${id}_gen_bin`
      )

      const last = results[results.length - 1]
      if (!genResult.ok) {
        last.compile_status = 'COMPILE_FAIL'
        last.compile_error = genResult.error
        writeFileSync(`/tmp/semorphe-fuzz/${id}_gen_compile.log`, genResult.error || '')
      } else {
        writeFileSync(`/tmp/semorphe-fuzz/${id}_gen_actual.txt`, genResult.stdout || '')
        if (genResult.stdout === expected) {
          last.compile_status = 'OUTPUT_MATCH'
        } else {
          last.compile_status = 'SEMANTIC_DIFF'
          last.expected_preview = expected.substring(0, 100)
          last.actual_preview = (genResult.stdout || '').substring(0, 100)
        }
      }
    } catch (e: any) {
      results.push({ id, status: 'ERROR', detail: e.message?.substring(0, 120) })
    }
  }

  // Print results table
  console.log('\n## Phase 3 Fuzz Results: Functions & I/O\n')
  console.log('| # | ID | Pipeline | Compile/Run | Detail |')
  console.log('|---|------|----------|-------------|--------|')
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const pSym = r.status === 'PIPELINE_PASS' ? 'PASS' : r.status === 'DEGRADED' ? 'DEGRADED' : r.status === 'ROUNDTRIP_DRIFT' ? 'DRIFT' : 'FAIL'
    const cSym = r.compile_status === 'OUTPUT_MATCH' ? 'PASS' :
                 r.compile_status === 'COMPILE_FAIL' ? 'COMPILE_FAIL' :
                 r.compile_status === 'SEMANTIC_DIFF' ? 'SEMANTIC_DIFF' : 'N/A'
    const detail = r.detail?.substring(0, 80) || ''
    console.log(`| ${i + 1} | ${r.id} | ${pSym} | ${cSym} | ${detail} |`)
  }

  // Summary
  const pipePass = results.filter(r => r.status === 'PIPELINE_PASS').length
  const compPass = results.filter(r => r.compile_status === 'OUTPUT_MATCH').length
  const degraded = results.filter(r => r.status === 'DEGRADED').length
  const drift = results.filter(r => r.status === 'ROUNDTRIP_DRIFT').length
  const compFail = results.filter(r => r.compile_status === 'COMPILE_FAIL').length
  const semDiff = results.filter(r => r.compile_status === 'SEMANTIC_DIFF').length

  console.log(`\n## Summary`)
  console.log(`Pipeline PASS: ${pipePass}/${results.length}`)
  console.log(`Pipeline DEGRADED: ${degraded}/${results.length}`)
  console.log(`Pipeline DRIFT: ${drift}/${results.length}`)
  console.log(`Compile+Run PASS: ${compPass}/${results.length}`)
  console.log(`Compile FAIL: ${compFail}/${results.length}`)
  console.log(`Semantic DIFF: ${semDiff}/${results.length}`)

  writeFileSync('/tmp/semorphe-fuzz/phase3_results.json', JSON.stringify(results, null, 2))
  console.log('\nDetailed results saved to /tmp/semorphe-fuzz/phase3_results.json')
}

main().catch(console.error)
