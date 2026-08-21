/**
 * Python 的語言套件宣告——**它自己說它提供什麼**，`app.ts` 不必認得它。
 *
 * ⚠️ 在 spec 161 之前，這六樣東西是 `app.ts` 裡的**五個 import ＋ 三行註冊**。
 */
import type { Topic, Target, StylePreset } from '../../core/types'
import { declareLanguagePack } from '../../core/language-packs'
import { pythonCategoryDefs } from './toolbox-categories'
import { PythonParser } from './parser'
import pythonLiftPatterns from './lift-patterns.json'
import { declareDegradationBlocks } from '../../core/degradation-blocks'
import { declareCommentSyntax } from '../../core/comment-syntax'
import { declareExpressionStatement } from '../../core/expression-statement'
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
