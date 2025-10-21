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
 * ストレージから設定を取得する関数
 */
export async function getStorageSettings(): Promise<{
  daysUntilRead: number;
  daysUntilDelete: number;
}> {
  try {
    const result = await chrome.storage.local.get([
      "daysUntilRead",
      "daysUntilDelete",
    ]);

    return {
      daysUntilRead: result.daysUntilRead ?? 30,
      daysUntilDelete: result.daysUntilDelete ?? 60,
    };
  } catch (error) {
    console.error("ストレージ設定の取得に失敗しました:", error);
    throw error;
  }
}

/**
 * 指定日数以上のエントリを既読化する関数
 */
export async function markReadingListEntriesAsRead(
  daysThreshold: number,
): Promise<void> {
  try {
    console.debug(`${daysThreshold}日以上前のエントリを既読化します`);

    const entries = await getReadingListEntries();
    const now = Date.now();
    const thresholdTime = now - daysThreshold * 24 * 60 * 60 * 1000;

    for (const entry of entries) {
      if (!entry.hasBeenRead && entry.creationTime < thresholdTime) {
        try {
          await chrome.readingList.updateEntry({
            url: entry.url,
            hasBeenRead: true,
          });
          console.debug(`既読化しました: ${entry.title}`);
        } catch (error) {
          console.error(`既読化に失敗しました (${entry.title}):`, error);
        }
      }
    }

    console.debug("既読化処理が完了しました");
  } catch (error) {
    console.error("既読化処理中にエラーが発生しました:", error);
    throw error;
  }
}

/**
 * 指定日数以上のエントリを削除する関数
 */
export async function deleteReadingListEntries(
  daysThreshold: number,
): Promise<void> {
  try {
    console.debug(`${daysThreshold}日以上前のエントリを削除します`);

    const entries = await getReadingListEntries();
    const now = Date.now();
    const thresholdTime = now - daysThreshold * 24 * 60 * 60 * 1000;

    for (const entry of entries) {
      if (entry.creationTime < thresholdTime) {
        try {
          await chrome.readingList.removeEntry({
            url: entry.url,
          });
          console.debug(`削除しました: ${entry.title}`);
        } catch (error) {
          console.error(`削除に失敗しました (${entry.title}):`, error);
        }
      }
    }

    console.debug("削除処理が完了しました");
  } catch (error) {
    console.error("削除処理中にエラーが発生しました:", error);
    throw error;
  }
}

/**
 * リーディングリストをエントリの年代に基づいて処理する関数
 * 設定に従って既読化・削除を実行
 */
export async function processReadingListByAge(): Promise<void> {
  try {
    console.debug("リーディングリストの年代に基づく処理を開始します");

    const settings = await getStorageSettings();

    // 既読化処理を実行
    await markReadingListEntriesAsRead(settings.daysUntilRead);

    // 削除処理を実行
    await deleteReadingListEntries(settings.daysUntilDelete);

    console.debug("リーディングリストの処理が完了しました");
  } catch (error) {
    console.error("リーディングリスト処理中にエラーが発生しました:", error);
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
      await processReadingListByAge();
    } catch (error) {
      console.error("初期化時のエントリ処理でエラーが発生しました:", error);
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
