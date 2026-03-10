/**
 * Style Exception Detection & Conversion
 *
 * After code→blocks lifting, scans the semantic tree for concepts that
 * don't match the current coding style. If alternatives exist (can be lifted),
 * offers the user the option to convert.
 */
import type { SemanticNode } from '../../core/types'
import type { CodingStyle } from '../style'
import { createNode } from '../../core/semantic-tree'
import type { ModuleRegistry } from './std/module-registry'

/** A single style exception found in the semantic tree */
export interface StyleException {
  /** The offending node */
  node: SemanticNode
  /** Human-readable description of the exception */
  label: string
  /** What the conversion would produce (description) */
  suggestion: string
  /** Apply conversion — returns replacement node(s), or null to remove */
  convert: () => SemanticNode[] | null
}

/** Rule definition for matching style exceptions */
interface StyleExceptionRule {
  /** Check if a semantic node is a style exception */
  match: (node: SemanticNode, style: CodingStyle) => boolean
  /** Label for dialog display */
  label: (node: SemanticNode) => string
  /** Suggested replacement description */
  suggestion: (node: SemanticNode, style: CodingStyle) => string
  /** Convert the node — returns replacement nodes, or null to remove */
  convert: (node: SemanticNode, style: CodingStyle) => SemanticNode[] | null
}

// ─── Exception Rules ───

/** Header: bits/stdc++.h in non-competitive styles */
const bitsHeaderRule: StyleExceptionRule = {
  match: (node, style) =>
    node.concept === 'cpp_include' &&
    node.properties.header === 'bits/stdc++.h' &&
    style.headerStyle !== 'bits',
  label: () => '#include <bits/stdc++.h>',
  suggestion: (_node, style) =>
    style.ioPreference === 'iostream'
      ? '#include <iostream>'
      : '#include <cstdio>',
  convert: (_node, style) => {
    // Replace with style-preferred headers
    const headers = style.ioPreference === 'iostream'
      ? ['iostream']
      : ['cstdio']
    return headers.map(h => createNode('cpp_include', { header: h, local: false }))
  },
}

/** Header: cstdio in iostream-preferred styles */
const cstdioHeaderRule: StyleExceptionRule = {
  match: (node, style) =>
    node.concept === 'cpp_include' &&
    node.properties.header === 'cstdio' &&
    style.ioPreference === 'iostream',
  label: () => '#include <cstdio>',
  suggestion: () => '#include <iostream>',
  convert: () => {
    return [createNode('cpp_include', { header: 'iostream', local: false })]
  },
}

/** Header: iostream in cstdio-preferred styles */
const iostreamHeaderRule: StyleExceptionRule = {
  match: (node, style) =>
    node.concept === 'cpp_include' &&
    node.properties.header === 'iostream' &&
    style.ioPreference === 'cstdio',
  label: () => '#include <iostream>',
  suggestion: () => '#include <cstdio>',
  convert: () => {
    return [createNode('cpp_include', { header: 'cstdio', local: false })]
  },
}

/** cpp_printf block (from toolbox, not from code) in iostream styles */
const cppPrintfRule: StyleExceptionRule = {
  match: (node, style) =>
    node.concept === 'cpp_printf' && style.ioPreference === 'iostream',
  label: () => 'printf(...)',
  suggestion: () => 'cout << ...',
  convert: (node) => {
    // Convert cpp_printf to universal print
    const args = node.children.args ?? []
    const values = args.length > 0 ? args : []
    return [createNode('print', {}, { values })]
  },
}

/** cpp_scanf block (from toolbox, not from code) in iostream styles */
const cppScanfRule: StyleExceptionRule = {
  match: (node, style) =>
    node.concept === 'cpp_scanf' && style.ioPreference === 'iostream',
  label: () => 'scanf(...)',
  suggestion: () => 'cin >> ...',
  convert: (node) => {
    const args = node.children.args ?? []
    const values = args.length > 0 ? args : []
    return [createNode('input', {}, { values })]
  },
}

/** print block (cout-origin) in cstdio-preferred styles */
const printToCstdioRule: StyleExceptionRule = {
  match: (node, style) =>
    node.concept === 'print' && style.ioPreference === 'cstdio',
  label: () => 'cout << ...',
  suggestion: () => 'printf(...)',
  convert: (node) => {
    const values = node.children.values ?? []
    const hasEndl = values.some(v => v.concept === 'endl')
    // Build format string: embed string_literal values directly, use %d for expressions
    const formatParts: string[] = []
    const args: typeof values = []
    for (const v of values) {
      if (v.concept === 'endl') continue
      if (v.concept === 'string_literal') {
        // Embed string value directly into format string
        const text = (v.properties.value as string) ?? ''
        formatParts.push(text)
      } else {
        formatParts.push('%d')
        args.push(v)
      }
    }
    const format = formatParts.join('') + (hasEndl ? '\\n' : '')
    return [createNode('cpp_printf', { format }, { args })]
  },
}

/** input block (cin-origin) in cstdio-preferred styles */
const inputToCstdioRule: StyleExceptionRule = {
  match: (node, style) =>
    node.concept === 'input' && style.ioPreference === 'cstdio',
  label: () => 'cin >> ...',
  suggestion: () => 'scanf(...)',
  convert: (node) => {
    const values = node.children.values ?? []
    const format = values.map(() => '%d').join(' ')
    return [createNode('cpp_scanf', { format }, { args: values })]
  },
}

/** All rules */
const RULES: StyleExceptionRule[] = [
  bitsHeaderRule,
  cstdioHeaderRule,
  iostreamHeaderRule,
  cppPrintfRule,
  cppScanfRule,
  printToCstdioRule,
  inputToCstdioRule,
]

