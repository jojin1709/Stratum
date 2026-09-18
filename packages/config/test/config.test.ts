import { describe, expect, it, beforeEach } from 'vitest';
import { loadConfig, resetConfig } from '../src/index.js';

describe('@stratum/config', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('loads defaults with valid DATABASE_URL', () => {
    const config = loadConfig({ DATABASE_URL: 'postgres://localhost:5432/test' });
    expect(config.DATABASE_URL).toBe('postgres://localhost:5432/test');
    expect(config.STORAGE_DRIVER).toBe('local');
    expect(config.STRATUM_API_PORT).toBe(8788);
    expect(config.STRATUM_DASHBOARD_PORT).toBe(8787);
    expect(config.isProduction).toBe(false);
    expect(config.corsOrigins).toEqual(['http://localhost:8787']);
  });

  it('throws descriptive error if DATABASE_URL is missing', () => {
    expect(() => loadConfig({ DATABASE_URL: '' })).toThrow(/Invalid Stratum configuration/);
  });

  it('validates S3 / R2 required fields when STORAGE_DRIVER=s3', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgres://localhost:5432/test',
        STORAGE_DRIVER: 's3',
      }),
    ).toThrow(/R2_ENDPOINT is required when STORAGE_DRIVER=s3/);
  });

  it('accepts full S3 / R2 configuration', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://localhost:5432/test',
      STORAGE_DRIVER: 's3',
      R2_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
      R2_BUCKET: 'my-bucket',
      R2_ACCESS_KEY_ID: 'key-id',
      R2_SECRET_ACCESS_KEY: 'secret-key',
    });
    expect(config.STORAGE_DRIVER).toBe('s3');
    expect(config.R2_BUCKET).toBe('my-bucket');
  });
});
