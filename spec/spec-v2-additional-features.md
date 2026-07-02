# LLR Terminal PWA — 追加機能 要件定義 (v2)

策定日: 2026-07-02 / 対象: 既存 `index.html` 単一ファイル PWA

本書は [spec.md](./spec.md) を前提とした追加開発の要件定義。決定事項（2026-07-02 ユーザー回答）を反映済み。

## 0. 共通前提（既存アーキテクチャ制約）

- ビルドステップなし・単一 `index.html` + `sw.js` + `manifest.json`、npm/フレームワーク不使用
- 外部通信は CSP で制限。現状: `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net`, `connect-src https://api.github.com`, `img-src 'self' data:`
- 書き込みは GitHub **Contents API** の base64 PUT（`createFile()`）、実質 **~1MB/ファイル**
- 既存の画像添付フロー（Canvas圧縮 → `raw/images/` に別ファイルコミット → 本文へ相対リンク）を流用可能

---

## 1. テンプレート機能（編集可能）

### 目的
定型フォーマットをワンタップで textarea に展開。**初期からユーザーがテンプレを編集・追加・削除できる**こと。

### 機能要件
| 項目 | 内容 |
|---|---|
| 初期テンプレ | ①日記 ②業務報告 ③英語学習日誌（初回起動時に localStorage へシード） |
| 展開 | 選択で Markdown 雛形を textarea に挿入。`{date}` `{datetime}` 等のプレースホルダを展開時に置換 |
| カテゴリ連動 | テンプレに紐づくカテゴリを保持し、展開時に `#category-select` を自動セット |
| 上書き挙動 | textarea に既存入力がある場合は「置換 / 末尾に追加 / キャンセル」を確認 |
| 編集UI | テンプレ一覧（名前・カテゴリ・本文）を CRUD。新規追加・複製・削除・並べ替え |
| 保存先 | `localStorage` キー `llr_templates`（ドラフトと同じパターン） |

### データ構造（`llr_templates`）
```json
[
  { "id": "uuid", "name": "日記", "category": "LifeLog", "body": "## {date}\n\n### 今日の出来事\n\n### 所感\n" }
]
```

### プレースホルダ
- `{date}` → YYYY-MM-DD / `{datetime}` → ローカル日時 / `{weekday}` → 曜日（既存 `formatDate` を再利用/拡張）

### UI
- Input タブに「📄 Template」ボタン → テンプレ選択メニュー ＋「テンプレ編集」導線
- 編集はモーダル or 専用ビュー（既存トースト/軽量UIに合わせる）

### 技術方式
- localStorage CRUD ＋ `#memo-text` / `#category-select` への代入。新規依存・CSP変更・API変更なし

### 実現難易度: **中（M）** 見積り ~1日
- 単純展開のみなら低だが、編集UI込みで中。リスク低。

---

## 2. PDF テキスト抽出（案B）

### 目的
PDF からクライアント側でテキスト抽出し textarea へ取り込み（LLR 資産＝検索対象化）。**原本ファイルは保存しない。**

### 機能要件
| 項目 | 内容 |
|---|---|
| 入力 | ファイル選択（`accept="application/pdf"`）。将来 Web Share Target 経由も検討（別途） |
| 抽出 | 全ページのテキストを順に単純連結して textarea に挿入（ページ区切りは付与しない・決定 2026-07-02） |
| 進捗 | ページ数不定・大容量ありうるため「n/N ページ処理中」を表示 |
| スキャンPDF | テキストレイヤ無し（画像PDF）は抽出結果が空 → その旨を通知（OCR[4]は別機能） |
| サイズ | 上限不明。大容量はメモリ/時間リスク → ページ単位で逐次処理し、極端な場合は警告 |

### 技術方式
- `pdf.js`（`pdfjs-dist`）を jsdelivr から読込
- Worker 使用（推奨・高速）。`GlobalWorkerOptions.workerSrc` を CDN URL に設定
- **CSP 追加**: `worker-src 'self' blob: https://cdn.jsdelivr.net`（Worker を CDN/blob から起動するため）

### 実現難易度: **中（M）** 見積り ~1〜1.5日
- 難所は Worker/CSP 設定と大容量PDFの逐次処理・進捗。

---

## 3. Markdown ファイルアップロード → 直接 Git

