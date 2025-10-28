import crypto from 'crypto';

const API_KEY_PREFIX = 'lead_';
const API_KEY_LENGTH = 32;

export function generateApiKey(): { key: string; hash: string; preview: string } {
  const randomBytes = crypto.randomBytes(API_KEY_LENGTH);
  const key = `${API_KEY_PREFIX}${randomBytes.toString('hex')}`;
  
  const hash = crypto
    .createHash('sha256')
    .update(key)
    .digest('hex');
  
  const preview = `${key.substring(0, 12)}...${key.substring(key.length - 4)}`;
  
  return { key, hash, preview };
}

export function hashApiKey(key: string): string {
  return crypto
    .createHash('sha256')
    .update(key)
    .digest('hex');
}

export function validateApiKeyFormat(key: string): boolean {
  return key.startsWith(API_KEY_PREFIX) && key.length === API_KEY_PREFIX.length + (API_KEY_LENGTH * 2);
}
