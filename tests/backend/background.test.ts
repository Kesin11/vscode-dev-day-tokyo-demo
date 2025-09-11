import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getReadingListEntries,
  initializeExtension,
} from "../../src/backend/background";

// Chrome API のモック
const mockChrome = {
  readingList: {
    query: vi.fn(),
  },
  runtime: {
    onStartup: {
      addListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
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
});
