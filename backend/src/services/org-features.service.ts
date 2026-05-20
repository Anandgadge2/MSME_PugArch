import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '../../config/org-features.json');

export interface OrgFeatures {
  products: boolean;
  services: boolean;
  marketplace: boolean;
  catalog: boolean;
}

const DEFAULT_FEATURES: OrgFeatures = {
  products: true,
  services: true,
  marketplace: true,
  catalog: true
};

export const orgFeaturesService = {
  getForOrg(orgId: number): OrgFeatures {
    try {
      if (!fs.existsSync(filePath)) {
        return { ...DEFAULT_FEATURES };
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      return data[orgId] !== undefined ? { ...DEFAULT_FEATURES, ...data[orgId] } : { ...DEFAULT_FEATURES };
    } catch {
      return { ...DEFAULT_FEATURES };
    }
  },

  getAll(): Record<number, OrgFeatures> {
    try {
      if (!fs.existsSync(filePath)) {
        return {};
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  },

  updateForOrg(orgId: number, features: Partial<OrgFeatures>): OrgFeatures {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = this.getAll();
      data[orgId] = {
        ...(data[orgId] || DEFAULT_FEATURES),
        ...features
      };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return data[orgId];
    } catch {
      return { ...DEFAULT_FEATURES, ...features };
    }
  }
};
