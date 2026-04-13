import { env } from '$env/dynamic/private';
import { BaseRepository } from '$lib/server/repositories/base.repository';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar';

export interface GoogleCalendarEventInput {
  summary: string;
  description: string;
  startDateTime: string; // ISO 8601 with offset
  endDateTime: string;
  timeZone: string;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

export class GoogleCalendarRepository extends BaseRepository {
  private get serviceAccountEmail(): string {
    const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    if (!email) throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL is not configured');
    return email;
  }

  private get privateKeyPem(): string {
    const key = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is not configured');
    // Support escaped newlines (common when the key is stored in a single-line env var).
    return key.replace(/\\n/g, '\n');
  }

  isConfigured(): boolean {
    return Boolean(
      env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    );
  }

  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (tokenCache && tokenCache.expiresAt - 30 > now) {
      return tokenCache.token;
    }

    const header = { alg: 'RS256', typ: 'JWT' };
    const claims = {
      iss: this.serviceAccountEmail,
      scope: SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    };

    const jwt = await this.signJwt(header, claims);

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google token exchange failed (${res.status}): ${text}`);
    }

    const body = (await res.json()) as { access_token: string; expires_in: number };
    tokenCache = {
      token: body.access_token,
      expiresAt: now + body.expires_in,
    };
    return body.access_token;
  }

  private async signJwt(header: object, claims: object): Promise<string> {
    const encoder = new TextEncoder();
    const encodedHeader = base64UrlEncode(encoder.encode(JSON.stringify(header)));
    const encodedClaims = base64UrlEncode(encoder.encode(JSON.stringify(claims)));
    const signingInput = `${encodedHeader}.${encodedClaims}`;

    const privateKey = await this.importPrivateKey();
    const signature = await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      privateKey,
      encoder.encode(signingInput),
    );

    return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
  }

  private async importPrivateKey(): Promise<CryptoKey> {
    const pem = this.privateKeyPem;
    const pemContents = pem
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s+/g, '');
    const binaryDer = base64ToArrayBuffer(pemContents);
    return await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
  }

  private async apiRequest(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const token = await this.getAccessToken();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(`${GOOGLE_CALENDAR_API}${path}`, { ...init, headers });
    return res;
  }

  async createCalendar(teacherName: string, teacherEmail: string): Promise<string> {
    const res = await this.apiRequest('/calendars', {
      method: 'POST',
      body: JSON.stringify({
        summary: `${teacherName} - Starforge Class Bookings`,
        description: `Auto-synced class bookings for ${teacherName} (${teacherEmail}).`,
        timeZone: 'America/Chicago',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to create calendar (${res.status}): ${text}`);
    }

    const body = (await res.json()) as { id: string };

    // Share read-only with anyone who has the link so teachers can add it to any
    // Google account via the `cid=` invite link.
    await this.makeCalendarPublic(body.id);

    return body.id;
  }

  async makeCalendarPublic(calendarId: string): Promise<void> {
    const res = await this.apiRequest(
      `/calendars/${encodeURIComponent(calendarId)}/acl`,
      {
        method: 'POST',
        body: JSON.stringify({
          role: 'reader',
          scope: { type: 'default' },
        }),
      },
    );
    if (!res.ok && res.status !== 409) {
      const text = await res.text();
      throw new Error(`Failed to publish calendar (${res.status}): ${text}`);
    }
  }

  async createEvent(
    calendarId: string,
    event: GoogleCalendarEventInput,
  ): Promise<string> {
    const res = await this.apiRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          start: { dateTime: event.startDateTime, timeZone: event.timeZone },
          end: { dateTime: event.endDateTime, timeZone: event.timeZone },
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to create event (${res.status}): ${text}`);
    }

    const body = (await res.json()) as { id: string };
    return body.id;
  }

  async updateEvent(
    calendarId: string,
    eventId: string,
    event: GoogleCalendarEventInput,
  ): Promise<void> {
    const res = await this.apiRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          start: { dateTime: event.startDateTime, timeZone: event.timeZone },
          end: { dateTime: event.endDateTime, timeZone: event.timeZone },
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to update event (${res.status}): ${text}`);
    }
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    const res = await this.apiRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE' },
    );

    // 404/410 mean already gone; treat as success.
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      const text = await res.text();
      throw new Error(`Failed to delete event (${res.status}): ${text}`);
    }
  }

  /**
   * Builds the `cid=`-style "add calendar" URL. Because the calendar is shared
   * publicly read-only, any signed-in Google user who follows the link can add
   * it to their account.
   */
  buildAddCalendarUrl(calendarId: string): string {
    // Google expects the calendar ID to be base64-encoded (no padding) for the
    // cid parameter in the "add by URL" flow.
    const encoded = base64UrlEncodeString(calendarId).replace(/=+$/, '');
    return `https://calendar.google.com/calendar/r?cid=${encoded}`;
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeString(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_');
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer.buffer;
}
