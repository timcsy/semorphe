/**
 * C++ 的語言套件宣告。
 *
 * ⚠️ **這一份存在的理由與 Python 那份不同**：Python 是「本來就沒有」，
 * 而 C++ 是**本來繞過了自己的登記處**——`app.ts` 直接 `import cppCategoryDefs`，
 * 於是 `toolbox-categories` 這個登記處**只有 python 一個宣告者**。
 *
 * > `concepts/宣告登記處.md` 逐字：「一個單一宣告者的登記處，
 * > 與一個寫死的值在行為上分不出來。」
 *
 * 🟢 兩個語言都走同一條路之後，那九個登記處才第一次**被驗過**。
 */
import type { Topic, Target, StylePreset } from '../../core/types'
import { declareLanguagePack } from '../../core/language-packs'
import { cppCategoryDefs } from './toolbox-categories'
import { CppParser } from './parser'
import cppLiftPatterns from './lift-patterns.json'
import cppBeginnerTopic from './topics/cpp-beginner.json'
import cppCompetitiveTopic from './topics/cpp-competitive.json'
import cBeginnerTopic from './topics/c-beginner.json'
import arduinoTopic from './topics/arduino.json'
import cppTargetDef from './targets/cpp.json'
import cTargetDef from './targets/c.json'
import cppCompetitiveTargetDef from './targets/cpp-competitive.json'
import arduinoTargetDef from './targets/arduino.json'
import arduinoUnoTargetDef from './targets/arduino-uno.json'
import arduinoNanoTargetDef from './targets/arduino-nano.json'
import esp32TargetDef from './targets/esp32.json'
import esp32c3TargetDef from './targets/esp32c3.json'
import esp32s3TargetDef from './targets/esp32s3.json'
import esp32s3CamTargetDef from './targets/esp32s3-cam.json'
import wemosD1MiniTargetDef from './targets/wemos-d1-mini.json'
import nodemcuEsp8266TargetDef from './targets/nodemcu-esp8266.json'
import apcsPreset from './styles/apcs.json'
import competitivePreset from './styles/competitive.json'
import googlePreset from './styles/google.json'
import cPreset from './styles/c.json'

declareLanguagePack({
  id: 'cpp',
  name: 'C++',
  /**
   * ⚠️ **一個文法，四個教學語言**——下面 `topics` 那四筆
   * （cpp-beginner／cpp-competitive／c-beginner／arduino）全走這一個文法。
   * 這就是「文法不是語言」最直接的證據。
   */
  grammar: 'tree-sitter-cpp',
  liftPatterns: cppLiftPatterns,
  /**
   * 這些節點由手寫 lifter 或 lift-pattern 接手，**pattern 那條路要跳過**。
   *
   * 🔴 spec 167 之前這一串寫在 `app.ts` 的組裝點，**而它套用在所有語言上**
   * ——於是 Python 的 `for_statement` 也被跳過了，而沒有任何東西說話。
   */
  liftSkipNodeTypes: [
    'call_expression', 'using_declaration', 'for_statement', 'assignment_expression',
    'update_expression', 'switch_statement', 'case_statement', 'do_statement',
    'conditional_expression', 'cast_expression', 'preproc_ifdef',
  ],
  order: 0,
  topics: [cppBeginnerTopic, cppCompetitiveTopic, cBeginnerTopic, arduinoTopic] as Topic[],
  // ⚠️ **順序就是選單順序**——照 `app.ts` 原本的註冊順序原封搬過來。
  // 🔴 而 Python 原本插在 `arduino` 與板子之間，那是**跨語言的順序**，
  // 一個語言套件表達不出來 → 由 `app.ts` 的組裝順序決定（見那裡的註解）。
  targets: [
    cppTargetDef, cTargetDef, cppCompetitiveTargetDef, arduinoTargetDef,
    arduinoUnoTargetDef, arduinoNanoTargetDef, esp32TargetDef, esp32c3TargetDef,
    esp32s3TargetDef, esp32s3CamTargetDef, wemosD1MiniTargetDef, nodemcuEsp8266TargetDef,
  ] as Target[],
  // 🔴 **順序就是選單順序**（`c.json` 的 `apcs` 在第一個 → 預設風格）。
  styles: [apcsPreset, competitivePreset, googlePreset, cPreset] as StylePreset[],
  categories: cppCategoryDefs,
  createParser: () => new CppParser(),
})
