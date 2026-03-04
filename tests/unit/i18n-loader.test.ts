import { describe, it, expect, beforeEach } from 'vitest'
import { LocaleLoader, type BlocklyMsg } from '../../src/i18n/loader'

describe('T020: LocaleLoader', () => {
  let loader: LocaleLoader
  let msg: BlocklyMsg

  beforeEach(() => {
    loader = new LocaleLoader()
    msg = {}
    loader.setBlocklyMsg(msg)
  })

  it('should load from data and inject into Blockly.Msg', () => {
    loader.loadFromData('zh-TW', {
      U_VAR_DECLARE_MSG0: '宣告 %1 型別 %2 名稱 %3',
      U_VAR_DECLARE_TOOLTIP: '宣告一個變數',
    }, {
      TYPE_INT: 'int（整數）',
    })

    expect(msg['U_VAR_DECLARE_MSG0']).toBe('宣告 %1 型別 %2 名稱 %3')
    expect(msg['U_VAR_DECLARE_TOOLTIP']).toBe('宣告一個變數')
    expect(msg['TYPE_INT']).toBe('int（整數）')
  })

  it('should track current locale', () => {
    expect(loader.getCurrentLocale()).toBe('')
    loader.loadFromData('zh-TW', {}, {})
    expect(loader.getCurrentLocale()).toBe('zh-TW')
    loader.loadFromData('en', {}, {})
    expect(loader.getCurrentLocale()).toBe('en')
  })

  it('should list available locales', () => {
    const locales = loader.getAvailableLocales()
    expect(locales).toContain('zh-TW')
    expect(locales).toContain('en')
  })

  it('should cache loaded bundles', () => {
    const bundle = loader.loadFromData('zh-TW', { KEY: 'value' }, {})
    expect(loader.getBundle('zh-TW')).toBe(bundle)
  })

  it('should handle missing keys gracefully (key stays as-is in Blockly)', () => {
    loader.loadFromData('zh-TW', {}, {})
    // Keys not in the bundle won't exist in msg
    expect(msg['NONEXISTENT_KEY']).toBeUndefined()
  })

  it('should inject types into Blockly.Msg', () => {
    loader.loadFromData('zh-TW', {}, {
      TYPE_INT: 'int（整數）',
      TYPE_DOUBLE: 'double（小數）',
      TYPE_CHAR: 'char（字元）',
    })
    expect(msg['TYPE_INT']).toBe('int（整數）')
    expect(msg['TYPE_DOUBLE']).toBe('double（小數）')
    expect(msg['TYPE_CHAR']).toBe('char（字元）')
  })

  it('should overwrite previous locale keys when loading new locale', () => {
    loader.loadFromData('zh-TW', { KEY: '中文' }, {})
    expect(msg['KEY']).toBe('中文')
    loader.loadFromData('en', { KEY: 'English' }, {})
    expect(msg['KEY']).toBe('English')
  })

  it('should work without setBlocklyMsg (no injection)', () => {
    const loader2 = new LocaleLoader()
    // Should not throw
    const bundle = loader2.loadFromData('zh-TW', { KEY: 'val' }, {})
    expect(bundle.blocks.KEY).toBe('val')
  })
})
