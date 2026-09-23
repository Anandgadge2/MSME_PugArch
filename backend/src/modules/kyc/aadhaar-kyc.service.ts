import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma.js';
import { env, isProduction } from '../../config/env.js';
import type { AuthenticatedUser } from '../../middleware/authenticate.js';
import { logger } from '../../config/logger.js';


const PROVIDER = 'MERIPEHCHAAN' as const;
const VERIFICATION_TYPE = 'AADHAAR' as const;
const DEFAULT_RETURN_PATH = '/onboarding/kyc';
const ALLOWED_ID_TOKEN_ALGORITHMS: jwt.Algorithm[] = ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'];

type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

type SafeProfile = {
  name?: string;
  dob?: Date | null;
  gender?: string;
  email?: string;
  address?: unknown;
  ageVerified?: boolean | null;
  digilockerId?: string;
  referenceKey?: string;
  subject?: string;
  aadhaarLast4?: string;
};

const requiredConfig = () => {
  const scopes = env.MERIPEHCHAAN_SCOPES || 'openid profile email';
  const needsIdTokenVerification = scopes.split(/\s+/).includes('openid');

  const missing = [
    ['MERIPEHCHAAN_CLIENT_ID', env.MERIPEHCHAAN_CLIENT_ID],
    ['MERIPEHCHAAN_CLIENT_SECRET', env.MERIPEHCHAAN_CLIENT_SECRET],
    ['MERIPEHCHAAN_AUTH_URL', env.MERIPEHCHAAN_AUTH_URL],
    ['MERIPEHCHAAN_TOKEN_URL', env.MERIPEHCHAAN_TOKEN_URL],
    ['MERIPEHCHAAN_REDIRECT_URI', env.MERIPEHCHAAN_REDIRECT_URI],
    ['FRONTEND_URL', env.FRONTEND_URL],
  ].filter(([, value]) => !value);

  if (missing.length) {
    const keys = missing.map(([key]) => key).join(', ');
    throw Object.assign(
      new Error(`MeriPehchaan Aadhaar KYC is not configured: ${keys}`),
      { statusCode: 503, code: 'KYC_NOT_CONFIGURED' },
    );
  }

  if (isProduction && !String(env.MERIPEHCHAAN_REDIRECT_URI).startsWith('https://')) {
    throw Object.assign(new Error('HTTPS MeriPehchaan callback URL is required in production'), { statusCode: 503, code: 'KYC_REDIRECT_URI_INSECURE' });
  }

  return {
    clientId: env.MERIPEHCHAAN_CLIENT_ID!,
    clientSecret: env.MERIPEHCHAAN_CLIENT_SECRET!,
    authUrl: env.MERIPEHCHAAN_AUTH_URL!,
    tokenUrl: env.MERIPEHCHAAN_TOKEN_URL!,
    userInfoUrl: env.MERIPEHCHAAN_USERINFO_URL,
    jwksUrl: env.MERIPEHCHAAN_JWKS_URL,
    issuer: env.MERIPEHCHAAN_ISSUER,
    redirectUri: env.MERIPEHCHAAN_REDIRECT_URI!,
    frontendUrl: env.FRONTEND_URL!,
    scopes,
    acr: env.MERIPEHCHAAN_ACR,
    ttlMinutes: env.AADHAAR_KYC_SESSION_TTL_MINUTES || 10,
    needsIdTokenVerification,
  };
};

const randomUrlSafe = (bytes = 32) =>
  crypto.randomBytes(bytes).toString('base64url');

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const codeChallenge = (verifier: string) =>
  crypto.createHash('sha256').update(verifier).digest('base64url');

const redirectUrl = (status: string, message?: string, customPath?: string, customBase?: string) => {
  const base = customBase || env.FRONTEND_URL || 'http://localhost:3000';
  const path = customPath || DEFAULT_RETURN_PATH;
  const url = new URL(path, base);
  url.searchParams.set('aadhaar', status);
  if (message) url.searchParams.set('reason', message);
  return url.toString();
};

