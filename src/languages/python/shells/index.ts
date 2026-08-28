/**
 * Python 的鷹架宣告——**在模組載入時註冊**。
 *
 * 🔴 為什麼 Python 也要一份「空的」：`shellById('none')` 在 2026-08-28
 * 對 Python 回的是**C++ 那一份**——同一個 id 跨語言撞名。
 * 症狀是狀態列顯示「沒有外框」而那句話碰巧是對的，
 * **而選單裡「外框」那一組整個不見**（`shellsOfLanguage('python')` 是空的）。
 *
 * > **一個 id 沒有語言的話，第二個語言進來的那天它會安靜地撿到別人的宣告。**
 */
import { registerShell, parseShell } from '../../../core/shell'
import pythonNoneShellDef from './python-none.json'

registerShell(parseShell(pythonNoneShellDef))
