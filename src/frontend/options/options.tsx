/// <reference types="chrome" />

import { useCallback, useEffect, useId, useState } from "react";

export interface Settings {
  daysUntilRead: number;
  daysUntilDelete: number;
}

function OptionsPage(): React.ReactElement {
  const daysUntilReadId = useId();
  const daysUntilDeleteId = useId();

  const [settings, setSettings] = useState<Settings>({
    daysUntilRead: 30,
    daysUntilDelete: 60,
  });

  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async (): Promise<void> => {
    try {
      const result = await chrome.storage.local.get([
        "daysUntilRead",
        "daysUntilDelete",
      ]);

      setSettings({
        daysUntilRead: result.daysUntilRead ?? 30,
        daysUntilDelete: result.daysUntilDelete ?? 60,
      });
    } catch (error) {
      console.error("設定の読み込みに失敗しました:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // ページ読み込み時に設定を復元
    void loadSettings();
  }, [loadSettings]);

  async function handleSave(): Promise<void> {
    try {
      // 入力値の検証
      if (
        Number.isNaN(settings.daysUntilRead) ||
        Number.isNaN(settings.daysUntilDelete)
      ) {
        console.error("無効な入力値です");
        return;
      }

      await chrome.storage.local.set({
        daysUntilRead: settings.daysUntilRead,
        daysUntilDelete: settings.daysUntilDelete,
      });

      // 保存完了メッセージを表示
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("設定の保存に失敗しました:", error);
    }
  }

  if (loading) {
    return <div className="text-center p-8">読み込み中...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-8 font-sans">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">
        Reading List Auto Summary 設定
      </h1>

      <div className="space-y-6">
        {/* 既読化までの日数設定 */}
        <div className="border border-gray-300 rounded-lg p-6 bg-white shadow-sm">
          <label
            htmlFor={daysUntilReadId}
            className="block text-lg font-semibold text-gray-700 mb-2"
          >
            既読化までの日数
          </label>
          <p className="text-gray-600 text-sm mb-4">
            この日数を経過したエントリを既読化します（デフォルト: 30日）
          </p>
          <input
            id={daysUntilReadId}
            type="number"
            min="1"
            max="365"
            value={settings.daysUntilRead}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                daysUntilRead: Number.parseInt(e.target.value, 10),
              }))
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 削除までの日数設定 */}
        <div className="border border-gray-300 rounded-lg p-6 bg-white shadow-sm">
          <label
            htmlFor={daysUntilDeleteId}
            className="block text-lg font-semibold text-gray-700 mb-2"
          >
            削除までの日数
          </label>
          <p className="text-gray-600 text-sm mb-4">
            この日数を経過したエントリを削除します（デフォルト: 60日）
          </p>
          <input
            id={daysUntilDeleteId}
            type="number"
            min="1"
            max="365"
            value={settings.daysUntilDelete}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                daysUntilDelete: Number.parseInt(e.target.value, 10),
              }))
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 注意書き */}
        <div className="border border-orange-300 rounded-lg p-4 bg-orange-50">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">注意:</span>{" "}
            削除までの日数は、既読化までの日数より長く設定することをお勧めします。
          </p>
        </div>

        {/* 保存ボタン */}
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            type="button"
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
          >
            保存
          </button>
        </div>

        {/* 保存完了メッセージ */}
        {saved && (
          <div className="border border-green-300 rounded-lg p-4 bg-green-50">
            <p className="text-green-700 font-semibold">設定を保存しました</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default OptionsPage;