const parseState = (state: string): { path: string; origin?: string } => {
  const result: { path: string; origin?: string } = { path: DEFAULT_RETURN_PATH };
  if (!state || !state.includes('_')) return result;
  try {
    const parts = state.split('_');
    const encoded = parts[parts.length - 1];
    const decoded = Buffer.from(encoded, 'base64url').toString('utf8');

    if (decoded.trim().startsWith('{')) {
      const data = JSON.parse(decoded);
      if (typeof data.path === 'string') {
        result.path = data.path;
      }
      if (typeof data.origin === 'string') {
        const cleanOrigin = data.origin.trim().toLowerCase().replace(/\/$/, '');
        const allowedOrigins = [
          'https://www.jsgsmile.in',
          'https://jsgsmile.in',
          'https://msme-pugarch-frontend.vercel.app',
          'http://localhost:3000'
        ];
        try {
          const configFrontend = env.FRONTEND_URL || 'http://localhost:3000';
          allowedOrigins.push(new URL(configFrontend).origin);
        } catch {}

        if (allowedOrigins.some(allowed => cleanOrigin === allowed.toLowerCase().replace(/\/$/, ''))) {
          result.origin = cleanOrigin;
        }
      }
    } else {
      if (
        decoded.startsWith('/') &&
        !decoded.startsWith('//') &&
        !decoded.includes('\\')
      ) {
        result.path = decoded;
      }
    }
  } catch (e) {
    console.error('[Aadhaar KYC] Error parsing state:', e);
  }
  return result;
};

const getRedirectPathFromState = (state: string): string => {
  return parseState(state).path;
};

const safeMessage = (value: unknown) =>
  String(value || 'Aadhaar verification could not be completed').slice(0, 240);

const normalizeRedirectUri = (uri: string): string => {
  if (!uri) return '';
  return uri
    .trim()
    .toLowerCase()
    .replace(/\/$/, '')
    .replace(/\/aadhar\//g, '/aadhaar/')
    .replace(/\/aadhar$/, '/aadhaar');
};

const getOrgId = (user: AuthenticatedUser) =>
  user.organizationId || null;

const audit = async (
  userId: number,
  organizationId: number | null | undefined,
  action: string,
  status: 'STARTED' | 'PENDING' | 'VERIFIED' | 'FAILED' | 'EXPIRED' | 'RESET',
  meta: RequestMeta,
  message?: string,
) => {
  await prisma.kycAuditLog.create({
    data: {
      userId,
      organizationId: organizationId || null,
      provider: PROVIDER,
      verificationType: VERIFICATION_TYPE,
      action,
      status,
      message: message ? safeMessage(message) : null,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent ? meta.userAgent.slice(0, 500) : undefined,
    }
  });
};

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  const str = String(value).trim();
  const normalized = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.test(str)
    ? str.replace(/^(\d{2})[-/](\d{2})[-/](\d{4})$/, '$3-$2-$1')
    : str;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const firstString = (source: any, keys: string[]) => {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const extractSafeProfile = (userinfo: any, idTokenPayload: any): SafeProfile => {
  const source = { ...(idTokenPayload || {}), ...(userinfo || {}) };
  const rawAadhaarStr = firstString(source, ['aadhaar_number', 'aadhaar', 'masked_aadhaar', 'aadhaar_last4', 'aadhaar_last_4', 'uid']);
  const aadhaarLast4 = rawAadhaarStr ? rawAadhaarStr.replace(/\D/g, '').slice(-4) : undefined;
  return {
    name: firstString(source, ['name', 'full_name', 'fullname', 'verified_name']),
    dob: parseDate(source.birthdate || source.dob || source.date_of_birth),
    gender: firstString(source, ['gender']),
    email: firstString(source, ['email', 'verified_email']),
    address: source.address && typeof source.address === 'object' ? source.address : undefined,
    ageVerified: typeof source.age_verified === 'boolean' ? source.age_verified : typeof source.ageVerified === 'boolean' ? source.ageVerified : null,
    digilockerId: firstString(source, ['digilocker_id', 'digilockerId', 'digilockerid']),
    referenceKey: firstString(source, ['reference_key', 'referenceKey', 'txn', 'transaction_id']),
    subject: firstString(source, ['sub']),
    aadhaarLast4: aadhaarLast4 && aadhaarLast4.length === 4 ? aadhaarLast4 : undefined,
  };
};

const fetchUserInfo = async (url: string | undefined, accessToken: string) => {
  if (!url) return null;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      logger.warn({ status: response.status, statusText: response.statusText, errorText }, '[MeriPehchaan] UserInfo endpoint returned non-OK response; will rely on ID token claims');
      return null;
    }
    return await response.json().catch(() => null);
  } catch (err: any) {
    logger.warn({ error: err?.message || String(err) }, '[MeriPehchaan] Error querying UserInfo endpoint; falling back to ID token claims');
    return null;
  }
};

