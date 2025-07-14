# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

CraftotoはMinecraftサーバーをDiscord Botで管理するためのNode.js/TypeScriptアプリケーションです。GCP Compute Engineインスタンスの起動・停止、プレイヤー監視による自動シャットダウン機能を提供します。

## 重要なコマンド

### 開発環境
```bash
npm run dev          # nodemonでTypeScriptを監視実行
npm run build        # TypeScriptをdist/にコンパイル
npm start            # コンパイル済みJavaScriptを実行
```

### Docker環境
```bash
docker build -t craftoto .                    # Dockerイメージをビルド
docker-compose up -d                          # Docker Composeで起動
```

## アーキテクチャ

### 主要コンポーネント

- **src/index.ts**: メインファイル。Discord Bot起動、スラッシュコマンド登録・処理
- **src/services/**: 各種サービスクラス
  - **gcp.service.ts**: GCP Compute Engine操作（起動・停止・ステータス取得）
  - **minecraft.service.ts**: Minecraft RCON接続（ワールド保存・サーバー情報取得）
  - **monitoring.service.ts**: プレイヤー監視・自動シャットダウン機能
- **src/utils/config.ts**: 環境変数からの設定読み込み
- **src/types/config.ts**: TypeScript型定義

### Discord スラッシュコマンド

- `/up`: GCPインスタンス起動
- `/down`: ワールド保存後インスタンス停止  
- `/status`: サーバーステータス表示（GCP・Minecraft・監視状況）

### 環境変数設定

以下の環境変数が必須：
- Discord: `DISCORD_TOKEN`, `GUILD_ID`
- GCP: `GCP_PROJECT_ID`, `GCP_ZONE`, `GCP_INSTANCE_NAME`
- Minecraft: `MINECRAFT_HOST`, `MINECRAFT_RCON_PORT`, `MINECRAFT_RCON_PASSWORD`
- 監視設定: `IDLE_TIMEOUT_MINUTES` (デフォルト15), `CHECK_INTERVAL_SECONDS` (デフォルト60)

### 外部依存関係

- **@google-cloud/compute**: GCP Compute Engine操作
- **discord.js**: Discord Bot API
- **rcon-client**: Minecraft RCON通信
- **dotenv**: 環境変数管理

## 開発時の注意点

- 設定ファイル修正時は`src/types/config.ts`と`src/utils/config.ts`の両方を更新
- サービスクラス追加時は`src/index.ts`でのDIも更新
- Discord Bot権限: Send Messages, Use Slash Commands, Embed Links が必要
- GCP権限: Compute Instance Admin または個別のcompute.instances権限が必要
- RCON接続はMinecraftサーバー起動まで時間がかかる場合がある