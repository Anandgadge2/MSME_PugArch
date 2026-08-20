import '../src/config/env.js';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { BUYERS_DATA, SELLERS_DATA } from './portal-seed-data.js';
import { generateAllAssets } from './generate-brand-assets.js';
import { deleteCache } from '../src/services/cache.service.js';
import { redisKeys } from '../src/constants/redis-keys.js';

const prisma = new PrismaClient();

const slugFor = (name: string) =>
  name.trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function seedJharsuguda() {
  console.log('=== Starting Jharsuguda Top 10 Buyers & Top 20 Sellers Database Seeding ===');

  // Step 1: Ensure SVG assets exist
  generateAllAssets();

  const defaultPasswordHash = await bcrypt.hash('Jharsuguda@2026', 10);

  // Load / map categories
  const categories = await prisma.category.findMany();
  const categoryMap = new Map<string, number>();
  for (const cat of categories) {
    categoryMap.set(cat.name.toLowerCase(), cat.id);
    categoryMap.set(cat.slug.toLowerCase(), cat.id);
  }

  const getCategoryId = async (name: string) => {
    const direct = categoryMap.get(name.toLowerCase());
    if (direct) return direct;

    for (const [catName, id] of categoryMap.entries()) {
      if (catName.includes(name.toLowerCase()) || name.toLowerCase().includes(catName)) {
        return id;
      }
    }

    // Upsert new category if not found
    const slug = slugFor(name);
    const created = await prisma.category.upsert({
      where: { slug },
      update: { name, isActive: true },
      create: { name, slug, type: 'BOTH', displayOrder: 100, isActive: true }
    });
    categoryMap.set(name.toLowerCase(), created.id);
    return created.id;
  };

  console.log('Seeding Top 10 Jharsuguda Buyers...');
  for (let bIndex = 0; bIndex < BUYERS_DATA.length; bIndex++) {
    const buyer = BUYERS_DATA[bIndex];
    console.log(`[${bIndex + 1}/10] Processing Buyer: ${buyer.name}`);
    const logoUrl = `/org-logos/${buyer.slug}.svg`;
    const bannerUrl = `/banners/${buyer.slug}-banner.svg`;

    // 1. Upsert Buyer User
    const user = await prisma.user.upsert({
      where: { email: buyer.email },
      update: {
        name: buyer.name,
        mobile: buyer.mobile,
        role: 'buyer',
        registrationStatus: 'completed',
        onboardingStatus: 'approved_for_procurement',
        accountStatus: 'ACTIVE',
        emailVerified: true,
        mobileVerified: true
      },
      create: {
        email: buyer.email,
        name: buyer.name,
        mobile: buyer.mobile,
        password: defaultPasswordHash,
        role: 'buyer',
        registrationStatus: 'completed',
        onboardingStatus: 'approved_for_procurement',
        accountStatus: 'ACTIVE',
        emailVerified: true,
        mobileVerified: true
      }
    });

    // 2. Upsert Logo FileAsset
    let logoAsset = await prisma.fileAsset.findFirst({
      where: { url: logoUrl }
    });
    if (!logoAsset) {
      logoAsset = await prisma.fileAsset.create({
        data: {
          key: `org-logos/${buyer.slug}.svg`,
          url: logoUrl,
          fileUrl: logoUrl,
          storageProvider: 'LOCAL',
          ownerId: user.id,
          ownerRole: 'buyer',
          mimeType: 'image/svg+xml',
          size: 2048,
          checksum: `chk-logo-${buyer.slug}`,
          originalName: `${buyer.slug}.svg`,
          status: 'active',
          entityType: 'organization_logo'
        }
      });
    }

    // 3. Upsert Organization
    let org = await prisma.organization.findFirst({
      where: {
        OR: [
          { organizationName: buyer.name },
          { gstin: buyer.gstin },
          { panNumber: buyer.pan }
        ]
      }
    });

    if (org) {
      org = await prisma.organization.update({
        where: { id: org.id },
        data: {
          organizationName: buyer.name,
          organizationType: buyer.type as any,
          city: buyer.city,
          district: 'Jharsuguda',
          state: 'Odisha',
          pincode: buyer.pincode,
          addressLine1: buyer.address,
          gstin: buyer.gstin,
          panNumber: buyer.pan,
          cinNumber: buyer.cin,
          annualTurnover: buyer.turnover,
          employeeCount: buyer.employees,
          verificationStatus: 'VERIFIED' as any,
          organizationLogoFileId: logoAsset.id
        }
      });
    } else {
      org = await prisma.organization.create({
        data: {
          organizationName: buyer.name,
          organizationType: buyer.type as any,
          city: buyer.city,
          district: 'Jharsuguda',
          state: 'Odisha',
          pincode: buyer.pincode,
          addressLine1: buyer.address,
          gstin: buyer.gstin,
          panNumber: buyer.pan,
          cinNumber: buyer.cin,
          annualTurnover: buyer.turnover,
          employeeCount: buyer.employees,
          verificationStatus: 'VERIFIED' as any,
          organizationLogoFileId: logoAsset.id
        }
      });
    }

    await prisma.fileAsset.update({
      where: { id: logoAsset.id },
      data: { entityId: org.id }
    });

    // Link User to Organization
    await prisma.user.update({
      where: { id: user.id },
      data: { organizationId: org.id }
    });

    // 4. Upsert OrganizationProfile
    await prisma.organizationProfile.upsert({
      where: { organizationId: org.id },
      update: {
        logoUrl,
        bannerUrl,
        isLargeIndustry: true,
        isBigMsme: false,
        isFeatured: true,
        verificationStatus: 'VERIFIED' as any,
        industryType: buyer.subtitle,
        description: `${buyer.name} is a premier industrial anchor buyer operating in ${buyer.city}, Jharsuguda district, Odisha.`
      },
      create: {
        organizationId: org.id,
        logoUrl,
        bannerUrl,
        isLargeIndustry: true,
        isBigMsme: false,
        isFeatured: true,
        verificationStatus: 'VERIFIED' as any,
        industryType: buyer.subtitle,
        description: `${buyer.name} is a premier industrial anchor buyer operating in ${buyer.city}, Jharsuguda district, Odisha.`
      }
    });

    // 5. Upsert BuyerProfile
    await prisma.buyerProfile.upsert({
      where: { userId: user.id },
      update: {
        organizationId: org.id,
        organizationName: buyer.name,
        businessType: 'BUYER',
        industry: buyer.subtitle,
        city: buyer.city,
        district: 'Jharsuguda',
        state: 'Odisha',
        pincode: buyer.pincode,
        registeredAddress: buyer.address,
        pan: buyer.pan,
        gst: buyer.gstin,
        panNumber: buyer.pan,
        gstNumber: buyer.gstin,
        cin: buyer.cin,
        mobile: buyer.mobile,
        email: buyer.email,
        officialEmail: buyer.email,
        officialPhone: buyer.mobile,
        annualBudget: String(buyer.turnover),
        verificationStatus: 'VERIFIED',
        verificationStatusEnum: 'VERIFIED' as any,
        logoUrl,
        bannerUrl
      },
      create: {
        userId: user.id,
        organizationId: org.id,
        organizationName: buyer.name,
        businessType: 'BUYER',
        industry: buyer.subtitle,
        city: buyer.city,
        district: 'Jharsuguda',
        state: 'Odisha',
        pincode: buyer.pincode,
        registeredAddress: buyer.address,
        pan: buyer.pan,
        gst: buyer.gstin,
        panNumber: buyer.pan,
        gstNumber: buyer.gstin,
        cin: buyer.cin,
        mobile: buyer.mobile,
        email: buyer.email,
        officialEmail: buyer.email,
        officialPhone: buyer.mobile,
        annualBudget: String(buyer.turnover),
        verificationStatus: 'VERIFIED',
        verificationStatusEnum: 'VERIFIED' as any,
        logoUrl,
        bannerUrl
      }
    });

    // 6. Seed Buyer Requirements
    for (let i = 0; i < buyer.requirements.length; i++) {
      const req = buyer.requirements[i];
      const categoryId = await getCategoryId(req.category);
      const reqImgUrl = `/products/${buyer.slug}-req-${i + 1}.svg`;

      const existingReq = await prisma.buyerRequirement.findFirst({
        where: {
          buyerOrganizationId: org.id,
          title: req.title
        }
      });

      const reqData = {
        title: req.title,
        requirementType: req.type,
        categoryId,
        buyerOrganizationId: org.id,
        createdById: user.id,
        description: req.desc,
        quantity: req.qty,
        unit: req.unit,
        budgetMin: req.budget * 0.9,
        budgetMax: req.budget,
        location: `${buyer.city}, Jharsuguda, Odisha`,
        lastDate: new Date(Date.now() + (30 + i * 10) * 24 * 60 * 60 * 1000),
        status: 'OPEN' as any,
        visibility: 'PUBLIC' as any,
        isFeatured: true,
        isUrgent: i === 0,
        attachmentUrl: reqImgUrl,
        terms: 'Payment 30 days against GRN. Material inspection at supplier site or JSG plant store.'
      };

      if (existingReq) {
        await prisma.buyerRequirement.update({
          where: { id: existingReq.id },
          data: reqData
        });
      } else {
        await prisma.buyerRequirement.create({
          data: reqData
        });
      }
    }
  }

  console.log('Seeding Top 20 Jharsuguda MSME Sellers...');
  for (let sIndex = 0; sIndex < SELLERS_DATA.length; sIndex++) {
    const seller = SELLERS_DATA[sIndex];
    console.log(`[${sIndex + 1}/20] Processing Seller: ${seller.name}`);
    const logoUrl = `/org-logos/${seller.slug}.svg`;
    const bannerUrl = `/banners/${seller.slug}-banner.svg`;
    const userRole = seller.type === 'SHG' ? 'shg' : 'seller';

    // 1. Upsert Seller User
    const user = await prisma.user.upsert({
      where: { email: seller.email },
      update: {
        name: seller.name,
        mobile: seller.mobile,
        role: userRole as any,
        registrationStatus: 'completed',
        onboardingStatus: 'approved_for_procurement',
        accountStatus: 'ACTIVE',
        emailVerified: true,
        mobileVerified: true
      },
      create: {
        email: seller.email,
        name: seller.name,
        mobile: seller.mobile,
        password: defaultPasswordHash,
        role: userRole as any,
        registrationStatus: 'completed',
        onboardingStatus: 'approved_for_procurement',
        accountStatus: 'ACTIVE',
        emailVerified: true,
        mobileVerified: true
      }
    });

    // 2. Upsert Logo FileAsset
    let logoAsset = await prisma.fileAsset.findFirst({
      where: { url: logoUrl }
    });
    if (!logoAsset) {
      logoAsset = await prisma.fileAsset.create({
        data: {
          key: `org-logos/${seller.slug}.svg`,
          url: logoUrl,
          fileUrl: logoUrl,
          storageProvider: 'LOCAL',
          ownerId: user.id,
          ownerRole: userRole,
          mimeType: 'image/svg+xml',
          size: 2048,
          checksum: `chk-logo-${seller.slug}`,
          originalName: `${seller.slug}.svg`,
          status: 'active',
          entityType: 'organization_logo'
        }
      });
    }

    // 3. Upsert Organization
    let org = await prisma.organization.findFirst({
      where: {
        OR: [
          { organizationName: seller.name },
          { gstin: seller.gstin },
          { panNumber: seller.pan }
        ]
      }
    });

    const orgTypeEnum = seller.type === 'SHG' ? 'SHG' : seller.type === 'PRIVATE_LIMITED' ? 'PRIVATE_LIMITED' : 'MSME';

    if (org) {
      org = await prisma.organization.update({
        where: { id: org.id },
        data: {
          organizationName: seller.name,
          organizationType: orgTypeEnum as any,
          city: seller.city,
          district: 'Jharsuguda',
          state: 'Odisha',
          pincode: seller.pincode,
          addressLine1: seller.address,
          gstin: seller.gstin,
          panNumber: seller.pan,
          udyamNumber: seller.udyam,
          verificationStatus: 'VERIFIED' as any,
          organizationLogoFileId: logoAsset.id
        }
      });
    } else {
      org = await prisma.organization.create({
        data: {
          organizationName: seller.name,
          organizationType: orgTypeEnum as any,
          city: seller.city,
          district: 'Jharsuguda',
          state: 'Odisha',
          pincode: seller.pincode,
          addressLine1: seller.address,
          gstin: seller.gstin,
          panNumber: seller.pan,
          udyamNumber: seller.udyam,
          verificationStatus: 'VERIFIED' as any,
          organizationLogoFileId: logoAsset.id
        }
      });
    }

    await prisma.fileAsset.update({
      where: { id: logoAsset.id },
      data: { entityId: org.id }
    });

    // Link User to Organization
    await prisma.user.update({
      where: { id: user.id },
      data: { organizationId: org.id }
    });

    // 4. Upsert OrganizationProfile
    await prisma.organizationProfile.upsert({
      where: { organizationId: org.id },
      update: {
        logoUrl,
        bannerUrl,
        isLargeIndustry: false,
        isBigMsme: true,
        isFeatured: true,
        verificationStatus: 'VERIFIED' as any,
        industryType: seller.subtitle,
        description: `${seller.name} is an active verified MSME supplier located in ${seller.city}, Jharsuguda.`
      },
      create: {
        organizationId: org.id,
        logoUrl,
        bannerUrl,
        isLargeIndustry: false,
        isBigMsme: true,
        isFeatured: true,
        verificationStatus: 'VERIFIED' as any,
        industryType: seller.subtitle,
        description: `${seller.name} is an active verified MSME supplier located in ${seller.city}, Jharsuguda.`
      }
    });

    // 5. Upsert SellerProfile
    await prisma.sellerProfile.upsert({
      where: { userId: user.id },
      update: {
        organizationId: org.id,
        businessName: seller.name,
        pan: seller.pan,
        mobile: seller.mobile,
        verificationStatusEnum: 'VERIFIED' as any,
        isUdyamCertified: true,
        panVerified: true,
        ownershipVerified: true,
        termsAccepted: true
      },
      create: {
        userId: user.id,
        organizationId: org.id,
        businessName: seller.name,
        pan: seller.pan,
        mobile: seller.mobile,
        verificationStatusEnum: 'VERIFIED' as any,
        isUdyamCertified: true,
        panVerified: true,
        ownershipVerified: true,
        termsAccepted: true
      }
    });

    // 6. Seed Products
    for (let i = 0; i < seller.products.length; i++) {
      const prod = seller.products[i];
      const categoryId = await getCategoryId(prod.category);
      const prodImgUrl = `/products/${seller.slug}-prod-${i + 1}.svg`;
      const sku = `JSG-${seller.slug.slice(0, 4).toUpperCase()}-${100 + i}`;

      let product = await prisma.product.findFirst({
        where: {
          sellerId: user.id,
          sku
        }
      });

      const prodData = {
        name: prod.name,
        description: prod.desc,
        price: prod.price,
        originalPrice: prod.price * 1.15,
        discountPrice: prod.price,
        discountPercent: 13,
        isOfferActive: true,
        status: 'ACTIVE' as any,
        isMsmeMade: true,
        organizationId: org.id,
        sellerId: user.id,
        categoryId,
        unitOfMeasure: 'PCS',
        brand: seller.shortName,
        modelNumber: `JSG-${seller.slug.slice(0, 4).toUpperCase()}-${100 + i}`,
        sku
      };

      if (product) {
        product = await prisma.product.update({
          where: { id: product.id },
          data: prodData
        });
      } else {
        product = await prisma.product.create({
          data: prodData
        });
      }

      // Upsert FileAsset for product image
      let fileAsset = await prisma.fileAsset.findFirst({
        where: { url: prodImgUrl }
      });
      if (!fileAsset) {
        fileAsset = await prisma.fileAsset.create({
          data: {
            key: `products/${seller.slug}-prod-${i + 1}.svg`,
            url: prodImgUrl,
            fileUrl: prodImgUrl,
            storageProvider: 'LOCAL',
            ownerId: user.id,
            ownerRole: userRole,
            mimeType: 'image/svg+xml',
            size: 2048,
            checksum: `chk-prod-${seller.slug}-${i + 1}`,
            originalName: `${seller.slug}-prod-${i + 1}.svg`,
            status: 'active',
            entityType: 'catalogue_product',
            entityId: product.id
          }
        });
      } else {
        await prisma.fileAsset.update({
          where: { id: fileAsset.id },
          data: { entityId: product.id, entityType: 'catalogue_product' }
        });
      }

      // Link ProductImage
      const existingImg = await prisma.productImage.findFirst({
        where: { productId: product.id, fileAssetId: fileAsset.id }
      });
      if (!existingImg) {
        await prisma.productImage.create({
          data: {
            productId: product.id,
            fileAssetId: fileAsset.id,
            altText: prod.name,
            isPrimary: true,
            displayOrder: 0
          }
        });
      }
    }
  }

  // Clear marketplace caches
  await deleteCache(redisKeys.cacheMarketplaceHome()).catch(() => null);
  await deleteCache('cache:marketplace:*').catch(() => null);

  console.log('=== Successfully Seeded 10 Buyers and 20 Sellers with Logos, Banners & Products! ===');
}

seedJharsuguda()
  .catch(err => {
    console.error('Failed to seed Jharsuguda data:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
