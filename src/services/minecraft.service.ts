import { Rcon } from 'rcon-client';
import { Config } from '../types/config';

export interface MinecraftServerInfo {
  isOnline: boolean;
  playerCount: number;
  players: string[];
  uptime?: number;
}

export class MinecraftService {
  private host: string;
  private port: number;
  private password: string;
  private serverStartTime: Date | null = null;
  private lastConnectionCheck: Date = new Date(0);

  constructor(config: Config['minecraft']) {
    this.host = config.host;
    this.port = config.rconPort;
    this.password = config.rconPassword;
  }

  /**
   * RCONクライアントを作成し接続
   */
  private async createRconClient(): Promise<Rcon> {
    const rcon = new Rcon({
      host: this.host,
      port: this.port,
      password: this.password,
      timeout: 5000,
    });

    try {
      await rcon.connect();
      return rcon;
    } catch (error) {
      throw new Error(`RCON接続に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * RCONコマンドを実行
   */
  private async executeCommand(command: string): Promise<string> {
    let rcon: Rcon | null = null;
    
    try {
      rcon = await this.createRconClient();
      const response = await rcon.send(command);
      return response;
    } finally {
      if (rcon) {
        await rcon.end();
      }
    }
  }

  /**
   * サーバー情報を取得
   */
  async getServerInfo(): Promise<MinecraftServerInfo> {
    try {
      // プレイヤーリストを取得
      const playersResponse = await this.executeCommand('list');
      
      // プレイヤー情報をパース
      const playerInfo = this.parsePlayerList(playersResponse);
      
      // サーバーが応答した場合はオンライン
      const isOnline = true;
      
      // サーバー起動時刻の推定（初回接続時に記録）
      if (isOnline && !this.serverStartTime) {
        this.serverStartTime = new Date();
      } else if (!isOnline) {
        this.serverStartTime = null;
      }

      let uptime: number | undefined;
      if (this.serverStartTime) {
        uptime = Math.floor((Date.now() - this.serverStartTime.getTime()) / 1000);
      }

      this.lastConnectionCheck = new Date();

      return {
        isOnline,
        playerCount: playerInfo.count,
        players: playerInfo.players,
        uptime,
      };
    } catch (error) {
      console.error('Minecraftサーバー情報取得エラー:', error);
      
      // 接続に失敗した場合はオフライン扱い
      return {
        isOnline: false,
        playerCount: 0,
        players: [],
      };
    }
  }

  /**
   * プレイヤーリストのレスポンスをパース
   */
  private parsePlayerList(response: string): { count: number; players: string[] } {
    // Minecraftの list コマンドのレスポンス例:
    // "There are 2 of a max of 20 players online: player1, player2"
    // "There are 0 of a max of 20 players online:"
    
    const match = response.match(/There are (\d+) of a max of \d+ players online:?(.*)$/);
    
    if (!match) {
      return { count: 0, players: [] };
    }

    const count = parseInt(match[1], 10);
    const playersString = match[2]?.trim();
    
    let players: string[] = [];
    if (count > 0 && playersString) {
      players = playersString.split(',').map(name => name.trim()).filter(name => name.length > 0);
    }

    return { count, players };
  }

  /**
   * ワールドを保存
   */
  async saveWorld(): Promise<string> {
    try {
      console.log('ワールドを保存中...');
      
      // save-allコマンドでワールドを保存
      const response = await this.executeCommand('save-all');
      
      console.log('ワールド保存完了:', response);
      return 'ワールドの保存が完了しました。';
    } catch (error) {
      console.error('ワールド保存エラー:', error);
      throw new Error(`ワールドの保存に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * サーバーを停止
   */
  async stopServer(): Promise<string> {
    try {
      console.log('Minecraftサーバーを停止中...');
      
      // ワールドを保存してからサーバーを停止
      await this.saveWorld();
      
      // stopコマンドでサーバーを停止
      await this.executeCommand('stop');
      
      this.serverStartTime = null;
      
      console.log('Minecraftサーバー停止完了');
      return 'Minecraftサーバーの停止が完了しました。';
    } catch (error) {
      console.error('サーバー停止エラー:', error);
      throw new Error(`サーバーの停止に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * プレイヤーに告知メッセージを送信
   */
  async broadcastMessage(message: string): Promise<void> {
    try {
      await this.executeCommand(`say ${message}`);
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      // メッセージ送信の失敗は致命的ではないため、エラーをスローしない
    }
  }

  /**
   * サーバーがオンラインかどうかを確認
   */
  async isServerOnline(): Promise<boolean> {
    try {
      const info = await this.getServerInfo();
      return info.isOnline;
    } catch (error) {
      return false;
    }
  }

  /**
   * プレイヤー数を取得
   */
  async getPlayerCount(): Promise<number> {
    try {
      const info = await this.getServerInfo();
      return info.playerCount;
    } catch (error) {
      console.error('プレイヤー数取得エラー:', error);
      return 0;
    }
  }
}