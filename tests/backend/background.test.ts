import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteIfOlder,
  getReadingListEntries,
  initializeExtension,
  markAsReadIfOlder,
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
    lastUpdateTime: Date.now() - 2592000000,
  },
  {
    title: "テストエントリ4",
    url: "https://example.com/4",
    hasBeenRead: false,
    creationTime: Date.now() - 5184000000, // 60日前
    lastUpdateTime: Date.now() - 5184000000,
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

  describe("markAsReadIfOlder", () => {
    it("正常系: 指定日数以上経過した未読エントリを既読化できる", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.updateEntry.mockResolvedValue(undefined);

      // テスト実行
      const result = await markAsReadIfOlder(30);

      // 検証
      expect(result).toBe(2); // エントリ3（30日）とエントリ4（60日）が対象
      expect(mockChrome.readingList.updateEntry).toHaveBeenCalledTimes(2);
      expect(mockChrome.readingList.updateEntry).toHaveBeenCalledWith({
        url: "https://example.com/3",
        hasBeenRead: true,
      });
    });

    it("正常系: 既読エントリはスキップされる", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.updateEntry.mockResolvedValue(undefined);

      // テスト実行
      const result = await markAsReadIfOlder(1);

      // 検証
      expect(result).toBe(3); // エントリ1, 3, 4が対象（1日以上経過）、エントリ2は既読のためスキップ
      expect(mockChrome.readingList.updateEntry).toHaveBeenCalledTimes(3);
    });

    it("正常系: 対象エントリがない場合は0を返す", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.updateEntry.mockResolvedValue(undefined);

      // テスト実行
      const result = await markAsReadIfOlder(100);

      // 検証
      expect(result).toBe(0);
      expect(mockChrome.readingList.updateEntry).not.toHaveBeenCalled();
    });

    it("異常系: APIエラーが発生した場合、リトライして失敗する", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue([sampleEntries[3]]);
      mockChrome.readingList.updateEntry.mockRejectedValue(
        new Error("API エラー"),
      );

      // テスト実行
      const result = await markAsReadIfOlder(30, 2);

      // 検証: リトライされるが失敗数をカウント
      expect(result).toBe(0);
      expect(mockChrome.readingList.updateEntry).toHaveBeenCalledTimes(2); // 最大リトライ数
    });
  });

  describe("deleteIfOlder", () => {
    it("正常系: 指定日数以上経過したエントリを削除できる", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.removeEntry.mockResolvedValue(undefined);

      // テスト実行
      const result = await deleteIfOlder(60);

      // 検証
      expect(result).toBe(1); // エントリ4（60日）のみが対象
      expect(mockChrome.readingList.removeEntry).toHaveBeenCalledTimes(1);
      expect(mockChrome.readingList.removeEntry).toHaveBeenCalledWith({
        url: "https://example.com/4",
      });
    });

    it("正常系: 対象エントリがない場合は0を返す", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.readingList.removeEntry.mockResolvedValue(undefined);

      // テスト実行
      const result = await deleteIfOlder(100);

      // 検証
      expect(result).toBe(0);
      expect(mockChrome.readingList.removeEntry).not.toHaveBeenCalled();
    });

    it("異常系: APIエラーが発生した場合、リトライして失敗する", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue([sampleEntries[3]]);
      mockChrome.readingList.removeEntry.mockRejectedValue(
        new Error("API エラー"),
      );

      // テスト実行
      const result = await deleteIfOlder(60, 2);

      // 検証: リトライされるが失敗
      expect(result).toBe(0);
      expect(mockChrome.readingList.removeEntry).toHaveBeenCalledTimes(2); // 最大リトライ数
    });
  });

  describe("processReadingList", () => {
    it("正常系: 設定に基づいて既読化・削除処理を実行できる", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue(sampleEntries);
      mockChrome.storage.local.get.mockResolvedValue({
        daysUntilRead: 30,
        daysUntilDelete: 60,
      });
      mockChrome.readingList.updateEntry.mockResolvedValue(undefined);
      mockChrome.readingList.removeEntry.mockResolvedValue(undefined);

      // テスト実行
      await processReadingList();

      // 検証
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith([
        "daysUntilRead",
        "daysUntilDelete",
      ]);
      expect(mockChrome.readingList.query).toHaveBeenCalled();
      expect(mockChrome.readingList.updateEntry).toHaveBeenCalled();
      expect(mockChrome.readingList.removeEntry).toHaveBeenCalled();
    });

    it("正常系: デフォルト設定を使用できる", async () => {
      // モックの設定
      mockChrome.readingList.query.mockResolvedValue([]);
      mockChrome.storage.local.get.mockResolvedValue({}); // デフォルト値を使用

      // テスト実行
      await processReadingList();

      // 検証
      expect(mockChrome.storage.local.get).toHaveBeenCalled();
      expect(mockChrome.readingList.query).toHaveBeenCalled();
    });

    it("異常系: ストレージアクセスエラーをthrowする", async () => {
      // モックの設定
      mockChrome.storage.local.get.mockRejectedValue(
        new Error("ストレージエラー"),
      );

      // テスト実行と検証
      await expect(processReadingList()).rejects.toThrow("ストレージエラー");
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
