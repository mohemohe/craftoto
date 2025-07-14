# Craftoto - Minecraft Server Manager Discord Bot

Minecraft サーバーを Discord Bot で管理するためのサーバーレスツールです。GCP Cloud Run 上で動作し、Compute Engine インスタンスの起動・停止、プレイヤー監視による自動シャットダウン機能を提供します。

## 主な機能

- 📊 **サーバーステータス確認** - GCPインスタンスとMinecraftサーバーの状態を表示
- 🚀 **リモート起動** - Discordから GCP インスタンスを起動
- 🛑 **安全なシャットダウン** - ワールド保存後のインスタンス停止
- 👥 **自動監視** - プレイヤー0人が15分続くと自動シャットダウン
- ☁️ **サーバーレス** - Cloud Run による従量課金とメンテナンスフリー運用
- 🔒 **セキュア** - Discord署名検証とGCP IAM統合

## Discord コマンド

| コマンド | 説明 |
|---------|------|
| `/craftoto up` | GCPインスタンスを起動します |
| `/craftoto down` | ワールドを保存してGCPインスタンスをシャットダウンします |
| `/craftoto status` | サーバーの状態（インスタンス・プレイヤー数・起動時間）を確認します |
| `/craftoto help` | 使い方を表示します |

## Cloud Run デプロイメント

### 1. 前提条件

- Google Cloud Platform アカウント
- Pulumi CLI （Infrastructure as Code）
- Docker
- Discord Developer Account

### 2. Discord Bot セットアップ

