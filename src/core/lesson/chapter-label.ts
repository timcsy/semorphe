/** 章節選單的一個選項：資料夾名的 `NN-` 編號 ＋ 課文的標題（沒有編號就只用標題；沒有標題才退回資料夾名）。 */
export function chapterLabel(id: string, title: string | undefined): string {
  const folder = id.split('/')[1] ?? id
  const num = /^(\d+)-/.exec(folder)?.[1]
  const name = title?.trim() || (num ? folder.slice(num.length + 1) : folder)
  return num ? `${num}-${name}` : name
}
