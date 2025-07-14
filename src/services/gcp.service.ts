import { InstancesClient } from '@google-cloud/compute';
import { Config } from '../types/config';

export class GCPService {
  private compute: InstancesClient;
  private projectId: string;
  private zone: string;
  private instanceName: string;
  private startTime: Date | null = null;

  constructor(config: Config['gcp']) {
    this.compute = new InstancesClient();
    this.projectId = config.projectId;
    this.zone = config.zone;
    this.instanceName = config.instanceName;
  }

  /**
   * インスタンスを起動
   */
  async startInstance(): Promise<string> {
    try {
      const [operation] = await this.compute.start({
        project: this.projectId,
        zone: this.zone,
        instance: this.instanceName,
      });

      // オペレーションの完了を待機
      if (operation.name) {
        await this.waitForOperation(operation.name);
      }

      this.startTime = new Date();
      
      return `インスタンス ${this.instanceName} の起動が完了しました。`;
    } catch (error) {
      console.error('インスタンス起動エラー:', error);
      throw new Error(`インスタンスの起動に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * インスタンスを停止
   */
  async stopInstance(): Promise<string> {
    try {
      const [operation] = await this.compute.stop({
        project: this.projectId,
        zone: this.zone,
        instance: this.instanceName,
      });

      // オペレーションの完了を待機
      if (operation.name) {
        await this.waitForOperation(operation.name);
      }

      this.startTime = null;
      
      return `インスタンス ${this.instanceName} のシャットダウンが完了しました。`;
    } catch (error) {
      console.error('インスタンス停止エラー:', error);
      throw new Error(`インスタンスの停止に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * インスタンスの状態を取得
   */
  async getInstanceStatus(): Promise<{
    status: string;
    uptime?: number;
  }> {
    try {
      const [instance] = await this.compute.get({
        project: this.projectId,
        zone: this.zone,
        instance: this.instanceName,
      });

      const status = instance.status || 'UNKNOWN';

      let uptime: number | undefined;
      if (status === 'RUNNING') {
        if (this.startTime) {
          uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
        } else {
          // インスタンスの起動時刻をメタデータから取得を試みる
          const creationTimestamp = instance.creationTimestamp;
          if (creationTimestamp) {
            const startTime = new Date(creationTimestamp);
            uptime = Math.floor((Date.now() - startTime.getTime()) / 1000);
          }
        }
      }

      return {
        status,
        uptime,
      };
    } catch (error) {
      console.error('インスタンス状態取得エラー:', error);
      throw new Error(`インスタンスの状態取得に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * インスタンスが実行中かどうかを確認
   */
  async isInstanceRunning(): Promise<boolean> {
    try {
      const status = await this.getInstanceStatus();
      return status.status === 'RUNNING';
    } catch (error) {
      console.error('インスタンス実行状態確認エラー:', error);
      return false;
    }
  }

  /**
   * オペレーションの完了を待機
   */
  private async waitForOperation(operationName: string): Promise<void> {
    const { ZoneOperationsClient } = await import('@google-cloud/compute');
    const operationsClient = new ZoneOperationsClient();
    
    while (true) {
      const [operation] = await operationsClient.get({
        project: this.projectId,
        zone: this.zone,
        operation: operationName,
      });
      
      if (operation.status === 'DONE') {
        if (operation.error) {
          throw new Error(`Operation failed: ${operation.error.errors?.map(e => e.message).join(', ')}`);
        }
        break;
      }
      
      // 2秒待機してから再チェック
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  /**
   * インスタンスのIPアドレスを取得
   */
  async getInstanceIP(): Promise<string | null> {
    try {
      const [instance] = await this.compute.get({
        project: this.projectId,
        zone: this.zone,
        instance: this.instanceName,
      });
      
      // 外部IPアドレスを取得
      const networkInterfaces = instance.networkInterfaces;
      if (networkInterfaces && networkInterfaces.length > 0) {
        const accessConfigs = networkInterfaces[0].accessConfigs;
        if (accessConfigs && accessConfigs.length > 0) {
          return accessConfigs[0].natIP || null;
        }
      }
      
      return null;
    } catch (error) {
      console.error('インスタンスIP取得エラー:', error);
      return null;
    }
  }
}