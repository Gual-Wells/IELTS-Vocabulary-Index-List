// @ts-check

const JWKS_TTL_MS = 60 * 60 * 1000;
const CLOCK_TOLERANCE_SECONDS = 60;
const MAX_TOKEN_LENGTH = 32 * 1024;
const jwksCache = new Map();

function decodeBase64Url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid_base64url');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJsonPart(value) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(decodeBase64Url(value));
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid_jwt_json');
  return parsed;
}

function configuredTeamDomain(value) {
  if (typeof value !== 'string' || !value || /YOUR_TEAM/i.test(value)) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') return '';
    if (!url.hostname.endsWith('.cloudflareaccess.com')) return '';
    return url.origin;
  } catch {
    return '';
  }
}

function configuredAudience(value) {
  if (typeof value !== 'string' || !value.trim() || /YOUR_ACCESS|AUD_TAG/i.test(value)) return '';
  return value.trim();
}

async function fetchJwks(teamDomain, forceRefresh = false) {
  const cached = jwksCache.get(teamDomain);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.keys;
  const response = await fetch(`${teamDomain}/cdn-cgi/access/certs`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    redirect: 'error',
    cf: { cacheEverything: true, cacheTtl: JWKS_TTL_MS / 1000 },
  });
  if (!response.ok || !/application\/json/i.test(response.headers.get('content-type') || '')) throw new Error('jwks_unavailable');
  const body = await response.json();
  const keys = Array.isArray(body?.keys)
    ? body.keys.filter((key) => key?.kty === 'RSA' && key?.alg === 'RS256' && key?.use === 'sig' && typeof key?.kid === 'string')
    : [];
  if (!keys.length) throw new Error('jwks_invalid');
  jwksCache.set(teamDomain, { keys, expiresAt: Date.now() + JWKS_TTL_MS });
  return keys;
}

async function verifySignature(signingInput, encodedSignature, key) {
  const imported = await crypto.subtle.importKey(
    'jwk',
    key,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    imported,
    decodeBase64Url(encodedSignature),
    new TextEncoder().encode(signingInput),
  );
}

function claimsValid(payload, teamDomain, audience) {
  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const optionalTimeValid = (value, predicate) => value === undefined || (Number.isFinite(value) && predicate(value));
  return payload.iss === teamDomain
    && audiences.every((value) => typeof value === 'string') && audiences.includes(audience)
    && Number.isFinite(payload.exp) && payload.exp > now - CLOCK_TOLERANCE_SECONDS
    && optionalTimeValid(payload.nbf, (value) => value <= now + CLOCK_TOLERANCE_SECONDS)
    && optionalTimeValid(payload.iat, (value) => value <= now + CLOCK_TOLERANCE_SECONDS);
}

export function accessConfiguration(env) {
  return {
    teamDomain: configuredTeamDomain(env?.TEAM_DOMAIN),
    audience: configuredAudience(env?.POLICY_AUD),
  };
}

export async function verifyAccessJwt(token, env) {
  const { teamDomain, audience } = accessConfiguration(env);
  if (!teamDomain || !audience || typeof token !== 'string' || !token || token.length > MAX_TOKEN_LENGTH) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const header = decodeJsonPart(parts[0]);
    const payload = decodeJsonPart(parts[1]);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) return false;

    let keys = await fetchJwks(teamDomain);
    let key = keys.find((candidate) => candidate.kid === header.kid);
    if (!key) {
      keys = await fetchJwks(teamDomain, true);
      key = keys.find((candidate) => candidate.kid === header.kid);
    }
    if (!key || !(await verifySignature(`${parts[0]}.${parts[1]}`, parts[2], key))) return false;
    return claimsValid(payload, teamDomain, audience);
  } catch {
    return false;
  }
}

export async function authorizeAccess(request, env) {
  if (env?.ALLOW_UNPROTECTED_LOCAL === 'true') return { ok: true, localBypass: true };
  const { teamDomain, audience } = accessConfiguration(env);
  if (!teamDomain || !audience) return { ok: false, status: 503, code: 'access_not_configured' };
  const token = request.headers.get('cf-access-jwt-assertion') || '';
  if (!token) return { ok: false, status: 401, code: 'access_required' };
  return (await verifyAccessJwt(token, env))
    ? { ok: true, localBypass: false }
    : { ok: false, status: 401, code: 'access_invalid' };
}
