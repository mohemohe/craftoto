# Craftoto - Minecraft Server Manager Discord Bot

Minecraft サーバーを Discord Bot で管理するためのツールです。GCP Compute Engine インスタンスの起動・停止、プレイヤー監視による自動シャットダウン機能を提供します。

## 主な機能

- 📊 **サーバーステータス確認** - GCPインスタンスとMinecraftサーバーの状態を表示
- 🚀 **リモート起動** - Discordから GCP インスタンスを起動
- 🛑 **安全なシャットダウン** - ワールド保存後のインスタンス停止
- 👥 **自動監視** - プレイヤー0人が15分続くと自動シャットダウン

## Discord コマンド

| コマンド | 説明 |
|---------|------|
| `/up` | GCPインスタンスを起動します |
| `/down` | ワールドを保存してGCPインスタンスをシャットダウンします |
| `/status` | サーバーの状態（インスタンス・プレイヤー数・起動時間）を確認します |

## セットアップ

### 1. 環境変数の設定

`.env.example` をコピーして `.env` ファイルを作成し、以下の設定を行ってください：

```bash
cp .env.example .env
```

#### Discord Bot 設定

1. [Discord Developer Portal](https://discord.com/developers/applications) でアプリケーションを作成
2. Bot タブでトークンを取得
3. OAuth2 タブで Bot と applications.commands スコープを選択してサーバーに招待

```env
DISCORD_TOKEN=your_discord_bot_token_here
GUILD_ID=your_guild_id_here
```

#### GCP 設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. Compute Engine API を有効化
3. サービスアカウントを作成し、キーファイルをダウンロード
4. 環境変数 `GOOGLE_APPLICATION_CREDENTIALS` にキーファイルのパスを設定

```env
GCP_PROJECT_ID=your_gcp_project_id
GCP_ZONE=asia-northeast1-a
GCP_INSTANCE_NAME=minecraft-server
```

#### Minecraft RCON 設定

Minecraft サーバーで RCON（Remote Console）を有効化する必要があります：

1. **server.properties の編集**
   
   Minecraft サーバーのルートディレクトリにある `server.properties` ファイルを編集：

   ```properties
   enable-rcon=true
   rcon.port=25575
   rcon.password=your_strong_password_here
   ```

2. **セキュリティ設定**
   
   - RCON パスワードは強固なものを設定してください
   - デフォルトポート（25575）を変更することを推奨します
   - ファイアウォールで RCON ポートへのアクセスを適切に制限してください

3. **環境変数の設定**

   ```env
   MINECRAFT_HOST=your_minecraft_server_ip
   MINECRAFT_RCON_PORT=25575
   MINECRAFT_RCON_PASSWORD=your_rcon_password
   ```

4. **サーバーの再起動**
   
   設定変更後は Minecraft サーバーを再起動してください。

### 2. 依存関係のインストール

```bash
npm install
```

### 3. ビルド

```bash
npm run build
```

### 4. 実行

#### 開発環境

```bash
npm run dev
```

#### 本番環境

```bash
npm start
```

#### Docker Compose での実行

Docker Composeを使用してコンテナで実行する場合：

1. **GCP認証情報の準備**
   
   サービスアカウントキーファイルを `credentials.json` として配置するか、`GOOGLE_APPLICATION_CREDENTIALS` 環境変数でパスを指定してください。

2. **ログディレクトリの作成**（オプション）
   
   ```bash
   mkdir logs
   ```

3. **コンテナの起動**
   
   ```bash
   docker-compose up -d
   ```

4. **ログの確認**
   
   ```bash
   docker-compose logs -f craftoto
   ```

5. **コンテナの停止**
   
   ```bash
   docker-compose down
   ```

**Docker Compose の主な特徴：**
- セキュアな設定（read-only filesystem、resource limits）
- ヘルスチェック機能
- 自動再起動（unless-stopped）
- ログローテーション設定

## 必要な権限

### GCP サービスアカウント権限

- `Compute Instance Admin (v1)` または以下の個別権限：
  - `compute.instances.start`
  - `compute.instances.stop`
  - `compute.instances.get`

### Discord Bot 権限

- `Send Messages`
- `Use Slash Commands`
- `Embed Links`

## ファイル構成

```
src/
├── index.ts                 # メインファイル（Bot起動・コマンド処理）
├── types/
│   └── config.ts           # 型定義
├── utils/
│   └── config.ts           # 設定ファイル読み込み
└── services/
    ├── gcp.service.ts      # GCP Compute Engine操作
    ├── minecraft.service.ts # Minecraft RCON操作
    └── monitoring.service.ts # プレイヤー監視・自動シャットダウン
```

## 注意事項

- GCP インスタンスの起動には数分かかる場合があります
- Minecraft サーバーが完全に起動するまで RCON 接続ができない場合があります
- 自動シャットダウン機能は開発中のため、予期しない動作をする可能性があります

## トラブルシューティング

### "RCON接続に失敗しました"

1. Minecraft サーバーが起動しているか確認
2. RCON設定が正しいか確認
3. ファイアウォール設定を確認

### "インスタンスの起動に失敗しました"

1. GCP認証情報が正しく設定されているか確認
2. サービスアカウントに必要な権限があるか確認
3. プロジェクトID・ゾーン・インスタンス名が正しいか確認

## 開発

### TypeScript コンパイル監視

```bash
npm run dev
```

### ログ確認

アプリケーションは標準出力にログを出力します。本番環境では適切なログ管理システムの使用を推奨します。