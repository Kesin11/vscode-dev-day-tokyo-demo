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
 * 指定日数以上経過したエントリを既読化する関数
 * @param daysThreshold 日数閾値
 * @param maxRetries 最大リトライ回数
 */
export async function markAsReadIfOlder(
  daysThreshold: number,
  maxRetries = 3,
): Promise<number> {
  const entries = await getReadingListEntries();
  const now = Date.now();
  const thresholdTime = daysThreshold * 24 * 60 * 60 * 1000;

  const entriesToMarkAsRead = entries.filter((entry) => {
    const ageTime = now - entry.creationTime;
    return !entry.hasBeenRead && ageTime >= thresholdTime;
  });

  console.debug(`${entriesToMarkAsRead.length} 件のエントリを既読化します`);

  let successCount = 0;
  for (const entry of entriesToMarkAsRead) {
    let retryCount = 0;
    while (retryCount < maxRetries) {
      try {
        await chrome.readingList.updateEntry({
          url: entry.url,
          hasBeenRead: true,
        });
        console.debug(`既読化完了: ${entry.title}`);
        successCount++;
        break;
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          console.error(
            `既読化失敗 (${maxRetries}回リトライ後): ${entry.title}`,
            error,
          );
        } else {
          // 指数バックオフ: 1秒, 2秒, 4秒
          const waitTime = 2 ** (retryCount - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }
  }

  return successCount;
}

/**
 * 指定日数以上経過したエントリを削除する関数
 * @param daysThreshold 日数閾値
 * @param maxRetries 最大リトライ回数
 */
export async function deleteIfOlder(
  daysThreshold: number,
  maxRetries = 3,
): Promise<number> {
  const entries = await getReadingListEntries();
  const now = Date.now();
  const thresholdTime = daysThreshold * 24 * 60 * 60 * 1000;

  const entriesToDelete = entries.filter((entry) => {
    const ageTime = now - entry.creationTime;
    return ageTime >= thresholdTime;
  });

  console.debug(`${entriesToDelete.length} 件のエントリを削除します`);

  let successCount = 0;
  for (const entry of entriesToDelete) {
    let retryCount = 0;
    while (retryCount < maxRetries) {
      try {
        await chrome.readingList.removeEntry({ url: entry.url });
        console.debug(`削除完了: ${entry.title}`);
        successCount++;
        break;
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          console.error(
            `削除失敗 (${maxRetries}回リトライ後): ${entry.title}`,
            error,
          );
        } else {
          // 指数バックオフ: 1秒, 2秒, 4秒
          const waitTime = 2 ** (retryCount - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }
  }

  return successCount;
}

/**
 * リーディングリストを処理する関数
 * 設定に基づいて既読化・削除を実行
 */
export async function processReadingList(): Promise<void> {
  console.debug("リーディングリスト処理を開始します");

  try {
    const settings = await getSettings();
    console.debug(
      `設定: 既読化=${settings.daysUntilRead}日, 削除=${settings.daysUntilDelete}日`,
    );

    // 既読化処理
    const readCount = await markAsReadIfOlder(settings.daysUntilRead);
    console.debug(`${readCount} 件を既読化しました`);

    // 削除処理
    const deleteCount = await deleteIfOlder(settings.daysUntilDelete);
    console.debug(`${deleteCount} 件を削除しました`);

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
      await processReadingList();
    } catch (error) {
      console.error("インストール時の処理でエラーが発生しました:", error);
    }
  });
}

// Chrome Extension環境でのみ初期化処理を実行
if (typeof chrome !== "undefined" && chrome.runtime) {
  initializeExtension();
}
