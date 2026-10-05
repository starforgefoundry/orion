import { env } from '$env/dynamic/private';
import { getDB, type Database } from '$lib/server/db';
import { SquareClient } from 'square';

export class BaseRepository {
  private _db?: Database;
  private _square?: SquareClient;

  constructor(db?: Database, square?: SquareClient) {
    this._db = db;
    this._square = square;
  }

  protected get db(): Database {
    if (!this._db) {
      this._db = getDB();
    }
    return this._db;
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
