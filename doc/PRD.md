# Product Requirements Document (PRD)
## Craftoto Discord Bot - Cloud Run Migration

### Document Information
- **Project**: Craftoto Discord Bot
- **Version**: 1.0
- **Date**: 2025-07-14
- **Author**: Hemo

---

## 1. Executive Summary

### 1.1 Background
現在のCraftoto Discord Botは、WebSocketベースの常時接続方式でGCP Compute Engineインスタンスの管理を行っています。この方式では以下の課題があります：

- **高コスト**: 常時起動による継続的な計算リソース消費
- **メンテナンス負荷**: サーバー管理・監視が必要
- **スケーラビリティの制限**: 固定リソースによる制約

### 1.2 Solution Overview
Discord Interactions Webhookを使用したサーバーレスアーキテクチャへの移行により、コスト削減とメンテナンスフリー化を実現します。

### 1.3 Key Benefits
- **コスト削減**: 従量課金による大幅なコスト削減（推定80%削減）
- **メンテナンスフリー**: サーバー管理不要
- **高可用性**: 自動スケーリング・障害対応
- **セキュリティ**: GCPマネージドサービスによるセキュリティ向上

---

## 2. Problem Statement

### 2.1 Current Issues
1. **コスト効率性**
   - 常時起動による無駄なリソース消費
   - アイドル時間でも課金が発生
   - 月額固定費用の負担

2. **運用負荷**
   - サーバー監視が必要
   - アップデート・パッチ適用
   - 障害対応・復旧作業

3. **スケーラビリティ**
   - 固定リソースによる制約
   - 負荷増加時の対応が困難

### 2.2 Target Outcomes
- 月額運用コストを80%削減
- 運用作業時間をゼロに近づける
- 高可用性とスケーラビリティを実現

---

## 3. Requirements

### 3.1 Functional Requirements

#### 3.1.1 Core Features
- **FR-001**: Discord スラッシュコマンド対応
  - `/up`: GCPインスタンス起動
  - `/down`: ワールド保存後インスタンス停止
  - `/status`: サーバーステータス表示

- **FR-002**: GCP Compute Engine管理
  - インスタンス起動・停止
  - ステータス監視
  - 既存GCPサービスとの連携

- **FR-003**: Minecraft サーバー管理
  - RCON接続による制御
  - ワールド保存機能
  - プレイヤー情報取得

- **FR-004**: 自動監視・シャットダウン
  - プレイヤー監視
  - アイドル時間による自動シャットダウン
  - スケジュール実行

#### 3.1.2 New Features
- **FR-005**: Webhook署名検証
  - Discordからのリクエスト検証
  - セキュリティ強化

- **FR-006**: Cloud Scheduler統合
  - 定期実行による監視
  - 従来の常時監視からの移行

### 3.2 Non-Functional Requirements

#### 3.2.1 Performance
- **NFR-001**: レスポンス時間 < 3秒
- **NFR-002**: コールドスタート時間 < 5秒
- **NFR-003**: 同時リクエスト処理 > 10件

#### 3.2.2 Availability
- **NFR-004**: 可用性 > 99.5%
- **NFR-005**: 自動復旧機能
- **NFR-006**: 障害通知機能

#### 3.2.3 Security
- **NFR-007**: Discord署名検証必須
- **NFR-008**: GCP IAM最小権限原則
- **NFR-009**: 機密情報の適切な管理

#### 3.2.4 Cost
- **NFR-010**: 月額コスト < 現在の20%
- **NFR-011**: 従量課金モデル
- **NFR-012**: 無料枠の最大活用

---

## 4. Technical Architecture

### 4.1 Current Architecture
```
Discord Bot (WebSocket)
└── GCP Compute Engine
    ├── Discord.js Client
    ├── Continuous Monitoring
    └── Direct GCP API Calls
```

### 4.2 Target Architecture
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

### 4.3 Technology Stack

#### 4.3.1 Runtime & Framework
- **Node.js**: 18.x LTS
- **TypeScript**: 5.x
- **Express.js**: HTTP サーバー
- **discord-interactions**: Webhook処理

#### 4.3.2 Infrastructure
- **GCP Cloud Run**: サーバーレス実行環境
- **GCP Cloud Scheduler**: 定期実行
- **Pulumi**: インフラ管理（TypeScript）
- **Docker**: コンテナ化

#### 4.3.3 Dependencies
- **@google-cloud/compute**: GCP操作
- **rcon-client**: Minecraft RCON
- **Ed25519**: 署名検証

### 4.4 Data Flow

#### 4.4.1 Command Processing
1. Discord → Webhook → Cloud Run
2. 署名検証 → コマンド処理
3. GCP API実行 → レスポンス返却

