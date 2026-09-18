export interface ColumnDefinition {
  name: string;
  /** Postgres type, validated against the supported-type allowlist. */
  type: string;
  nullable?: boolean;
  defaultValue?: string | null;
  primaryKey?: boolean;
  unique?: boolean;
  references?: { schema?: string; table: string; column: string; onDelete?: ForeignKeyAction };
}

export type ForeignKeyAction = 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';

export interface ColumnInfo {
  name: string;
  dataType: string;
  udtName: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isUnique: boolean;
  ordinalPosition: number;
  maxLength: number | null;
  comment: string | null;
}

export interface ForeignKeyInfo {
  constraintName: string;
  schema: string;
  table: string;
  columns: string[];
  referencedSchema: string;
  referencedTable: string;
  referencedColumns: string[];
  onDelete: string;
  onUpdate: string;
}

export interface IndexInfo {
  name: string;
  schema: string;
  table: string;
  definition: string;
  isUnique: boolean;
  isPrimary: boolean;
}

export interface TableInfo {
  schema: string;
  name: string;
  kind: 'table' | 'view' | 'materialized_view';
  comment: string | null;
  estimatedRows: number;
  sizeBytes: number;
  columns: ColumnInfo[];
  primaryKey: string[];
}

export interface SchemaSnapshot {
  generatedAt: string;
  schemas: string[];
  tables: TableInfo[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  fields: { name: string; dataTypeId: number }[];
  command: string;
  durationMs: number;
}

export type FilterOperator =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'like' | 'ilike' | 'is' | 'in' | 'contains';

export interface Filter {
  column: string;
  operator: FilterOperator;
  value: unknown;
}

export interface ListParams {
  limit: number;
  offset: number;
  order: { column: string; ascending: boolean; nullsFirst?: boolean }[];
  select: string[] | null;
  filters: Filter[];
  count: boolean;
}

export interface Paginated<T> {
  data: T[];
  count: number | null;
  limit: number;
  offset: number;
}

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface DatabaseChangeEvent {
  type: RealtimeEventType;
  schema: string;
  table: string;
  record: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
  commitTimestamp: string;
}

export interface BucketInfo {
  name: string;
  public: boolean;
  createdAt: string;
  fileCount?: number;
  sizeBytes?: number;
}

export interface StorageObjectInfo {
  key: string;
  size: number;
  contentType: string;
  lastModified: string;
  etag?: string;
}
