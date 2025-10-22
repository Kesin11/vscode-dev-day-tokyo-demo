// Chrome Extension Background Script for Reading List Management

/**
 * Reading List エントリを取得する関数
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
 * ストレージから設定を取得する
 */
async function getSettings(): Promise<{
  daysUntilRead: number;
  daysUntilDelete: number;
}> {
  const result = await chrome.storage.local.get([
    "daysUntilRead",
    "daysUntilDelete",
  ]);

  return {
    daysUntilRead: result.daysUntilRead ?? 30,
    daysUntilDelete: result.daysUntilDelete ?? 60,
  };
}

/**
 * 指定日数以上前のエントリを既読化する
 * @param daysUntilRead - 既読化までの日数
 */
export async function markEntriesAsRead(daysUntilRead: number): Promise<void> {
  try {
    console.debug(`${daysUntilRead}日以上前のエントリを既読化します`);

    const entries = await getReadingListEntries();
    const now = Date.now();
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const thresholdTime = now - daysUntilRead * millisecondsPerDay;

    const entriesToMarkAsRead = entries.filter((entry) => {
      return !entry.hasBeenRead && entry.creationTime < thresholdTime;
    });

    console.debug(`既読化対象: ${entriesToMarkAsRead.length} 件`);

    for (const entry of entriesToMarkAsRead) {
      try {
        await chrome.readingList.updateEntry({
          url: entry.url,
          hasBeenRead: true,
        });
        console.debug(`既読化しました: ${entry.title}`);
      } catch (error) {
        console.error(`エントリの既読化に失敗しました: ${entry.title}`, error);
      }
    }
  } catch (error) {
    console.error("既読化処理でエラーが発生しました:", error);
    throw error;
  }
}

/**
 * 指定日数以上前のエントリを削除する
 * @param daysUntilDelete - 削除までの日数
 */
export async function deleteOldEntries(daysUntilDelete: number): Promise<void> {
  try {
    console.debug(`${daysUntilDelete}日以上前のエントリを削除します`);

    const entries = await getReadingListEntries();
    const now = Date.now();
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const thresholdTime = now - daysUntilDelete * millisecondsPerDay;

    const entriesToDelete = entries.filter((entry) => {
      return entry.creationTime < thresholdTime;
    });

    console.debug(`削除対象: ${entriesToDelete.length} 件`);

    for (const entry of entriesToDelete) {
      try {
        await chrome.readingList.removeEntry({
          url: entry.url,
        });
        console.debug(`削除しました: ${entry.title}`);
      } catch (error) {
        console.error(`エントリの削除に失敗しました: ${entry.title}`, error);
      }
    }
  } catch (error) {
    console.error("削除処理でエラーが発生しました:", error);
    throw error;
  }
}

/**
 * ストレージから設定を取得して、既読化・削除処理を実行する
 */
export async function processReadingList(): Promise<void> {
  try {
    console.debug("リーディングリスト処理を開始します");

    const settings = await getSettings();
    await markEntriesAsRead(settings.daysUntilRead);
    await deleteOldEntries(settings.daysUntilDelete);

    console.debug("リーディングリスト処理が完了しました");
  } catch (error) {
    console.error("リーディングリスト処理でエラーが発生しました:", error);
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
      await processReadingList();
    } catch (error) {
      console.error("初期化時の処理でエラーが発生しました:", error);
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

  /**
   * オプションページからのメッセージハンドラー
   */
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "processReadingList") {
      processReadingList()
        .then(() => {
          sendResponse({ success: true, message: "処理が完了しました" });
        })
        .catch((error) => {
          sendResponse({
            success: false,
            message: error instanceof Error ? error.message : "不明なエラー",
          });
        });
      return true; // 非同期応答を示す
    }
  });
}

// Chrome Extension環境でのみ初期化処理を実行
if (typeof chrome !== "undefined" && chrome.runtime) {
  initializeExtension();
}