#### 4.4.2 Monitoring Flow
1. Cloud Scheduler → Cloud Run (Monitoring)
2. プレイヤー監視 → 自動シャットダウン判定
3. 必要に応じてGCP API実行

---

## 5. Implementation Plan

### 5.1 Phase 1: Foundation (Week 1-2)
- **Task 1.1**: プロジェクト構造変更
- **Task 1.2**: discord-interactions導入
- **Task 1.3**: Express.js HTTP サーバー実装
- **Task 1.4**: 署名検証機能実装

### 5.2 Phase 2: Core Migration (Week 3-4)
- **Task 2.1**: コマンドハンドラー移行
- **Task 2.2**: GCP Service連携
- **Task 2.3**: Minecraft Service連携
- **Task 2.4**: エラーハンドリング実装

### 5.3 Phase 3: Monitoring (Week 5-6)
- **Task 3.1**: 監視エンドポイント実装
- **Task 3.2**: Cloud Scheduler設定
- **Task 3.3**: 自動シャットダウン機能移行
- **Task 3.4**: ログ・メトリクス実装

### 5.4 Phase 4: Infrastructure (Week 7-8)
- **Task 4.1**: Pulumi設定
- **Task 4.2**: Cloud Run設定
- **Task 4.3**: IAM・セキュリティ設定
- **Task 4.4**: CI/CD パイプライン

### 5.5 Phase 5: Testing & Deployment (Week 9-10)
- **Task 5.1**: 統合テスト
- **Task 5.2**: 負荷テスト
- **Task 5.3**: プロダクションデプロイ
- **Task 5.4**: モニタリング設定

---

## 6. Deployment Strategy

### 6.1 Infrastructure as Code
- **Tool**: Pulumi (TypeScript)
- **Benefits**: 
  - アプリケーションコードと同じ言語
  - 型安全性
  - AWS CDKライクな体験

### 6.2 Deployment Process
1. **Development**: ローカルでPulumi preview
2. **Staging**: テスト環境にデプロイ
3. **Production**: 本番環境にデプロイ
4. **Rollback**: 問題発生時の自動ロールバック

### 6.3 Environment Management
- **Development**: ローカル開発環境
- **Staging**: テスト用Cloud Run
- **Production**: 本番用Cloud Run

---

## 7. Success Metrics

### 7.1 Cost Metrics
- **Primary**: 月額運用コスト削減率 > 80%
- **Secondary**: 1リクエストあたりのコスト

### 7.2 Performance Metrics
- **Response Time**: 平均レスポンス時間 < 3秒
- **Availability**: 月間可用性 > 99.5%
- **Cold Start**: コールドスタート時間 < 5秒

### 7.3 Operational Metrics
- **Maintenance Time**: 月間運用作業時間 < 1時間
- **Deployment Frequency**: デプロイ頻度の向上
- **Error Rate**: エラー率 < 0.1%

---

## 8. Risk Assessment

### 8.1 Technical Risks
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Cold Start遅延 | Medium | Low | コネクションプールの活用 |
| 署名検証エラー | High | Medium | 十分なテスト・検証 |
| GCP API制限 | Medium | Low | レート制限の実装 |

### 8.2 Business Risks
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| 移行中の機能停止 | High | Low | 段階的移行・ロールバック準備 |
| コスト超過 | Medium | Low | 予算監視・アラート設定 |
| 学習コストの増加 | Low | Medium | 十分なドキュメント整備 |

---

## 9. Timeline & Milestones

### 9.1 Project Timeline
- **Start Date**: 2025-07-14
- **End Date**: 2025-09-22
- **Duration**: 10 weeks

### 9.2 Key Milestones
- **Week 2**: Foundation完了
- **Week 4**: Core Migration完了
- **Week 6**: Monitoring機能完了
- **Week 8**: Infrastructure完了
- **Week 10**: Production Deploy完了

---

## 10. Appendix

### 10.1 References
- [Discord Interactions Documentation](https://discord.com/developers/docs/interactions/receiving-and-responding)
- [GCP Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Pulumi GCP Documentation](https://www.pulumi.com/docs/clouds/gcp/)

### 10.2 Glossary
- **Discord Interactions**: Discord上でのユーザーとBotの相互作用
- **Webhook**: HTTPリクエストによるリアルタイム通知
- **Cloud Run**: GCPのサーバーレスコンテナ実行環境
- **Pulumi**: Infrastructure as Codeツール

### 10.3 Contact Information
- **Product Owner**: mohemohe
- **Technical Lead**: Hemo
- **Project Manager**: Hemo