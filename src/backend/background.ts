// Chrome Extension Background Script for Reading List Management

/// <reference types="chrome" />

/**
 * Reading List エントリを取得する関数
 * @returns Promise<chrome.readingList.ReadingListEntry[]> リーディングリストのエントリ一覧
 */
async function getReadingListEntries(): Promise<
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
 * @returns Promise<Settings> ユーザー設定
 */
interface Settings {
  daysUntilRead: number;
  daysUntilDelete: number;
}

async function getSettings(): Promise<Settings> {
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
 * エントリの作成時刻から経過日数を計算する関数
 * @param creationTime エントリの作成時刻（ミリ秒）
 * @returns number 経過日数
 */
function calculateDaysSinceCreation(creationTime: number): number {
  const now = Date.now();
  const elapsedMilliseconds = now - creationTime;
  return Math.floor(elapsedMilliseconds / (1000 * 60 * 60 * 24));
}

/**
 * 既読化・削除対象を判定する関数
 * @param entries リーディングリストのエントリ一覧
 * @param settings ユーザー設定
 * @returns Object 既読化対象と削除対象のエントリを分類したオブジェクト
 */
interface ClassifiedEntries {
  toMarkRead: chrome.readingList.ReadingListEntry[];
  toDelete: chrome.readingList.ReadingListEntry[];
}

function classifyEntries(
  entries: chrome.readingList.ReadingListEntry[],
  settings: Settings,
): ClassifiedEntries {
  const toDelete: chrome.readingList.ReadingListEntry[] = [];
  const toMarkRead: chrome.readingList.ReadingListEntry[] = [];

  for (const entry of entries) {
    const daysSinceCreation = calculateDaysSinceCreation(entry.creationTime);

    // 削除対象の方を先にチェック（削除対象は既読化対象よりも優先度が高い）
    if (daysSinceCreation >= settings.daysUntilDelete) {
      toDelete.push(entry);
    } else if (
      daysSinceCreation >= settings.daysUntilRead &&
      !entry.hasBeenRead
    ) {
      toMarkRead.push(entry);
    }
  }

  return { toMarkRead, toDelete };
}

/**
 * エントリを既読化する関数
 * @param entry 既読化するエントリ
 * @returns Promise<void>
 */
async function markEntryAsRead(
  entry: chrome.readingList.ReadingListEntry,
): Promise<void> {
  try {
    console.debug(`エントリを既読化します: ${entry.title} (${entry.url})`);
    await chrome.readingList.updateEntry({
      url: entry.url,
      hasBeenRead: true,
    });
    console.debug(`エントリを既読化しました: ${entry.title}`);
  } catch (error) {
    console.error(`エントリの既読化に失敗しました: ${entry.title}`, error);
    throw error;
  }
}

/**
 * エントリを削除する関数
 * @param entry 削除するエントリ
 * @returns Promise<void>
 */
async function deleteEntry(
  entry: chrome.readingList.ReadingListEntry,
): Promise<void> {
  try {
    console.debug(`エントリを削除します: ${entry.title} (${entry.url})`);
    await chrome.readingList.removeEntry({ url: entry.url });
    console.debug(`エントリを削除しました: ${entry.title}`);
  } catch (error) {
    console.error(`エントリの削除に失敗しました: ${entry.title}`, error);
    throw error;
  }
}

/**
 * 既読化・削除処理を実行する関数
 * @returns Promise<void>
 */
async function processReadingListEntries(): Promise<void> {
  try {
    console.debug("リーディングリストの既読化・削除処理を開始します...");

    // 設定とエントリを取得
    const settings = await getSettings();
    const entries = await getReadingListEntries();

    // エントリを分類
    const classified = classifyEntries(entries, settings);

    // 削除処理を実行
    for (const entry of classified.toDelete) {
      await deleteEntry(entry);
    }

    // 既読化処理を実行
    for (const entry of classified.toMarkRead) {
      await markEntryAsRead(entry);
    }

    console.debug(
      `処理完了: ${classified.toMarkRead.length} 件を既読化、${classified.toDelete.length} 件を削除しました`,
    );
  } catch (error) {
    console.error("リーディングリストの既読化・削除処理に失敗しました:", error);
    throw error;
  }
}

/**
 * エクステンション起動時の初期化処理
 */
function initializeExtension(): void {
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

// エクスポート（テスト用）
export {
  getReadingListEntries,
  initializeExtension,
  getSettings,
  calculateDaysSinceCreation,
  classifyEntries,
  markEntryAsRead,
  deleteEntry,
  processReadingListEntries,
};
export type { Settings, ClassifiedEntries };