1. **Discord Developer Portal 設定**
   
   [Discord Developer Portal](https://discord.com/developers/applications) でアプリケーションを作成：
   
   ```
   1. 新しいアプリケーションを作成
   2. Bot タブでトークンを取得
   3. Interactions Endpoint URL を設定（後でCloud Run URLに更新）
   4. OAuth2 タブで Bot と applications.commands スコープを選択
   5. 必要な権限を設定：
      - Send Messages
      - Use Slash Commands  
      - Embed Links
   6. サーバーに招待
   ```

2. **必要な情報を記録**
   
   ```
   - Discord Bot Token
   - Discord Application ID
   - Discord Public Key
   - Discord Guild ID
   ```

### 3. GCP プロジェクト準備

1. **Google Cloud Console 設定**
   
   ```bash
   # プロジェクト作成
   gcloud projects create your-project-id
   gcloud config set project your-project-id
   
   # 必要なAPIを有効化
   gcloud services enable compute.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable cloudscheduler.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   ```

2. **認証設定**
   
   ```bash
   # Application Default Credentials を設定
   gcloud auth application-default login
   ```

### 4. Minecraft サーバー設定

Minecraft サーバーで RCON（Remote Console）を有効化：

1. **server.properties の編集**
   
   ```properties
   enable-rcon=true
   rcon.port=25575
   rcon.password=your_strong_password_here
   ```

2. **ファイアウォール設定**
   
   ```bash
   # GCP Compute Engine インスタンスでRCONポートを開放
   gcloud compute firewall-rules create allow-minecraft-rcon \
     --allow tcp:25575 \
     --source-ranges YOUR_CLOUD_RUN_IP_RANGE \
     --description "Allow RCON for Craftoto"
   ```

### 5. Pulumi インフラストラクチャデプロイ

1. **依存関係のインストール**
   
   ```bash
   npm install
   ```

2. **Pulumi プロジェクト初期化**
   
   ```bash
   cd infrastructure
   pulumi stack init production
   ```

3. **設定値の入力**
   
   ```bash
   # GCP設定
   pulumi config set gcp:project your-gcp-project-id
   pulumi config set gcp:region asia-northeast1
   
   # Discord設定（シークレット）
   pulumi config set --secret craftoto:discord-token your_discord_bot_token
   pulumi config set --secret craftoto:discord-application-id your_discord_app_id
   pulumi config set --secret craftoto:discord-public-key your_discord_public_key
   pulumi config set --secret craftoto:discord-guild-id your_discord_guild_id
   
   # Minecraft設定
   pulumi config set craftoto:minecraft-host your_minecraft_server_ip
   pulumi config set craftoto:minecraft-rcon-port 25575
   pulumi config set --secret craftoto:minecraft-rcon-password your_rcon_password
   
   # 管理対象GCPインスタンス設定
   pulumi config set craftoto:gcp-project-id your_minecraft_gcp_project_id
   pulumi config set craftoto:gcp-zone asia-northeast1-a
   pulumi config set craftoto:gcp-instance-name your_minecraft_instance_name
   
   # 監視設定（オプション）
   pulumi config set craftoto:idle-timeout-minutes 15
   pulumi config set craftoto:check-interval-seconds 60
   ```

4. **インフラストラクチャデプロイ**
   
   ```bash
   pulumi up
   ```
   
   このコマンドで以下が作成されます：
   - Cloud Run サービス
   - Cloud Scheduler ジョブ（監視用）
   - IAM サービスアカウントと権限
   - 必要なネットワーク設定

### 6. アプリケーションデプロイ

1. **コンテナイメージビルド**
   
   ```bash
   # プロジェクトルートに戻る
   cd ..
   
   # Container Registry にイメージをビルド・プッシュ
   gcloud builds submit --tag gcr.io/your-project-id/craftoto:latest
   ```

2. **Cloud Run サービス更新**
   
   ```bash
   # 新しいイメージでCloud Runサービスを更新
   gcloud run deploy craftoto \
     --image gcr.io/your-project-id/craftoto:latest \
     --region asia-northeast1 \
     --platform managed
   ```

### 7. Discord コマンド登録

1. **コマンド登録スクリプト実行**
   
   ```bash
   npm run deploy-commands
   ```

2. **Interactions Endpoint URL 更新**
   
   Discord Developer Portal で Interactions Endpoint URL を Cloud Run の URL に設定：
   ```
   https://your-service-url.run.app/interactions
   ```

### 8. 動作確認

1. **ヘルスチェック**
   
   ```bash
   curl https://your-service-url.run.app/health
   ```

2. **Discord でテスト**
   
   Discord サーバーで以下のコマンドをテスト：
   ```
   /craftoto help
   /craftoto status
   ```

## アーキテクチャ

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

## 技術スタック

- **Runtime**: Node.js 18.x + TypeScript
- **Framework**: Express.js
- **Infrastructure**: Pulumi (TypeScript)
- **Platform**: GCP Cloud Run
- **Monitoring**: Cloud Scheduler
- **Authentication**: Discord署名検証 + GCP IAM

## ファイル構成

```
src/
├── index.ts                 # メインファイル（HTTP サーバー・Webhook処理）
├── scripts/
│   └── deploy-commands.ts   # Discord コマンド登録スクリプト
├── types/
│   └── config.ts           # 型定義
├── utils/
│   └── config.ts           # 設定ファイル読み込み
└── services/
    ├── gcp.service.ts      # GCP Compute Engine操作
    ├── minecraft.service.ts # Minecraft RCON操作
    └── monitoring.service.ts # プレイヤー監視・自動シャットダウン

infrastructure/
├── index.ts                # Pulumi インフラ定義
└── Pulumi.yaml             # Pulumi 設定

Dockerfile                  # Cloud Run用コンテナ定義
```

## 運用とメンテナンス

### ログ確認

```bash
# Cloud Run ログ確認
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=craftoto" --limit=50

# リアルタイムログ監視
gcloud logs tail "resource.type=cloud_run_revision AND resource.labels.service_name=craftoto"
```

### 設定更新

```bash
# Pulumi設定更新
cd infrastructure
pulumi config set craftoto:idle-timeout-minutes 30
pulumi up

# 新しいバージョンデプロイ
gcloud builds submit --tag gcr.io/your-project-id/craftoto:v2
gcloud run deploy craftoto --image gcr.io/your-project-id/craftoto:v2
```

### コスト最適化

- **自動スケーリング**: 最小インスタンス数 0、最大 10
- **従量課金**: リクエスト時のみ課金
- **リソース制限**: CPU 1000m、メモリ 512Mi
- **Cloud Scheduler**: 5分間隔での監視

## トラブルシューティング

### "Discord署名検証エラー"

1. Discord Public Key が正しく設定されているか確認
2. Interactions Endpoint URL が正しく設定されているか確認
3. Cloud Run サービスがアクセス可能か確認

### "RCON接続に失敗しました"

1. Minecraft サーバーが起動しているか確認
2. RCON設定が正しいか確認
3. ファイアウォール設定を確認
4. Cloud Run から Minecraft サーバーへのネットワーク接続を確認

### "インスタンスの起動に失敗しました"

1. GCP認証情報が正しく設定されているか確認
2. サービスアカウントに必要な権限があるか確認
3. プロジェクトID・ゾーン・インスタンス名が正しいか確認

### Cloud Run 関連

```bash
# サービス状態確認
gcloud run services describe craftoto --region asia-northeast1

# 最新デプロイメント確認
gcloud run revisions list --service craftoto --region asia-northeast1

# エラーログ確認
gcloud logs read "severity>=ERROR" --limit=20
```

## セキュリティ

- Discord Webhook署名検証
- GCP IAM最小権限原則
- 環境変数による機密情報管理
- Cloud Run セキュアな実行環境
- プライベートネットワーク通信

## ライセンス

ISC License