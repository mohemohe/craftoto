import { Config } from '../types/config';
import { GCPService } from './gcp.service';
import { MinecraftService } from './minecraft.service';
import { logger } from '../utils/logger';

export class MonitoringService {
  private idleTimeoutMinutes: number;
  private checkIntervalSeconds: number;
  private gcpService: GCPService;
  private minecraftService: MinecraftService;
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastPlayerActivity: Date = new Date();
  private isMonitoring: boolean = false;
  private shutdownInProgress: boolean = false;

  constructor(
    config: Config['monitoring'],
    gcpService: GCPService,
    minecraftService: MinecraftService
  ) {
    this.idleTimeoutMinutes = config.idleTimeoutMinutes;
    this.checkIntervalSeconds = config.checkIntervalSeconds;
    this.gcpService = gcpService;
    this.minecraftService = minecraftService;
  }

  /**
   * 監視を開始
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('監視はすでに開始されています。');
      return;
    }

    logger.info(`プレイヤー監視を開始します。チェック間隔: ${this.checkIntervalSeconds}秒, アイドルタイムアウト: ${this.idleTimeoutMinutes}分`);
    
    this.isMonitoring = true;
    this.lastPlayerActivity = new Date();
    
    this.monitoringInterval = setInterval(async () => {
      await this.performMonitoringCheck();
    }, this.checkIntervalSeconds * 1000);
    
    logger.monitoring('プレイヤー監視サービスが正常に開始されました', {
      checkInterval: this.checkIntervalSeconds,
      idleTimeout: this.idleTimeoutMinutes
    });
  }

  /**
   * 監視を停止
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      logger.warn('監視は開始されていません。');
      return;
    }

    logger.info('プレイヤー監視を停止します。');
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    logger.monitoring('プレイヤー監視サービスが停止されました');
  }

  /**
   * 監視チェックを実行
   */
  private async performMonitoringCheck(): Promise<void> {
    try {
      // GCPインスタンスが実行中かどうかをチェック
      const isInstanceRunning = await this.gcpService.isInstanceRunning();
      
      if (!isInstanceRunning) {
        logger.debug('GCPインスタンスが停止中です。監視をスキップします。');
        return;
      }

      // Minecraftサーバーの情報を取得
      const serverInfo = await this.minecraftService.getServerInfo();
      
      if (!serverInfo.isOnline) {
        logger.debug('Minecraftサーバーがオフラインです。監視をスキップします。');
        return;
      }

      const currentTime = new Date();
      
      // プレイヤーがいる場合は最後の活動時刻を更新
      if (serverInfo.playerCount > 0) {
        this.lastPlayerActivity = currentTime;
        logger.monitoring(`プレイヤー ${serverInfo.playerCount}人 オンライン`, {
          players: serverInfo.players,
          playerCount: serverInfo.playerCount
        });
        return;
      }

      // プレイヤーが0人の場合、アイドル時間をチェック
      const idleTimeMinutes = (currentTime.getTime() - this.lastPlayerActivity.getTime()) / (1000 * 60);
      
      logger.monitoring(`プレイヤー 0人 - アイドル時間チェック`, {
        idleMinutes: Math.floor(idleTimeMinutes),
        maxIdleMinutes: this.idleTimeoutMinutes,
        remainingMinutes: Math.ceil(this.idleTimeoutMinutes - idleTimeMinutes)
      });

      // アイドルタイムアウトに達した場合の処理
      if (idleTimeMinutes >= this.idleTimeoutMinutes) {
        await this.handleIdleTimeout();
      } else {
        // 警告メッセージの送信（残り時間が5分以下の場合）
        const remainingMinutes = this.idleTimeoutMinutes - idleTimeMinutes;
        if (remainingMinutes <= 5 && remainingMinutes > 0) {
          const remainingTime = Math.ceil(remainingMinutes);
          await this.sendWarningMessage(remainingTime);
        }
      }
    } catch (error) {
      logger.error('監視チェックエラー:', error);
      // エラーが発生しても監視は継続
    }
  }

  /**
   * アイドルタイムアウト時の処理
   */
  private async handleIdleTimeout(): Promise<void> {
    if (this.shutdownInProgress) {
      console.log('シャットダウンが既に進行中です。');
      return;
    }

    logger.info('アイドルタイムアウトに達しました。自動シャットダウンを開始します。');
    this.shutdownInProgress = true;

    try {
      // 最終警告メッセージを送信
      await this.minecraftService.broadcastMessage('§c[自動シャットダウン] プレイヤーが長時間いないため、サーバーを自動停止します...');
      
      // 少し待機
      await this.sleep(5000);
      
      // ワールドを保存
      logger.serverOperation('ワールド保存', 'START');
      await this.minecraftService.saveWorld();
      logger.serverOperation('ワールド保存', 'SUCCESS');
      
      // Minecraftサーバーを停止
      logger.serverOperation('Minecraftサーバー停止', 'START');
      await this.minecraftService.stopServer();
      logger.serverOperation('Minecraftサーバー停止', 'SUCCESS');
      
      // 少し待機してからGCPインスタンスを停止
      await this.sleep(10000);
      
      // GCPインスタンスを停止
      logger.serverOperation('GCPインスタンス停止', 'START');
      await this.gcpService.stopInstance();
      logger.serverOperation('GCPインスタンス停止', 'SUCCESS');
      
      logger.info('自動シャットダウンが完了しました。');
      
      // 監視を停止
      this.stopMonitoring();
      
    } catch (error) {
      logger.serverOperation('自動シャットダウン', 'ERROR', error);
      this.shutdownInProgress = false;
      // エラーが発生した場合は監視を継続
    }
  }

  /**
   * 警告メッセージを送信
   */
  private async sendWarningMessage(remainingMinutes: number): Promise<void> {
    try {
      const message = `§e[自動シャットダウン警告] プレイヤーがいない状態が続いています。あと${remainingMinutes}分でサーバーが自動停止されます。`;
      await this.minecraftService.broadcastMessage(message);
    } catch (error) {
      logger.error('警告メッセージ送信エラー:', error);
      // メッセージ送信失敗は致命的ではない
    }
  }

  /**
   * 指定時間だけ待機
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 監視状態を取得
   */
  getMonitoringStatus(): {
    isMonitoring: boolean;
    lastPlayerActivity: Date;
    idleTimeMinutes: number;
    shutdownInProgress: boolean;
  } {
    const currentTime = new Date();
    const idleTimeMinutes = (currentTime.getTime() - this.lastPlayerActivity.getTime()) / (1000 * 60);
    
    return {
      isMonitoring: this.isMonitoring,
      lastPlayerActivity: this.lastPlayerActivity,
      idleTimeMinutes: Math.floor(idleTimeMinutes),
      shutdownInProgress: this.shutdownInProgress,
    };
  }

  /**
   * プレイヤー活動時刻をリセット（手動でサーバーを起動した場合など）
   */
  resetPlayerActivity(): void {
    this.lastPlayerActivity = new Date();
    this.shutdownInProgress = false;
    logger.monitoring('プレイヤー活動時刻をリセットしました');
  }

  /**
   * シャットダウン進行状況をリセット
   */
  resetShutdownProgress(): void {
    this.shutdownInProgress = false;
    logger.monitoring('シャットダウン進行状況をリセットしました');
  }
}