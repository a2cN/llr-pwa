# LLR Terminal PWA — Web クリッピング機能 (v4)

策定日: 2026-07-15 / 実装同日

## 0. 目的

Obsidian Web Clipper のように Web ページの内容を Markdown で PWA に取り込み、`raw/` へ送信できるようにする（Obsidian Sync 有料のためスマホに vault を置けない代替）。

## 1. 制約（調査結果）

- **URL だけからの全文自動取得は不可**: ブラウザの CORS 制限により、PWA から他サイトの HTML を fetch できない。サーバを立てれば可能だがサーバレス原則（spec §12）に反するため不採用
- **Web Share Target API は Android 専用**: iOS/iPadOS は 2026 年時点で PWA を共有シートに登録できない

## 2. 採用方式（2本立て）

### 2.1 Web Share Target（Pixel / Android）
- `manifest.json` に `share_target` を追加（GET / `shared_title` `shared_text` `shared_url`）
- ブラウザの共有 → LLR Terminal 選択 → Input タブに以下の形で自動入力:
  - タイトル+URL → `[タイトル](URL)`（タイトル内の `[ ]` は除去）
  - Android が URL を text に入れてくるケースに対応（text が URL 単体なら url として扱う）
  - 既存入力があれば空行を挟んで末尾に追記
- 処理後は `history.replaceState` でクエリを除去（リロードでの二重挿入防止）
- **注意**: manifest 変更のため、共有シートに出ない場合はPWAの再インストール（ホーム画面から削除→再追加）が必要

### 2.2 スマートペースト（全機器: Pixel / iPad / PC）
- ページ上で本文を選択コピー → PWA の textarea に貼り付けると、クリップボードの **HTML フレーバーを Turndown で Markdown に変換**して挿入（見出し・リンク・リスト・表・強調が保持される）
- 依存: `turndown@7.2.4`（~26KB）+ `turndown-plugin-gfm@1.0.2`（~4KB、表対応）。初回貼り付け時に jsdelivr から遅延ロード。CSP 変更不要
- 変換設定: ATX見出し / fenced code / `-` リスト / `---` hr / `*` 強調。script/style/noscript は除去
- **変換ヒューリスティック**: HTML に構造タグ（`a, h1-6, ul, ol, li, table, blockquote, strong, b, em, img, hr`）がある場合のみ変換。`p`/`span`/`pre` のみの単純コピー（コードのコピー等）はネイティブ貼り付けのまま → Markdown ソースをコピペしても壊れない
- 挿入は `mdReplaceRange`（execCommand）経由で undo 可能。変換失敗時はプレーンテキストにフォールバック

## 3. 運用フロー

```
Pixel: 記事 → 共有 → LLR → [タイトル](URL) 入りで起動
       → 本文を選択コピー → 貼り付け（自動 Markdown 化）→ Submit
iPad:  本文選択コピー → 貼り付け（リーダー表示で全選択すると綺麗）
PC:    同上（Ctrl+C / Ctrl+V）。本格クリップは Claude Code 側で
```

## 4. 検証
- 共有パラメータ処理・変換ヒューリスティックは Node 単体テスト16ケースで確認
- Turndown 実変換・Android 共有シート表示は実機確認が必要
