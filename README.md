# dsh-font-overrides

DeepSeek Harness(DSH)の Web UI フォントを **Google Fonts のファミリー名指定**で
差し替える、最小構成の標準クライアントプラグイン。

## 使い方

### 方法1: ファイル編集(全ブラウザ共通)

`lib/client.js` 冒頭の1行を書き換える:

```js
const DEFAULT_FAMILY = "Noto Sans JP";  // ← 好きなGoogle Fontsの名前
```

例: `"Zen Kaku Gothic New"`, `"M PLUS 1 Code"`, `"Inter"`, `"BIZ UDGothic"`

### 方法2: ブラウザのDevToolsコンソール(その場で即時・選択は保存される)

```js
__dshFontOverrides.set("M PLUS 1 Code")  // 即時適用 + localStorageに永続化
__dshFontOverrides.current               // 現在の設定確認
__dshFontOverrides.reset()               // DEFAULT_FAMILYに戻す
```

## 仕組み

- Host 側(`lib/index.js`)は空の `apply()` のみ。プラグイン行のマウントとクライアントバンドル発見のための存在。
- ブラウザ側(`lib/client.js`)が本体:
  - Google Fonts のスタイルシート(`css2?family=…&display=swap`)を `<link>` で動的ロード
  - `:root` の `--dsw-font-family` トークンを `!important` で上書きする `<style>` タグを注入
  - すべて `ctx.effect` 経由で登録し、teardown で完全に元に戻る
- フォールバックスタック(Windows日本語環境向け)も同時に設定されるため、Webフォント読み込み失敗時も崩れない。

## インストール(ローカル)

```bash
dsh plugin --profile web add <このフォルダのパス>
dsh web
```

削除:

```bash
dsh plugin --profile web remove dsh-font-overrides
```

## 対応バージョン

- DSH `0.1.1-rc.2`(web プロファイル)

## ライセンス

MIT
