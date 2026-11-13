/**
 * **Python → C++**（跨語言互轉第二對的反方向，spec 225）：把 Python 的語意樹寫成 C++ 原始碼。
 *
 * - 每顆元件的寫法住在它的膠囊（`src/components/python/<名>/to-cpp.ts`）；這裡負責走樹、查表、記保留原因、宣告與骨架。
 * - **整支換或不換**：有任何一處保留 ⟹ `code` 是 null，原因列出來（C++ 程式裡不能留一行 Python）。
 * - **型別來自 Cella 在一份輸入上觀察到的型別表**（research R1）：C++ 每個變數都要宣告型別，而 Python 沒寫——我們不推，問 Cella。
 *   只用「觀察到、而且單一」的型別；聯集、空容器看不出元素、這份輸入下沒跑到 ⟹ 整支保留（不猜一個型別）。
 * - **宣告提到函式最前面**（research R2）：Python 的作用域是函式、C++ 是區塊——`if` 裡第一次指定、外面用到的，照原位宣告會看不到。
 * - 換得對不對由 Cella 判：換完的 C++ 與原本的 Python 交給 Cella，判決、輸出、assumes 相同（research R3）。
 */
import type { SemanticNode } from '../../core/types'
import type { KeepKind, LanguageConversion } from '../../core/language-conversion'
import type { HelperName, ObservedTypes, ToCppContext } from './to-cpp/contract'
import { collectToCpp, type ToCppTables } from './to-cpp/registry'

let TABLES: ToCppTables | null = null
const tables = (): ToCppTables => (TABLES ??= collectToCpp())

/** C++ 的保留字與這支程式會用到的標準名字——Python 的名字撞到就加底線 */
const CPP_RESERVED = new Set(['auto', 'bool', 'break', 'case', 'char', 'class', 'const', 'continue', 'default', 'delete', 'do', 'double', 'else', 'enum', 'explicit', 'extern', 'false', 'float', 'for', 'friend', 'goto', 'if', 'inline', 'int', 'long', 'namespace', 'new', 'operator', 'private', 'protected', 'public', 'register', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'template', 'this', 'throw', 'true', 'try', 'typedef', 'union', 'unsigned', 'using', 'virtual', 'void', 'volatile', 'while', 'main', 'string', 'vector', 'cin', 'cout', 'endl', 'getline', 'stoll', 'stod', 'to_string', 'max', 'min', 'accumulate', 'read_line', 'floor_div', 'floor_mod', 'float_text', 'map', 'map_at', 'out_of_range', 'py_int', 'invalid_argument', 'runtime_error', 'std'])

