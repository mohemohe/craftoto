import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { loadConfig } from './utils/config';
import { logger } from './utils/logger';
import { GCPService } from './services/gcp.service';
import { MinecraftService } from './services/minecraft.service';
import { MonitoringService } from './services/monitoring.service';

const config = loadConfig();

// Discord Bot クライアントを作成
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// サービスクラスのインスタンス化
const gcpService = new GCPService(config.gcp);
const minecraftService = new MinecraftService(config.minecraft);
const monitoringService = new MonitoringService(config.monitoring, gcpService, minecraftService);

// スラッシュコマンドの定義
const commands = [
  new SlashCommandBuilder()
    .setName('up')
    .setDescription('GCPインスタンスを起動します'),
  
  new SlashCommandBuilder()
    .setName('down')
    .setDescription('ワールドを保存してGCPインスタンスをシャットダウンします'),
  
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('サーバーの状態を確認します'),
].map(command => command.toJSON());

// コマンドをDiscordに登録
async function deployCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(config.discord.token);
    
    logger.info('スラッシュコマンドを登録中...');
    
    await rest.put(
      Routes.applicationGuildCommands(client.user!.id, config.discord.guildId),
      { body: commands },
    );
    
    logger.info('スラッシュコマンドの登録が完了しました。');
  } catch (error) {
    logger.error('コマンド登録エラー:', error);
  }
}

// Bot Ready イベント
client.once('ready', async () => {
  logger.info(`${client.user?.tag} としてログインしました。`);
  await deployCommands();
  
  // 監視サービスを開始
  monitoringService.startMonitoring();
});

// スラッシュコマンドの処理
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    switch (commandName) {
      case 'up':
        await interaction.deferReply();
        const startResult = await gcpService.startInstance();
        await interaction.editReply(`✅ インスタンス起動を開始しました: ${startResult}`);
        break;

      case 'down':
        await interaction.deferReply();
        // ワールド保存してからシャットダウン
        await minecraftService.saveWorld();
        const stopResult = await gcpService.stopInstance();
        await interaction.editReply(`✅ ワールドを保存してインスタンスをシャットダウンしました: ${stopResult}`);
        break;

      case 'status':
        await interaction.deferReply();
        const status = await getServerStatus();
        const embed = createStatusEmbed(status);
        await interaction.editReply({ embeds: [embed] });
        break;

      default:
        await interaction.reply('未知のコマンドです。');
    }
  } catch (error) {
    logger.userAction(interaction.user.id, commandName, 'ERROR', error);
    const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました。';
    
    if (interaction.deferred) {
      await interaction.editReply(`❌ エラー: ${errorMessage}`);
    } else {
      await interaction.reply(`❌ エラー: ${errorMessage}`);
    }
  }
});

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

  return new EmbedBuilder()
    .setTitle('🖥️ サーバーステータス')
    .addFields(
      {
        name: '☁️ GCPインスタンス',
        value: `ステータス: ${status.gcp.status}${status.gcp.uptime ? `\\n起動時間: ${Math.floor(status.gcp.uptime / 60)}分` : ''}`,
        inline: true,
      },
      {
        name: '⛏️ Minecraftサーバー',
        value: `オンライン: ${status.minecraft.isOnline ? '✅' : '❌'}\\nプレイヤー数: ${status.minecraft.playerCount}${status.minecraft.uptime ? `\\n起動時間: ${Math.floor(status.minecraft.uptime / 60)}分` : ''}`,
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
    )
    .setTimestamp()
    .setColor(status.minecraft.isOnline ? 0x00ff00 : 0xff0000);
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  logger.error('未処理のPromise拒否:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('未処理の例外:', error);
  process.exit(1);
});

// Botを起動
client.login(config.discord.token);