#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/46398d695235a96f6f0e9465bfcdcfc433dc137a149731a91fa0b27d3fd105a1/contract';
import endContract from '../../snapshots/46398d695235a96f6f0e9465bfcdcfc433dc137a149731a91fa0b27d3fd105a1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'position_status',
        members: ['open', 'closed'],
      }),
      this.createTable({
        schema: 'public',
        table: 'positions',
        columns: [
          col('amount', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('created_at', 'timestamp', {
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-temporal@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('pnl', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('position_status', '"position_status"', {
            default: lit('open'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'position_status' } },
          }),
          col('price', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('token_identifier', 'character varying(63)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 63 } },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'positions_pkey' })],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
