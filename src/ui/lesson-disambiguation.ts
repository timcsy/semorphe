/**
 * **規格消歧的並排畫面與老師的選擇**（spec 218 US3）。
 *
 * 每個解讀一欄：名稱、一致／不一致／不可比、第一個不一致的情境與兩邊的輸出；每欄一顆「題目指的是這一種」。
 * 老師的選擇存在本機（`semorphe-disambiguation`：課 id＋題目 id → 解讀 id）——題意的正式紀錄歸 cos-mos，之後換實作只動這兩個函式。
 * localStorage 可能讀不到（私密視窗、被擋）：讀不到就是沒選，寫不進去就照常顯示（P6：不讓畫面壞掉）。
 */
import type { ComparisonResult } from '../core/disambiguation/types'
import { msg } from '../core/messages'

const KEY = 'semorphe-disambiguation'

function readAll(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string> } catch { return {} }
}

export function chosenInterpretation(lessonId: string, taskId: string): string | undefined {
  return readAll()[`${lessonId}#${taskId}`]
}

export function chooseInterpretation(lessonId: string, taskId: string, interpretationId: string): void {
  const all = readAll()
  all[`${lessonId}#${taskId}`] = interpretationId
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* 存不進去：這一次照常，下次再選 */ }
}

const show = (s: string): string => (s === '' ? msg('DISAMBIG_EMPTY_OUTPUT', '（沒有輸出）') : JSON.stringify(s))

/** 並排畫面（純 DOM，不知道是哪個面板） */
export function renderDisambiguation(result: ComparisonResult, chosen: string | undefined, onChoose: (id: string) => void): HTMLElement {
  const box = document.createElement('div')
  box.className = 'console-disambiguation'
  const head = document.createElement('div')
  head.className = 'console-disambiguation-head'
  head.textContent = msg('DISAMBIG_HEAD', '這一題有不只一種讀法——你的程式和每一種比起來：')
  box.appendChild(head)
  const cols = document.createElement('div')
  cols.className = 'console-disambiguation-cols'
  for (const r of result.results) {
    const col = document.createElement('div')
    col.className = `console-disambiguation-col ${r.status}${chosen === r.id ? ' chosen' : ''}`
    col.dataset.interpretation = r.id
    const title = document.createElement('div')
    title.className = 'console-disambiguation-title'
    title.textContent = r.label
    const status = document.createElement('div')
    status.className = 'console-disambiguation-status'
    status.textContent = r.status === 'consistent' ? msg('DISAMBIG_CONSISTENT', '✅ 一致')
      : r.status === 'inconsistent' ? msg('DISAMBIG_INCONSISTENT', '✗ 不一致')
        : msg('DISAMBIG_INCOMPARABLE', '？ 比不了（判決沒有跑完）')
    col.append(title, status)
    if (r.firstMismatch) {
      const m = r.firstMismatch
      const detail = document.createElement('div')
      detail.className = 'console-disambiguation-mismatch'
      const boardPart = (b?: Record<string, number>): string => (b && Object.keys(b).length ? ` ${JSON.stringify(b)}` : '')
      detail.textContent = msg('DISAMBIG_FIRST_MISMATCH', '第一個不一樣的情境：{scenario}——你的：{student}；這種讀法：{reference}')
        .replace('{scenario}', m.scenario.label)
        .replace('{student}', show(m.student.out) + boardPart(m.student.board))
        .replace('{reference}', show(m.reference.out) + boardPart(m.reference.board))
      col.appendChild(detail)
    }
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'console-disambiguation-choose'
    btn.textContent = chosen === r.id ? msg('DISAMBIG_CHOSEN', '題目指的是這一種（已選）') : msg('DISAMBIG_CHOOSE', '題目指的是這一種')
    btn.addEventListener('click', () => onChoose(r.id))
    col.appendChild(btn)
    cols.appendChild(col)
  }
  box.appendChild(cols)
  for (const group of result.indistinguishable) {
    const note = document.createElement('div')
    note.className = 'console-disambiguation-note'
    note.textContent = msg('DISAMBIG_INDISTINGUISHABLE', '這一批情境分不出這幾種讀法：{ids}').replace('{ids}', group.join('、'))
    box.appendChild(note)
  }
  return box
}
