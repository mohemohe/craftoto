# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

CraftotoはMinecraftサーバーをDiscord Botで管理するためのサーバーレスNode.js/TypeScriptアプリケーションです。GCP Cloud Run上で動作し、Discord Interactions Webhookを使用してCompute Engineインスタンスの起動・停止、プレイヤー監視による自動シャットダウン機能を提供します。

## 重要なコマンド

### 開発環境
```bash
npm run dev               # nodemonでTypeScriptを監視実行
npm run build             # TypeScriptをdist/にコンパイル
npm start                 # コンパイル済みJavaScriptを実行
npm run deploy-commands   # Discord スラッシュコマンドを登録
```

### Cloud Run デプロイメント
```bash
# コンテナビルドとプッシュ
gcloud builds submit --tag gcr.io/your-project-id/craftoto:latest

# Cloud Runサービスデプロイ
gcloud run deploy craftoto --image gcr.io/your-project-id/craftoto:latest --region asia-northeast1

# Pulumiインフラデプロイ
cd infrastructure && pulumi up
```

### ローカルテスト
```bash
docker build -t craftoto .                    # Dockerイメージをビルド
docker run -p 3000:3000 --env-file .env craftoto # ローカル実行
```

## アーキテクチャ

### サーバーレスアーキテクチャ

```
Discord Interactions Webhook
└── GCP Cloud Run
    ├── HTTP Server (Express.js)
    ├── Discord Interactions Handler
    ├── GCP Compute Engine API
    └── Minecraft RCON Client

Cloud Scheduler
└── GCP Cloud Run (Monitoring Endpoint)
    ├── Player Monitoring
    ├── Auto Shutdown Logic
    └── GCP Compute Engine API
```

### 主要コンポーネント

- **src/index.ts**: メインファイル。Express.js HTTPサーバー、Discord Interactions Webhook処理
- **src/scripts/deploy-commands.ts**: Discord スラッシュコマンド登録スクリプト
- **src/services/**: 各種サービスクラス
  - **gcp.service.ts**: GCP Compute Engine操作（起動・停止・ステータス取得）
  - **minecraft.service.ts**: Minecraft RCON接続（ワールド保存・サーバー情報取得）
  - **monitoring.service.ts**: プレイヤー監視・自動シャットダウン機能、Cloud Scheduler対応
- **src/utils/config.ts**: 環境変数からの設定読み込み
- **src/types/config.ts**: TypeScript型定義
- **infrastructure/**: Pulumi Infrastructure as Code
  - **index.ts**: Cloud Run、Cloud Scheduler、IAM設定
  - **Pulumi.yaml**: プロジェクト設定とコンフィグ定義

### Discord スラッシュコマンド（サブコマンド形式）

- `/craftoto up`: GCPインスタンス起動
- `/craftoto down`: ワールド保存後インスタンス停止  
- `/craftoto status`: サーバーステータス表示（GCP・Minecraft・監視状況）
- `/craftoto help`: 使い方とコマンド一覧表示

### 環境変数設定

以下の環境変数が必須：
- Discord: `DISCORD_TOKEN`, `GUILD_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID`
- GCP: `GCP_PROJECT_ID`, `GCP_ZONE`, `GCP_INSTANCE_NAME`
- Minecraft: `MINECRAFT_HOST`, `MINECRAFT_RCON_PORT`, `MINECRAFT_RCON_PASSWORD`
- 監視設定: `IDLE_TIMEOUT_MINUTES` (デフォルト15), `CHECK_INTERVAL_SECONDS` (デフォルト60)
- Cloud Run: `PORT` (デフォルト3000)

### 外部依存関係

#### アプリケーション
- **express**: HTTP サーバーフレームワーク
- **discord-interactions**: Discord Interactions Webhook処理
- **@google-cloud/compute**: GCP Compute Engine操作
- **rcon-client**: Minecraft RCON通信
- **dotenv**: 環境変数管理

#### Infrastructure as Code
- **@pulumi/pulumi**: Infrastructure as Code フレームワーク
- **@pulumi/gcp**: GCP Pulumi プロバイダー

## Cloud Run 特有の設定

### HTTPサーバー設定
- ポート: 環境変数 `PORT` または 3000
- ヘルスチェック: `/health` エンドポイント
- Discord Webhook: `/interactions` エンドポイント
- 監視API: `/monitor` エンドポイント (Cloud Scheduler用)

### 署名検証
Discord Interactions Webhookは `discord-interactions` ライブラリで署名検証を実装。`DISCORD_PUBLIC_KEY` が必要。

### 認証
- GCP: Application Default Credentials (ADC) を使用
- Cloud Run環境では自動的にサービスアカウント認証が適用される

## 開発時の注意点

### コード変更時
- 設定ファイル修正時は`src/types/config.ts`と`src/utils/config.ts`の両方を更新
- サービスクラス追加時は`src/index.ts`でのDI初期化も更新
- Discord コマンド変更時は`src/scripts/deploy-commands.ts`も更新

### 権限設定
- Discord Bot権限: Send Messages, Use Slash Commands, Embed Links が必要
- GCP権限: Compute Instance Admin または個別のcompute.instances権限が必要
- Cloud Run権限: IAMでサービスアカウントに適切な権限を設定

### デプロイフロー
1. コード修正 → `npm run build` でコンパイル確認
2. `npm run deploy-commands` でDiscordコマンド更新（必要時）
3. `gcloud builds submit` でコンテナビルド
4. `gcloud run deploy` または `pulumi up` でデプロイ
5. `/health` エンドポイントで動作確認

### トラブルシューティング
- RCON接続はMinecraftサーバー起動まで時間がかかる場合がある
- Discord署名検証エラーは `DISCORD_PUBLIC_KEY` の設定を確認
- Cloud Runの起動問題は環境変数とサービスアカウント権限を確認
- Pulumi設定は `pulumi config` で確認・修正可能

### ログとデバッグ
```bash
# Cloud Runログ確認
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=craftoto" --limit=50

# リアルタイムログ監視
gcloud logs tail "resource.type=cloud_run_revision AND resource.labels.service_name=craftoto"
```

## セキュリティ

- Discord Webhook署名検証が必須
- 機密情報は環境変数で管理（Pulumiシークレット対応）
- GCP IAM最小権限原則に従う
- プライベートネットワーク通信を推奨