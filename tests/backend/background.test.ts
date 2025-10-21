import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteReadingListEntries,
  getReadingListEntries,
  getStorageSettings,
  initializeExtension,
  markReadingListEntriesAsRead,
  processReadingListByAge,
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
const now = Date.now();
const sampleEntries: chrome.readingList.ReadingListEntry[] = [
  {
    title: "テストエントリ1",
    url: "https://example.com/1",
    hasBeenRead: false,
    creationTime: now - 1 * 24 * 60 * 60 * 1000, // 1日前
    lastUpdateTime: now - 3600000, // 1時間前
  },
  {
    title: "テストエントリ2",
    url: "https://example.com/2",
    hasBeenRead: true,
    creationTime: now - 2 * 24 * 60 * 60 * 1000, // 2日前
    lastUpdateTime: now - 7200000, // 2時間前
  },
  {
    title: "テストエントリ3",
    url: "https://example.com/3",
    hasBeenRead: false,
    creationTime: now - 35 * 24 * 60 * 60 * 1000, // 35日前
    lastUpdateTime: now - 86400000, // 1日前
  },
  {
    title: "テストエントリ4",
    url: "https://example.com/4",
    hasBeenRead: false,
    creationTime: now - 65 * 24 * 60 * 60 * 1000, // 65日前
    lastUpdateTime: now - 172800000, // 2日前
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

  describe("getStorageSettings", () => {
    it("正常系: ストレージから設定を取得できる", async () => {
      // モックの設定
      mockChrome.storage.local.get.mockResolvedValue({
        daysUntilRead: 25,
        daysUntilDelete: 55,
      });

      // テスト実行
      const result = await getStorageSettings();

      // 検証
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith([
        "daysUntilRead",
        "daysUntilDelete",
      ]);
      expect(result).toEqual({
        daysUntilRead: 25,
        daysUntilDelete: 55,
      });
    });

    it("正常系: 設定が存在しない場合はデフォルト値を返す", async () => {
      // モックの設定
      mockChrome.storage.local.get.mockResolvedValue({});

      // テスト実行
      const result = await getStorageSettings();

      // 検証
      expect(result).toEqual({
        daysUntilRead: 30,
        daysUntilDelete: 60,
      });
    });

    it("異常系: ストレージアクセスに失敗した場合にエラーをthrowする", async () => {
      // モックの設定
      const errorMessage = "Storage access error";
      mockChrome.storage.local.get.mockRejectedValue(new Error(errorMessage));

      // テスト実行と検証
      await expect(getStorageSettings()).rejects.toThrow(errorMessage);
    });
  });

  describe("markReadingListEntriesAsRead", () => {
    it("正常系: 指定日数以上のエントリを既読化できる", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.updateEntry.mockResolvedValue(undefined);

      // テスト実行: 30日以上のエントリを既読化
      await markReadingListEntriesAsRead(30);

      // 検証: 35日前と65日前のエントリが既読化される (未読のみ)
      // sampleEntries[2]は35日前で未読
      expect(mockChrome.readingList.updateEntry).toHaveBeenCalledWith({
        url: "https://example.com/3",
        hasBeenRead: true,
      });
      // sampleEntries[3]は65日前で未読
      expect(mockChrome.readingList.updateEntry).toHaveBeenCalledWith({
        url: "https://example.com/4",
        hasBeenRead: true,
      });
      expect(mockChrome.readingList.updateEntry).toHaveBeenCalledTimes(2);
    });

    it("正常系: 既読済みのエントリは既読化対象外", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.updateEntry.mockResolvedValue(undefined);

      // テスト実行: 1日以上のエントリを既読化
      await markReadingListEntriesAsRead(1);

      // 検証: 既読済みのエントリ(sampleEntries[1])は呼ばれない
      expect(mockChrome.readingList.updateEntry).toHaveBeenCalledTimes(3);
      expect(mockChrome.readingList.updateEntry).not.toHaveBeenCalledWith({
        url: "https://example.com/2",
        hasBeenRead: true,
      });
    });

    it("正常系: 条件に合わないエントリは既読化されない", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.updateEntry.mockResolvedValue(undefined);

      // テスト実行: 100日以上のエントリを既読化
      await markReadingListEntriesAsRead(100);

      // 検証: 呼ばれない
      expect(mockChrome.readingList.updateEntry).not.toHaveBeenCalled();
    });

    it("異常系: updateEntry API呼び出しが失敗しても他のエントリは処理される", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.updateEntry
        .mockRejectedValueOnce(new Error("Update error"))
        .mockResolvedValueOnce(undefined);

      // テスト実行: エラーハンドリング後も処理が続行される
      await expect(markReadingListEntriesAsRead(30)).resolves.not.toThrow();

      // 検証: 複数回呼ばれる
      expect(mockChrome.readingList.updateEntry).toHaveBeenCalled();
    });
  });

  describe("deleteReadingListEntries", () => {
    it("正常系: 指定日数以上のエントリを削除できる", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.removeEntry.mockResolvedValue(undefined);

      // テスト実行: 60日以上のエントリを削除
      await deleteReadingListEntries(60);

      // 検証: 65日前のエントリが削除される
      expect(mockChrome.readingList.removeEntry).toHaveBeenCalledWith({
        url: "https://example.com/4",
      });
      expect(mockChrome.readingList.removeEntry).toHaveBeenCalledTimes(1);
    });

    it("正常系: 条件に合わないエントリは削除されない", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.removeEntry.mockResolvedValue(undefined);

      // テスト実行: 100日以上のエントリを削除
      await deleteReadingListEntries(100);

      // 検証: 呼ばれない
      expect(mockChrome.readingList.removeEntry).not.toHaveBeenCalled();
    });

    it("異常系: removeEntry API呼び出しが失敗しても他のエントリは処理される", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.removeEntry
        .mockRejectedValueOnce(new Error("Remove error"))
        .mockResolvedValueOnce(undefined);

      // テスト実行: エラーハンドリング後も処理が続行される
      await expect(deleteReadingListEntries(30)).resolves.not.toThrow();

      // 検証: 複数回呼ばれる
      expect(mockChrome.readingList.removeEntry).toHaveBeenCalled();
    });
  });

  describe("processReadingListByAge", () => {
    it("正常系: 設定に基づいて既読化・削除処理が実行される", async () => {
      // モックの設定
      mockChrome.storage.local.get.mockResolvedValue({
        daysUntilRead: 30,
        daysUntilDelete: 60,
      });
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.updateEntry.mockResolvedValue(undefined);
      mockChrome.readingList.removeEntry.mockResolvedValue(undefined);

      // テスト実行
      await processReadingListByAge();

      // 検証: query, updateEntry, removeEntry が呼ばれる
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith([
        "daysUntilRead",
        "daysUntilDelete",
      ]);
      expect(mockChrome.readingList.query).toHaveBeenCalledWith({});
      expect(mockChrome.readingList.updateEntry).toHaveBeenCalled();
      expect(mockChrome.readingList.removeEntry).toHaveBeenCalled();
    });

    it("正常系: デフォルト設定で処理が実行される", async () => {
      // モックの設定
      mockChrome.storage.local.get.mockResolvedValue({});
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.updateEntry.mockResolvedValue(undefined);
      mockChrome.readingList.removeEntry.mockResolvedValue(undefined);

      // テスト実行
      await processReadingListByAge();

      // 検証
      expect(mockChrome.readingList.query).toHaveBeenCalledWith({});
    });

    it("異常系: ストレージ取得に失敗した場合エラーをthrowする", async () => {
      // モックの設定
      mockChrome.storage.local.get.mockRejectedValue(
        new Error("Storage error"),
      );

      // テスト実行と検証
      await expect(processReadingListByAge()).rejects.toThrow("Storage error");
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

      // リスナーが関数であることを確認
      const onStartupCallback =
        mockChrome.runtime.onStartup.addListener.mock.calls[0]?.[0];
      const onInstalledCallback =
        mockChrome.runtime.onInstalled.addListener.mock.calls[0]?.[0];

      expect(typeof onStartupCallback).toBe("function");
      expect(typeof onInstalledCallback).toBe("function");
    });
  });
});
