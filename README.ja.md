# dsh-font-overrides

DeepSeek Harness (DSH) の Web UI フォントを **Google Fonts のファミリー名指定**で
差し替える、最小構成・ゼロ依存の標準クライアントプラグイン。

English README is [here](README.md).

## 特徴

- **フォントピッカー UI**（Google Fonts 風）— Google Fonts の全ファミリーを
  検索・カテゴリ絞り込み（Sans Serif / Serif / Display / Handwriting /
  Monospace）できる一覧から選択。各行はそのフォント自体でプレビュー表示。
  **設定 → Font** 行、URL に `#fonts` を付けてアクセス、コンソールから開ける。
- **ファミリー別ウェイト検出** — スタイルシートを読む前に、そのファミリーが
  実際に提供するウェイトを取得する。ウェイトを1つしか持たないファミリー
  （手書き・ディスプレイ系の *Yomogi*、*Hachi Maru Pop*、*Dela Gothic One* 等）
  が黙って失敗せず、正しく適用される。
- **チャット範囲限定のオーバーライド** — 選んだフォントは会話メッセージの
  テキストだけに適用。シェル側（サイドバー・コンポーザ・設定・統計）は
  システムフォントのままなので、UI のレイアウトや行間は壊れない。
- **等幅フォント保護** — チャット内の `pre` / `code` は選択フォントに関わらず
  等幅スタックを維持する。
- **選択の永続化** — 選んだファミリーは `localStorage` に保存され、
  次回以降のページ読み込みで自動的に再適用される。
- **ライブカタログ** — ホスト側が `fonts.google.com/metadata/fonts` を
  同一オリジンでプロキシ（公開APIはCORSヘッダを送らないため）。
  24時間キャッシュ。オフライン時は内蔵フォールバックカタログで動作。

## インストール

```bash
dsh plugin --profile web add <このフォルダのパス>
dsh web
```

web プロファイルの `package.json` に手動で追記する場合:

```json
{
  "dependencies": {
    "dsh-font-overrides": "link:C:/path/to/dsh-font-overrides"
  },
  "dsh": {
    "profile": {
      "bundles": ["dsh-font-overrides"]
    }
  }
}
```

削除:

```bash
dsh plugin --profile web remove dsh-font-overrides
```

## 使い方

### ピッカー UI

1. 設定を開いて **フォント** 行をクリック。または URL に `#fonts` を付けてアクセス。
2. 検索・絞り込みしてファミリーをクリック。即時適用・永続化される。
3. **オーバーライド解除** でプロファイル既定のフォントに戻す。

### コンソール（手早い・永続化もされる）

```js
__dshFontOverrides.set("M PLUS 1 Code") // 即時適用 + localStorageに永続化
__dshFontOverrides.current              // 現在の設定確認 (null = オーバーライドなし)
__dshFontOverrides.openPicker()         // ピッカーを開く
__dshFontOverrides.clear()              // プロファイル既定に戻す
```

### 既定フォント（ファイル編集・新規プロファイル向け）

`lib/client.js` 冒頭の1行を書き換える:

```js
const DEFAULT_FAMILY = "Noto Sans JP";  // ← 好きなGoogle Fontsの名前
```

## 仕組み

- **ホスト側** (`lib/index.js`): webserver に `/dsh-font-overrides/catalog`
  ルートを1つ登録するだけ。Google のフォントメタデータ（family / category /
  popularity）を取得してスリム化し、24時間キャッシュする。
- **クライアント側** (`lib/client.js`): プラグイン本体。
  - css2 の `text=` サブセットエンドポイント（実在ファミリーには常に `200`）で
    ファミリーの利用可能ウェイトを検出してから
    `css2?family=…:wght@<weights>&display=swap` を読み込む;
  - `--dsw-font-family` トークンを、注入した `<style>` タグ **と**
    `<html>` へのインライン `!important` プロパティの二段構えで上書き
    （どのUI言語でも locale プラグインのスタイルシートに勝つ）;
  - オーバーライドの適用範囲は、レンダラが出力するセマンティックな
    スロットアンカー（`[data-slot="conversation.session"]`、
    `conversation.chat.flow`、`conversation.chat.node`）で絞る。
    ハッシュ化された CSS module クラス名に依存しないため、
    DSH のバージョンが変わっても壊れにくい;
  - `settings.section` スロット経由で設定行を登録;
  - すべて `ctx.effect` 1つの中で動くため、teardown で完全に元に戻る
    （タグ削除・変数削除・フック削除）。
- Windows 日本語環境向けのフォールバックスタックも同時に設定されるため、
  Web フォントの読み込みに失敗しても UI が崩れない。

## 対応バージョン

| DSH バージョン | 状態 |
|---|---|
| 0.2.x（`0.2.1-rc.5` で検証） | ✅ |
| 0.1.x | スロットキーは不変なので恐らく動作（ピッカーは 0.2.x で検証） |

## ライセンス

MIT