const HELPERS: Record<HelperName, string[]> = {
  // input() 讀一整行（cin >> 讀一個詞——行的語意不同，research R6）
  // 讀到檔尾：Python 的 input() 丟 EOFError——C++ 也丟（回空字串的話，讀一個數字的迴圈會變成無窮迴圈）
  read_line: ['string read_line() {', '    string s;', '    if (!getline(cin, s)) {', '        throw runtime_error("EOFError");', '    }', '    return s;', '}'],
  // Python 的 // 向下取整（C++ 的 / 向零截斷，負數時不同）
  floor_div: ['long long floor_div(long long a, long long b) {', '    long long q = a / b;', '    if (a % b != 0 && (a < 0) != (b < 0)) {', '        q--;', '    }', '    return q;', '}'],
  // Python 的 % 的正負號跟除數（C++ 跟被除數）
  floor_mod: ['long long floor_mod(long long a, long long b) {', '    long long r = a % b;', '    if (r != 0 && (r < 0) != (b < 0)) {', '        r += b;', '    }', '    return r;', '}'],
  // Python 的 ** 兩邊是整數、指數不是負的（pow 走浮點，大數不精確）
  int_pow: ['long long int_pow(long long a, long long b) {', '    long long r = 1;', '    for (long long i = 0; i < b; i++) {', '        r *= a;', '    }', '    return r;', '}'],
  // s.split()：以空白分開、連續空白算一個；索引用 int（size_t 要靠標頭遞移帶進來，Cella 不接受那個假設）
  split_words: ['vector<string> split_words(string s) {', '    vector<string> words;', '    string word;', '    for (char c : s) {', '        if (isspace(c)) {', '            if (word != "") {', '                words.push_back(word);', '                word = "";', '            }', '        } else {', '            word += c;', '        }', '    }', '    if (word != "") {', '        words.push_back(word);', '    }', '    return words;', '}'],
  // 分隔與替換的文字收 const char*：引數若是兩個 string 建構，C++ 的求值順序沒有規定，Cella 判 unknown
  split_on: ['vector<string> split_on(const string& s, const char* sep_text) {', '    string sep = sep_text;', '    vector<string> parts;', '    string part;', '    int i = 0;', '    while (i < s.size()) {', '        if (s.substr(i, sep.size()) == sep) {', '            parts.push_back(part);', '            part = "";', '            i += sep.size();', '        } else {', '            part += s[i];', '            i++;', '        }', '    }', '    parts.push_back(part);', '    return parts;', '}'],
  to_upper: ['string to_upper(string s) {', '    for (int i = 0; i < s.size(); i++) {', '        s[i] = toupper(s[i]);', '    }', '    return s;', '}'],
  to_lower: ['string to_lower(string s) {', '    for (int i = 0; i < s.size(); i++) {', '        s[i] = tolower(s[i]);', '    }', '    return s;', '}'],
  replace_all: ['string replace_all(const string& s, const char* from_text, const char* to_text) {', '    string from = from_text;', '    string to = to_text;', '    string out;', '    int i = 0;', '    while (i < s.size()) {', '        if (s.substr(i, from.size()) == from) {', '            out += to;', '            i += from.size();', '        } else {', '            out += s[i];', '            i++;', '        }', '    }', '    return out;', '}'],
  // print(list)：Python 印出容器的樣子（[1, 2]、['a', 'b']）
  list_text_int: ['string list_text(const vector<long long>& v) {', '    string out = "[";', '    for (int i = 0; i < v.size(); i++) {', '        if (i > 0) {', '            out += ", ";', '        }', '        out += to_string(v[i]);', '    }', '    return out + "]";', '}'],
  list_text_str: ['string list_text(const vector<string>& v) {', '    string out = "[";', '    for (int i = 0; i < v.size(); i++) {', '        if (i > 0) {', '            out += ", ";', '        }', `        out += "'" + v[i] + "'";`, '    }', '    return out + "]";', '}'],
  // print(浮點)／str(浮點)：Python 印 repr——能來回的最短位數、整數值補 .0、指數在 [-4, 16) 之外改科學記號。
  // 位數用 snprintf 逐一試、atof 讀回比對（strtod／stod Cella 還不支援；atof 判 accept、沒有假設）
  float_text: ['string float_text(double x) {', '    if (x != x) {', '        return "nan";', '    }', '    if (x > 1.7976931348623157e308) {', '        return "inf";', '    }', '    if (x < -1.7976931348623157e308) {', '        return "-inf";', '    }', '    char buf[64];', '    int p = 1;', '    while (p < 17) {', '        snprintf(buf, sizeof(buf), "%.*e", p - 1, x);', '        if (atof(buf) == x) {', '            break;', '        }', '        p++;', '    }', '    snprintf(buf, sizeof(buf), "%.*e", p - 1, x);', '    string s = buf;', '    int e = atoi(buf + s.find(\'e\') + 1);', '    if (e < -4 || e >= 16) {', '        return s;', '    }', '    int d = p - 1 - e;', '    if (d < 0) {', '        d = 0;', '    }', '    snprintf(buf, sizeof(buf), "%.*f", d, x);', '    s = buf;', '    if (s.find(\'.\') == string::npos) {', '        s += ".0";', '    }', '    return s;', '}'],
  // int(字串)（在抓 ValueError 的 try 裡）：照 Python 的規則——去掉前後空白、可帶正負號、數字之間可以有一個底線，其餘丟 invalid_argument。
  // stoi 吃得下 "12abc"（讀到 12）與 "1_0" 之外的東西，Python 會丟 ValueError
  py_int: ['long long py_int(const string& s) {', '    int a = 0;', '    int b = s.size();', '    while (a < b && isspace(s[a])) {', '        a++;', '    }', '    while (b > a && isspace(s[b - 1])) {', '        b--;', '    }', '    bool neg = false;', "    if (a < b && (s[a] == '+' || s[a] == '-')) {", "        neg = s[a] == '-';", '        a++;', '    }', '    if (a == b) {', '        throw invalid_argument("ValueError");', '    }', '    long long v = 0;', '    for (int i = a; i < b; i++) {', "        if (s[i] == '_' && i > a && i + 1 < b && isdigit(s[i - 1]) && isdigit(s[i + 1])) {", '            continue;', '        }', '        if (!isdigit(s[i])) {', '            throw invalid_argument("ValueError");', '        }', "        v = v * 10 + (s[i] - '0');", '    }', '    return neg ? -v : v;', '}'],
}

