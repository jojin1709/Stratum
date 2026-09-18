import pg from 'pg';
import { assertIdentifier, quoteIdent, quoteQualified, type DatabaseChangeEvent, type Logger } from '@stratum/shared';
import type { DatabaseAdapter } from '@stratum/database';
import type { RealtimeHub } from './hub.js';

const NOTIFY_CHANNEL = 'stratum_changes';

/**
 * Triggers emit JSON payloads over pg_notify on the channel `stratum_changes`.
 * If the payload exceeds Postgres's 8000-byte NOTIFY limit, the trigger sends a
 * header-only event with `truncated: true` and the client/hub falls back to fetching.
 */
export const TRIGGER_FUNCTION_SQL = `
CREATE OR REPLACE FUNCTION stratum.notify_change() RETURNS trigger AS $$
DECLARE
  payload json;
  record_json json;
  old_json json;
BEGIN
  record_json := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW) END;
  old_json    := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD) END;

  payload := json_build_object(
    'type', TG_OP,
    'schema', TG_TABLE_SCHEMA,
    'table', TG_TABLE_NAME,
    'record', record_json,
    'old', old_json,
    'commitTimestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  IF octet_length(payload::text) > 7800 THEN
    payload := json_build_object(
      'type', TG_OP,
      'schema', TG_TABLE_SCHEMA,
      'table', TG_TABLE_NAME,
      'record', NULL,
      'old', NULL,
      'truncated', true,
      'commitTimestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
  END IF;

  PERFORM pg_notify('stratum_changes', payload::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
`;

export async function installTriggerFunction(db: DatabaseAdapter): Promise<void> {
  await db.query(TRIGGER_FUNCTION_SQL);
}

export async function enableRealtimeForTable(db: DatabaseAdapter, schema: string, table: string): Promise<void> {
  assertIdentifier(schema, 'schema');
  assertIdentifier(table, 'table');
  await installTriggerFunction(db);

  const triggerName = `stratum_notify_${schema}_${table}`;
  const target = quoteQualified(schema, table);

  await db.query(`DROP TRIGGER IF EXISTS ${quoteIdent(triggerName, 'trigger')} ON ${target}`);
  await db.query(`
    CREATE TRIGGER ${quoteIdent(triggerName, 'trigger')}
      AFTER INSERT OR UPDATE OR DELETE ON ${target}
      FOR EACH ROW EXECUTE FUNCTION stratum.notify_change()`);

  await db.query(
    `insert into stratum.realtime_tables (schema_name, table_name) values ($1,$2)
       on conflict (schema_name, table_name) do nothing`,
    [schema, table],
  );
}

export async function disableRealtimeForTable(db: DatabaseAdapter, schema: string, table: string): Promise<void> {
  assertIdentifier(schema, 'schema');
  assertIdentifier(table, 'table');
  const triggerName = `stratum_notify_${schema}_${table}`;
  await db.query(`DROP TRIGGER IF EXISTS ${quoteIdent(triggerName, 'trigger')} ON ${quoteQualified(schema, table)}`);
  await db.query(`delete from stratum.realtime_tables where schema_name = $1 and table_name = $2`, [schema, table]);
}

export async function listRealtimeTables(db: DatabaseAdapter): Promise<{ schema: string; table: string }[]> {
  const res = await db.query<{ schema_name: string; table_name: string }>(
    `select schema_name, table_name from stratum.realtime_tables order by schema_name, table_name`,
  );
  return res.rows.map((r) => ({ schema: r.schema_name, table: r.table_name }));
}

/**
 * Dedicated persistent Postgres connection listening on LISTEN stratum_changes.
 * Forwards parsed change events into the RealtimeHub.
 */
export class PostgresChangeListener {
  private readonly connectionString: string;
  private readonly hub: RealtimeHub;
  private readonly logger?: Logger;
  private client: pg.Client | null = null;
  private running = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(opts: { connectionString: string; hub: RealtimeHub; logger?: Logger }) {
    this.connectionString = opts.connectionString;
    this.hub = opts.hub;
    this.logger = opts.logger;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.connect();
  }

  private async connect(): Promise<void> {
    const client = new pg.Client({ connectionString: this.connectionString, application_name: 'stratum-realtime' });
    this.client = client;

    client.on('notification', (msg) => {
      if (msg.channel !== NOTIFY_CHANNEL || !msg.payload) return;
      try {
        const event = JSON.parse(msg.payload) as DatabaseChangeEvent;
        this.hub.dispatchPostgresChange(event);
      } catch (e) {
        this.logger?.warn('failed to parse postgres change notification', { error: String(e), payload: msg.payload });
      }
    });

    client.on('error', (e) => {
      this.logger?.warn('realtime change listener disconnected, reconnecting...', { error: String(e) });
      this.scheduleReconnect();
    });

    client.on('end', () => {
      if (this.running) this.scheduleReconnect();
    });

    try {
      await client.connect();
      await client.query(`LISTEN ${NOTIFY_CHANNEL}`);
      this.logger?.info('realtime change listener connected');
    } catch (e) {
      this.logger?.warn('failed initial connection to postgres for realtime changes', { error: String(e) });
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.running || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.running) await this.connect();
    }, 2000);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.client) {
      await this.client.end().catch(() => {});
      this.client = null;
    }
  }
}
