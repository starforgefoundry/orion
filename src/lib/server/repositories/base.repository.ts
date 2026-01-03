import { env } from '$env/dynamic/private';
import { getDB } from '$lib/server/db';
import { drizzle } from 'drizzle-orm/d1';
import { SquareClient } from 'square';

import S3mini from 's3mini';

type Database = ReturnType<typeof drizzle>;

export class BaseRepository {
  private _db?: Database;
  private _s3?: S3mini;
  private _square?: SquareClient;

  constructor(db?: Database, s3?: S3mini, square?: SquareClient) {
    this._db = db;
    this._s3 = s3;
    this._square = square;
  }

  protected get db(): Database {
    if (!this._db) {
      this._db = getDB();
    }
    return this._db;
  }

  protected get s3(): S3mini {
    if (!this._s3) {
      this._s3 = new S3mini({
        accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: env.S3_APPLICATION_KEY ?? '',
        endpoint: env.S3_ENDPOINT ?? '',
      });
    }
    return this._s3;
  }

  protected get square(): SquareClient {
    if (!this._square) {
      this._square = new SquareClient({
        token: env.SQUARE_TOKEN,
        baseUrl: env.SQUARE_URL ?? 'https://connect.squareup.com',
      });
    }
    return this._square;
  }
}