/** 小函式需要的標頭 */
const HELPER_INCLUDES: Partial<Record<HelperName, string[]>> = {
  split_words: ['vector', 'cctype'], split_on: ['vector'], to_upper: ['cctype'], to_lower: ['cctype'], list_text_int: ['vector'], list_text_str: ['vector'], float_text: ['cstdio', 'cstdlib'], read_line: ['stdexcept'], py_int: ['stdexcept', 'cctype'],
}

/** `max(xs, key=lambda p: …)` 的那個 lambda（只收一個參數、而且 key= 是唯一的具名引數）；沒有 → undefined */
export function keyLambda(n: SemanticNode): SemanticNode | undefined {
  const named = (n.slots?.values ?? []).filter((v) => v.componentId.endsWith(':func_call_named'))
  if (named.length !== 1 || named[0].properties?.name !== 'key' || (n.slots?.values ?? []).length !== 2) return undefined
  const lam = named[0].slots?.value?.[0]
  return lam?.componentId.endsWith(':lambda') && (lam.slots?.params ?? []).length === 1 && (lam.slots?.body ?? []).length === 1 ? lam : undefined
}

const lineOf = (n: SemanticNode): number | undefined =>
  (n.metadata as { sourceRange?: { startLine?: number } } | undefined)?.sourceRange?.startLine

const kids = (n: SemanticNode): SemanticNode[] => Object.values(n.slots ?? {}).flat()
const contains = (root: SemanticNode, x: SemanticNode): boolean => root === x || kids(root).some((k) => contains(k, x))

