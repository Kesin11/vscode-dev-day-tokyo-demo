import fs from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// マニフェストファイルとHTMLファイルをコピーする関数
function copyFiles() {
  return {
    name: "copy-files",
    closeBundle() {
      // マニフェストファイルをdistディレクトリにコピー
      fs.copyFileSync("manifest.json", "dist/manifest.json");

      // 必要ならimagesディレクトリもコピー
      if (fs.existsSync("images")) {
        fs.mkdirSync("dist/images", { recursive: true });
        copyDir("images", "dist/images");
      }

      console.log("✅ ビルド後の処理が完了しました");
    },
  };
}

// ディレクトリを再帰的にコピーする関数
function copyDir(src: string, dest: string): void {
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = `${src}/${entry.name}`;
    const destPath = `${dest}/${entry.name}`;

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// https://vitejs.dev/config/
// メインのビルド設定
export default defineConfig({
  plugins: [
    tailwindcss(),
    copyFiles(),
    {
      name: "build-individual-entry-points",
      apply: "build",
      closeBundle: {
        handler: async () => {
          console.log("🔄 エントリーポイント別にバンドルを実行します...");

          // ServiceWorker
          await generateStandaloneBundle({
            entry: resolve(__dirname, "src/backend/background.ts"),
            outDir: "dist/src/backend",
            fileName: "background",
            globalName: "background",
            format: "es",
          });

          console.log("✅ 個別エントリーポイントのバンドルが完了しました");
        },
      },
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        options: resolve(__dirname, "src/frontend/options/options.html"),
      },
      output: {
        entryFileNames: (chunk) => {
          const name = chunk.name;
          return `src/frontend/${name}/${name}.js`;
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
});

// 個別のエントリーポイントをバンドルする関数
async function generateStandaloneBundle({
  entry,
  outDir,
  fileName,
  format = "iife", // デフォルトはiife
  globalName,
}: {
  entry: string;
  outDir: string;
  fileName: string;
  format?: "iife" | "es";
  globalName: string;
}) {
  // ファイルシステムアクセス用のfsモジュールをインポート
  const { build } = await import("vite");

  // 指定されたエントリーポイントから単一バンドルを生成
  await build({
    configFile: false,
    build: {
      outDir,
      emptyOutDir: false,
      sourcemap: true,
      write: true,
      lib: {
        entry,
        name: globalName,
        fileName: () => `${fileName}.js`,
        formats: [format],
      },
      rollupOptions: {
        output: {
          extend: true,
        },
      },
    },
  });
}
