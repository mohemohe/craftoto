import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';

// 設定の読み込み
const config = new pulumi.Config();
const gcpConfig = new pulumi.Config('gcp');

// GCP設定
const project = gcpConfig.require('project');
const region = gcpConfig.get('region') || 'asia-northeast1';

// Discord設定
const discordPublicKey = config.requireSecret('discord-public-key');
const discordToken = config.requireSecret('discord-token');
const discordApplicationId = config.requireSecret('discord-application-id');
const discordGuildId = config.requireSecret('discord-guild-id');

// Minecraft設定
const minecraftHost = config.require('minecraft-host');
const minecraftRconPort = config.get('minecraft-rcon-port') || '25575';
const minecraftRconPassword = config.requireSecret('minecraft-rcon-password');

// GCP管理対象設定
const gcpProjectId = config.require('gcp-project-id');
const gcpZone = config.get('gcp-zone') || 'asia-northeast1-a';
const gcpInstanceName = config.require('gcp-instance-name');

// 監視設定
const idleTimeoutMinutes = config.get('idle-timeout-minutes') || '15';
const checkIntervalSeconds = config.get('check-interval-seconds') || '60';

// Cloud Runサービス用のサービスアカウント
const cloudRunServiceAccount = new gcp.serviceaccount.Account('craftoto-cloud-run-sa', {
  accountId: 'craftoto-cloud-run',
  displayName: 'Craftoto Cloud Run Service Account',
  description: 'Service account for Craftoto Cloud Run service',
});

// Cloud Runサービスアカウントに必要な権限を付与
const computeInstanceAdminBinding = new gcp.projects.IAMBinding('craftoto-compute-instance-admin', {
  project: gcpProjectId,
  role: 'roles/compute.instanceAdmin',
  members: [pulumi.interpolate`serviceAccount:${cloudRunServiceAccount.email}`],
});

// Cloud Runサービス
const cloudRunService = new gcp.cloudrun.Service('craftoto-service', {
  name: 'craftoto',
  location: region,
  
  template: {
    spec: {
      serviceAccountName: cloudRunServiceAccount.email,
      containers: [{
        image: 'gcr.io/cloudrun/hello', // 初期イメージ（後でデプロイ時に更新）
        ports: [{
          containerPort: 3000,
        }],
        env: [
          {
            name: 'DISCORD_TOKEN',
            value: discordToken,
          },
          {
            name: 'GUILD_ID',
            value: discordGuildId,
          },
          {
            name: 'DISCORD_PUBLIC_KEY',
            value: discordPublicKey,
          },
          {
            name: 'DISCORD_APPLICATION_ID',
            value: discordApplicationId,
          },
          {
            name: 'GCP_PROJECT_ID',
            value: gcpProjectId,
          },
          {
            name: 'GCP_ZONE',
            value: gcpZone,
          },
          {
            name: 'GCP_INSTANCE_NAME',
            value: gcpInstanceName,
          },
          {
            name: 'MINECRAFT_HOST',
            value: minecraftHost,
          },
          {
            name: 'MINECRAFT_RCON_PORT',
            value: minecraftRconPort,
          },
          {
            name: 'MINECRAFT_RCON_PASSWORD',
            value: minecraftRconPassword,
          },
          {
            name: 'IDLE_TIMEOUT_MINUTES',
            value: idleTimeoutMinutes,
          },
          {
            name: 'CHECK_INTERVAL_SECONDS',
            value: checkIntervalSeconds,
          },
        ],
        resources: {
          limits: {
            cpu: '1000m',
            memory: '512Mi',
          },
        },
      }],
    },
    metadata: {
      annotations: {
        'autoscaling.knative.dev/maxScale': '10',
        'autoscaling.knative.dev/minScale': '0',
        'run.googleapis.com/execution-environment': 'gen2',
      },
    },
  },
  
  traffic: [{
    percent: 100,
    latestRevision: true,
  }],
});

// Cloud Runサービスに対する公開アクセス権限（Discord Webhookから呼び出すため）
const cloudRunInvoker = new gcp.cloudrun.IamBinding('craftoto-invoker', {
  service: cloudRunService.name,
  location: region,
  role: 'roles/run.invoker',
  members: ['allUsers'],
});

// Cloud Scheduler用のサービスアカウント
const schedulerServiceAccount = new gcp.serviceaccount.Account('craftoto-scheduler-sa', {
  accountId: 'craftoto-scheduler',
  displayName: 'Craftoto Scheduler Service Account',
  description: 'Service account for Craftoto Cloud Scheduler',
});

// Cloud Scheduler用サービスアカウントにCloud Run呼び出し権限を付与
const schedulerInvokerBinding = new gcp.projects.IAMBinding('craftoto-scheduler-invoker', {
  project: project,
  role: 'roles/run.invoker',
  members: [pulumi.interpolate`serviceAccount:${schedulerServiceAccount.email}`],
});

// Cloud Scheduler ジョブ（プレイヤー監視用）
const monitoringSchedulerJob = new gcp.cloudscheduler.Job('craftoto-monitoring-job', {
  name: 'craftoto-monitoring',
  description: 'Craftoto player monitoring job',
  schedule: '*/5 * * * *', // 5分おきに実行
  timeZone: 'Asia/Tokyo',
  region: region,
  
  httpTarget: {
    uri: pulumi.interpolate`${cloudRunService.statuses[0].url}/monitor`,
    httpMethod: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: btoa(JSON.stringify({
      source: 'cloud-scheduler',
      job: 'monitoring',
    })),
    oidcToken: {
      serviceAccountEmail: schedulerServiceAccount.email,
    },
  },
  
  retryConfig: {
    retryCount: 3,
    maxRetryDuration: '60s',
    minBackoffDuration: '5s',
    maxBackoffDuration: '60s',
  },
});

// 出力
export const cloudRunUrl = cloudRunService.statuses[0].url;
export const cloudRunServiceAccountEmail = cloudRunServiceAccount.email;
export const schedulerServiceAccountEmail = schedulerServiceAccount.email;
export const monitoringJobName = monitoringSchedulerJob.name;