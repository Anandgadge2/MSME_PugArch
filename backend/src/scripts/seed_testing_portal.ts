import prisma from '../lib/prisma.js';
import { hashPassword } from '../services/password.service.js';
import { generateAlphanumericUserId } from '../utils/userId.js';

async function seedTestingPortal() {
  console.log('Connecting to Testing Database (Neon)...');
  const passwordHash = await hashPassword('Pass@1234567');

  // ────────────────────────────────────────────────────────────
  // 1. BUYER: TRL KROSAKI REFRACTORIES LIMITED (trl@gmail.com)
  // ────────────────────────────────────────────────────────────
  console.log('Setting up Buyer: TRL KROSAKI REFRACTORIES LIMITED...');
  let trlOrg = await prisma.organization.findFirst({
    where: {
      OR: [
        { gstin: '21AAACT6494Q1ZS' },
        { organizationName: { contains: 'TRL KROSAKI', mode: 'insensitive' } }
      ]
    }
  });

  if (!trlOrg) {
    trlOrg = await prisma.organization.create({
      data: {
        organizationName: 'TRL KROSAKI REFRACTORIES LIMITED',
        organizationType: 'PRIVATE_LIMITED',
        gstin: '21AAACT6494Q1ZS',
        panNumber: 'AAACT6494Q',
        cinNumber: 'U26921OR1958PLC000349',
        addressLine1: 'TRL KROSAKI REFRACTORIES LIMITED, BELPAHAR, Jharsuguda, Odisha, 768218',
        city: 'BELPAHAR',
        district: 'Jharsuguda',
        state: 'ODISHA',
        pincode: '768218',
        country: 'India',
        website: 'https://www.trlkrosaki.com/',
        verificationStatus: 'VERIFIED',
        organizationOnboardingStatus: 'approved_for_procurement'
      }
    });
    console.log(`Created TRL Krosaki Organization (ID: ${trlOrg.id})`);
  } else {
    trlOrg = await prisma.organization.update({
      where: { id: trlOrg.id },
      data: {
        organizationName: 'TRL KROSAKI REFRACTORIES LIMITED',
        gstin: '21AAACT6494Q1ZS',
        panNumber: 'AAACT6494Q',
        cinNumber: 'U26921OR1958PLC000349',
        addressLine1: 'TRL KROSAKI REFRACTORIES LIMITED, BELPAHAR, Jharsuguda, Odisha, 768218',
        city: 'BELPAHAR',
        district: 'Jharsuguda',
        state: 'ODISHA',
        pincode: '768218',
        verificationStatus: 'VERIFIED',
        organizationOnboardingStatus: 'approved_for_procurement'
      }
    });
    console.log(`Updated TRL Krosaki Organization (ID: ${trlOrg.id})`);
  }

  // Create or Update Buyer User: trl@gmail.com
  let trlUser = await prisma.user.findUnique({ where: { email: 'trl@gmail.com' } });
  if (!trlUser) {
    const uid = await generateAlphanumericUserId();
    trlUser = await prisma.user.create({
      data: {
        name: 'TRL Krosaki Procurement',
        email: 'trl@gmail.com',
        password: passwordHash,
        role: 'buyer',
        organizationId: trlOrg.id,
        userId: uid,
        mobile: '9876543210',
        registrationStatus: 'completed',
        onboardingStatus: 'approved_for_procurement',
        accountStatus: 'ACTIVE',
        emailVerified: true,
        mobileVerified: true,
        requiresMobileVerification: false,
        accountTypeId: 3,
        sectionStatus: {
          org: 'approved',
          rep: 'approved',
          docs: 'approved',
          address: 'approved',
          procurement: 'approved'
        },
        registrationDetails: {
          cin: 'U26921OR1958PLC000349',
          pan: 'AAACT6494Q',
          city: 'BELPAHAR',
          gstin: '21AAACT6494Q1ZS',
          state: 'ODISHA',
          orgPan: 'AAACT6494Q',
          userId: 'trl@gmail.com',
          address: 'TRL KROSAKI REFRACTORIES LIMITED, BELPAHAR, Jharsuguda, Odisha, 768218',
          pincode: '768218',
          businessName: 'TRL KROSAKI REFRACTORIES LIMITED',
          gstVerified: true
        }
      }
    });
    console.log(`Created Buyer User: trl@gmail.com (ID: ${trlUser.id})`);
  } else {
    trlUser = await prisma.user.update({
      where: { id: trlUser.id },
      data: {
        name: 'TRL Krosaki Procurement',
        password: passwordHash,
        role: 'buyer',
        organizationId: trlOrg.id,
        accountStatus: 'ACTIVE',
        registrationStatus: 'completed',
        onboardingStatus: 'approved_for_procurement',
        emailVerified: true,
        mobileVerified: true,
        requiresMobileVerification: false,
        failedLoginCount: 0,
        lockedUntil: null
      }
    });
    console.log(`Updated Buyer User: trl@gmail.com (ID: ${trlUser.id})`);
  }

  // Ensure BuyerProfile
  await prisma.buyerProfile.upsert({
    where: { userId: trlUser.id },
    update: {
      organizationId: trlOrg.id,
      organizationName: 'TRL KROSAKI REFRACTORIES LIMITED',
      pan: 'AAACT6494Q',
      panNumber: 'AAACT6494Q',
      gst: '21AAACT6494Q1ZS',
      gstNumber: '21AAACT6494Q1ZS',
      cin: 'U26921OR1958PLC000349',
      city: 'BELPAHAR',
      district: 'Jharsuguda',
      state: 'ODISHA',
      pincode: '768218',
      registeredAddress: 'TRL KROSAKI REFRACTORIES LIMITED, BELPAHAR, Jharsuguda, Odisha, 768218',
      isActive: true,
      verificationStatus: 'VERIFIED',
      email: 'trl@gmail.com',
      contactPersonEmail: 'trl@gmail.com',
      officialEmail: 'trl@gmail.com',
      representativeName: 'TRL Krosaki Procurement',
      mobile: '9876543210'
    },
    create: {
      userId: trlUser.id,
      organizationId: trlOrg.id,
      organizationName: 'TRL KROSAKI REFRACTORIES LIMITED',
      pan: 'AAACT6494Q',
      panNumber: 'AAACT6494Q',
      gst: '21AAACT6494Q1ZS',
      gstNumber: '21AAACT6494Q1ZS',
      cin: 'U26921OR1958PLC000349',
      city: 'BELPAHAR',
      district: 'Jharsuguda',
      state: 'ODISHA',
      pincode: '768218',
      registeredAddress: 'TRL KROSAKI REFRACTORIES LIMITED, BELPAHAR, Jharsuguda, Odisha, 768218',
      isActive: true,
      verificationStatus: 'VERIFIED',
      businessType: 'PRIVATE_LIMITED',
      representativeName: 'TRL Krosaki Procurement',
      email: 'trl@gmail.com',
      contactPersonEmail: 'trl@gmail.com',
      officialEmail: 'trl@gmail.com',
      mobile: '9876543210'
    }
  });

  // ────────────────────────────────────────────────────────────
  // 2. SELLER 1: FORTIS CHEMICALS PVT. LTD (fortis@gmail.com)
  // ────────────────────────────────────────────────────────────
  console.log('Setting up Seller: FORTIS CHEMICALS PVT. LTD...');
  let fortisOrg = await prisma.organization.findFirst({
    where: {
      OR: [
        { gstin: '21AAACF9253B1Z6' },
        { organizationName: { contains: 'FORTIS CHEMICALS', mode: 'insensitive' } }
      ]
    }
  });

  if (!fortisOrg) {
    fortisOrg = await prisma.organization.create({
      data: {
        organizationName: 'FORTIS CHEMICALS PVT. LTD',
        organizationType: 'PRIVATE_LIMITED',
        gstin: '21AAACF9253B1Z6',
        panNumber: 'AAACF9253B',
        udyamNumber: 'UDYAM-OD-14-0000310',
        addressLine1: 'PLOT NO. 148, KALAMATI INDUSTRIAL ESTATE, JHARSUGUDA, ODISHA - 768203',
        city: 'Jharsuguda',
        district: 'Jharsuguda',
        state: 'ODISHA',
        pincode: '768203',
        country: 'India',
        verificationStatus: 'VERIFIED',
        organizationOnboardingStatus: 'approved_for_procurement'
      }
    });
    console.log(`Created Fortis Chemicals Organization (ID: ${fortisOrg.id})`);
  } else {
    fortisOrg = await prisma.organization.update({
      where: { id: fortisOrg.id },
      data: {
        organizationName: 'FORTIS CHEMICALS PVT. LTD',
        gstin: '21AAACF9253B1Z6',
        panNumber: 'AAACF9253B',
        udyamNumber: 'UDYAM-OD-14-0000310',
        addressLine1: 'PLOT NO. 148, KALAMATI INDUSTRIAL ESTATE, JHARSUGUDA, ODISHA - 768203',
        city: 'Jharsuguda',
        district: 'Jharsuguda',
        state: 'ODISHA',
        pincode: '768203',
        verificationStatus: 'VERIFIED',
        organizationOnboardingStatus: 'approved_for_procurement'
      }
    });
    console.log(`Updated Fortis Chemicals Organization (ID: ${fortisOrg.id})`);
  }

  // Create or Update Seller User: fortis@gmail.com
  let fortisUser = await prisma.user.findUnique({ where: { email: 'fortis@gmail.com' } });
  if (!fortisUser) {
    const uid = await generateAlphanumericUserId();
    fortisUser = await prisma.user.create({
      data: {
        name: 'Fortis Chemicals Sales',
        email: 'fortis@gmail.com',
        password: passwordHash,
        role: 'seller',
        organizationId: fortisOrg.id,
        userId: uid,
        mobile: '7381076680',
        registrationStatus: 'completed',
        onboardingStatus: 'approved_for_procurement',
        accountStatus: 'ACTIVE',
        emailVerified: true,
        mobileVerified: true,
        requiresMobileVerification: false,
        accountTypeId: 2,
        sectionStatus: {
          pan: 'approved',
          bank: 'approved',
          details: 'approved',
          offices: 'approved',
          documents: 'approved',
          additional: 'approved'
        },
        registrationDetails: {
          pan: 'AAACF9253B',
          city: 'Jharsuguda',
          gstin: '21AAACF9253B1Z6',
          state: 'ODISHA',
          orgPan: 'AAACF9253B',
          userId: 'fortis@gmail.com',
          address: 'PLOT NO. 148, KALAMATI INDUSTRIAL ESTATE, JHARSUGUDA, ODISHA - 768203',
          pincode: '768203',
          businessName: 'FORTIS CHEMICALS PVT. LTD',
          gstVerified: true,
          udyamNumber: 'UDYAM-OD-14-0000310'
        }
      }
    });
    console.log(`Created Seller User: fortis@gmail.com (ID: ${fortisUser.id})`);
  } else {
    fortisUser = await prisma.user.update({
      where: { id: fortisUser.id },
      data: {
        name: 'Fortis Chemicals Sales',
        password: passwordHash,
        role: 'seller',
        organizationId: fortisOrg.id,
        accountStatus: 'ACTIVE',
        registrationStatus: 'completed',
        onboardingStatus: 'approved_for_procurement',
        emailVerified: true,
        mobileVerified: true,
        requiresMobileVerification: false,
        failedLoginCount: 0,
        lockedUntil: null
      }
    });
    console.log(`Updated Seller User: fortis@gmail.com (ID: ${fortisUser.id})`);
  }

  // Ensure SellerProfile for Fortis
  await prisma.sellerProfile.upsert({
    where: { userId: fortisUser.id },
    update: {
      organizationId: fortisOrg.id,
      businessName: 'FORTIS CHEMICALS PVT. LTD',
      nameAsInPan: 'FORTIS CHEMICALS PVT. LTD',
      pan: 'AAACF9253B',
      panVerified: true,
      participateInBid: true,
      verificationStatusEnum: 'VERIFIED',
      msmeType: 'LOCAL_MSME',
      vendorType: 'MANUFACTURER'
    },
    create: {
      userId: fortisUser.id,
      organizationId: fortisOrg.id,
      businessName: 'FORTIS CHEMICALS PVT. LTD',
      nameAsInPan: 'FORTIS CHEMICALS PVT. LTD',
      pan: 'AAACF9253B',
      panVerified: true,
      participateInBid: true,
      verificationStatusEnum: 'VERIFIED',
      msmeType: 'LOCAL_MSME',
      vendorType: 'MANUFACTURER',
      productCategories: ['Chemicals', 'Resin Powder', 'Raw Materials'],
      mobile: '7381076680'
    }
  });

  // ────────────────────────────────────────────────────────────
  // 3. SELLER 2: KOSHAL CERAMICS PRIVATE LIMITED (koshal@gmail.com)
  // ────────────────────────────────────────────────────────────
  console.log('Setting up Seller: KOSHAL CERAMICS PRIVATE LIMITED...');
  let koshalOrg = await prisma.organization.findFirst({
    where: {
      OR: [
        { gstin: '21AABCF3556E1Z5' },
        { organizationName: { contains: 'KOSHAL CERAMICS', mode: 'insensitive' } }
      ]
    }
  });

  if (!koshalOrg) {
    koshalOrg = await prisma.organization.create({
      data: {
        organizationName: 'KOSHAL CERAMICS PRIVATE LIMITED',
        organizationType: 'PRIVATE_LIMITED',
        gstin: '21AABCF3556E1Z5',
        panNumber: 'AABCF3556E',
        udyamNumber: 'UDYAM-OD-14-0000292',
        addressLine1: '2ND FLOOR KRISHNA CENTRE, BEHIND HOTEL UTKAL CONTINENTAL, SARBAHAL, JHARSUGUDA, ODISHA - 768201',
        city: 'Jharsuguda',
        district: 'Jharsuguda',
        state: 'ODISHA',
        pincode: '768201',
        country: 'India',
        verificationStatus: 'VERIFIED',
        organizationOnboardingStatus: 'approved_for_procurement'
      }
    });
    console.log(`Created Koshal Ceramics Organization (ID: ${koshalOrg.id})`);
  } else {
    koshalOrg = await prisma.organization.update({
      where: { id: koshalOrg.id },
      data: {
        organizationName: 'KOSHAL CERAMICS PRIVATE LIMITED',
        gstin: '21AABCF3556E1Z5',
        panNumber: 'AABCF3556E',
        udyamNumber: 'UDYAM-OD-14-0000292',
        addressLine1: '2ND FLOOR KRISHNA CENTRE, BEHIND HOTEL UTKAL CONTINENTAL, SARBAHAL, JHARSUGUDA, ODISHA - 768201',
        city: 'Jharsuguda',
        district: 'Jharsuguda',
        state: 'ODISHA',
        pincode: '768201',
        verificationStatus: 'VERIFIED',
        organizationOnboardingStatus: 'approved_for_procurement'
      }
    });
    console.log(`Updated Koshal Ceramics Organization (ID: ${koshalOrg.id})`);
  }

  // Create or Update Seller User: koshal@gmail.com
  let koshalUser = await prisma.user.findUnique({ where: { email: 'koshal@gmail.com' } });
  if (!koshalUser) {
    const uid = await generateAlphanumericUserId();
    koshalUser = await prisma.user.create({
      data: {
        name: 'Koshal Ceramics Sales',
        email: 'koshal@gmail.com',
        password: passwordHash,
        role: 'seller',
        organizationId: koshalOrg.id,
        userId: uid,
        mobile: '7507055660',
        registrationStatus: 'completed',
        onboardingStatus: 'approved_for_procurement',
        accountStatus: 'ACTIVE',
        emailVerified: true,
        mobileVerified: true,
        requiresMobileVerification: false,
        accountTypeId: 2,
        sectionStatus: {
          pan: 'approved',
          bank: 'approved',
          details: 'approved',
          offices: 'approved',
          documents: 'approved',
          additional: 'approved'
        },
        registrationDetails: {
          pan: 'AABCF3556E',
          city: 'Jharsuguda',
          gstin: '21AABCF3556E1Z5',
          state: 'ODISHA',
          orgPan: 'AABCF3556E',
          userId: 'koshal@gmail.com',
          address: '2ND FLOOR KRISHNA CENTRE, BEHIND HOTEL UTKAL CONTINENTAL, SARBAHAL, JHARSUGUDA, ODISHA - 768201',
          pincode: '768201',
          businessName: 'KOSHAL CERAMICS PRIVATE LIMITED',
          gstVerified: true,
          udyamNumber: 'UDYAM-OD-14-0000292'
        }
      }
    });
    console.log(`Created Seller User: koshal@gmail.com (ID: ${koshalUser.id})`);
  } else {
    koshalUser = await prisma.user.update({
      where: { id: koshalUser.id },
      data: {
        name: 'Koshal Ceramics Sales',
        password: passwordHash,
        role: 'seller',
        organizationId: koshalOrg.id,
        accountStatus: 'ACTIVE',
        registrationStatus: 'completed',
        onboardingStatus: 'approved_for_procurement',
        emailVerified: true,
        mobileVerified: true,
        requiresMobileVerification: false,
        failedLoginCount: 0,
        lockedUntil: null
      }
    });
    console.log(`Updated Seller User: koshal@gmail.com (ID: ${koshalUser.id})`);
  }

  // Ensure SellerProfile for Koshal
  await prisma.sellerProfile.upsert({
    where: { userId: koshalUser.id },
    update: {
      organizationId: koshalOrg.id,
      businessName: 'KOSHAL CERAMICS PRIVATE LIMITED',
      nameAsInPan: 'KOSHAL CERAMICS PRIVATE LIMITED',
      pan: 'AABCF3556E',
      panVerified: true,
      participateInBid: true,
      verificationStatusEnum: 'VERIFIED',
      msmeType: 'LOCAL_MSME',
      vendorType: 'MANUFACTURER'
    },
    create: {
      userId: koshalUser.id,
      organizationId: koshalOrg.id,
      businessName: 'KOSHAL CERAMICS PRIVATE LIMITED',
      nameAsInPan: 'KOSHAL CERAMICS PRIVATE LIMITED',
      pan: 'AABCF3556E',
      panVerified: true,
      participateInBid: true,
      verificationStatusEnum: 'VERIFIED',
      msmeType: 'LOCAL_MSME',
      vendorType: 'MANUFACTURER',
      productCategories: ['Refractories', 'Clot Making', 'Filter Dust', 'Industrial Services'],
      mobile: '7507055660'
    }
  });

  // ────────────────────────────────────────────────────────────
  // 4. BUYER VENDOR ALIASES
  // ────────────────────────────────────────────────────────────
  console.log('Mapping Buyer-Vendor Aliases in Testing DB...');
  const existingAliases = await prisma.buyerVendorAlias.findMany({
    where: {
      buyerOrgId: trlOrg.id,
      erpVendorCode: { in: ['50034', '50033'] }
    }
  });

  const fortisAlias = existingAliases.find(a => a.erpVendorCode === '50034');
  if (fortisAlias) {
    await prisma.buyerVendorAlias.update({
      where: { id: fortisAlias.id },
      data: { sellerOrgId: fortisOrg.id, erpSystem: 'SAP' }
    });
  } else {
    await prisma.buyerVendorAlias.create({
      data: {
        buyerOrgId: trlOrg.id,
        sellerOrgId: fortisOrg.id,
        erpSystem: 'SAP',
        erpVendorCode: '50034'
      }
    });
  }

  const koshalAlias = existingAliases.find(a => a.erpVendorCode === '50033');
  if (koshalAlias) {
    await prisma.buyerVendorAlias.update({
      where: { id: koshalAlias.id },
      data: { sellerOrgId: koshalOrg.id, erpSystem: 'SAP' }
    });
  } else {
    await prisma.buyerVendorAlias.create({
      data: {
        buyerOrgId: trlOrg.id,
        sellerOrgId: koshalOrg.id,
        erpSystem: 'SAP',
        erpVendorCode: '50033'
      }
    });
  }

  console.log('============================================================');
  console.log('🎉 TESTING PORTAL ORGANIZATIONS & CREDENTIALS CONFIGURED:');
  console.log('============================================================');
  console.log(`1. BUYER:`);
  console.log(`   Email:        trl@gmail.com`);
  console.log(`   Password:     Pass@1234567`);
  console.log(`   Role:         buyer`);
  console.log(`   Org ID:       ${trlOrg.id}`);
  console.log(`   Org Name:     ${trlOrg.organizationName}`);
  console.log(`   GSTIN:        ${trlOrg.gstin}`);
  console.log(`   PAN:          ${trlOrg.panNumber}`);
  console.log('');
  console.log(`2. SELLER (FORTIS):`);
  console.log(`   Email:        fortis@gmail.com`);
  console.log(`   Password:     Pass@1234567`);
  console.log(`   Role:         seller`);
  console.log(`   Org ID:       ${fortisOrg.id}`);
  console.log(`   Org Name:     ${fortisOrg.organizationName}`);
  console.log(`   GSTIN:        ${fortisOrg.gstin}`);
  console.log(`   PAN:          ${fortisOrg.panNumber}`);
  console.log(`   ERP Code:     50034`);
  console.log('');
  console.log(`3. SELLER (KOSHAL):`);
  console.log(`   Email:        koshal@gmail.com`);
  console.log(`   Password:     Pass@1234567`);
  console.log(`   Role:         seller`);
  console.log(`   Org ID:       ${koshalOrg.id}`);
  console.log(`   Org Name:     ${koshalOrg.organizationName}`);
  console.log(`   GSTIN:        ${koshalOrg.gstin}`);
  console.log(`   PAN:          ${koshalOrg.panNumber}`);
  console.log(`   ERP Code:     50033`);
  console.log('============================================================');
}

seedTestingPortal()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error during testing portal seed:', err);
    process.exit(1);
  });
