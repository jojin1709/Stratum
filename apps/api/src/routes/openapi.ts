import { Hono } from 'hono';
import { snapshotSchema } from '@stratum/database';
import type { AppEnv, Services } from '../context.js';

function jsonType(udt: string): { type: string; format?: string } {
  if (/^(int2|int4|int8|serial|bigserial)$/.test(udt)) return { type: 'integer' };
  if (/^(float4|float8|numeric)$/.test(udt)) return { type: 'number' };
  if (udt === 'bool') return { type: 'boolean' };
  if (udt === 'uuid') return { type: 'string', format: 'uuid' };
  if (/^(json|jsonb)$/.test(udt)) return { type: 'object' };
  if (/^(timestamp|timestamptz|date)$/.test(udt)) return { type: 'string', format: 'date-time' };
  return { type: 'string' };
}

export function openApiRoutes(services: Services) {
  const app = new Hono<AppEnv>();

  const handler = async (c: any) => {
    let snapshot: { tables: any[] } = { tables: [] };
    try {
      snapshot = await snapshotSchema(services.db);
    } catch {
      snapshot = { tables: [] };
    }

    const paths: Record<string, unknown> = {};
    const schemas: Record<string, unknown> = {};

    for (const table of snapshot.tables) {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const col of table.columns || []) {
        properties[col.name] = { ...jsonType(col.udtName), nullable: col.nullable, description: col.comment ?? undefined };
        if (!col.nullable && col.defaultValue === null) required.push(col.name);
      }
      schemas[table.name] = { type: 'object', properties, required };

      const listPath = `/api/v1/${table.name}`;
      const tag = `${table.schema}.${table.name}`;
      paths[listPath] = {
        get: {
          tags: [tag],
          summary: `List rows from ${tag}`,
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 1000 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
            { name: 'select', in: 'query', schema: { type: 'string' }, description: 'Comma-separated column list.' },
            { name: 'order', in: 'query', schema: { type: 'string' }, description: 'e.g. created_at.desc' },
            { name: 'count', in: 'query', schema: { type: 'string', enum: ['exact'] } },
          ],
          responses: {
            200: {
              description: 'A page of rows.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { $ref: `#/components/schemas/${table.name}` } },
                      count: { type: 'integer', nullable: true },
                      limit: { type: 'integer' },
                      offset: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: [tag],
          summary: `Insert rows into ${tag}`,
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: `#/components/schemas/${table.name}` } } },
          },
          responses: { 201: { description: 'Inserted rows.' } },
        },
      };

      if (table.primaryKey && table.primaryKey.length === 1) {
        paths[`${listPath}/{id}`] = {
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          get: { tags: [tag], summary: `Fetch one row by ${table.primaryKey[0]}`, responses: { 200: { description: 'The row.' }, 404: { description: 'Not found.' } } },
          patch: { tags: [tag], summary: 'Update one row', responses: { 200: { description: 'Updated row.' } } },
          delete: { tags: [tag], summary: 'Delete one row', responses: { 204: { description: 'Deleted.' } } },
        };
      }
    }

    return c.json({
      openapi: '3.1.0',
      info: {
        title: 'Stratum API',
        version: '0.1.0',
        description: 'Automatically generated from the live database schema.',
      },
      components: {
        schemas,
        securitySchemes: { apiKey: { type: 'apiKey', in: 'header', name: 'apikey' } },
      },
      security: [{ apiKey: [] }],
      paths,
    });
  };

  app.get('/openapi.json', handler);
  app.get('/openapi.json/', handler);

  return app;
}
