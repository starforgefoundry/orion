import { env } from '$env/dynamic/private';
import { getDB } from '$lib/server/db';
import { drizzle } from 'drizzle-orm/d1';
import { SquareClient } from 'square';

import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import S3mini from 's3mini';

type MailgunClient = ReturnType<Mailgun['client']>;
type Database = ReturnType<typeof drizzle>;

export class BaseRepository {
  private _db?: Database;
  private _s3?: S3mini;
  private _square?: SquareClient;
  private _mailgun?: MailgunClient;

  constructor(db?: Database, s3?: S3mini, square?: SquareClient, mailgun?: MailgunClient) {
    this._db = db;
    this._s3 = s3;
    this._square = square;
    this._mailgun = mailgun;
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

  protected get mailgun() {
    if (!this._mailgun) {
      const mailgun = new Mailgun(FormData);
      this._mailgun = mailgun.client({
        username: 'api',
        key: env.MAILGUN_API_KEY!,
      });
    }

    return this._mailgun;
  }
}
