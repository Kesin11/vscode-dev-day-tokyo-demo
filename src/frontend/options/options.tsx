import type React from "react";
import { useCallback, useEffect, useId, useState } from "react";

interface Settings {
  daysUntilRead: number;
  daysUntilDelete: number;
}

interface SaveMessage {
  text: string;
  type: "success" | "error";
}

/**
 * オプションページのメインコンポーネント
 */
export function OptionsPage(): React.ReactElement {
  const readInputId = useId();
  const deleteInputId = useId();
  const [settings, setSettings] = useState<Settings>({
    daysUntilRead: 30,
    daysUntilDelete: 60,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null);

  /**
   * storage.localから設定を読み込む関数
   */
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
    }
  }, []);

  // コンポーネントマウント時に設定を読み込む
  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  /**
   * 設定を保存する関数
   */
  const saveSettings = async (): Promise<void> => {
    // NaN チェック
    if (
      Number.isNaN(settings.daysUntilRead) ||
      Number.isNaN(settings.daysUntilDelete)
    ) {
      setSaveMessage({
        text: "エラー: 日数には1から365の数値を入力してください。",
        type: "error",
      });
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    setIsSaving(true);

    try {
      await chrome.storage.local.set({
        daysUntilRead: settings.daysUntilRead,
        daysUntilDelete: settings.daysUntilDelete,
      });

      setSaveMessage({ text: "設定を保存しました", type: "success" });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error("設定の保存に失敗しました:", error);
      setSaveMessage({
        text: "設定の保存に失敗しました",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 入力値が変更された時のハンドラ
   */
  const handleChangeSettings = (key: keyof Settings, value: number): void => {
    setSettings((prev) => ({
      ...prev,
      [key]: Math.max(1, Math.min(365, value)), // 1〜365日の範囲に制限
    }));
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Reading List Auto Summary 設定</h1>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>リーディングリスト管理設定</h2>

        <div style={styles.settingItem}>
          <label style={styles.label} htmlFor={readInputId}>
            既読化までの日数 (デフォルト: 30日)
          </label>
          <div style={styles.inputGroup}>
            <input
              id={readInputId}
              type="number"
              min="1"
              max="365"
              value={settings.daysUntilRead}
              onChange={(e) =>
                handleChangeSettings(
                  "daysUntilRead",
                  Number.parseInt(e.target.value, 10),
                )
              }
              style={styles.input}
            />
            <span style={styles.unit}>日</span>
          </div>
          <p style={styles.description}>
            この日数以上前に追加されたエントリを既読化します。
          </p>
        </div>

        <div style={styles.settingItem}>
          <label style={styles.label} htmlFor={deleteInputId}>
            削除までの日数 (デフォルト: 60日)
          </label>
          <div style={styles.inputGroup}>
            <input
              id={deleteInputId}
              type="number"
              min="1"
              max="365"
              value={settings.daysUntilDelete}
              onChange={(e) =>
                handleChangeSettings(
                  "daysUntilDelete",
                  Number.parseInt(e.target.value, 10),
                )
              }
              style={styles.input}
            />
            <span style={styles.unit}>日</span>
          </div>
          <p style={styles.description}>
            この日数以上前に追加されたエントリを削除します。
          </p>
        </div>
      </div>

      <div style={styles.buttonGroup}>
        <button
          type="button"
          onClick={saveSettings}
          disabled={isSaving}
          style={{
            ...styles.button,
            ...(isSaving ? styles.buttonDisabled : {}),
          }}
        >
          {isSaving ? "保存中..." : "設定を保存"}
        </button>
      </div>

      {saveMessage && (
        <p
          style={
            saveMessage.type === "success"
              ? styles.messageSuccess
              : styles.messageError
          }
        >
          {saveMessage.text}
        </p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    padding: "20px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "600",
    marginBottom: "20px",
    color: "#333",
  },
  section: {
    marginBottom: "30px",
    padding: "20px",
    backgroundColor: "#f5f5f5",
    borderRadius: "6px",
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: "600",
    marginBottom: "15px",
    color: "#333",
  },
  settingItem: {
    marginBottom: "20px",
  },
  label: {
    display: "block",
    fontSize: "14px",
    fontWeight: "500",
    marginBottom: "8px",
    color: "#333",
  },
  inputGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  input: {
    width: "80px",
    padding: "8px 12px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    boxSizing: "border-box",
  },
  unit: {
    fontSize: "14px",
    color: "#666",
  },
  description: {
    fontSize: "12px",
    color: "#666",
    margin: "6px 0 0 0",
  },
  buttonGroup: {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
  },
  button: {
    padding: "10px 20px",
    fontSize: "14px",
    fontWeight: "600",
    backgroundColor: "#007bff",
    color: "#ffffff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  buttonDisabled: {
    backgroundColor: "#6c757d",
    cursor: "not-allowed",
    opacity: 0.6,
  },
  messageSuccess: {
    marginTop: "15px",
    padding: "10px 15px",
    backgroundColor: "#d4edda",
    color: "#155724",
    borderRadius: "4px",
    fontSize: "14px",
    textAlign: "center",
  },
  messageError: {
    marginTop: "15px",
    padding: "10px 15px",
    backgroundColor: "#f8d7da",
    color: "#721c24",
    borderRadius: "4px",
    fontSize: "14px",
    textAlign: "center",
  },
};

// アプリケーションをマウント
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<OptionsPage />);
}
