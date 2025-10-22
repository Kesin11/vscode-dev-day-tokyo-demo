import { useEffect, useId, useState } from "react";
import { createRoot } from "react-dom/client";

interface Settings {
  daysUntilRead: number;
  daysUntilDelete: number;
}

export function OptionsPage(): React.ReactElement {
  const daysUntilReadId = useId();
  const daysUntilDeleteId = useId();

  const [settings, setSettings] = useState<Settings>({
    daysUntilRead: 30,
    daysUntilDelete: 60,
  });
  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // コンポーネント初期化時に設定を読み込む
  useEffect(() => {
    const initSettings = async (): Promise<void> => {
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
        setMessage("設定の読み込みに失敗しました");
      }
    };

    void initSettings();
  }, []);

  // 設定を保存する
  const saveSettings = async (): Promise<void> => {
    try {
      await chrome.storage.local.set({
        daysUntilRead: settings.daysUntilRead,
        daysUntilDelete: settings.daysUntilDelete,
      });

      setMessage("設定を保存しました");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("設定の保存に失敗しました:", error);
      setMessage("設定の保存に失敗しました");
    }
  };

  // 手動実行
  const handleManualProcess = async (): Promise<void> => {
    setIsProcessing(true);
    try {
      const response = await chrome.runtime.sendMessage({
        action: "processReadingList",
      });

      if (response.success) {
        setMessage("処理が完了しました");
      } else {
        setMessage(`エラー: ${response.message}`);
      }
    } catch (error) {
      console.error("処理実行中にエラーが発生しました:", error);
      setMessage(
        error instanceof Error ? error.message : "処理実行に失敗しました",
      );
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // 入力値の変更処理
  const handleSettingChange = (key: keyof Settings, value: number): void => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">
          Reading List Auto Summary
        </h1>

        {/* 設定フォーム */}
        <div className="space-y-4">
          {/* 既読化日数設定 */}
          <div>
            <label
              htmlFor={daysUntilReadId}
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              既読化までの日数
            </label>
            <input
              type="number"
              id={daysUntilReadId}
              min="1"
              value={settings.daysUntilRead}
              onChange={(e) =>
                handleSettingChange(
                  "daysUntilRead",
                  Number.parseInt(e.target.value, 10),
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              この日数以上前のエントリが自動的に既読化されます（デフォルト:
              30日）
            </p>
          </div>

          {/* 削除日数設定 */}
          <div>
            <label
              htmlFor={daysUntilDeleteId}
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              削除までの日数
            </label>
            <input
              type="number"
              id={daysUntilDeleteId}
              min="1"
              value={settings.daysUntilDelete}
              onChange={(e) =>
                handleSettingChange(
                  "daysUntilDelete",
                  Number.parseInt(e.target.value, 10),
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              この日数以上前のエントリが自動的に削除されます（デフォルト: 60日）
            </p>
          </div>
        </div>

        {/* ボタングループ */}
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={saveSettings}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            設定を保存
          </button>

          <button
            type="button"
            onClick={handleManualProcess}
            disabled={isProcessing}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            {isProcessing ? "処理中..." : "手動実行"}
          </button>
        </div>

        {/* メッセージ表示 */}
        {message && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default OptionsPage;

// DOM要素の取得とコンポーネントのマウント
const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<OptionsPage />);
}
