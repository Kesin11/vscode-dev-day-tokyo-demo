import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteOldEntries,
  getReadingListEntries,
  initializeExtension,
  markEntriesAsRead,
  processReadingList,
} from "../../src/backend/background";

// Chrome API のモック
const mockChrome = {
  readingList: {
    query: vi.fn(),
    updateEntry: vi.fn(),
    removeEntry: vi.fn(),
  },
  runtime: {
    onStartup: {
      addListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
    onMessage: {
      addListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn(),
    },
  },
};

// グローバルオブジェクトにchromeを設定
vi.stubGlobal("chrome", mockChrome);

// テスト用のサンプルデータ
const sampleEntries: chrome.readingList.ReadingListEntry[] = [
  {
    title: "テストエントリ1",
    url: "https://example.com/1",
    hasBeenRead: false,
    creationTime: Date.now() - 86400000, // 1日前
    lastUpdateTime: Date.now() - 3600000, // 1時間前
  },
  {
    title: "テストエントリ2",
    url: "https://example.com/2",
    hasBeenRead: true,
    creationTime: Date.now() - 172800000, // 2日前
    lastUpdateTime: Date.now() - 7200000, // 2時間前
  },
  {
    title: "テストエントリ3",
    url: "https://example.com/3",
    hasBeenRead: false,
    creationTime: Date.now() - 2592000000, // 30日前
    lastUpdateTime: Date.now() - 2592000000, // 30日前
  },
  {
    title: "テストエントリ4",
    url: "https://example.com/4",
    hasBeenRead: false,
    creationTime: Date.now() - 5184000000, // 60日前
    lastUpdateTime: Date.now() - 5184000000, // 60日前
  },
];

describe("Background", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getReadingListEntries", () => {
    it("正常系: リーディングリストのエントリを正常に取得できる", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);

      // テスト実行
      const result = await getReadingListEntries();

      // 検証
      expect(mockChrome.readingList.query).toHaveBeenCalledWith({});
      expect(result).toEqual(sampleEntries);
      expect(result).toHaveLength(4);
      expect(result[0]?.title).toBe("テストエントリ1");
      expect(result[1]?.hasBeenRead).toBe(true);
    });

    it("正常系: エントリが空の場合でも正常に処理される", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue([]);

      // テスト実行
      const result = await getReadingListEntries();

      // 検証
      expect(mockChrome.readingList.query).toHaveBeenCalledWith({});
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it("異常系: Chrome API呼び出しが失敗した場合にエラーをthrowする", async () => {
      // モックの設定
      const errorMessage = "Chrome API エラー";
      mockChrome.readingList.query.mockRejectedValue(new Error(errorMessage));

      // テスト実行と検証
      await expect(getReadingListEntries()).rejects.toThrow(errorMessage);
      expect(mockChrome.readingList.query).toHaveBeenCalledWith({});
    });

    it("異常系: Chrome readingList APIが利用できない場合", async () => {
      // モックの設定
      mockChrome.readingList.query.mockRejectedValue(
        new Error("readingList API is not available"),
      );

      // テスト実行と検証
      await expect(getReadingListEntries()).rejects.toThrow(
        "readingList API is not available",
      );
      expect(mockChrome.readingList.query).toHaveBeenCalledWith({});
    });
  });

  describe("markEntriesAsRead", () => {
    it("正常系: 指定日数以上前の未読エントリを既読化できる", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.updateEntry.mockResolvedValue(undefined);

      // テスト実行 - 30日以上前のエントリを既読化
      await markEntriesAsRead(30);

      // 検証: エントリ3（30日前）とエントリ4（60日前）が既読化対象
      expect(mockChrome.readingList.updateEntry).toHaveBeenCalledTimes(2);
      expect(mockChrome.readingList.updateEntry).toHaveBeenCalledWith({
        url: "https://example.com/3",
        hasBeenRead: true,
      });
      expect(mockChrome.readingList.updateEntry).toHaveBeenCalledWith({
        url: "https://example.com/4",
        hasBeenRead: true,
      });
    });

    it("正常系: 既に既読化されているエントリは対象外", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.updateEntry.mockResolvedValue(undefined);

      // テスト実行 - 1日以上前のエントリを既読化
      await markEntriesAsRead(1);

      // 検証: 未読エントリのみが既読化対象
      expect(mockChrome.readingList.updateEntry).toHaveBeenCalledTimes(3);
    });

    it("正常系: 対象エントリがない場合", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);

      // テスト実行 - 90日以上前のエントリを既読化（該当なし）
      await markEntriesAsRead(90);

      // 検証
      expect(mockChrome.readingList.updateEntry).not.toHaveBeenCalled();
    });

    it("異常系: updateEntry呼び出し時のエラーハンドリング", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.updateEntry.mockRejectedValue(
        new Error("Update failed"),
      );

      // テスト実行 - エラーが発生しても処理を続行
      await expect(markEntriesAsRead(30)).resolves.not.toThrow();

      // 検証: 複数エントリに対して試行
      expect(mockChrome.readingList.updateEntry).toHaveBeenCalledTimes(2);
    });
  });

  describe("deleteOldEntries", () => {
    it("正常系: 指定日数以上前のエントリを削除できる", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.removeEntry.mockResolvedValue(undefined);

      // テスト実行 - 60日以上前のエントリを削除
      await deleteOldEntries(60);

      // 検証: エントリ4（60日前）のみが削除対象
      expect(mockChrome.readingList.removeEntry).toHaveBeenCalledTimes(1);
      expect(mockChrome.readingList.removeEntry).toHaveBeenCalledWith({
        url: "https://example.com/4",
      });
    });

    it("正常系: 複数のエントリを削除", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.removeEntry.mockResolvedValue(undefined);

      // テスト実行 - 30日以上前のエントリを削除
      await deleteOldEntries(30);

      // 検証: エントリ3とエントリ4が削除対象
      expect(mockChrome.readingList.removeEntry).toHaveBeenCalledTimes(2);
    });

    it("正常系: 対象エントリがない場合", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);

      // テスト実行 - 90日以上前のエントリを削除（該当なし）
      await deleteOldEntries(90);

      // 検証
      expect(mockChrome.readingList.removeEntry).not.toHaveBeenCalled();
    });

    it("異常系: removeEntry呼び出し時のエラーハンドリング", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.removeEntry.mockRejectedValue(
        new Error("Remove failed"),
      );

      // テスト実行 - エラーが発生しても処理を続行
      await expect(deleteOldEntries(60)).resolves.not.toThrow();

      // 検証
      expect(mockChrome.readingList.removeEntry).toHaveBeenCalledTimes(1);
    });
  });

  describe("processReadingList", () => {
    it("正常系: ストレージから取得した設定で処理実行", async () => {
      // モックの設定
      mockChrome.storage.local.get.mockResolvedValue({
        daysUntilRead: 20,
        daysUntilDelete: 50,
      });
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.updateEntry.mockResolvedValue(undefined);
      mockChrome.readingList.removeEntry.mockResolvedValue(undefined);

      // テスト実行
      await processReadingList();

      // 検証: ストレージから設定を取得
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith([
        "daysUntilRead",
        "daysUntilDelete",
      ]);
      expect(mockChrome.readingList.query).toHaveBeenCalledWith({});
    });

    it("正常系: デフォルト値が使用される（ストレージに設定がない場合）", async () => {
      // モックの設定
      mockChrome.storage.local.get.mockResolvedValue({});
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.updateEntry.mockResolvedValue(undefined);
      mockChrome.readingList.removeEntry.mockResolvedValue(undefined);

      // テスト実行
      await processReadingList();

      // 検証: デフォルト値（30日、60日）で処理
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith([
        "daysUntilRead",
        "daysUntilDelete",
      ]);
    });

    it("異常系: ストレージ取得時のエラーハンドリング", async () => {
      // モックの設定
      mockChrome.storage.local.get.mockRejectedValue(
        new Error("Storage error"),
      );

      // テスト実行と検証
      await expect(processReadingList()).rejects.toThrow("Storage error");
    });
  });

  describe("initializeExtension", () => {
    it("正常系: イベントリスナーが正しく設定される", () => {
      // テスト実行
      initializeExtension();

      // 検証
      expect(mockChrome.runtime.onStartup.addListener).toHaveBeenCalledTimes(1);
      expect(mockChrome.runtime.onInstalled.addListener).toHaveBeenCalledTimes(
        1,
      );
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);

      // リスナーが関数であることを確認
      const onStartupCallback =
        mockChrome.runtime.onStartup.addListener.mock.calls[0]?.[0];
      const onInstalledCallback =
        mockChrome.runtime.onInstalled.addListener.mock.calls[0]?.[0];
      const onMessageCallback =
        mockChrome.runtime.onMessage.addListener.mock.calls[0]?.[0];

      expect(typeof onStartupCallback).toBe("function");
      expect(typeof onInstalledCallback).toBe("function");
      expect(typeof onMessageCallback).toBe("function");
    });

    it("正常系: onMessage リスナーが processReadingList アクション処理", () => {
      // モックの設定
      mockChrome.storage.local.get.mockResolvedValue({
        daysUntilRead: 30,
        daysUntilDelete: 60,
      });
      mockChrome.readingList.query.mockResolvedValue([]);
      let messageCallback:
        | ((
            message: unknown,
            _sender: unknown,
            sendResponse: (response: unknown) => void,
          ) => boolean)
        | undefined;

      mockChrome.runtime.onMessage.addListener.mockImplementation(
        (callback) => {
          messageCallback = callback;
        },
      );

      // テスト実行
      initializeExtension();

      // メッセージハンドラーのテスト
      if (messageCallback) {
        const sendResponse = vi.fn();
        const result = messageCallback(
          { action: "processReadingList" },
          undefined,
          sendResponse,
        );

        expect(result).toBe(true); // 非同期応答を示すtrue
      }
    });
  });
});