type TokenExchangeResult = {
  access_token: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  [key: string]: any;
};

const exchangeTokenWithProvider = async (
  config: ReturnType<typeof requiredConfig>,
  code: string,
  codeVerifier?: string,
  redirectUri?: string
): Promise<TokenExchangeResult> => {
  const actualRedirectUri = redirectUri || config.redirectUri;

  // Sanitize: trim whitespace/quotes that may have leaked from env var
  const clientId = config.clientId.trim().replace(/^["']|["']$/g, '');
  const clientSecret = config.clientSecret.trim().replace(/^["']|["']$/g, '');

  // Diagnostic log (masked) to surface config issues in production
  const masked = clientId.length > 8
    ? `${clientId.slice(0, 4)}...${clientId.slice(-4)} (len=${clientId.length})`
    : `[TOO_SHORT len=${clientId.length}]`;
  logger.info(
    { clientIdMasked: masked, tokenUrl: config.tokenUrl, redirectUri: actualRedirectUri },
    '[MeriPehchaan] Starting token exchange'
  );

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  // Multi-strategy token exchange for DigiLocker / MeriPehchaan / API Setu compatibility:
  // 1. Basic Auth Header (Official DigiLocker / MeriPehchaan recommendation) with PKCE
  // 2. Basic Auth Header + Body client credentials (hybrid gateway support) with PKCE
  // 3. Body credentials only without Basic Auth Header (Standard OAuth2 post) with PKCE
  // 4. Basic Auth Header without PKCE (in case server didn't record or support PKCE)
  // 5. Body credentials only without PKCE
  const attempts: Array<{
    name: string;
    headers: Record<string, string>;
    body: Record<string, string>;
  }> = [
    {
      name: 'Basic Auth Header + PKCE',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: actualRedirectUri,
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      },
    },
    {
      name: 'Basic Auth Header + Body Credentials + PKCE',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: actualRedirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      },
    },
    {
      name: 'Body Credentials Only + PKCE',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: actualRedirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      },
    },
  ];

  if (codeVerifier) {
    attempts.push(
      {
        name: 'Basic Auth Header without PKCE',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Authorization': `Basic ${basicAuth}`,
        },
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: actualRedirectUri,
        },
      },
      {
        name: 'Body Credentials Only without PKCE',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: actualRedirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        },
      }
    );
  }

  let lastErrorDetail = '';
  let lastStatus = 0;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    try {
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: attempt.headers,
        body: new URLSearchParams(attempt.body),
      });

      const rawText = await response.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = null;
      }

      const accessToken = parsed?.access_token || parsed?.accessToken || parsed?.token;

      if (response.ok && accessToken) {
        logger.info({ strategy: attempt.name }, '[MeriPehchaan] Token exchange succeeded');
        return {
          ...parsed,
          access_token: accessToken,
        };
      }

      lastStatus = response.status;
      lastErrorDetail =
        (parsed && (parsed.error_description || parsed.error || parsed.message)) ||
        rawText ||
        response.statusText;

      logger.warn(
        {
          strategy: attempt.name,
          status: response.status,
          statusText: response.statusText,
          error: lastErrorDetail,
        },
        '[MeriPehchaan] Token exchange attempt failed'
      );

      // If the code is already expired or consumed, retry won't succeed
      if (
        parsed?.error === 'invalid_grant' &&
        /expired|already used|consumed/i.test(String(parsed?.error_description || ''))
      ) {
        break;
      }
    } catch (fetchErr: any) {
      lastErrorDetail = fetchErr?.message || String(fetchErr);
      logger.warn({ strategy: attempt.name, error: lastErrorDetail }, '[MeriPehchaan] Token exchange attempt threw network error');
    }
  }

  logger.error(
    {
      tokenUrl: config.tokenUrl,
      redirectUri: actualRedirectUri,
      lastStatus,
      lastError: lastErrorDetail,
    },
    '[MeriPehchaan] All token exchange attempts failed'
  );

  throw Object.assign(
    new Error(`MeriPehchaan token exchange failed${lastStatus ? ` [HTTP ${lastStatus}]` : ''}: ${lastErrorDetail || 'Invalid token response'}`),
    { statusCode: 502, code: 'TOKEN_EXCHANGE_FAILED' }
  );
};

