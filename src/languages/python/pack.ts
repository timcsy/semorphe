/**
 * Python 的語言套件宣告——**它自己說它提供什麼**，`app.ts` 不必認得它。
 *
 * ⚠️ 在 spec 161 之前，這六樣東西是 `app.ts` 裡的**五個 import ＋ 三行註冊**。
 */
import type { Topic, Target, StylePreset } from '../../core/types'
import { declareLanguagePack } from '../../core/language-packs'
import { pythonCategoryDefs } from './toolbox-categories'
import { PythonParser } from './parser'
import pythonBeginnerTopic from './topics/python-beginner.json'
import pythonTargetDef from './targets/python.json'
import pythonPreset from './styles/python.json'

declareLanguagePack({
  id: 'python',
  name: 'Python',
  order: 1,
  topics: [pythonBeginnerTopic as Topic],
  targets: [pythonTargetDef as Target],
  styles: [pythonPreset as StylePreset],
  categories: pythonCategoryDefs,
  createParser: () => new PythonParser(),
})
