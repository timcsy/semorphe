/**
 * 兩段程式碼的逐行差異——給「提議中」的變更看改前改後（spec 220）。
 *
 * 對位重用 `alignLines`（LCS）；它比的是去掉前後空白的行，
 * 所以對上之後再比一次原文：縮排變了也要看得見。
 */
import { alignLines } from '../projection/patch-shift'

export interface DiffLine {
  kind: ' ' | '+' | '-'
  text: string
}

const linesOf = (s: string): string[] => {
  if (s === '') return []
  const ls = s.split('\n')
  if (ls[ls.length - 1] === '') ls.pop()
  return ls
}

export function lineDiff(before: string, after: string): DiffLine[] {
  const b = linesOf(before)
  const a = linesOf(after)
  const map = alignLines(b, a)
  const out: DiffLine[] = []
  let j = 0
  for (let i = 0; i < b.length; i++) {
    const k = map[i]
    if (k < 0) { out.push({ kind: '-', text: b[i] }); continue }
    // 對上之前，after 裡跳過的那些是新加的——但要等這一段被刪的都列完（先 - 後 +）
    const pendingAdds: DiffLine[] = []
    for (; j < k; j++) pendingAdds.push({ kind: '+', text: a[j] })
    out.push(...pendingAdds)
    if (b[i] === a[k]) out.push({ kind: ' ', text: b[i] })
    else out.push({ kind: '-', text: b[i] }, { kind: '+', text: a[k] })
    j = k + 1
  }
  for (; j < a.length; j++) out.push({ kind: '+', text: a[j] })
  return out
}
