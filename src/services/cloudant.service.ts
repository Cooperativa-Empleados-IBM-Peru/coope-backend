import {HttpErrors} from '@loopback/rest';

export const CLOUDANT_CLIENT = 'services.CloudantClient';

export interface CloudantClientConfig {
  url?: string;
  username?: string;
  password?: string;
}

export interface CloudantRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  // Path segments below the Cloudant account URL, e.g. ['servicios', 'abc']
  segments: string[];
  query?: Record<string, string>;
  body?: object;
}

const TIMEOUT_MS = 15000;

/**
 * Minimal Cloudant (CouchDB HTTP API) client. Credentials come from the
 * server environment only, they are never exposed to the UI.
 */
export class CloudantClient {
  constructor(
    private readonly config: CloudantClientConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async request(req: CloudantRequest): Promise<unknown> {
    const {url, username, password} = this.config;
    if (!url || !username || !password || !url.startsWith('https://')) {
      console.error('Cloudant is not configured correctly');
      throw new HttpErrors.ServiceUnavailable('Service unavailable');
    }

    const target = new URL(
      url.replace(/\/+$/, '') +
        '/' +
        req.segments.map(encodeURIComponent).join('/'),
    );
    for (const [key, value] of Object.entries(req.query ?? {})) {
      target.searchParams.set(key, value);
    }

    const hasBody = req.method === 'POST' || req.method === 'PUT';
    let upstream: Response;
    try {
      upstream = await this.fetchFn(target, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization:
            'Basic ' +
            Buffer.from(`${username}:${password}`).toString('base64'),
        },
        body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      console.error('Cloudant request error:', (err as Error).message);
      throw new HttpErrors.BadGateway('Bad gateway');
    }

    if (upstream.status >= 500) {
      throw new HttpErrors.BadGateway('Bad gateway');
    }
    if (upstream.status >= 400) {
      throw HttpErrors(upstream.status, 'Cloudant request failed');
    }
    try {
      return await upstream.json();
    } catch {
      throw new HttpErrors.BadGateway('Bad gateway');
    }
  }
}
