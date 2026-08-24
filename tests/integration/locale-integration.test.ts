import { describe, it, expect, beforeEach } from 'vitest'
import { LocaleLoader, type BlocklyMsg } from '../../src/i18n/loader'
import zhTWBlocks from '../../src/i18n/zh-TW/blocks.json'
import zhTWTypes from '../../src/i18n/zh-TW/types.json'
import enBlocks from '../../src/i18n/en/blocks.json'
import enTypes from '../../src/i18n/en/types.json'
import { componentLabels } from '../../src/core/component/labels'

describe('T031: Locale Integration', () => {
  let loader: LocaleLoader
  let msg: BlocklyMsg

  beforeEach(() => {
    loader = new LocaleLoader()
    msg = {}
    loader.setBlocklyMsg(msg)
  })

  describe('zh-TW locale completeness', () => {
    it('should have all block keys after loading zh-TW', () => {
      // ⚠️ **膠囊自帶的標籤也要載。** `U_COUNT_LOOP_MSG0` 2026-08-11 隨
      // `cpp:loop_count` 進了膠囊——只載共用 i18n 檔的話這裡讀到 undefined，
      // 而症狀看起來像「翻譯漏了一條」。
      loader.loadFromData('zh-TW', { ...zhTWBlocks, ...componentLabels('zh-TW') }, zhTWTypes)

      // Check critical block keys exist
      expect(msg['U_VAR_DECLARE_MSG0']).toBeTruthy()
      expect(msg['U_PRINT_TOOLTIP']).toBeTruthy()
      expect(msg['U_IF_MSG0']).toBeTruthy()
      expect(msg['U_COUNT_LOOP_MSG0']).toBeTruthy()
      expect(msg['U_FUNC_DEF_TOOLTIP']).toBeTruthy()
      expect(msg['U_INPUT_TOOLTIP']).toBeTruthy()
    })

    it('should have all dynamic block UI keys', () => {
      loader.loadFromData('zh-TW', zhTWBlocks, zhTWTypes)

      expect(msg['U_PRINT_LABEL']).toBe('輸出')
      // 🪦 `U_FUNC_DEF_LABEL`／`U_FUNC_DEF_RETURN_LABEL` 於 2026-08-24 搬進膠囊
      //    （`components/cpp/func_def/labels/`）——命令式那顆退場，標籤跟著走。
      //    ⚠️ `U_FUNC_DEF_PARAMS_LABEL` 仍留在共用檔：**還有別人在用**
      //    （`cpp_forward_decl` 的命令式參數列）——它不是搬走，是還沒輪到。
      expect(msg['U_FUNC_DEF_PARAMS_LABEL']).toBe('參數')
      // 🪦 `U_FUNC_CALL_LABEL` 於 2026-08-24 搬進膠囊（`components/cpp/func_call/labels/`）
      //    ——命令式那顆退場，標籤跟著走。**這一支載的是共用的 `src/i18n`**，
      //    所以它不再在這裡，而**那正是就近性護欄要求的**（兩份會漂移）。
      //    ⚠️ 從這張清單拿掉一個鍵要附理由：否則「搬走了」與「弄丟了」長得一樣。
      expect(msg['U_INPUT_LABEL']).toBe('讀取輸入 → 變數')
      expect(msg['U_VAR_REF_CUSTOM']).toBe('(自訂)')
      expect(msg['U_VAR_DECLARE_HEADER']).toBe('宣告')
      expect(msg['U_VAR_DECLARE_VAR_LABEL']).toBe('變數')
      expect(msg['U_VAR_DECLARE_VAR_INIT_LABEL']).toBe('變數 = 值')
    })

    it('should have all category name keys', () => {
      loader.loadFromData('zh-TW', zhTWBlocks, zhTWTypes)

      expect(msg['CAT_DATA']).toBe('資料')
      expect(msg['CAT_OPERATORS']).toBe('運算')
      expect(msg['CAT_CONTROL']).toBe('流程控制')
      expect(msg['CAT_FUNCTIONS']).toBe('函式')
      expect(msg['CAT_IO']).toBe('輸入輸出')
      expect(msg['CAT_ARRAYS']).toBe('陣列')
    })

    it('should have type labels', () => {
      loader.loadFromData('zh-TW', zhTWBlocks, zhTWTypes)

      expect(msg['TYPE_INT']).toBe('int（整數）')
      expect(msg['TYPE_DOUBLE']).toBe('double（精確小數）')
      expect(msg['TYPE_VOID']).toBe('void（無回傳）')
    })

    it('should have quick access keys', () => {
      loader.loadFromData('zh-TW', zhTWBlocks, zhTWTypes)

      expect(msg['QA_VAR']).toBe('變數')
      expect(msg['QA_PRINT']).toBe('輸出')
      expect(msg['QA_INPUT']).toBe('輸入')
      expect(msg['QA_IF']).toBe('如果')
      expect(msg['QA_LOOP']).toBe('迴圈')
      expect(msg['QA_FUNC']).toBe('函式')
    })
  })

  describe('en locale completeness', () => {
    it('should have all block keys after loading en', () => {
      loader.loadFromData('en', { ...enBlocks, ...componentLabels('en') }, enTypes)

      expect(msg['U_VAR_DECLARE_MSG0']).toBeTruthy()
      expect(msg['U_PRINT_TOOLTIP']).toBeTruthy()
      expect(msg['U_IF_MSG0']).toBeTruthy()
    })

    it('should have type labels in English', () => {
      loader.loadFromData('en', enBlocks, enTypes)

      expect(msg['TYPE_INT']).toContain('int')
      expect(msg['TYPE_DOUBLE']).toContain('double')
    })
  })

  describe('locale switching', () => {
    it('should switch from zh-TW to en and update all keys', () => {
      loader.loadFromData('zh-TW', zhTWBlocks, zhTWTypes)
      expect(msg['U_PRINT_LABEL']).toBe('輸出')

      loader.loadFromData('en', enBlocks, enTypes)
      expect(msg['U_PRINT_LABEL']).toBe('Print')
      expect(loader.getCurrentLocale()).toBe('en')
    })

    it('should switch from en to zh-TW', () => {
      loader.loadFromData('en', enBlocks, enTypes)
      expect(msg['U_PRINT_LABEL']).toBe('Print')

      loader.loadFromData('zh-TW', zhTWBlocks, zhTWTypes)
      expect(msg['U_PRINT_LABEL']).toBe('輸出')
      expect(loader.getCurrentLocale()).toBe('zh-TW')
    })
  })

  describe('key consistency between locales', () => {
    it('en should have all keys that zh-TW has in blocks', () => {
      const zhKeys = Object.keys(zhTWBlocks)
      const enKeys = new Set(Object.keys(enBlocks))

      const missingInEn = zhKeys.filter(k => !enKeys.has(k))
      expect(missingInEn).toEqual([])
    })

    it('en should have all keys that zh-TW has in types', () => {
      const zhKeys = Object.keys(zhTWTypes)
      const enKeys = new Set(Object.keys(enTypes))

      const missingInEn = zhKeys.filter(k => !enKeys.has(k))
      expect(missingInEn).toEqual([])
    })
  })

  describe('fallback behavior', () => {
    it('missing keys should remain undefined (Blockly handles missing keys)', () => {
      loader.loadFromData('zh-TW', zhTWBlocks, zhTWTypes)
      expect(msg['NONEXISTENT_KEY_12345']).toBeUndefined()
    })
  })
})
