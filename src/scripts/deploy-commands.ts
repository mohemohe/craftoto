import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { loadConfig } from '../utils/config';
import { logger } from '../utils/logger';

const config = loadConfig();

// スラッシュコマンドの定義（サブコマンドとして実装）
const commands = [
  new SlashCommandBuilder()
    .setName('craftoto')
    .setDescription('Craftoto Discord Bot - Minecraft サーバー管理')
    .addSubcommand(subcommand =>
      subcommand
        .setName('up')
        .setDescription('GCPインスタンスを起動します')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('down')
        .setDescription('ワールドを保存してGCPインスタンスをシャットダウンします')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('サーバーの状態を確認します')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('help')
        .setDescription('使い方を表示します')
    ),
].map(command => command.toJSON());

// コマンドをDiscordに登録
async function deployCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(config.discord.token);
    
    logger.info('スラッシュコマンドを登録中...');
    
    // ギルドコマンドとして登録
    await rest.put(
      Routes.applicationGuildCommands(config.discord.applicationId, config.discord.guildId),
      { body: commands },
    );
    
    logger.info('スラッシュコマンドの登録が完了しました。');
    
    // 登録されたコマンドを表示
    commands.forEach(command => {
      logger.info(`  - /${command.name}: ${command.description}`);
    });
    
  } catch (error) {
    logger.error('コマンド登録エラー:', error);
    process.exit(1);
  }
}

// スクリプトとして実行された場合
if (require.main === module) {
  deployCommands()
    .then(() => {
      logger.info('コマンドデプロイが完了しました。');
      process.exit(0);
    })
    .catch(error => {
      logger.error('コマンドデプロイに失敗しました:', error);
      process.exit(1);
    });
}

export { deployCommands };