/**
 * 「這個字串字面是不是一個元件身分引用」——靠**位置**，不靠字串
 *
 * ## 為什麼不能靠字串
 *
 * 實測：177 顆身分裡有 32 顆是**裸名**（`if`／`print`／`comment`／`input`），
 * 而它們同時是 DOM 標籤、tree-sitter 節點型別、除錯動作、產生出來的原始碼文字：
 *
 * ```
 * src/ui/app-shell.ts:640              document.createElement('input')
 * src/core/lift/lifter.ts:198          if (node.type === 'comment')      ← tree-sitter 節點型別
 * src/languages/cpp/.../expressions.ts:305   rightNode.text === 'endl'   ← 原始碼文字
 * src/interpreter/executors/control-flow.ts:4  readonly _brand = 'break'
 * ```
 *
 * `knowledge/experience.md:150` 記過同一個坑：中立性護欄拿 `'comment'` 做純文字比對，
 * **六筆裡三筆是誤報**。
 *
 * ## 還有一個更兇的：66 顆身分與**積木型別同名**
 *
 * `cpp_class_def` 既是元件身分也是積木型別。改錯邊的症狀是「積木消失」，
 * 而積木消失有十幾種成因——那正是「紅得無法歸因」的具體長相。
 *
 * ## 這個模組不判定什麼
 *
 * - **不追函式呼叫**：id 經由變數傳好幾層再用，這裡看不到
 * - **已知低報**：
 *   - 變數指派 `concept = 'arithmetic'`（已涵蓋，見 `CONCEPT_VARS`）
 *   - 未列入 `CONCEPT_CALLS` 的註冊函式
 *
 * ⚠️ **低報的後果是棘輪提早喊零。** 所以收硬性零之前必須把
 * `residualRefs()` 的清單逐筆看過——那份清單就是為此存在的。
 */
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'
import { listSourceFiles, REPO_ROOT } from './guardrail'

export type Role = 'conceptId' | 'blockType' | '非身分'

export interface IdRef {
  file: string
  line: number
  id: string
  role: Role
  /** 該行的原文，給人看殘留清單時用 */
  text: string
}

/** 第一引數是 **conceptId** 的呼叫 */
const CONCEPT_CALLS = new Set([
  'createNode',
  'getByConceptId',
  'getFormsByConceptId',
  'getWithOverride',
  'getBlockTypeForConcept',
  'registerConceptMapping',
  'register',
  'registerExecutor',
  'set',
])

/** 第一引數是 **blockType** 的呼叫——**這些位置不得改寫** */
const BLOCKTYPE_CALLS = new Set([
  'registerExtractStrategy',
  'newBlock',
  'getByBlockType',
  'isBlockVisible',
])

/** 值是 conceptId 的屬性名 */
const CONCEPT_PROPS = /^(conceptId|abstractConcept)$/
/** 值是 blockType 的屬性名 */
const BLOCKTYPE_PROPS = /^(type|blockType)$/

/** 變數名長這樣時，指派給它的字面是 conceptId */
const CONCEPT_VARS = /^(concept|conceptId|cid)$/

function classify(n: ts.StringLiteral, sf: ts.SourceFile): Role {
  const p = n.parent
  if (!p) return '非身分'

  // f('id', …)
  if (ts.isCallExpression(p) && p.arguments[0] === n) {
    const c = p.expression
    const name = ts.isPropertyAccessExpression(c) ? c.name.text : ts.isIdentifier(c) ? c.text : ''
    if (BLOCKTYPE_CALLS.has(name)) return 'blockType'
    if (CONCEPT_CALLS.has(name)) return 'conceptId'
    return '非身分'
  }

  // { conceptId: 'id' } / { type: 'id' }
  if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) {
    const k = p.name.text
    if (CONCEPT_PROPS.test(k)) return 'conceptId'
    if (BLOCKTYPE_PROPS.test(k)) return 'blockType'
    return '非身分'
  }

  // x.conceptId === 'id' ／ x.type === 'id'
  if (ts.isBinaryExpression(p)) {
    const other = (p.left === n ? p.right : p.left).getText(sf)
    if (/\bconceptId\b/.test(other)) return 'conceptId'
    if (/\.type\b|\bblockType\b/.test(other)) return 'blockType'
    return '非身分'
  }

  // concept = 'id'（變數指派）
  if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && CONCEPT_VARS.test(p.name.text)) {
    return 'conceptId'
  }

  return '非身分'
}

/** 掃 TypeScript：每一處命中 `ids` 的字串字面，附角色 */
export function scanTsRefs(ids: Set<string>, extra: { file: string; source: string }[] = []): IdRef[] {
  const out: IdRef[] = []
  const files: { file: string; source: string }[] = [
    ...['src', 'tests'].flatMap((d) =>
      listSourceFiles(d, ['.ts']).map((rel) => ({
        file: rel,
        source: fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'),
      })),
    ),
    ...extra,
  ]
  for (const { file, source } of files) {
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
    const lines = source.split('\n')
    const visit = (n: ts.Node): void => {
      if (ts.isStringLiteral(n) && ids.has(n.text)) {
        const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
        out.push({ file, line, id: n.text, role: classify(n, sf), text: (lines[line - 1] ?? '').trim() })
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  return out
}

/**
 * 掃 JSON：**靠欄位位置**，零曖昧。
 *
 * `conceptId` / `abstractConcept` / 課程清單的身分陣列 → 改寫
 * `blockDef.type` → **不得改寫**（66 處與身分同名）
 */
export function scanJsonRefs(ids: Set<string>, extraFiles: { file: string; data: unknown }[] = []): IdRef[] {
  const out: IdRef[] = []
  const files: { file: string; data: unknown }[] = [
    ...['src', 'tests'].flatMap((d) =>
      listSourceFiles(d, ['.json'])
        // ⚠️ **排除 `tests/baselines/`——那是本護欄自己的產出。**
        //
        // 第一次跑就踩到了：棘輪把違規清單寫進基線 JSON，下一次掃描
        // 又把基線裡的身分數進來，數字從 1516 跳到 1690。
        // **量測工具量到了自己**，而那個迴圈的終點是「永遠收不到零」。
        .filter((rel) => !rel.includes('/i18n/') && !rel.includes('tests/baselines/'))
        .flatMap((rel) => {
          try {
            return [{ file: rel, data: JSON.parse(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')) }]
          } catch {
            return []
          }
        }),
    ),
    ...extraFiles,
  ]
  for (const { file, data } of files) {
    const walk = (v: unknown, key: string | undefined, p: string): void => {
      if (typeof v === 'string') {
        if (!ids.has(v)) return
        const role: Role = key && BLOCKTYPE_PROPS.test(key) ? 'blockType' : 'conceptId'
        out.push({ file, line: 0, id: v, role, text: `${p} = ${v}` })
        return
      }
      if (Array.isArray(v)) {
        v.forEach((x, i) => walk(x, key, `${p}[${i}]`))
        return
      }
      if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) walk(x, k, `${p}.${k}`)
      }
    }
    walk(data, undefined, '$')
  }
  return out
}

/**
 * 角色分類不到、但字串命中身分的每一處——**給人逐筆看的清單**。
 *
 * 這份清單是硬性零之前唯一擋得住「分類器漏抓 → 棘輪提早喊零」的東西。
 * 過濾掉明顯無關的（DOM、tree-sitter）之後剩下的，每一筆都要有判定。
 */
export function residualRefs(ids: Set<string>): IdRef[] {
  return scanTsRefs(ids).filter((r) => r.role === '非身分' && /concept|Node|tree|lift|身分/i.test(r.text))
}
