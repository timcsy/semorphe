import { describe, it, expect, beforeEach } from 'vitest'

import { QuickAccessBar } from '../../../src/ui/toolbar/quick-access-bar'

describe('QuickAccessBar (block toolbar)', () => {
  let parent: HTMLElement
  let bar: QuickAccessBar

  beforeEach(() => {
    parent = document.createElement('div')
    bar = new QuickAccessBar(parent)
  })

  it('should create bar element', () => {
    expect(parent.querySelector('.quick-access-bar')).toBeTruthy()
  })

  it('should contain sync buttons', () => {
    const el = bar.getElement()
    expect(el.querySelector('#auto-sync-btn')).toBeTruthy()
    expect(el.querySelector('#sync-blocks-btn')).toBeTruthy()
    expect(el.querySelector('#sync-code-btn')).toBeTruthy()
  })

  it('should contain level selector mount', () => {
    expect(bar.getElement().querySelector('#level-selector-mount')).toBeTruthy()
  })

  it('should contain block style selector mount', () => {
    expect(bar.getElement().querySelector('#block-style-selector-mount')).toBeTruthy()
  })

  it('should contain undo/redo/clear buttons', () => {
    const el = bar.getElement()
    expect(el.querySelector('#undo-btn')).toBeTruthy()
    expect(el.querySelector('#redo-btn')).toBeTruthy()
    expect(el.querySelector('#clear-btn')).toBeTruthy()
  })

  it('should contain file dropdown with export/import/upload', () => {
    const el = bar.getElement()
    expect(el.querySelector('#file-menu-btn')).toBeTruthy()
    expect(el.querySelector('#file-menu')).toBeTruthy()
    expect(el.querySelector('#export-btn')).toBeTruthy()
    expect(el.querySelector('#import-btn')).toBeTruthy()
    expect(el.querySelector('#upload-blocks-btn')).toBeTruthy()
  })

  it('should not contain style or locale selectors', () => {
    const el = bar.getElement()
    expect(el.querySelector('#style-selector-mount')).toBeNull()
    expect(el.querySelector('#locale-selector-mount')).toBeNull()
  })
})