### 目的
既存の `.md` ファイルを選択し、**内容をそのまま**（フロントマター等の加工なし）リポジトリへ直接コミット。

### 機能要件
| 項目 | 内容 |
|---|---|
| 入力 | ファイル選択（`accept=".md,text/markdown"`）。複数選択は v2 で検討（初期は1件） |
| 投入先 | `raw/`（spec §2「PWA は raw/ に新規書き込み」に準拠） |
| ファイル名 | 既存メモと同じ命名規則 `raw/{category}_{YYYY-MM-DD}_{HHmmss}.md`。日時接尾辞で一意化され衝突は実質発生しない（決定 2026-07-02） |
| コミット | `createFile()` を流用。`message: "raw: upload {filename}"` |
| プレビュー | コミット前に内容と投入パスを確認表示 |
| サイズ | Contents API 実質 ~1MB。超過時はエラー通知（大容量 md は稀の想定） |
| 文字コード | UTF-8 前提。base64 化は既存ユーティリティを利用 |

### 技術方式
- `FileReader` でテキスト読込 → 既存 `createFile()` に渡すのみ。新規依存・CSP変更なし

### 実現難易度: **低〜中（S–M）** 見積り ~0.5日
- リスク低。名前衝突・サイズ超過のハンドリングが主な考慮点。

---

## 4. 画像 OCR（オフライン対応不要・活字前提）

### 目的
添付/撮影画像から文字抽出し textarea へ。**オフライン対応不要**・**手書きはほぼ想定せず活字中心。**

### 機能要件
| 項目 | 内容 |
|---|---|
| 入力 | 既存の画像添付フローに「OCR してテキスト挿入」アクションを追加 |
| 言語 | 日本語 `jpn`（＋英数 `eng` 併用を検討） |
| 前処理 | 既存 Canvas でグレースケール/コントラスト調整して精度改善（任意） |
| 進捗 | 処理数秒〜十数秒 → 進捗（Tesseract progress コールバック）表示 |
| 結果 | 抽出テキストを本文へ挿入（画像添付自体は従来通り任意で併用可） |

### 技術方式
- **Tesseract.js**（クライアント側 WASM OCR）を CDN から**オンデマンド読込**（初回OCR時のみfetch）
- **オフライン対応不要** → SW での大容量アセット（wasm/traineddata 約15MB）キャッシュは行わない。実装が単純化
- **CSP 追加**:
  - `script-src` … jsdelivr は許可済（tesseract 本体）
  - `connect-src https://cdn.jsdelivr.net` 追加（wasm・traineddata・worker の fetch 用）
  - `worker-src 'self' blob:` 追加
- 手書き非対象・活字前提のため精度は実用域

### 非採用: クラウド OCR
- 外部API/APIキー/サーバレス原則（spec §12）違反のため不採用

### 実現難易度: **中〜高（M–L）** 見積り ~1.5〜2日
- オフライン不要化で難易度が下がる。難所は CSP・日本語データ取得・進捗UX。

---

## 5. まとめ（難易度・優先度）

| # | 機能 | 難易度 | 見積り | 新規依存 | CSP変更 |
|---|---|---|---|---|---|
| 1 | テンプレート（編集可） | 中 (M) | ~1日 | なし | なし |
| 3 | Markdown アップロード | 低〜中 (S–M) | ~0.5日 | なし | なし |
| 2 | PDF テキスト抽出 | 中 (M) | ~1〜1.5日 | pdf.js | `worker-src` |
| 4 | 画像 OCR | 中〜高 (M–L) | ~1.5〜2日 | Tesseract.js | `connect-src`,`worker-src` |

**推奨実装順:** ③Markdownアップロード（最小・低リスク）→ ①テンプレート → ②PDF抽出 →（②と共通のテキスト取り込み基盤の上に）④OCR。

## 6. 残課題 / 確認事項
- ~~Markdown 投入先~~: `raw/` に決定（2026-07-02）
- ~~同名衝突時の挙動~~: 日時接尾辞命名で一意化に決定（2026-07-02）
- ~~PDF のページ区切り~~: 付与しない（全ページを単純連結）に決定（2026-07-02）
- ~~CSP 緩和~~: `cdn.jsdelivr.net` を `connect-src`/`worker-src` に追加を許容に決定（2026-07-02）
