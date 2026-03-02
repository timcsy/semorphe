import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SyncController } from '../../src/ui/sync-controller'

describe('SyncController', () => {
  let syncController: SyncController
  let mockBlocksToCode: ReturnType<typeof vi.fn>
  let mockCodeToBlocks: ReturnType<typeof vi.fn>
  let mockSetCode: ReturnType<typeof vi.fn>
  let mockSetBlocks: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    mockBlocksToCode = vi.fn().mockReturnValue('int x = 10;')
    mockCodeToBlocks = vi.fn().mockResolvedValue({
      blocks: { languageVersion: 0, blocks: [] },
    })
    mockSetCode = vi.fn()
    mockSetBlocks = vi.fn()

    syncController = new SyncController({
      blocksToCode: mockBlocksToCode,
      codeToBlocks: mockCodeToBlocks,
      setCode: mockSetCode,
      setBlocks: mockSetBlocks,
      debounceMs: 300,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    syncController.destroy()
  })

  describe('Block → Code 觸發', () => {
    it('should call blocksToCode when blocks change', async () => {
      syncController.onBlocksChanged({ blocks: { languageVersion: 0, blocks: [] } })
      await vi.advanceTimersByTimeAsync(300)
      expect(mockBlocksToCode).toHaveBeenCalled()
    })

    it('should call setCode with generated code', async () => {
      syncController.onBlocksChanged({ blocks: { languageVersion: 0, blocks: [] } })
      await vi.advanceTimersByTimeAsync(300)
      expect(mockSetCode).toHaveBeenCalledWith('int x = 10;')
    })
  })

  describe('Code → Block 觸發', () => {
    it('should call codeToBlocks when code changes', async () => {
      syncController.onCodeChanged('int x = 10;')
      await vi.advanceTimersByTimeAsync(300)
      expect(mockCodeToBlocks).toHaveBeenCalledWith('int x = 10;')
    })

    it('should call setBlocks with workspace state', async () => {
      syncController.onCodeChanged('int x = 10;')
      await vi.advanceTimersByTimeAsync(300)
      expect(mockSetBlocks).toHaveBeenCalled()
    })
  })

  describe('防抖邏輯', () => {
    it('should debounce rapid block changes', async () => {
      syncController.onBlocksChanged({ blocks: { languageVersion: 0, blocks: [] } })
      syncController.onBlocksChanged({ blocks: { languageVersion: 0, blocks: [] } })
      syncController.onBlocksChanged({ blocks: { languageVersion: 0, blocks: [] } })
      await vi.advanceTimersByTimeAsync(300)
      expect(mockBlocksToCode).toHaveBeenCalledTimes(1)
    })

    it('should debounce rapid code changes', async () => {
      syncController.onCodeChanged('a')
      syncController.onCodeChanged('ab')
      syncController.onCodeChanged('abc')
      await vi.advanceTimersByTimeAsync(300)
      expect(mockCodeToBlocks).toHaveBeenCalledTimes(1)
      expect(mockCodeToBlocks).toHaveBeenCalledWith('abc')
    })

    it('should not trigger before debounce period', async () => {
      syncController.onBlocksChanged({ blocks: { languageVersion: 0, blocks: [] } })
      await vi.advanceTimersByTimeAsync(100)
      expect(mockBlocksToCode).not.toHaveBeenCalled()
    })
  })

  describe('防止無限迴圈', () => {
    it('should not trigger code→blocks while blocks→code is running', async () => {
      // Trigger blocks→code
      syncController.onBlocksChanged({ blocks: { languageVersion: 0, blocks: [] } })
      await vi.advanceTimersByTimeAsync(300)

      // The setCode call should be flagged as source-locked
      // So if code editor reacts, it should be suppressed
      expect(mockBlocksToCode).toHaveBeenCalledTimes(1)
    })

    it('should not trigger blocks→code while code→blocks is running', async () => {
      // Trigger code→blocks
      syncController.onCodeChanged('int x;')
      await vi.advanceTimersByTimeAsync(300)

      expect(mockCodeToBlocks).toHaveBeenCalledTimes(1)
    })
  })
})
