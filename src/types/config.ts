export interface Config {
  discord: {
    token: string;
    guildId: string;
    publicKey: string;
    applicationId: string;
  };
  gcp: {
    projectId: string;
    zone: string;
    instanceName: string;
  };
  minecraft: {
    host: string;
    rconPort: number;
    rconPassword: string;
  };
  monitoring: {
    idleTimeoutMinutes: number;
    checkIntervalSeconds: number;
  };
}

export interface ServerStatus {
  gcpInstance: {
    status: string;
    uptime?: number;
  };
  minecraft: {
    isOnline: boolean;
    playerCount: number;
    players: string[];
    uptime?: number;
  };
}