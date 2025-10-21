/// <reference types="chrome" />

interface Settings {
  daysUntilRead: number;
  daysUntilDelete: number;
}

class OptionsPage {
  private settings: Settings = {
    daysUntilRead: 30,
    daysUntilDelete: 60,
  };

  private daysUntilReadInput: HTMLInputElement | null = null;
  private daysUntilDeleteInput: HTMLInputElement | null = null;
  private saveButton: HTMLButtonElement | null = null;
  private savedMessage: HTMLDivElement | null = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    this.daysUntilReadInput = document.getElementById(
      "daysUntilRead",
    ) as HTMLInputElement;
    this.daysUntilDeleteInput = document.getElementById(
      "daysUntilDelete",
    ) as HTMLInputElement;
    this.saveButton = document.getElementById(
      "saveButton",
    ) as HTMLButtonElement;
    this.savedMessage = document.getElementById(
      "savedMessage",
    ) as HTMLDivElement;

    // イベントリスナーを設定
    if (this.saveButton) {
      this.saveButton.addEventListener("click", () => this.handleSave());
    }

    // ページ読み込み時に設定を復元
    void this.loadSettings();
  }

  private async loadSettings(): Promise<void> {
    const result = await chrome.storage.local.get([
      "daysUntilRead",
      "daysUntilDelete",
    ]);

    this.settings = {
      daysUntilRead: result.daysUntilRead ?? 30,
      daysUntilDelete: result.daysUntilDelete ?? 60,
    };

    // UIに設定値を反映
    if (this.daysUntilReadInput) {
      this.daysUntilReadInput.value = String(this.settings.daysUntilRead);
    }
    if (this.daysUntilDeleteInput) {
      this.daysUntilDeleteInput.value = String(this.settings.daysUntilDelete);
    }
  }

  private async handleSave(): Promise<void> {
    if (!this.daysUntilReadInput || !this.daysUntilDeleteInput) {
      return;
    }

    const daysUntilRead = Number.parseInt(this.daysUntilReadInput.value, 10);
    const daysUntilDelete = Number.parseInt(
      this.daysUntilDeleteInput.value,
      10,
    );

    // 入力値の検証
    if (Number.isNaN(daysUntilRead) || Number.isNaN(daysUntilDelete)) {
      console.error("無効な入力値です");
      return;
    }

    await chrome.storage.local.set({
      daysUntilRead,
      daysUntilDelete,
    });

    // 保存完了メッセージを表示
    if (this.savedMessage) {
      this.savedMessage.style.display = "block";
      setTimeout(() => {
        if (this.savedMessage) {
          this.savedMessage.style.display = "none";
        }
      }, 2000);
    }
  }
}

// ページ読み込み時に初期化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new OptionsPage();
  });
} else {
  new OptionsPage();
}

export type { Settings };
