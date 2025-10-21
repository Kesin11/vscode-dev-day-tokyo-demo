// Chrome Extension Background Script for Reading List Management

/// <reference types="chrome" />

/**
 * Reading List エントリを取得する関数
 * @returns Promise<chrome.readingList.ReadingListEntry[]> リーディングリストのエントリ一覧
 */
export async function getReadingListEntries(): Promise<
  chrome.readingList.ReadingListEntry[]
> {
  try {
    console.debug("リーディングリストエントリの取得を開始します...");

    // Chrome Reading List API を使用してエントリを取得
    const entries = await chrome.readingList.query({});

    console.debug(
      `リーディングリストから ${entries.length} 件のエントリを取得しました`,
    );

    // 各エントリの詳細をテーブル形式でログ出力
    console.table(
      entries.map((entry: chrome.readingList.ReadingListEntry) => ({
        title: entry.title,
        url: entry.url,
        hasBeenRead: entry.hasBeenRead,
        creationTime: new Date(entry.creationTime).toISOString(),
        lastUpdateTime: new Date(entry.lastUpdateTime).toISOString(),
      })),
    );

    return entries;
  } catch (error) {
    console.error("リーディングリストエントリの取得に失敗しました:", error);
    throw error;
  }
}

/**
 * エクステンション起動時の初期化処理
 */
export function initializeExtension(): void {
  chrome.runtime.onStartup.addListener(async () => {
    console.debug("Reading List Auto Summary エクステンションが起動しました");
    try {
      await getReadingListEntries();
    } catch (error) {
      console.error("初期化時のエントリ取得でエラーが発生しました:", error);
    }
  });

  /**
   * エクステンションインストール時の処理
   */
  chrome.runtime.onInstalled.addListener(async () => {
    console.debug(
      "Reading List Auto Summary エクステンションがインストールされました",
    );
    try {
      await getReadingListEntries();
    } catch (error) {
      console.error(
        "インストール時のエントリ取得でエラーが発生しました:",
        error,
      );
    }
  });
}

// Chrome Extension環境でのみ初期化処理を実行
if (typeof chrome !== "undefined" && chrome.runtime) {
  initializeExtension();
}
