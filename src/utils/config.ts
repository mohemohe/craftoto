import dotenv from 'dotenv';
import { Config } from '../types/config';

dotenv.config();

export function loadConfig(): Config {
  const requiredEnvVars = [
    'DISCORD_TOKEN',
    'GUILD_ID',
    'GCP_PROJECT_ID',
    'GCP_ZONE',
    'GCP_INSTANCE_NAME',
    'MINECRAFT_HOST',
    'MINECRAFT_RCON_PORT',
    'MINECRAFT_RCON_PASSWORD',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    discord: {
      token: process.env.DISCORD_TOKEN!,
      guildId: process.env.GUILD_ID!,
    },
    gcp: {
      projectId: process.env.GCP_PROJECT_ID!,
      zone: process.env.GCP_ZONE!,
      instanceName: process.env.GCP_INSTANCE_NAME!,
    },
    minecraft: {
      host: process.env.MINECRAFT_HOST!,
      rconPort: parseInt(process.env.MINECRAFT_RCON_PORT!, 10),
      rconPassword: process.env.MINECRAFT_RCON_PASSWORD!,
    },
    monitoring: {
      idleTimeoutMinutes: parseInt(process.env.IDLE_TIMEOUT_MINUTES || '15', 10),
      checkIntervalSeconds: parseInt(process.env.CHECK_INTERVAL_SECONDS || '60', 10),
    },
  };
}