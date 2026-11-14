import prisma from '../lib/prisma.js';
import { hashPassword } from '../services/password.service.js';

async function configureTestCredentials() {
  console.log('Starting credential setup for testing...');
  const passwordHash = await hashPassword('Pass@1234567');

  // 1. Clean up temporary user 123 if exists
  await prisma.user.deleteMany({ where: { email: 'trl@gmail.com', id: { not: 94 } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: 'fortis@gmail.com', id: { not: 105 } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: 'koshal@gmail.com', id: { not: 107 } } }).catch(() => {});

  // 2. Configure Buyer: trl@gmail.com (User #94, Org #85)
  const updatedBuyer = await prisma.user.update({
    where: { id: 94 },
    data: {
      email: 'trl@gmail.com',
      password: passwordHash,
      name: 'TRL Krosaki Procurement',
      role: 'buyer',
      organizationId: 85,
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

  await prisma.buyerProfile.updateMany({
    where: { userId: 94 },
    data: {
      organizationId: 85,
      organizationName: 'TRL KROSAKI REFRACTORIES LIMITED',
      email: 'trl@gmail.com',
      contactPersonEmail: 'trl@gmail.com',
      officialEmail: 'trl@gmail.com',
      representativeName: 'TRL Krosaki Procurement',
      isActive: true,
      verificationStatus: 'VERIFIED'
    }
  });

  await prisma.organization.update({
    where: { id: 85 },
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

  // 3. Configure Seller 1: fortis@gmail.com (User #105, Org #93)
  const updatedFortis = await prisma.user.update({
    where: { id: 105 },
    data: {
      email: 'fortis@gmail.com',
      password: passwordHash,
      name: 'Fortis Chemicals Sales',
      role: 'seller',
      organizationId: 93,
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

  await prisma.sellerProfile.updateMany({
    where: { userId: 105 },
    data: {
      organizationId: 93,
      businessName: 'FORTIS CHEMICALS PVT. LTD',
      nameAsInPan: 'FORTIS CHEMICALS PVT. LTD',
      pan: 'AAACF9253B',
      panVerified: true,
      participateInBid: true,
      verificationStatusEnum: 'VERIFIED',
      msmeType: 'LOCAL_MSME',
      vendorType: 'MANUFACTURER'
    }
  });

  await prisma.organization.update({
    where: { id: 93 },
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

  // 4. Configure Seller 2: koshal@gmail.com (User #107, Org #95)
  const updatedKoshal = await prisma.user.update({
    where: { id: 107 },
    data: {
      email: 'koshal@gmail.com',
      password: passwordHash,
      name: 'Koshal Ceramics Sales',
      role: 'seller',
      organizationId: 95,
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

  await prisma.sellerProfile.updateMany({
    where: { userId: 107 },
    data: {
      organizationId: 95,
      businessName: 'KOSHAL CERAMICS PRIVATE LIMITED',
      nameAsInPan: 'KOSHAL CERAMICS PRIVATE LIMITED',
      pan: 'AABCF3556E',
      panVerified: true,
      participateInBid: true,
      verificationStatusEnum: 'VERIFIED',
      msmeType: 'LOCAL_MSME',
      vendorType: 'MANUFACTURER'
    }
  });

  await prisma.organization.update({
    where: { id: 95 },
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

  // 5. Ensure BuyerVendorAlias mappings
  const existingAliases = await prisma.buyerVendorAlias.findMany({
    where: {
      buyerOrgId: 85,
      erpVendorCode: { in: ['50034', '50033'] }
    }
  });

  const fortisAlias = existingAliases.find(a => a.erpVendorCode === '50034');
  if (fortisAlias) {
    await prisma.buyerVendorAlias.update({
      where: { id: fortisAlias.id },
      data: { sellerOrgId: 93, erpSystem: 'SAP' }
    });
  } else {
    await prisma.buyerVendorAlias.create({
      data: {
        buyerOrgId: 85,
        sellerOrgId: 93,
        erpSystem: 'SAP',
        erpVendorCode: '50034'
      }
    });
  }

  const koshalAlias = existingAliases.find(a => a.erpVendorCode === '50033');
  if (koshalAlias) {
    await prisma.buyerVendorAlias.update({
      where: { id: koshalAlias.id },
      data: { sellerOrgId: 95, erpSystem: 'SAP' }
    });
  } else {
    await prisma.buyerVendorAlias.create({
      data: {
        buyerOrgId: 85,
        sellerOrgId: 95,
        erpSystem: 'SAP',
        erpVendorCode: '50033'
      }
    });
  }

  console.log('------------------------------------------------------------');
  console.log('✅ TEST CREDENTIALS CONFIGURED AND VERIFIED:');
  console.log('');
  console.log('1. BUYER:');
  console.log('   Email:     trl@gmail.com');
  console.log('   Password:  Pass@1234567');
  console.log('   Role:      buyer');
  console.log('   Org ID:    85 (TRL KROSAKI REFRACTORIES LIMITED)');
  console.log('   GSTIN:     21AAACT6494Q1ZS');
  console.log('   PAN:       AAACT6494Q');
  console.log('   Address:   TRL KROSAKI REFRACTORIES LIMITED, BELPAHAR, Jharsuguda, Odisha, 768218');
  console.log('');
  console.log('2. SELLER (FORTIS CHEMICALS):');
  console.log('   Email:     fortis@gmail.com');
  console.log('   Password:  Pass@1234567');
  console.log('   Role:      seller');
  console.log('   Org ID:    93 (FORTIS CHEMICALS PVT. LTD)');
  console.log('   GSTIN:     21AAACF9253B1Z6');
  console.log('   PAN:       AAACF9253B');
  console.log('   ERP Code:  50034');
  console.log('   Address:   PLOT NO. 148, KALAMATI INDUSTRIAL ESTATE, JHARSUGUDA, ODISHA - 768203');
  console.log('');
  console.log('3. SELLER (KOSHAL CERAMICS):');
  console.log('   Email:     koshal@gmail.com');
  console.log('   Password:  Pass@1234567');
  console.log('   Role:      seller');
  console.log('   Org ID:    95 (KOSHAL CERAMICS PRIVATE LIMITED)');
  console.log('   GSTIN:     21AABCF3556E1Z5');
  console.log('   PAN:       AABCF3556E');
  console.log('   ERP Code:  50033');
  console.log('   Address:   2ND FLOOR KRISHNA CENTRE, BEHIND HOTEL UTKAL CONTINENTAL, SARBAHAL, JHARSUGUDA, ODISHA - 768201');
  console.log('------------------------------------------------------------');
}

configureTestCredentials()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error during credential configuration:', err);
    process.exit(1);
  });
