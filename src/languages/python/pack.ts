/**
 * Python 的語言套件宣告——**它自己說它提供什麼**，`app.ts` 不必認得它。
 *
 * ⚠️ 在 spec 161 之前，這六樣東西是 `app.ts` 裡的**五個 import ＋ 三行註冊**。
 */
import type { Topic, Target, StylePreset } from '../../core/types'
// ⚠️ **副作用 import**——把 Python 的鷹架宣告註冊進去。
//    少了它，`shellsOfLanguage('python')` 是空的，而狀態列會撿到 C++ 的 `none`。
import './shells'
import { declareLanguagePack } from '../../core/language-packs'
import { pythonCategoryDefs } from './toolbox-categories'
import { PythonParser } from './parser'
import pythonLiftPatterns from './lift-patterns.json'
import { declareDegradationBlocks } from '../../core/degradation-blocks'
import { declareCommentSyntax } from '../../core/comment-syntax'
import { declareExpressionStatement } from '../../core/expression-statement'
import { declareBuiltinConstants } from '../../core/language-executors'
// ⚠️ 下拉的**選項來源**是一個中立的登記處（那個模組一個語言的字都不認識），
//    而**選項本身是語言的知識**——所以宣告在這裡。
import { declareDropdownSource } from '../../core/dropdown-sources'
import { msg } from '../../core/messages'
import { PYTHON_GLOBALS } from './builtins'
import { pythonCommentSyntax } from './comment-syntax'
import { registerPythonTransforms } from './transforms'
import { registerPythonLanguage } from './install'

// 🔴 **Python 自己的降級積木**（spec 168）。
//
// ⚠️ 在此之前登記處是**一個全域槽**，於是 Python 的降級用的是 `cpp_raw_code`
// ——實測：一段 Python 貼進去產出 5 顆 C++ 的灰色方塊。
// **降級本身是對的，而那顆積木的身分是別的語言的。**
declareDegradationBlocks('python', {
  statement: 'python_raw_code',
  expression: 'python_raw_expression',
})
declareCommentSyntax('python', pythonCommentSyntax)

// 🔴 **Python 的頂層裸運算式是最常見的一行**（`nums.append(9)`），而收尾不加東西。
//
// 沒有這一筆的話，`asStatement` 不包縮排也不包換行，於是下一行黏上去
// ——`nums.append(9)print(len(nums))`，**一段不合法的 Python**。
// 見 `core/expression-statement.ts` 的檔頭。
declareExpressionStatement('python', { suffix: '', allowedAtTopLevel: true })

// 🔴 **`__name__` 是 `"__main__"`**——`if __name__ == "__main__":` 是 AI 生的
//    Python 幾乎必有的一行，而少了這個名字整段會說「沒有這個變數」。
declareBuiltinConstants(PYTHON_GLOBALS)

/**
 * **型別註記的下拉選單**——`def f(x: int) -> str` 的那幾個字。
 *
 * 🔴 **為什麼是下拉不是文字框**：使用者回報「型別要留的話要可以列表選，
 * 像 C++ 那邊的積木那樣」。一個文字框把「有哪幾種型別」這件事**留給學生去記**，
 * 而那正是積木要替他省掉的東西。
 *
 * ⚠️ **而它必須收得下不在清單裡的字**（`Dog`、`list[int]`）——
 * 動態下拉那顆欄位的既有行為就是「認不得的值加進選項，不換掉它」：
 *
 * > **一個會把它不認得的值換掉的下拉，等於在使用者沒看的時候改掉他的程式。**
 *
 * 🟢 **宣告在這裡而不是 `block-registrar`**：那個檔有一條護欄盯著
 * 「加一顆這個語言的積木不准動它」（P3）。語言自己的清單，語言自己說。
 */
declareDropdownSource('python_types', () => {
  return [
    // ⚠️ 第一筆是**清掉註記**——沒有它的話，選過之後就取消不掉了
    [msg('PY_TYPE_NONE_GIVEN', '（不指定）'), ''],
    ['int', 'int'],
    ['float', 'float'],
    ['str', 'str'],
    ['bool', 'bool'],
    ['list', 'list'],
    ['dict', 'dict'],
    ['tuple', 'tuple'],
    ['set', 'set'],
    // ⚠️ `None` 主要用在回傳（`-> None`），而參數上也合法
    ['None', 'None'],
  ]
})
import pythonBeginnerTopic from './topics/python-beginner.json'
import pythonTargetDef from './targets/python.json'
import pythonPreset from './styles/python.json'

declareLanguagePack({
  id: 'python',
  name: 'Python',
  grammar: 'tree-sitter-python',
  programRoot: 'python:program',
  install: registerPythonLanguage,
  liftPatterns: pythonLiftPatterns,
  liftTransforms: registerPythonTransforms,
  /**
   * ⚠️ **空的，而它是【顯式的空】不是忘了寫。**
   * Python 今天沒有任何手寫 lifter——所有辨識都走 pattern。
   * C++ 那一串跳過清單**與這裡無關**，那正是 spec 167 修的東西。
   */
  liftSkipNodeTypes: [],
  order: 1,
  topics: [pythonBeginnerTopic as Topic],
  targets: [pythonTargetDef as Target],
  styles: [pythonPreset as StylePreset],
  categories: pythonCategoryDefs,
  createParser: () => new PythonParser(),
})
