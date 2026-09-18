import type { StratumConfig } from '@stratum/config';
import type { DatabaseAdapter } from '@stratum/database';
import type { StorageProvider } from '@stratum/storage';
import type { RealtimeHub } from '@stratum/realtime';
import type { LocalFunctionRuntime } from '@stratum/functions';
import type { Logger, KeyRole } from '@stratum/shared';

export interface Services {
  config: StratumConfig;
  db: DatabaseAdapter;
  storage: StorageProvider;
  hub: RealtimeHub;
  functions: LocalFunctionRuntime;
  logger: Logger;
}

/** Per-request state set by middleware. */
export interface RequestVars {
  services: Services;
  keyRole: KeyRole;
  keyId: string | null;
  startedAt: number;
}

export type AppEnv = { Variables: RequestVars };
