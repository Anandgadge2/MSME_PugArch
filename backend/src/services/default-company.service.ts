import prisma from '../lib/prisma.js';

type PrismaLike = typeof prisma;

const DEFAULT_COMPANY_NAME = 'JsgSmile';
const DEFAULT_PORTAL_DISPLAY_NAME = 'JsgSmile Portal';

export const getDefaultCompany = async (client?: PrismaLike) => {
  return {
    id: 1,
    name: DEFAULT_COMPANY_NAME,
    portalDisplayName: DEFAULT_PORTAL_DISPLAY_NAME,
    isActive: true
  };
};

export const getDefaultCompanyId = async (client?: PrismaLike) => {
  return 1;
};