/** 一個 Python 型別字串拆成聯集的成員（只拆最外層的 `|`） */
function splitUnion(t: string): string[] {
  const out: string[] = []
  let depth = 0, cur = ''
  for (const ch of t) {
    if (ch === '[') depth++
    if (ch === ']') depth--
    if (ch === '|' && depth === 0) { out.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** `str, int` 拆成最外層的逗號兩邊 */
function splitTop(t: string): string[] {
  const out: string[] = []
  let depth = 0, cur = ''
  for (const ch of t) {
    if (ch === '[') depth++
    if (ch === ']') depth--
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

/**
 * 幾個觀察到的型別併成一個：`list[?]` 在有 `list[int]` 時讓位（容器的型別是那一刻的值——空的那一刻看不出元素）。
 * 併不成單一型別 → undefined（聯集、或只有 `list[?]`）。
 */
export function unifyTypes(types: readonly string[]): string | undefined {
  const all = [...new Set(types.flatMap(splitUnion))]
  const concrete = all.filter((t) => !t.includes('?'))
  const kept = all.filter((t) => !t.includes('?') || !concrete.some((c) => c.split('[')[0] === t.split('[')[0]))
  return kept.length === 1 && !kept[0].includes('?') ? kept[0] : undefined
}

/**
 * 第一行的說明（FR-009，使用者 2026-11-09 定）：型別是照這組輸入觀察到的——跟著程式走，學生換一組輸入時看得到這個限制。
 * 輸入照詞列出、超過 20 字截短；程式不讀輸入時說「照這次執行看到的」。
 */
export function typesNote(input: string | undefined, readsInput: boolean): string {
  if (!readsInput) return '// 變數的型別是照這次執行看到的；換一組輸入，型別可能不同'
  const words = (input ?? '').split(/\s+/).filter(Boolean).join('、')
  const shown = words.length > 20 ? `${words.slice(0, 20)}…` : words
  return `// 變數的型別是照這組輸入跑一次看到的（輸入：${shown}）；換一組輸入，型別可能不同`
}

export function convertPythonToCpp(tree: SemanticNode, observed: ObservedTypes | null, opts: { input?: string } = {}): LanguageConversion {
  const reasons: LanguageConversion['reasons'] = []
  const t = tables()
  const helpers = new Set<HelperName>()
  const mapAts = new Map<string, string[]>()
  const hoisted: string[][] = []
  let hoistCount = 0
  const hoistNames = new Map<string, string>()
  const includes = new Set<string>(['iostream', 'string'])
  let converted = 0
  let valueErrorTry = 0

  const body = tree.slots?.body ?? []
  const isFunc = (n: SemanticNode): boolean => n.slots?.params !== undefined && typeof n.properties?.name === 'string'
  const funcs = body.filter(isFunc)
  const top = body.filter((n) => !isFunc(n))
  const userFunctions = new Set(funcs.map((f) => String(f.properties.name)))

  const keep = (n: SemanticNode, kind: KeepKind, detail: string): string => {
    const line = lineOf(n)
    reasons.push({ nodeId: n.id, ...(line !== undefined ? { line: line + 1 } : {}), kind, detail })
    return '…'
  }

  // 型別表：沒有表就是「需要型別」；有一個節點這份輸入下沒跑到 ⟹ 那一段的型別看不到（research R1）——整支保留
  // 讀輸入的程式而沒有輸入：型別要在一份輸入上觀察，空輸入會把 input() 之後全標成沒跑到——假的資訊（FR-008；cella 談定時的理由）
  const readsInput = (() => { let r = false; const w = (n: SemanticNode): void => { if (n.componentId.endsWith(':input')) r = true; Object.values(n.slots ?? {}).flat().forEach(w) }; w(tree); return r })()
  if (readsInput && !(opts.input ?? '').trim()) {
    keep(tree, 'needs-input', '這支程式會讀輸入——要先有一份輸入（題目的輸入或上一次執行的輸入），才看得到每個變數的型別')
    return { code: null, converted: 0, kept: reasons.length, reasons }
  }
  if (!observed) keep(tree, 'needs-types', '要換成 C++ 得先知道每個變數的型別——需要 Cella 在一份輸入上跑過一次')
  const unreached = observed ? Object.entries(observed.basis).filter(([, b]) => b === 'unreached').map(([id]) => id) : []
  const byId = new Map<string, SemanticNode>()
  const parent = new Map<string, SemanticNode>()
  const index = (n: SemanticNode): void => { byId.set(n.id, n); kids(n).forEach((c) => { parent.set(c.id, n); index(c) }) }
  index(tree)
  // 印一段字串字面量：寫法由字面量自己決定，不必看型別——沒跑到也換得過去（其餘照舊保留：型別不自己推）
  const printsLiteral = (n: SemanticNode): boolean => n.componentId.endsWith(':literal_string') && parent.get(n.id)?.componentId.endsWith(':print') === true
  const firstUnreached = unreached.map((id) => byId.get(id)).find((n) => n !== undefined && !printsLiteral(n))
  if (firstUnreached) keep(firstUnreached, 'type-uncertain', '這一段在這份輸入下沒有跑到——看不到它的型別（換一份會走到這裡的輸入再試）')

  const rawType = (n: SemanticNode | undefined): string | undefined => {
    if (!n || !observed || observed.basis[n.id] !== 'observed') return undefined
    const v = observed.nodes[n.id]
    return v === undefined || v === '' ? undefined : v
  }
  const cppType = (py: string | undefined): string | undefined => {
    if (!py) return undefined
    if (py === 'int') return 'long long'
    if (py === 'float') return 'double'
    if (py === 'str') return 'string'
    if (py === 'bool') return 'bool'
    const m = /^list\[(.+)\]$/.exec(py)
    if (m) { const e = cppType(m[1]); if (e) { includes.add('vector'); return `vector<${e}>` } }
    // dict[K, V] → map<K, V>：走訪照鍵排序（Python 照插入順序——只有排序過的走訪換得過去，見 loop_for）
    const d = /^dict\[(.+)\]$/.exec(py)
    if (d) {
      const kv = splitTop(d[1])
      const k = kv.length === 2 ? cppType(kv[0]) : undefined, v = kv.length === 2 ? cppType(kv[1]) : undefined
      if (k && v) { includes.add('map'); return `map<${k}, ${v}>` }
    }
    return undefined
  }

  const cpp: ToCppContext = {
    expr(n) {
      if (!n) return '…'
      const fn = t.expr.get(n.componentId)
      return fn ? fn(n, cpp) : keep(n, 'outside-subset', `「${n.componentId}」還沒有 C++ 的寫法`)
    },
    block(nodes, depth) { return (nodes ?? []).flatMap((c) => stmt(c, depth)) },
    keep,
    pyType: (n) => { const r = rawType(n); return r ? unifyTypes([r]) : undefined },
    pyKind: (n) => { const r = rawType(n); const ks = [...new Set(r ? splitUnion(r).map((x) => x.split('[')[0]) : [])]; return ks.length === 1 ? ks[0] : undefined },
    cppType,
    useHelper(name) { helpers.add(name); (HELPER_INCLUDES[name] ?? []).forEach((h) => includes.add(h)); return name.startsWith('list_text') ? 'list_text' : name },
    useMapAt(mt, kt, vt) {
      includes.add('map'); includes.add('stdexcept')
      mapAts.set(mt, [`${vt} map_at(const ${mt}& m, const ${kt}& k) {`, '    if (m.count(k) == 0) {', '        throw out_of_range("KeyError");', '    }', '    return m.find(k)->second;', '}'])
      return 'map_at'
    },
    useInclude(h) { includes.add(h); return h },
    isUserFunction: (name) => userFunctions.has(name),
    plainLoopVar(loop, name) {
      // 本體裡被指定 → 不行
      let assignedInBody = false
      const inBody = (n: SemanticNode): void => { if ((n.properties?.obj === name && n.slots?.value) || (n.componentId.endsWith(':var_assign_compound') && n.slots?.target?.[0]?.properties?.name === name)) assignedInBody = true; kids(n).forEach(inBody) }
      ;(loop.slots?.body ?? []).forEach(inBody)
      if (assignedInBody) return false
      // 迴圈以外（同一個作用域）讀到它 → 不行。作用域：包住這個迴圈的函式本體，或最外層
      const scope = funcs.find((f) => contains(f, loop))?.slots?.body ?? top
      let readOutside = false
      const walk = (n: SemanticNode): void => { if (n === loop || isFunc(n)) return; if (n.componentId.endsWith(':var_ref') && n.properties?.name === name) readOutside = true; kids(n).forEach(walk) }
      scope.forEach(walk)
      return !readOutside
    },
    canHoist(n) {
      const effect = /:(func_call|func_call_named|input|method_call|var_assign_expr|container_(append|pop|insert|erase|erase_value|sort_self)|set_append)$/
      let cur = n
      for (;;) {
        const p = parent.get(cur.id)
        if (!p) return false
        const slot = Object.entries(p.slots ?? {}).find(([, cs]) => cs.includes(cur))?.[0]
        if (/:(logic|ternary|compare_chain|array_make_for|lambda)$/.test(p.componentId)) return false
        const stmtOk = /:(print|var_assign|return)$/.test(p.componentId) || (p.componentId.endsWith(':container_append') && slot !== 'obj') || (p.componentId.endsWith(':loop_for') && slot === 'iterable')
        if (stmtOk) {
          // 同一句裡其他部分有副作用 ⟹ 先算生成式會改變先後
          let bad = false
          const walk = (x: SemanticNode): void => {
            if (x === n) return
            if (x !== p && effect.test(x.componentId)) bad = true
            ;(x === p && p.componentId.endsWith(':loop_for') ? p.slots.iterable ?? [] : kids(x)).forEach(walk)
          }
          walk(p)
          return !bad
        }
        if (/:(program|if|loop_while|loop_for|func_def)$/.test(p.componentId) || t.stmt.has(p.componentId)) return false
        cur = p
      }
    },
    hoist(n, base, lines) {
      const had = hoistNames.get(n.id)
      if (had) return had
      const name = `${base}__${++hoistCount}`
      hoistNames.set(n.id, name)
      hoisted[hoisted.length - 1]?.push(...lines(name))
      return name
    },
    constNonNegInt(name) {
      const binds: SemanticNode[] = []
      let other = false
      const walk = (n: SemanticNode): void => {
        const id = n.componentId
        if (n.properties?.obj === name && n.slots?.value && !n.slots?.iterable) binds.push(n)
        else if (n.properties?.obj === name) other = true // for 的迴圈變數
        if (id.endsWith(':var_assign_compound') && n.slots?.target?.[0]?.properties?.name === name) other = true
        if ((id.endsWith(':global') || isFunc(n)) && JSON.stringify(n).includes(`"${name}"`)) other = true
        kids(n).forEach(walk)
      }
      body.forEach(walk)
      if (other || binds.length !== 1 || !top.includes(binds[0])) return undefined
      const v = binds[0].slots.value?.[0]
      return v?.componentId.endsWith(':literal_number') && /^\d+$/.test(String(v.properties?.value)) ? String(v.properties.value) : undefined
    },
    dictKeys: (name) => orderedDicts.get(name),
    assignedValue: (n) => { const p = parent.get(n.id); return p !== undefined && p.componentId.endsWith(':var_assign') && (p.slots?.value ?? []).includes(n) },
    catchingValueError: () => valueErrorTry > 0,
    inValueErrorTry(fn) { valueErrorTry++; try { return fn() } finally { valueErrorTry-- } },
    name: (s) => (CPP_RESERVED.has(s) ? `${s}_` : s),
    indent: (d) => '    '.repeat(d),
  }
  const stmt = (n: SemanticNode, depth: number): string[] => {
    hoisted.push([])
    const before = (lines: string[]): string[] => [...(hoisted.pop() ?? []).map((l) => `${cpp.indent(depth)}${l}`), ...lines]
    const s = t.stmt.get(n.componentId)
    if (s) { const lines = s(n, cpp, depth); converted += lines.length > 0 ? 1 : 0; return before(lines) }
    if (t.expr.has(n.componentId)) { converted++; const line = `${cpp.indent(depth)}${cpp.expr(n)};`; return before([line]) }
    hoisted.pop()
    keep(n, 'outside-subset', `「${n.componentId}」還沒有 C++ 的寫法`)
    return []
  }

  /**
   * 一個作用域（函式本體或最外層）裡被指定的名字 → 宣告的 C++ 型別。型別從指定的值與讀取的那幾格觀察到的併成一個（research R2）。
   * 巢狀函式定義裡的不算（另一個作用域）。`for v in xs` 的迴圈變數由迴圈自己宣告，不提前。
   */
  const declarations = (scope: readonly SemanticNode[], exclude: ReadonlySet<string>): string[] => {
    const assigned = new Map<string, SemanticNode>()
    const seen = new Map<string, string[]>()
    const note = (name: string, n: SemanticNode | undefined): void => {
      const r = rawType(n)
      if (r) seen.set(name, [...(seen.get(name) ?? []), r])
    }
    const walk = (n: SemanticNode, bound: ReadonlySet<string> = new Set()): void => {
      if (isFunc(n)) return
      const own = typeof n.properties?.obj === 'string' ? n.properties.obj : undefined
      if (n.slots?.value && own && !n.slots?.iterable && !n.slots?.target && !n.slots?.obj) { assigned.set(own, assigned.get(own) ?? n); note(own, n.slots.value[0]) }
      // 計數 for 的迴圈變數：range 的值是整數
      // 生成式的迴圈變數只活在生成式裡（Python 3），由生成式那幾行自己宣告
      if (own && n.slots?.iterable?.[0]?.componentId.endsWith(':range_make') && !n.componentId.endsWith(':array_make_for')) { assigned.set(own, assigned.get(own) ?? n); seen.set(own, [...(seen.get(own) ?? []), 'int']) }
      if (typeof n.properties?.name === 'string' && !bound.has(n.properties.name) && !n.slots?.args && Object.keys(n.slots ?? {}).every((k) => (n.slots[k] ?? []).length === 0)) note(n.properties.name, n)
      // 生成式裡讀到它自己的迴圈變數，不是外面那個同名的變數（走訪對象除外：它在外面求值）
      if (n.componentId.endsWith(':array_make_for') && own) {
        const inner = new Set([...bound, own])
        for (const [k, cs] of Object.entries(n.slots ?? {})) cs.forEach((c) => walk(c, k === 'iterable' ? bound : inner))
        return
      }
      kids(n).forEach((c) => walk(c, bound))
    }
    scope.forEach((n) => walk(n))
    const out: string[] = []
    for (const [name, at] of assigned) {
      if (exclude.has(name)) continue
      const ty = cppType(unifyTypes(seen.get(name) ?? []))
      if (!ty) { keep(at, 'type-uncertain', `變數 ${name} 的型別說不準（觀察到 ${[...new Set(seen.get(name) ?? [])].join('、') || '沒有'}）`); continue }
      out.push(`${ty} ${cpp.name(name)};`)
      const keys = orderedDicts.get(name)
      if (keys) {
        const kt = cppType(splitTop(/^dict\[(.+)\]$/.exec(unifyTypes(seen.get(name) ?? []) ?? '')?.[1] ?? '')[0])
        includes.add('vector')
        out.push(`vector<${kt}> ${cpp.name(keys)};`)
      }
    }
    return out
  }

  // 照放入的順序走訪的字典（441）：`for k in d` 在 Python 照放入的順序、C++ 的 map 照鍵排序——
  // 旁邊多帶一串鍵（`d__keys`），新的鍵寫進去時接在後面，走訪改走那一串。
  // 只收最外層的名字、而且它只被讀、寫、問大小、走訪、整個指定成字典字面量；其餘用法（pop、del、傳給函式…）照舊保留
  const orderedDicts = new Map<string, string>()
  {
    const iterated = new Set<string>()
    const findLoops = (n: SemanticNode): void => {
      const it = n.slots?.iterable?.[0]
      if (n.componentId.endsWith(':loop_for') && it?.componentId.endsWith(':var_ref') && cpp.pyKind(it) === 'dict') iterated.add(String(it.properties?.name ?? ''))
      // max(d, key=…)／min(d, key=…)（442）：也是照放入的順序走一遍（平手取先放進去的那個）
      const first = n.slots?.values?.[0]
      if (/:math_(max|min)$/.test(n.componentId) && first?.componentId.endsWith(':var_ref') && cpp.pyKind(first) === 'dict' && keyLambda(n)) iterated.add(String(first.properties?.name ?? ''))
      kids(n).forEach(findLoops)
    }
    top.forEach(findLoops)
    const allowed = (ref: SemanticNode): boolean => {
      const p = parent.get(ref.id)
      if (!p) return false
      const slot = Object.entries(p.slots ?? {}).find(([, cs]) => cs.includes(ref))?.[0]
      const id = p.componentId
      return (id.endsWith(':container_at') && slot === 'target') || (id.endsWith(':map_at_default') && slot === 'obj') ||
        (id.endsWith(':container_size') && slot === 'obj') || (id.endsWith(':loop_for') && slot === 'iterable') ||
        (/:math_(max|min)$/.test(id) && p.slots.values?.[0] === ref && keyLambda(p) !== undefined)
    }
    for (const name of iterated) {
      let ok = true
      const walk = (n: SemanticNode, inFunc: boolean): void => {
        if (n.componentId.endsWith(':var_ref') && n.properties?.name === name && (inFunc || !allowed(n))) ok = false
        if (n.properties?.obj === name && n.slots?.value) {
          const v = n.slots.value[0]
          if (inFunc || !n.componentId.endsWith(':var_assign') || !v?.componentId.endsWith(':map_make')) ok = false
        }
        if (n.componentId.endsWith(':global') && JSON.stringify(n).includes(`"${name}"`)) ok = false
        kids(n).forEach((c) => walk(c, inFunc || isFunc(n)))
      }
      body.forEach((n) => walk(n, isFunc(n)))
      if (ok) orderedDicts.set(name, `${name}__keys`)
    }
  }

  const funcLines: string[] = []
  for (const f of funcs) {
    const name = String(f.properties.name)
    const params = f.slots.params ?? []
    const fbody = f.slots.body ?? []
    const readsOf = (p: string): string[] => {
      const out: string[] = []
      const walk = (n: SemanticNode): void => { if (n.componentId.endsWith(':var_ref') && n.properties?.name === p) { const r = rawType(n); if (r) out.push(r) } kids(n).forEach(walk) }
      fbody.forEach(walk)
      return out
    }
    const ps = params.map((p) => {
      const pn = String(p.properties?.name ?? '')
      // 參數自己就有一筆（呼叫時綁定的值）；再加上本體裡的讀取
      const own = rawType(p)
      const ty = cppType(unifyTypes([...(own ? [own] : []), ...readsOf(pn)]))
      if (!ty) keep(p, 'type-uncertain', `函式 ${name} 的參數 ${pn} 的型別說不準（沒有被呼叫，或傳過不同型別）`)
      return `${ty ?? '…'} ${cpp.name(pn)}`
    })
    const rets: string[] = []
    const walkR = (n: SemanticNode): void => { if (n.componentId.endsWith(':return') && n.slots?.value?.[0]) { const r = rawType(n.slots.value[0]); if (r) rets.push(r) } if (!isFunc(n)) kids(n).forEach(walkR) }
    fbody.forEach(walkR)
    const hasValueReturn = (() => { let v = false; const w = (n: SemanticNode): void => { if (n.componentId.endsWith(':return') && n.slots?.value?.length) v = true; if (!isFunc(n)) kids(n).forEach(w) }; fbody.forEach(w); return v })()
    const rt = hasValueReturn ? cppType(unifyTypes(rets)) : 'void'
    if (!rt) keep(f, 'type-uncertain', `函式 ${name} 的回傳型別說不準`)
    const locals = declarations(fbody, new Set(params.map((p) => String(p.properties?.name ?? ''))))
    funcLines.push(`${rt ?? '…'} ${cpp.name(name)}(${ps.join(', ')}) {`, ...locals.map((d) => `    ${d}`), ...cpp.block(fbody, 1), '}', '')
    converted++
  }

  const mainDecls = declarations(top, new Set())
  const mainBody = cpp.block(top, 1)
  if (reasons.length > 0) return { code: null, converted: 0, kept: reasons.length, reasons }
  const head = [...[...includes].sort().map((h) => `#include <${h}>`), 'using namespace std;', '']
  const helperLines = [...(Object.keys(HELPERS) as HelperName[]).filter((h) => helpers.has(h)).flatMap((h) => [...HELPERS[h], '']), ...[...mapAts.values()].flatMap((l) => [...l, ''])]
  const lines = [typesNote(opts.input, readsInput), ...head, ...helperLines, ...funcLines, 'int main() {', ...mainDecls.map((d) => `    ${d}`), ...mainBody, '    return 0;', '}']
  return { code: `${lines.join('\n')}\n`, converted, kept: 0, reasons }
}
