import { Injectable, Logger } from '@nestjs/common';
import type {
  SireneSearchParams,
  SireneSearchResponse,
} from './sirene-client.types';

// VERIFY BEFORE PRODUCTION USE: base URLs, exact auth flow, and rate limits
// below are a best-effort scaffold, not a checked-today copy of INSEE's
// live docs (https://portail-api.insee.fr). Confirm before relying on them.
const TOKEN_URL = 'https://api.insee.fr/token';
const SEARCH_URL = 'https://api.insee.fr/entreprises/sirene/V3.11/siret';

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

/**
 * Thin client for the INSEE Sirene API v3. Handles OAuth2 client_credentials
 * token caching/refresh and paginated établissement search, with retry +
 * backoff on rate-limit/server errors. No business logic here — that lives
 * in CompanyRegistrySyncService.
 */
@Injectable()
export class SireneClientService {
  private readonly logger = new Logger(SireneClientService.name);
  private cachedToken: CachedToken | null = null;

  /** True when SIRENE credentials are configured; sync should no-op otherwise. */
  isConfigured(): boolean {
    return Boolean(
      process.env.SIRENE_CLIENT_ID && process.env.SIRENE_CLIENT_SECRET,
    );
  }

  async search(params: SireneSearchParams): Promise<SireneSearchResponse> {
    const token = await this.getAccessToken();
    const url = new URL(SEARCH_URL);
    url.searchParams.set('q', params.q);
    url.searchParams.set('curseur', params.curseur ?? '*');
    url.searchParams.set('nombre', String(params.nombre ?? 1000));

    const res = await this.fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return (await res.json()) as SireneSearchResponse;
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 5000) {
      return this.cachedToken.accessToken;
    }

    const clientId = process.env.SIRENE_CLIENT_ID;
    const clientSecret = process.env.SIRENE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error(
        'SIRENE_CLIENT_ID/SIRENE_CLIENT_SECRET are not configured',
      );
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    );
    const res = await this.fetchWithRetry(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const body = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.cachedToken = {
      accessToken: body.access_token,
      expiresAt: now + body.expires_in * 1000,
    };
    return this.cachedToken.accessToken;
  }

  /**
   * Retries on 429/5xx with exponential backoff + jitter, honoring
   * Retry-After when present. Any other non-OK status fails immediately —
   * retrying a 4xx auth/validation error just wastes the rate-limit budget.
   */
  private async fetchWithRetry(
    url: string | URL,
    init: RequestInit,
  ): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, init);
      } catch (err) {
        lastError = err;
        await this.sleep(this.backoffMs(attempt));
        continue;
      }

      if (res.ok) return res;

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === MAX_RETRIES) {
        throw new Error(
          `SIRENE request failed: ${res.status} ${res.statusText}`,
        );
      }

      const retryAfterHeader = res.headers.get('retry-after');
      const delayMs = retryAfterHeader
        ? Number(retryAfterHeader) * 1000
        : this.backoffMs(attempt);
      this.logger.warn(
        `SIRENE request got ${res.status}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await this.sleep(delayMs);
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('SIRENE request failed after retries');
  }

  private backoffMs(attempt: number): number {
    const exp = BASE_BACKOFF_MS * 2 ** attempt;
    const jitter = Math.random() * BASE_BACKOFF_MS;
    return exp + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
