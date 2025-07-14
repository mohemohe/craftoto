import express from 'express';
import { verifyKeyMiddleware, InteractionType, InteractionResponseType } from 'discord-interactions';
import { loadConfig } from './utils/config';
import { logger } from './utils/logger';
import { GCPService } from './services/gcp.service';
import { MinecraftService } from './services/minecraft.service';
import { MonitoringService } from './services/monitoring.service';

const config = loadConfig();
const app = express();
const PORT = process.env.PORT || 3000;

// サービスクラスのインスタンス化
const gcpService = new GCPService(config.gcp);
const minecraftService = new MinecraftService(config.minecraft);
const monitoringService = new MonitoringService(config.monitoring, gcpService, minecraftService);

// Discord署名検証ミドルウェア
app.use('/interactions', verifyKeyMiddleware(config.discord.publicKey));

// JSON解析
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Discord Interactions Webhook endpoint
app.post('/interactions', async (req, res) => {
  const { type, data } = req.body;

  // PINGリクエストの処理
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  // スラッシュコマンドの処理
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name, options } = data;

    try {
      if (name === 'craftoto') {
        // サブコマンドを取得
        const subcommand = options?.[0];
        if (!subcommand) {
          // サブコマンドが指定されていない場合はhelpを表示
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              embeds: [createHelpEmbed()],
            },
          });
        }

        switch (subcommand.name) {
          case 'up':
            // Deferredレスポンスを返す
            res.send({
              type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
            });
            
            // 非同期でコマンドを実行
            handleUpCommand(req.body.token);
            break;

          case 'down':
            res.send({
              type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
            });
            
            handleDownCommand(req.body.token);
            break;

          case 'status':
            res.send({
              type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
            });
            
            handleStatusCommand(req.body.token);
            break;

          case 'help':
            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                embeds: [createHelpEmbed()],
              },
            });

          default:
            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: '❌ 未知のサブコマンドです。',
                embeds: [createHelpEmbed()],
              },
            });
        }
      } else {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ 未知のコマンドです。',
          },
        });
      }
    } catch (error) {
      logger.error('コマンド処理エラー:', error);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '❌ エラーが発生しました。',
        },
      });
    }
  }
});

// 監視エンドポイント（Cloud Scheduler用）
app.post('/monitor', async (req, res) => {
  try {
    // プレイヤー監視を実行
    await monitoringService.checkAndShutdownIfIdle();
    res.json({ success: true, message: '監視処理が完了しました' });
  } catch (error) {
    logger.error('監視処理エラー:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '不明なエラー' });
  }
});

// コマンドハンドラー関数
async function handleUpCommand(token: string) {
  try {
    const startResult = await gcpService.startInstance();
    await sendFollowupMessage(token, `✅ インスタンス起動を開始しました: ${startResult}`);
  } catch (error) {
    logger.error('Up コマンドエラー:', error);
    const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました。';
    await sendFollowupMessage(token, `❌ エラー: ${errorMessage}`);
  }
}

async function handleDownCommand(token: string) {
  try {
    // ワールド保存してからシャットダウン
    await minecraftService.saveWorld();
    const stopResult = await gcpService.stopInstance();
    await sendFollowupMessage(token, `✅ ワールドを保存してインスタンスをシャットダウンしました: ${stopResult}`);
  } catch (error) {
    logger.error('Down コマンドエラー:', error);
    const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました。';
    await sendFollowupMessage(token, `❌ エラー: ${errorMessage}`);
  }
}

async function handleStatusCommand(token: string) {
  try {
    const status = await getServerStatus();
    const embed = createStatusEmbed(status);
    await sendFollowupMessage(token, '', [embed]);
  } catch (error) {
    logger.error('Status コマンドエラー:', error);
    const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました。';
    await sendFollowupMessage(token, `❌ エラー: ${errorMessage}`);
  }
}

// Discord Followup Message送信
async function sendFollowupMessage(token: string, content: string, embeds?: any[]) {
  const webhook_url = `https://discord.com/api/webhooks/${config.discord.applicationId}/${token}`;
  
  const payload: any = {
    content,
  };
  
  if (embeds) {
    payload.embeds = embeds;
  }
  
  try {
    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    logger.error('Followup message送信エラー:', error);
  }
}

// サーバーステータス取得
async function getServerStatus() {
  const [gcpStatus, minecraftStatus] = await Promise.allSettled([
    gcpService.getInstanceStatus(),
    minecraftService.getServerInfo(),
  ]);

  const monitoringStatus = monitoringService.getMonitoringStatus();

  return {
    gcp: gcpStatus.status === 'fulfilled' ? gcpStatus.value : { status: 'ERROR', error: gcpStatus.reason },
    minecraft: minecraftStatus.status === 'fulfilled' ? minecraftStatus.value : { isOnline: false, playerCount: 0, players: [], error: minecraftStatus.reason },
    monitoring: monitoringStatus,
  };
}

// ステータス表示用のEmbed作成
function createStatusEmbed(status: any) {
  const monitoringStatusText = status.monitoring.isMonitoring 
    ? `🟢 監視中 (アイドル: ${status.monitoring.idleTimeMinutes}分)`
    : '🔴 停止中';

  return {
    title: '🖥️ サーバーステータス',
    fields: [
      {
        name: '☁️ GCPインスタンス',
        value: `ステータス: ${status.gcp.status}${status.gcp.uptime ? `\n起動時間: ${Math.floor(status.gcp.uptime / 60)}分` : ''}`,
        inline: true,
      },
      {
        name: '⛏️ Minecraftサーバー',
        value: `オンライン: ${status.minecraft.isOnline ? '✅' : '❌'}\nプレイヤー数: ${status.minecraft.playerCount}${status.minecraft.uptime ? `\n起動時間: ${Math.floor(status.minecraft.uptime / 60)}分` : ''}`,
        inline: true,
      },
      {
        name: '👁️ プレイヤー監視',
        value: monitoringStatusText,
        inline: true,
      },
      {
        name: '👥 オンラインプレイヤー',
        value: status.minecraft.players.length > 0 ? status.minecraft.players.join(', ') : 'なし',
        inline: false,
      }
    ],
    timestamp: new Date().toISOString(),
    color: status.minecraft.isOnline ? 0x00ff00 : 0xff0000,
  };
}

// ヘルプ表示用のEmbed作成
function createHelpEmbed() {
  return {
    title: '📖 Craftoto Bot - 使い方',
    description: 'Minecraft サーバー管理用のDiscord Botです',
    fields: [
      {
        name: '🚀 `/craftoto up`',
        value: 'GCPインスタンスを起動します',
        inline: false,
      },
      {
        name: '🛑 `/craftoto down`',
        value: 'ワールドを保存してGCPインスタンスをシャットダウンします',
        inline: false,
      },
      {
        name: '📊 `/craftoto status`',
        value: 'サーバーの状態を確認します（GCP・Minecraft・監視状況）',
        inline: false,
      },
      {
        name: '❓ `/craftoto help`',
        value: 'この使い方を表示します',
        inline: false,
      },
      {
        name: '🔧 機能',
        value: '• 自動プレイヤー監視\n• アイドル時間による自動シャットダウン\n• リアルタイムステータス表示\n• 安全なワールド保存',
        inline: false,
      }
    ],
    timestamp: new Date().toISOString(),
    color: 0x5865f2, // Discord blue
  };
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  logger.error('未処理のPromise拒否:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('未処理の例外:', error);
  process.exit(1);
});

// サーバー起動
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info('Discord Interactions Webhook server started');
});