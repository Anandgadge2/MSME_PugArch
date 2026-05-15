import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export type AccessTokenPayload = {
  id: number;
  role: string;
  sessionVersion: number;
};

export type RefreshTokenPayload = {
  id: number;
  sessionVersion: number;
  type: 'refresh';
};

export const signAccessToken = (payload: AccessTokenPayload) =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN
  } as SignOptions);

export const signRefreshToken = (payload: Omit<RefreshTokenPayload, 'type'>) =>
  jwt.sign({ ...payload, type: 'refresh' }, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN
  } as SignOptions);

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_SECRET) as Partial<AccessTokenPayload>;

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, env.JWT_SECRET) as Partial<RefreshTokenPayload>;

export const issueAuthTokens = (user: { id: number; role: string; sessionVersion: number }) => ({
  token: signAccessToken({ id: user.id, role: user.role, sessionVersion: user.sessionVersion }),
  refreshToken: signRefreshToken({ id: user.id, sessionVersion: user.sessionVersion }),
  expiresIn: env.JWT_ACCESS_EXPIRES_IN
});

export const issueAuthResponse = (user: { id: number; role: string; sessionVersion: number }) => {
  const accessToken = signAccessToken({ id: user.id, role: user.role, sessionVersion: user.sessionVersion });
  return {
    token: accessToken,
    accessToken,
    refreshToken: signRefreshToken({ id: user.id, sessionVersion: user.sessionVersion }),
    expiresIn: env.JWT_ACCESS_EXPIRES_IN
  };
};
