import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

interface Settings {
  daysUntilRead: number;
  daysUntilDelete: number;
}

const OPTIONS_STORAGE_KEYS = ["daysUntilRead", "daysUntilDelete"] as const;

function OptionsPage() {
  const [settings, setSettings] = useState<Settings>({
    daysUntilRead: 30,
    daysUntilDelete: 60,
  });

  const [saved, setSaved] = useState(false);

  // コンポーネントマウント時に設定を読み込む
  useEffect(() => {
    const loadSettings = async () => {
      const result = await chrome.storage.local.get(OPTIONS_STORAGE_KEYS);
      setSettings({
        daysUntilRead: result.daysUntilRead ?? 30,
        daysUntilDelete: result.daysUntilDelete ?? 60,
      });
    };

    loadSettings();
  }, []);

  // 設定が変更されたらsavedフラグをリセット
  useEffect(() => {
    setSaved(false);
  }, [settings]);

  const handleDaysUntilReadChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = Number.parseInt(event.target.value, 10);
    setSettings((prev) => ({
      ...prev,
      daysUntilRead: value,
    }));
  };

  const handleDaysUntilDeleteChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = Number.parseInt(event.target.value, 10);
    setSettings((prev) => ({
      ...prev,
      daysUntilDelete: value,
    }));
  };

  const handleSave = async () => {
    try {
      await chrome.storage.local.set(settings);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
      }, 2000);
    } catch (error) {
      console.error("設定の保存に失敗しました:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6">Reading List Auto Summary</h1>

        <div className="space-y-4">
          <div>
            <label htmlFor="daysUntilRead" className="block font-medium mb-2">
              既読化までの日数
            </label>
            <input
              id="daysUntilRead"
              type="number"
              min="1"
              max="365"
              value={settings.daysUntilRead}
              onChange={handleDaysUntilReadChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              {settings.daysUntilRead}日以上経過したエントリを既読化します
            </p>
          </div>

          <div>
            <label
              htmlFor="daysUntilDelete"
              className="block font-medium mb-2"
            >
              削除までの日数
            </label>
            <input
              id="daysUntilDelete"
              type="number"
              min="1"
              max="365"
              value={settings.daysUntilDelete}
              onChange={handleDaysUntilDeleteChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              {settings.daysUntilDelete}
              日以上経過したエントリを削除します
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full mt-6 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          保存
        </button>

        {saved && (
          <p className="text-green-600 text-center mt-3">
            設定を保存しました
          </p>
        )}
      </div>
    </div>
  );
}

// React 18のrenderAPI
const root = ReactDOM.createRoot(
  document.getElementById("root") ?? document.body,
);
root.render(<OptionsPage />);
