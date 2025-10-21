import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateDaysSinceCreation,
  classifyEntries,
  deleteEntry,
  getReadingListEntries,
  getSettings,
  initializeExtension,
  markEntryAsRead,
  processReadingListEntries,
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
      expect(result).toHaveLength(2);
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

  describe("getSettings", () => {
    it("正常系: ストレージから設定を取得できる", async () => {
      // モックの設定
      mockChrome.storage.local.get.mockResolvedValue({
        daysUntilRead: 20,
        daysUntilDelete: 50,
      });

      // テスト実行
      const result = await getSettings();

      // 検証
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith([
        "daysUntilRead",
        "daysUntilDelete",
      ]);
      expect(result).toEqual({
        daysUntilRead: 20,
        daysUntilDelete: 50,
      });
    });

    it("正常系: ストレージにキーが無い場合は デフォルト値を返す", async () => {
      // モックの設定（空のオブジェクトを返す）
      mockChrome.storage.local.get.mockResolvedValue({});

      // テスト実行
      const result = await getSettings();

      // 検証
      expect(result).toEqual({
        daysUntilRead: 30,
        daysUntilDelete: 60,
      });
    });
  });

  describe("calculateDaysSinceCreation", () => {
    it("正常系: 1日前のタイムスタンプから1日が返される", () => {
      // テスト実行
      const oneDay = 24 * 60 * 60 * 1000;
      const creationTime = Date.now() - oneDay;
      const result = calculateDaysSinceCreation(creationTime);

      // 検証
      expect(result).toBe(1);
    });

    it("正常系: 30日前のタイムスタンプから30日が返される", () => {
      // テスト実行
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const creationTime = Date.now() - thirtyDays;
      const result = calculateDaysSinceCreation(creationTime);

      // 検証
      expect(result).toBe(30);
    });

    it("正常系: 現在時刻の場合は0が返される", () => {
      // テスト実行
      const result = calculateDaysSinceCreation(Date.now());

      // 検証
      expect(result).toBe(0);
    });
  });

  describe("classifyEntries", () => {
    it("正常系: 既読化・削除対象が正しく分類される", () => {
      // テスト用の設定
      const settings = {
        daysUntilRead: 10,
        daysUntilDelete: 20,
      };

      // テスト用のエントリ
      const entries: chrome.readingList.ReadingListEntry[] = [
        {
          title: "5日前のエントリ",
          url: "https://example.com/5days",
          hasBeenRead: false,
          creationTime: Date.now() - 5 * 24 * 60 * 60 * 1000,
          lastUpdateTime: Date.now(),
        },
        {
          title: "15日前の未読エントリ",
          url: "https://example.com/15days-unread",
          hasBeenRead: false,
          creationTime: Date.now() - 15 * 24 * 60 * 60 * 1000,
          lastUpdateTime: Date.now(),
        },
        {
          title: "15日前の既読エントリ",
          url: "https://example.com/15days-read",
          hasBeenRead: true,
          creationTime: Date.now() - 15 * 24 * 60 * 60 * 1000,
          lastUpdateTime: Date.now(),
        },
        {
          title: "25日前のエントリ",
          url: "https://example.com/25days",
          hasBeenRead: false,
          creationTime: Date.now() - 25 * 24 * 60 * 60 * 1000,
          lastUpdateTime: Date.now(),
        },
      ];

      // テスト実行
      const result = classifyEntries(entries, settings);

      // 検証
      expect(result.toMarkRead).toHaveLength(1);
      expect(result.toMarkRead[0]?.url).toBe(
        "https://example.com/15days-unread",
      );

      expect(result.toDelete).toHaveLength(1);
      expect(result.toDelete[0]?.url).toBe("https://example.com/25days");
    });

    it("正常系: 既読化対象が存在しない場合", () => {
      // テスト用の設定
      const settings = {
        daysUntilRead: 10,
        daysUntilDelete: 20,
      };

      // すべて既読のエントリ
      const entries: chrome.readingList.ReadingListEntry[] = [
        {
          title: "既読エントリ",
          url: "https://example.com/read",
          hasBeenRead: true,
          creationTime: Date.now() - 15 * 24 * 60 * 60 * 1000,
          lastUpdateTime: Date.now(),
        },
      ];

      // テスト実行
      const result = classifyEntries(entries, settings);

      // 検証
      expect(result.toMarkRead).toHaveLength(0);
      expect(result.toDelete).toHaveLength(0);
    });
  });

  describe("markEntryAsRead", () => {
    it("正常系: エントリが正常に既読化される", async () => {
      // モックの設定
      mockChrome.readingList.updateEntry.mockResolvedValue(undefined);

      // テスト対象のエントリ
      const entry: chrome.readingList.ReadingListEntry = {
        title: "テストエントリ",
        url: "https://example.com/test",
        hasBeenRead: false,
        creationTime: Date.now(),
        lastUpdateTime: Date.now(),
      };

      // テスト実行
      await markEntryAsRead(entry);

      // 検証
      expect(mockChrome.readingList.updateEntry).toHaveBeenCalledWith({
        url: "https://example.com/test",
        hasBeenRead: true,
      });
    });

    it("異常系: 既読化APIが失敗した場合にエラーをthrowする", async () => {
      // モックの設定
      const errorMessage = "既読化に失敗";
      mockChrome.readingList.updateEntry.mockRejectedValue(
        new Error(errorMessage),
      );

      // テスト対象のエントリ
      const entry: chrome.readingList.ReadingListEntry = {
        title: "テストエントリ",
        url: "https://example.com/test",
        hasBeenRead: false,
        creationTime: Date.now(),
        lastUpdateTime: Date.now(),
      };

      // テスト実行と検証
      await expect(markEntryAsRead(entry)).rejects.toThrow(errorMessage);
    });
  });

  describe("deleteEntry", () => {
    it("正常系: エントリが正常に削除される", async () => {
      // モックの設定
      mockChrome.readingList.removeEntry.mockResolvedValue(undefined);

      // テスト対象のエントリ
      const entry: chrome.readingList.ReadingListEntry = {
        title: "テストエントリ",
        url: "https://example.com/test",
        hasBeenRead: false,
        creationTime: Date.now(),
        lastUpdateTime: Date.now(),
      };

      // テスト実行
      await deleteEntry(entry);

      // 検証
      expect(mockChrome.readingList.removeEntry).toHaveBeenCalledWith({
        url: "https://example.com/test",
      });
    });

    it("異常系: 削除APIが失敗した場合にエラーをthrowする", async () => {
      // モックの設定
      const errorMessage = "削除に失敗";
      mockChrome.readingList.removeEntry.mockRejectedValue(
        new Error(errorMessage),
      );

      // テスト対象のエントリ
      const entry: chrome.readingList.ReadingListEntry = {
        title: "テストエントリ",
        url: "https://example.com/test",
        hasBeenRead: false,
        creationTime: Date.now(),
        lastUpdateTime: Date.now(),
      };

      // テスト実行と検証
      await expect(deleteEntry(entry)).rejects.toThrow(errorMessage);
    });
  });

  describe("processReadingListEntries", () => {
    it("正常系: 既読化・削除処理が正常に実行される", async () => {
      // モックの設定
      mockChrome.storage.local.get.mockResolvedValue({
        daysUntilRead: 10,
        daysUntilDelete: 20,
      });

      const entries: chrome.readingList.ReadingListEntry[] = [
        {
          title: "既読化対象",
          url: "https://example.com/mark-read",
          hasBeenRead: false,
          creationTime: Date.now() - 15 * 24 * 60 * 60 * 1000,
          lastUpdateTime: Date.now(),
        },
        {
          title: "削除対象",
          url: "https://example.com/delete",
          hasBeenRead: false,
          creationTime: Date.now() - 25 * 24 * 60 * 60 * 1000,
          lastUpdateTime: Date.now(),
        },
      ];

      mockChrome.readingList.query.mockResolvedValue(entries);
      mockChrome.readingList.updateEntry.mockResolvedValue(undefined);
      mockChrome.readingList.removeEntry.mockResolvedValue(undefined);

      // テスト実行
      await processReadingListEntries();

      // 検証
      expect(mockChrome.readingList.removeEntry).toHaveBeenCalledWith({
        url: "https://example.com/delete",
      });
      expect(mockChrome.readingList.updateEntry).toHaveBeenCalledWith({
        url: "https://example.com/mark-read",
        hasBeenRead: true,
      });
    });

    it("異常系: エントリ取得がエラーの場合", async () => {
      // モックの設定
      mockChrome.storage.local.get.mockResolvedValue({
        daysUntilRead: 10,
        daysUntilDelete: 20,
      });

      const errorMessage = "エントリ取得エラー";
      mockChrome.readingList.query.mockRejectedValue(new Error(errorMessage));

      // テスト実行と検証
      await expect(processReadingListEntries()).rejects.toThrow(errorMessage);
    });
  });
});