// ─── I/O Style Conformance Analysis (code-level) ───

export type IoConformanceVerdict = 'conforming' | 'minor_exception' | 'bulk_deviation'
export type IoPreferenceKey = 'iostream' | 'cstdio'

export interface IoConformanceResult {
  iostreamCount: number
  cstdioCount: number
  /** Which preset I/O style we're comparing against */
  presetStyle: IoPreferenceKey
  /** conforming = all match preset; minor_exception = mostly matches, few outliers (借音);
   *  bulk_deviation = majority doesn't match preset (轉調) */
  verdict: IoConformanceVerdict
}

const IOSTREAM_RE = /\b(cout|cin|cerr|clog|endl|getline)\b/g
const CSTDIO_RE = /\b(printf|scanf|puts|gets|fprintf|fscanf|sprintf|sscanf)\b/g

/**
 * Analyze raw C++ code for I/O style conformance against the active preset.
 * Like music — a single off-key note is a deliberate colour (借音),
 * but consistently playing in another key means modulation (轉調).
 */
export function analyzeIoConformance(code: string, presetStyle: IoPreferenceKey): IoConformanceResult {
  const iostreamCount = (code.match(IOSTREAM_RE) ?? []).length
  const cstdioCount = (code.match(CSTDIO_RE) ?? []).length
  const total = iostreamCount + cstdioCount

  let verdict: IoConformanceVerdict = 'conforming'
  if (total > 0) {
    const nonConforming = presetStyle === 'iostream' ? cstdioCount : iostreamCount
    if (nonConforming === 0) {
      verdict = 'conforming'
    } else if (nonConforming >= total / 2) {
      // Non-conforming is majority or equal — bulk deviation (轉調)
      verdict = 'bulk_deviation'
    } else {
      // Non-conforming is minority — minor exception (借音)
      verdict = 'minor_exception'
    }
  }

  return { iostreamCount, cstdioCount, presetStyle, verdict }
}

// ─── Module-based I/O preference mapping ───

/** Map ioPreference to the preferred std module header */
const IO_PREF_TO_HEADER: Record<string, string> = {
  iostream: '<iostream>',
  cstdio: '<cstdio>',
}

/** The two I/O module headers that are "parallel" alternatives */
const IO_MODULE_HEADERS = new Set(['<iostream>', '<cstdio>'])

// ─── Public API ───

/**
 * Scan a semantic tree for style exceptions.
 * When a ModuleRegistry is provided, uses module-based borrowing detection:
 * if a concept belongs to a non-preferred I/O module, it's flagged as a borrowing.
 */
export function detectStyleExceptions(
  root: SemanticNode,
  style: CodingStyle,
  registry?: ModuleRegistry,
): StyleException[] {
  const exceptions: StyleException[] = []
  walkTree(root, style, exceptions, registry)
  return exceptions
}

/**
 * Apply all conversions to a semantic tree (in-place replacement).
 * Returns the modified root node.
 */
export function applyStyleConversions(
  root: SemanticNode,
  exceptions: StyleException[],
): SemanticNode {
  // Build a map of node → replacement
  const replacements = new Map<SemanticNode, SemanticNode[] | null>()
  for (const ex of exceptions) {
    replacements.set(ex.node, ex.convert())
  }

  return replaceInTree(root, replacements)
}

// ─── Internals ───

function walkTree(
  node: SemanticNode,
  style: CodingStyle,
  exceptions: StyleException[],
  registry?: ModuleRegistry,
): void {
  let matched = false

  // First try hardcoded rules (header rules, known conversions)
  for (const rule of RULES) {
    if (rule.match(node, style)) {
      exceptions.push({
        node,
        label: rule.label(node),
        suggestion: rule.suggestion(node, style),
        convert: () => rule.convert(node, style),
      })
      matched = true
      break // One exception per node
    }
  }

  // If no hardcoded rule matched and we have a registry, try module-based detection
  if (!matched && registry) {
    const header = registry.getHeaderForConcept(node.concept)
    if (header && IO_MODULE_HEADERS.has(header)) {
      const preferredHeader = IO_PREF_TO_HEADER[style.ioPreference]
      if (preferredHeader && header !== preferredHeader) {
        // Concept belongs to non-preferred I/O module — borrowing detected
        // Find matching hardcoded rule for conversion (should already exist above,
        // but this catches any new concepts added to modules without explicit rules)
        exceptions.push({
          node,
          label: `${node.concept} (${header})`,
          suggestion: `use ${preferredHeader} equivalent`,
          convert: () => [node], // No auto-conversion for unknown concepts
        })
      }
    }
  }

  // Recurse into children
  for (const children of Object.values(node.children)) {
    for (const child of children) {
      walkTree(child, style, exceptions, registry)
    }
  }
}

function replaceInTree(
  node: SemanticNode,
  replacements: Map<SemanticNode, SemanticNode[] | null>,
): SemanticNode {
  // Process children first (bottom-up)
  const newChildren: Record<string, SemanticNode[]> = {}
  for (const [key, children] of Object.entries(node.children)) {
    const newList: SemanticNode[] = []
    for (const child of children) {
      const replacement = replacements.get(child)
      if (replacement !== undefined) {
        // Replace or remove
        if (replacement !== null) {
          newList.push(...replacement)
        }
        // null = remove
      } else {
        // Recurse
        newList.push(replaceInTree(child, replacements))
      }
    }
    newChildren[key] = newList
  }

  return { ...node, children: newChildren }
}