const verifyIdToken = async (idToken: string | undefined, config: ReturnType<typeof requiredConfig>) => {
  // If the token endpoint did not return an id_token, skip verification.
  // This is only safe when scope does not include 'openid'; if it does,
  // requiredConfig() already enforced that jwksUrl is present.
  if (!idToken) return null;

  // jwksUrl was already validated as present in requiredConfig() when openid
  // scope is active, so this guard only fires for a programming mistake.
  if (!config.jwksUrl) {
    throw Object.assign(
      new Error('MeriPehchaan JWKS URL is required to verify the OIDC ID token'),
      { statusCode: 503, code: 'KYC_JWKS_NOT_CONFIGURED' },
    );
  }

  const parts = (idToken || '').split('.');
  logger.debug({ partsCount: parts.length }, '[verifyIdToken] Token parts count');
  if (parts[0]) {
    try {
      const headerStr = Buffer.from(parts[0], 'base64url').toString('utf8');
      logger.debug({ header: headerStr }, '[verifyIdToken] Decoded header');
    } catch (e) {
      logger.error({ err: e }, '[verifyIdToken] Failed to decode header part');
    }
  }

  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded !== 'object' || !decoded.header?.alg) {
    logger.error({ decoded }, '[verifyIdToken] Invalid JWT decoded structure');
    throw Object.assign(new Error('MeriPehchaan ID token header is invalid'), { statusCode: 502, code: 'ID_TOKEN_INVALID' });
  }
  if (!ALLOWED_ID_TOKEN_ALGORITHMS.includes(decoded.header.alg as jwt.Algorithm)) {
    throw Object.assign(new Error('MeriPehchaan ID token algorithm is not allowed'), { statusCode: 502, code: 'ID_TOKEN_ALG_NOT_ALLOWED' });
  }

  const jwksResponse = await fetch(config.jwksUrl, { headers: { Accept: 'application/json' } });
  if (!jwksResponse.ok) {
    throw Object.assign(new Error('Failed to fetch MeriPehchaan JWKS'), { statusCode: 502, code: 'JWKS_FETCH_FAILED' });
  }

  const jwks = await jwksResponse.json() as { keys?: Array<crypto.JsonWebKey & { kid?: string }> };
  const kid = decoded.header.kid;
  const jwk = jwks.keys?.find((key) => kid ? key.kid === kid : false) || jwks.keys?.[0];
  if (!jwk) {
    throw Object.assign(new Error('MeriPehchaan signing key was not found'), { statusCode: 502, code: 'JWKS_KEY_NOT_FOUND' });
  }

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const pem = publicKey.export({ type: 'spki', format: 'pem' });

  // issuer is optional but highly recommended for production. Log a warning
  // (no sensitive data) if it is absent.
  if (!config.issuer) {
    console.warn('[MeriPehchaan] MERIPEHCHAAN_ISSUER is not set. ID token issuer (iss) claim will not be validated. Set it to the value from the API Setu OIDC discovery document for full security.');
  }

  const validIssuers: [string, ...string[]] = [
    'https://digilocker.meripehchaan.gov.in',
    'https://api.digitallocker.gov.in',
    'https://api.digitallocker.gov.in/'
  ];
  if (config.issuer && !validIssuers.includes(config.issuer)) {
    validIssuers.push(config.issuer);
  }

  try {
    const verified = jwt.verify(idToken, pem, {
      algorithms: [decoded.header.alg as jwt.Algorithm],
      audience: config.clientId,
      issuer: validIssuers,
    });
    return verified && typeof verified === 'object' ? verified : null;
  } catch (err: any) {
    console.error('[verifyIdToken] ID token signature/claim verification failed:', err);
    throw err;
  }
};

