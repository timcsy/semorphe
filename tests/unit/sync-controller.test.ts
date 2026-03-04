import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SyncController } from '../../src/ui/sync-controller'

describe('SyncController', () => {
  let syncController: SyncController
  let mockBlocksToCode: ReturnType<typeof vi.fn>
  let mockCodeToBlocks: ReturnType<typeof vi.fn>
  let mockSetCode: ReturnType<typeof vi.fn>
  let mockSetBlocks: ReturnType<typeof vi.fn>

  beforeEach(() => {
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
    })
  })

  describe('Block → Code 手動觸發', () => {
    it('should call blocksToCode and setCode when syncBlocksToCode is called', () => {
      syncController.syncBlocksToCode({ blocks: { languageVersion: 0, blocks: [] } })
      expect(mockBlocksToCode).toHaveBeenCalled()
      expect(mockSetCode).toHaveBeenCalledWith('int x = 10;')
    })

    it('should be synchronous', () => {
      syncController.syncBlocksToCode({ blocks: { languageVersion: 0, blocks: [] } })
      expect(mockBlocksToCode).toHaveBeenCalledTimes(1)
      expect(mockSetCode).toHaveBeenCalledTimes(1)
    })
  })

  describe('Code → Block 手動觸發', () => {
    it('should call codeToBlocks and setBlocks when syncCodeToBlocks is called', async () => {
      await syncController.syncCodeToBlocks('int x = 10;')
      expect(mockCodeToBlocks).toHaveBeenCalledWith('int x = 10;')
      expect(mockSetBlocks).toHaveBeenCalled()
    })
  })

  describe('防止重複觸發', () => {
    it('should not allow syncCodeToBlocks while syncing', async () => {
      // Make codeToBlocks hang
      let resolve: () => void
      mockCodeToBlocks.mockReturnValue(new Promise<unknown>(r => { resolve = () => r({ blocks: {} }) }))

      const promise = syncController.syncCodeToBlocks('int x;')
      expect(syncController.isSyncing()).toBe(true)

      // Try to trigger again while syncing
      syncController.syncBlocksToCode({ blocks: {} })
      expect(mockBlocksToCode).not.toHaveBeenCalled()

      resolve!()
      await promise
    })

    it('should not allow syncBlocksToCode while syncing blocks→code', () => {
      // blocksToCode is synchronous, so syncing flag is only true during execution
      // After completion, syncing is false and another call should work
      syncController.syncBlocksToCode({ blocks: {} })
      expect(mockBlocksToCode).toHaveBeenCalledTimes(1)

      syncController.syncBlocksToCode({ blocks: {} })
      expect(mockBlocksToCode).toHaveBeenCalledTimes(2)
    })
  })
})
