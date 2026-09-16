import { env } from '$env/dynamic/private';
import { schema, type PrintMaterial } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';

const BAMBU_API = 'https://api.bambulab.com';

// Two-factor codes are verified by the web portal; the API host has no such route.
const BAMBU_PORTAL = 'https://bambulab.com';
const CSRF_COOKIE = 'bbl_csrf_token';
const CSRF_HEADER = 'x-bbl-csrf-token';

// Bambu's edge rejects browser user agents that arrive without a browser TLS fingerprint.
const BAMBU_USER_AGENT = 'bambu_network_agent/01.09.05.01';

type Device = {
  name: string;
  dev_id: string;
};

export type BambuLoginResponse = {
  accessToken?: string;
  loginType?: 'tfa' | 'verifyCode' | string;
  tfaKey?: string;
};

export type BambuProfile = {
  uidStr: string;
  account: string;
  name: string;
};

function readSetCookie(response: Response, name: string): string | undefined {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = headers.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? ''];

  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');
    if (separator > 0 && cookie.slice(0, separator).trim() === name) {
      return cookie
        .slice(separator + 1)
        .split(';')[0]
        .trim();
    }
  }
}

async function readErrorMessage(response: Response, fallback: string) {
  const body = await response.text();

  try {
    const parsed = JSON.parse(body);
    return parsed.error ?? parsed.message ?? fallback;
  } catch {
    return body.slice(0, 200) || fallback;
  }
}

type BBCChangeFilamentRequestCloud = {
  user_id: string;
  auth_token: string;
  printer_id: string;
  filaments: any[];
};

type BBCChangeFilamentRequestLocal = {
  printer_ip: string;
  access_code: string;
  printer_serial: string;
  filaments: any[];
};

export class BambulabRepository extends BaseRepository {
  async startLogin(account: string, password: string): Promise<BambuLoginResponse> {
    const response = await fetch(`${BAMBU_API}/v1/user-service/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': BAMBU_USER_AGENT,
        accept: 'application/json',
      },
      body: JSON.stringify({ account, password, apiError: '' }),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Bambu Lab rejected the login request'));
    }

    return (await response.json()) as BambuLoginResponse;
  }

  async verifyTfaCode(tfaKey: string, tfaCode: string): Promise<string> {
    const csrfResponse = await fetch(`${BAMBU_PORTAL}/api/csrf`, {
      headers: { 'User-Agent': BAMBU_USER_AGENT, accept: 'application/json' },
    });

    const csrfToken = readSetCookie(csrfResponse, CSRF_COOKIE);
    if (!csrfToken) {
      throw new Error('Bambu Lab did not issue a CSRF token');
    }

    const response = await fetch(`${BAMBU_PORTAL}/api/sign-in/tfa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': BAMBU_USER_AGENT,
        accept: 'application/json',
        [CSRF_HEADER]: csrfToken,
        cookie: `${CSRF_COOKIE}=${csrfToken}`,
      },
      body: JSON.stringify({ tfaKey, tfaCode }),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Two-factor verification failed'));
    }

    const token = readSetCookie(response, 'token');
    if (!token) {
      throw new Error('Bambu Lab accepted the code but returned no token');
    }

    return token;
  }

  async getProfile(authToken: string): Promise<BambuProfile> {
    return (await this._makeRequest(authToken, 'v1/user-service/my/profile')) as BambuProfile;
  }

  async _makeRequest(authToken: string, endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${BAMBU_API}/${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`BBL API error: ${response.status} ${response.statusText} - ${errorText}`);
      throw new Error(`BBL API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async getCloudPrinters(authToken: string): Promise<CloudPrinter[]> {
    const printers: { devices: Device[] } = (await this._makeRequest(
      authToken,
      'v1/iot-service/api/user/bind',
    )) as any;

    return printers.devices.map((device) => ({
      ...device,
      type: 'cloud',
    }));
  }

  async getLocalPrinters(): Promise<LocalPrinter[]> {
    const printers = await this.db.select().from(schema.localBambuConnectPrinter).execute();
    return printers.map((printer) => ({
      name: printer.name,
      type: 'local',
      local_ip: printer.localIp,
      serial: printer.serial,
      access_code: printer.accessCode,
    }));
  }

  async updateAMSCloud(
    printer: CloudPrinter,
    filamentTags: PrintMaterial[],
    credentials: { userId: string; authKey: string },
  ) {
    if (!env.BAMBU_CONNECT_AUTH_KEY) {
      throw new Error('BAMBU_CONNECT_AUTH_KEY not set in environment variables');
    }

    const request: BBCChangeFilamentRequestCloud = {
      user_id: credentials.userId,
      auth_token: credentials.authKey,
      printer_id: printer.dev_id,
      filaments: filamentTags.map((tag) => JSON.parse(tag.bblTagData ?? '{}')),
    };

    await fetch('https://bambu-connect.starforgefoundry.com/change_filament_cloud', {
      headers: {
        Authorization: `Bearer ${env.BAMBU_CONNECT_AUTH_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      method: 'POST',
    });
  }
  async updateAMSLocal(printer: LocalPrinter, filamentTags: PrintMaterial[]) {
    if (!env.BAMBU_CONNECT_AUTH_KEY) {
      throw new Error('BAMBU_CONNECT_AUTH_KEY not set in environment variables');
    }

    const request: BBCChangeFilamentRequestLocal = {
      printer_ip: printer.local_ip,
      printer_serial: printer.serial,
      access_code: printer.access_code,
      filaments: filamentTags.map((tag) => JSON.parse(tag.bblTagData ?? '{}')),
    };

    await fetch('https://bambu-connect.starforgefoundry.com/change_filament_local', {
      headers: {
        Authorization: `Bearer ${env.BAMBU_CONNECT_AUTH_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      method: 'POST',
    });
  }
}
