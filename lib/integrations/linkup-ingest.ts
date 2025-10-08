const LINKUP_API_BASE = process.env.LINKUP_API_BASE || 'https://api.linkupapi.com';
const LINKUP_API_KEY = process.env.LINKUP_API_KEY || '';
const LINKUP_MOCK = process.env.LINKUP_MOCK === '1';

interface LinkupRequestOptions {
  path: string;
  body?: any;
  method?: 'GET' | 'POST';
}

interface LinkupResponse<T = any> {
  data?: T;
  items?: any[];
  mock: boolean;
  error?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function jitter(baseMs: number): number {
  return baseMs + Math.random() * 1000;
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      const status = error.status || 0;
      
      if (status === 429 || status >= 500) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        const delayMs = jitter(backoffMs);
        
        console.warn(
          `⚠️ [LINKUP_INGEST] Retry ${attempt + 1}/${maxRetries} after ${Math.round(delayMs)}ms (status: ${status})`
        );
        
        await sleep(delayMs);
        continue;
      }
      
      throw error;
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

export async function linkupIngest<T = any>({
  path,
  body,
  method = 'POST'
}: LinkupRequestOptions): Promise<LinkupResponse<T>> {
  if (LINKUP_MOCK) {
    console.info('ℹ️ [LINKUP_INGEST] Mock mode enabled - returning mock response');
    return {
      items: [],
      mock: true
    };
  }

  if (!LINKUP_API_KEY) {
    throw new Error('Missing LINKUP_API_KEY - required when LINKUP_MOCK is not enabled');
  }

  return retryWithBackoff(async () => {
    const url = `${LINKUP_API_BASE}${path}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LINKUP_API_KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        const text = await response.text();
        errorBody = text.substring(0, 200);
      } catch {
        errorBody = 'Unable to read error body';
      }

      const error: any = new Error(
        `LinkUp API error: ${response.status} ${response.statusText} - ${errorBody}`
      );
      error.status = response.status;
      error.body = errorBody;
      throw error;
    }

    const data = await response.json();

    return {
      data,
      items: data.items || data.results || [],
      mock: false
    };
  });
}

export function isMockMode(): boolean {
  return LINKUP_MOCK;
}

export function getApiConfig() {
  return {
    baseUrl: LINKUP_API_BASE,
    mock: LINKUP_MOCK,
    hasApiKey: !!LINKUP_API_KEY
  };
}