export const aadhaarKycService = {
  redirectUrl,

  async start(user: AuthenticatedUser, meta: RequestMeta, redirectPath?: string, frontendOrigin?: string) {
    const config = requiredConfig();
    const organizationId = getOrgId(user);

    const existing = await prisma.userKycVerification.findUnique({
      where: { userId_provider_verificationType: { userId: user.id, provider: PROVIDER, verificationType: VERIFICATION_TYPE } }
    });
    if (existing?.status === 'VERIFIED') {
      await audit(user.id, organizationId, 'ALREADY_VERIFIED', 'VERIFIED', meta);
      return redirectUrl('already_verified', undefined, redirectPath, frontendOrigin);
    }

    const stateData = {
      path: redirectPath || DEFAULT_RETURN_PATH,
      origin: frontendOrigin
    };
    const state = `${randomUrlSafe(16)}_${Buffer.from(JSON.stringify(stateData)).toString('base64url')}`;
    const codeVerifier = randomUrlSafe(64);
    const challenge = codeChallenge(codeVerifier);
    const expiresAt = new Date(Date.now() + config.ttlMinutes * 60_000);

    await prisma.$transaction([
      prisma.kycAuthSession.create({
        data: {
          userId: user.id,
          organizationId,
          provider: PROVIDER,
          verificationType: VERIFICATION_TYPE,
          state,
          codeVerifier,
          redirectUri: config.redirectUri,
          scopes: config.scopes,
          acr: config.acr || null,
          expiresAt,
        }
      }),
      prisma.userKycVerification.upsert({
        where: { userId_provider_verificationType: { userId: user.id, provider: PROVIDER, verificationType: VERIFICATION_TYPE } },
        create: { userId: user.id, organizationId, provider: PROVIDER, verificationType: VERIFICATION_TYPE, status: 'PENDING' },
        update: { status: 'PENDING', organizationId, lastErrorCode: null, lastErrorMessage: null }
      }),
      prisma.kycAuditLog.create({
        data: {
          userId: user.id,
          organizationId,
          provider: PROVIDER,
          verificationType: VERIFICATION_TYPE,
          action: 'STARTED',
          status: 'STARTED',
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent ? meta.userAgent.slice(0, 500) : undefined,
        }
      })
    ]);

    const authUrl = new URL(config.authUrl);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', config.redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', config.scopes);
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    if (config.acr) authUrl.searchParams.set('acr', config.acr);

    return authUrl.toString();
  },

  async callback(query: Record<string, unknown>, meta: RequestMeta) {
    const state = typeof query.state === 'string' ? query.state : '';
    if (state) {
      const preRegSession = await prisma.preRegistrationKycSession.findUnique({
        where: { state }
      });
      if (preRegSession) {
        logger.info({ state }, '[Aadhaar Callback] Detected pre-registration guest session, redirecting to preRegisterCallback');
        return this.preRegisterCallback(query, meta);
      }
    }

    const config = requiredConfig();
    const code = typeof query.code === 'string' ? query.code : '';
    const providerError = typeof query.error === 'string' ? query.error : '';
    const providerErrorDescription = typeof query.error_description === 'string' ? query.error_description : '';

    const stateInfo = parseState(state);
    const redirectPath = stateInfo.path;
    const origin = stateInfo.origin;

    const session = state
      ? await prisma.kycAuthSession.findFirst({
        where: { state, provider: PROVIDER, verificationType: VERIFICATION_TYPE },
      })
      : null;

    if (providerError) {
      if (session) {
        await prisma.userKycVerification.upsert({
          where: { userId_provider_verificationType: { userId: session.userId, provider: PROVIDER, verificationType: VERIFICATION_TYPE } },
          create: { userId: session.userId, organizationId: session.organizationId, provider: PROVIDER, verificationType: VERIFICATION_TYPE, status: 'FAILED', lastErrorCode: providerError, lastErrorMessage: safeMessage(providerErrorDescription) },
          update: { status: 'FAILED', lastErrorCode: providerError, lastErrorMessage: safeMessage(providerErrorDescription) }
        });
        await audit(session.userId, session.organizationId, 'FAILED', 'FAILED', meta, providerError);
      }
      return redirectUrl('failed', undefined, redirectPath, origin);
    }

    if (!state || !code || !session || session.used || session.expiresAt <= new Date()) {
      if (session) {
        await prisma.$transaction([
          prisma.kycAuthSession.update({ where: { id: session.id }, data: { used: true } }),
          prisma.userKycVerification.upsert({
            where: { userId_provider_verificationType: { userId: session.userId, provider: PROVIDER, verificationType: VERIFICATION_TYPE } },
            create: { userId: session.userId, organizationId: session.organizationId, provider: PROVIDER, verificationType: VERIFICATION_TYPE, status: 'EXPIRED', lastErrorCode: 'SESSION_EXPIRED' },
            update: { status: 'EXPIRED', lastErrorCode: 'SESSION_EXPIRED', lastErrorMessage: 'Aadhaar verification session expired or was already used.' }
          }),
          prisma.kycAuditLog.create({
            data: { userId: session.userId, organizationId: session.organizationId, provider: PROVIDER, verificationType: VERIFICATION_TYPE, action: 'EXPIRED', status: 'EXPIRED', ipAddress: meta.ipAddress, userAgent: meta.userAgent ? meta.userAgent.slice(0, 500) : undefined }
          })
        ]);
      }
      return redirectUrl('expired', undefined, redirectPath, origin);
    }

    if (normalizeRedirectUri(session.redirectUri) !== normalizeRedirectUri(config.redirectUri)) {
      await audit(session.userId, session.organizationId, 'FAILED', 'FAILED', meta, `Redirect URI mismatch (session: ${session.redirectUri}, config: ${config.redirectUri})`);
      return redirectUrl('failed', undefined, redirectPath, origin);
    }

    try {
      const tokenBody = await exchangeTokenWithProvider(config, code, session.codeVerifier, session.redirectUri);

      let idPayload: any = null;
      let idTokenVerified = false;

      if (tokenBody.id_token) {
        if (config.jwksUrl) {
          idPayload = await verifyIdToken(tokenBody.id_token, config);
          idTokenVerified = true;
        } else {
          idPayload = jwt.decode(tokenBody.id_token);
          idTokenVerified = false;
          console.warn('[MeriPehchaan] ID token signature verification skipped because JWKS URL is not configured.');
          if (isProduction) {
            console.warn('[MeriPehchaan] JWKS URL is strictly required in production for full ID token validation.');
          }
        }
      }

      const userInfo = await fetchUserInfo(config.userInfoUrl, tokenBody.access_token);
      if (!userInfo && !idPayload) {
        throw Object.assign(new Error('Failed to fetch MeriPehchaan user profile and no ID token was provided'), { statusCode: 502, code: 'USERINFO_FAILED' });
      }
      const profile = extractSafeProfile(userInfo, idPayload);

      await prisma.$transaction([
        prisma.kycAuthSession.update({ where: { id: session.id }, data: { used: true } }),
        prisma.userKycVerification.upsert({
          where: { userId_provider_verificationType: { userId: session.userId, provider: PROVIDER, verificationType: VERIFICATION_TYPE } },
          create: {
            userId: session.userId,
            organizationId: session.organizationId,
            provider: PROVIDER,
            verificationType: VERIFICATION_TYPE,
            status: 'VERIFIED',
            verifiedName: profile.name,
            verifiedDob: profile.dob || undefined,
            verifiedGender: profile.gender,
            verifiedEmail: profile.email,
            verifiedAddress: profile.address as any,
            ageVerified: profile.ageVerified,
            digilockerId: profile.digilockerId,
            referenceKey: profile.referenceKey,
            idTokenSubject: profile.subject,
            idTokenVerified,
            verifiedAt: new Date(),
            lastErrorCode: null,
            lastErrorMessage: null,
          },
          update: {
            organizationId: session.organizationId,
            status: 'VERIFIED',
            verifiedName: profile.name,
            verifiedDob: profile.dob || undefined,
            verifiedGender: profile.gender,
            verifiedEmail: profile.email,
            verifiedAddress: profile.address as any,
            ageVerified: profile.ageVerified,
            digilockerId: profile.digilockerId,
            referenceKey: profile.referenceKey,
            idTokenSubject: profile.subject,
            idTokenVerified,
            verifiedAt: new Date(),
            lastErrorCode: null,
            lastErrorMessage: null,
          }
        }),
        prisma.kycAuditLog.create({
          data: { userId: session.userId, organizationId: session.organizationId, provider: PROVIDER, verificationType: VERIFICATION_TYPE, action: 'COMPLETED', status: 'VERIFIED', ipAddress: meta.ipAddress, userAgent: meta.userAgent ? meta.userAgent.slice(0, 500) : undefined }
        })
      ]);

      return redirectUrl('verified', undefined, redirectPath, origin);
    } catch (error: any) {
      await prisma.$transaction([
        prisma.kycAuthSession.update({ where: { id: session.id }, data: { used: true } }),
        prisma.userKycVerification.upsert({
          where: { userId_provider_verificationType: { userId: session.userId, provider: PROVIDER, verificationType: VERIFICATION_TYPE } },
          create: { userId: session.userId, organizationId: session.organizationId, provider: PROVIDER, verificationType: VERIFICATION_TYPE, status: 'FAILED', lastErrorCode: error?.code || 'CALLBACK_FAILED', lastErrorMessage: safeMessage(error?.message) },
          update: { status: 'FAILED', lastErrorCode: error?.code || 'CALLBACK_FAILED', lastErrorMessage: safeMessage(error?.message) }
        }),
        prisma.kycAuditLog.create({
          data: { userId: session.userId, organizationId: session.organizationId, provider: PROVIDER, verificationType: VERIFICATION_TYPE, action: 'FAILED', status: 'FAILED', message: safeMessage(error?.message), ipAddress: meta.ipAddress, userAgent: meta.userAgent ? meta.userAgent.slice(0, 500) : undefined }
        })
      ]);
      return redirectUrl('failed', undefined, redirectPath, origin);
    }
  },

  async status(user: AuthenticatedUser) {
    const row = await prisma.userKycVerification.findUnique({
      where: { userId_provider_verificationType: { userId: user.id, provider: PROVIDER, verificationType: VERIFICATION_TYPE } }
    });
    if (!row) {
      return { status: 'NOT_STARTED', provider: PROVIDER, verificationType: VERIFICATION_TYPE };
    }
    return {
      status: row.status,
      provider: row.provider,
      verificationType: row.verificationType,
      verifiedName: row.verifiedName,
      verifiedAt: row.verifiedAt,
      ageVerified: row.ageVerified,
    };
  },

  async reset(user: AuthenticatedUser, meta: RequestMeta) {
    const organizationId = getOrgId(user);
    await prisma.$transaction([
      // Expire any open sessions so they cannot be used after a reset.
      prisma.kycAuthSession.updateMany({
        where: { userId: user.id, provider: PROVIDER, verificationType: VERIFICATION_TYPE, used: false },
        data: { used: true }
      }),
      // Reset to NOT_STARTED so the UI shows a clean "start verification" state,
      // not a misleading "pending" that implies an in-flight session.
      prisma.userKycVerification.upsert({
        where: { userId_provider_verificationType: { userId: user.id, provider: PROVIDER, verificationType: VERIFICATION_TYPE } },
        create: { userId: user.id, organizationId, provider: PROVIDER, verificationType: VERIFICATION_TYPE, status: 'NOT_STARTED' },
        update: { status: 'NOT_STARTED', organizationId, lastErrorCode: null, lastErrorMessage: null }
      }),
      prisma.kycAuditLog.create({
        data: { userId: user.id, organizationId, provider: PROVIDER, verificationType: VERIFICATION_TYPE, action: 'RESET', status: 'RESET', ipAddress: meta.ipAddress, userAgent: meta.userAgent ? meta.userAgent.slice(0, 500) : undefined }
      })
    ]);
    return this.status(user);
  },

  async preRegisterStart(payload: { consent: boolean; mobile: string; aadhaarNumber?: string; vid?: string; redirectPath?: string; frontendOrigin?: string }, meta: RequestMeta) {
    const config = requiredConfig();
    
    const stateData = {
      path: payload.redirectPath || DEFAULT_RETURN_PATH,
      origin: payload.frontendOrigin
    };
    const state = `${randomUrlSafe(16)}_${Buffer.from(JSON.stringify(stateData)).toString('base64url')}`;
    const codeVerifier = randomUrlSafe(64);
    const challenge = codeChallenge(codeVerifier);
    const rawNum = String(payload.aadhaarNumber || payload.vid || '').trim();
    const aadhaarLast4 = rawNum.length >= 4 ? rawNum.slice(-4) : undefined;
    const mobileHash = payload.mobile ? crypto.createHash('sha256').update(payload.mobile.trim()).digest('hex') : undefined;
    const expiresAt = new Date(Date.now() + config.ttlMinutes * 60_000);
    const kycSessionToken = randomUrlSafe(48);
    const kycSessionTokenHash = hashToken(kycSessionToken);

    await prisma.preRegistrationKycSession.create({
      data: {
        kycSessionTokenHash,
        provider: PROVIDER,
        verificationType: VERIFICATION_TYPE,
        state,
        codeVerifier,
        redirectUri: config.redirectUri,
        scopes: config.scopes,
        expiresAt,
        status: 'PENDING',
        aadhaarLast4,
        mobileHash
      }
    });

    const authUrl = new URL(config.authUrl);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', config.redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', config.scopes);
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    if (config.acr) authUrl.searchParams.set('acr', config.acr);

    return { authorizationUrl: authUrl.toString(), kycSessionToken };
  },

  async preRegisterCallback(query: Record<string, unknown>, meta: RequestMeta) {
    const config = requiredConfig();
    const state = typeof query.state === 'string' ? query.state : '';
    const code = typeof query.code === 'string' ? query.code : '';
    const providerError = typeof query.error === 'string' ? query.error : '';

    const session = state
      ? await prisma.preRegistrationKycSession.findUnique({ where: { state } })
      : null;

    const stateInfo = parseState(state);
    const redirectPath = stateInfo.path;
    const origin = stateInfo.origin;

    if (providerError) {
      if (session) {
        await prisma.preRegistrationKycSession.update({
          where: { id: session.id },
          data: { status: 'FAILED' }
        });
      }
      return redirectUrl('failed', 'Verification was declined or failed.', redirectPath, origin);
    }

    if (!state || !code || !session || session.used || session.expiresAt <= new Date()) {
      if (session) {
        await prisma.preRegistrationKycSession.update({
          where: { id: session.id },
          data: { used: true, status: 'EXPIRED' }
        });
      }
      return redirectUrl('expired', 'Verification session expired. Please start again.', redirectPath, origin);
    }

    if (normalizeRedirectUri(session.redirectUri) !== normalizeRedirectUri(config.redirectUri)) {
      return redirectUrl('failed', `Invalid redirect URI (session: ${session.redirectUri}, config: ${config.redirectUri}).`, redirectPath, origin);
    }

    try {
      const tokenBody = await exchangeTokenWithProvider(config, code, session.codeVerifier, session.redirectUri);

      let idPayload: any = null;
      let idTokenVerified = false;

      if (tokenBody.id_token) {
        if (config.jwksUrl) {
          idPayload = await verifyIdToken(tokenBody.id_token, config);
          idTokenVerified = true;
        } else {
          idPayload = jwt.decode(tokenBody.id_token);
        }
      }

      const userInfo = await fetchUserInfo(config.userInfoUrl, tokenBody.access_token);
      if (!userInfo && !idPayload) {
        throw Object.assign(new Error('Failed to fetch MeriPehchaan user profile and no ID token was provided'), { statusCode: 502, code: 'USERINFO_FAILED' });
      }
      const profile = extractSafeProfile(userInfo, idPayload);

      if (session.aadhaarLast4 && profile.aadhaarLast4 && session.aadhaarLast4 !== profile.aadhaarLast4) {
        logger.warn({ sessionLast4: session.aadhaarLast4, profileLast4: profile.aadhaarLast4 }, '[Aadhaar KYC] Aadhaar last 4 mismatch');
        await prisma.preRegistrationKycSession.update({
          where: { id: session.id },
          data: { status: 'FAILED: Aadhaar number mismatch', used: true }
        });
        return redirectUrl('failed', 'Aadhaar number mismatch. Verified Aadhaar does not match the entered Aadhaar.', redirectPath, origin);
      }

      await prisma.preRegistrationKycSession.update({
        where: { id: session.id },
        data: {
          status: 'VERIFIED',
          verifiedName: profile.name,
          verifiedDob: profile.dob,
          verifiedGender: profile.gender,
          referenceKey: profile.referenceKey,
          idTokenSubject: profile.subject,
          idTokenVerified,
          verifiedAt: new Date(),
          aadhaarLast4: profile.aadhaarLast4 || session.aadhaarLast4,
        }
      });

      return redirectUrl('verified', 'Aadhaar verification successful.', redirectPath, origin);
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      console.error('[Aadhaar KYC PreRegister Callback Error]:', error);
      await prisma.preRegistrationKycSession.update({
        where: { id: session.id },
        data: { used: true, status: `FAILED: ${errMsg.slice(0, 190)}` }
      });
      return redirectUrl('failed', safeMessage(errMsg), redirectPath, origin);
    }
  },

  async preRegisterStatus(kycSessionToken: string) {
    if (!kycSessionToken) {
      throw Object.assign(new Error('Session token is required'), { statusCode: 400, code: 'TOKEN_REQUIRED' });
    }
    const kycSessionTokenHash = hashToken(kycSessionToken);
    const session = await prisma.preRegistrationKycSession.findUnique({
      where: { kycSessionTokenHash }
    });
    
    if (!session) {
      throw Object.assign(new Error('KYC session not found'), { statusCode: 404, code: 'SESSION_NOT_FOUND' });
    }

    const now = new Date();
    const isExpired = session.expiresAt <= now;
    const isValid = !session.used && !isExpired;

    let status = session.status.startsWith('FAILED') ? 'FAILED' : session.status;
    if (status === 'PENDING' && isExpired) {
      status = 'EXPIRED';
    }

    return {
      status,
      verifiedName: session.verifiedName,
      verifiedDob: session.verifiedDob,
      verifiedGender: session.verifiedGender,
      referenceKey: session.referenceKey,
      aadhaarLast4: session.aadhaarLast4,
      isValid,
      used: session.used,
      expiresAt: session.expiresAt
    };
  }
};
