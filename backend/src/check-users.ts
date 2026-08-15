import prisma from './lib/prisma.js';

async function main() {
  console.log("=== DIAGNOSING USER COUNTS ===");
  try {
    const totalUsers = await prisma.user.count();
    console.log("Total users in database:", totalUsers);

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        onboardingStatus: true,
        name: true,
      }
    });

    console.log("\nAll users in database:");
    users.forEach(u => {
      console.log(`- ID: ${u.id}, Name: ${u.name}, Email: ${u.email}, Role: ${u.role}, Status: ${u.onboardingStatus}`);
    });

    // Let's run the exact queries from the summary API
    const pendingOnboardingStatuses = ['pending', 'pending_validation', 'manual_review_required', 'under_compliance_review'];
    const activeSellers = await prisma.user.count({ where: { role: 'seller', onboardingStatus: 'approved_for_procurement' } });
    const activeBuyers = await prisma.user.count({ where: { role: 'buyer', onboardingStatus: 'approved_for_procurement' } });
    const pendingApproval = await prisma.user.count({ where: { role: { in: ['seller', 'buyer'] }, onboardingStatus: { in: pendingOnboardingStatuses as any } } });
    const totalNetwork = await prisma.user.count();

    const deliveries = await prisma.deliveryTracking.findMany({
      select: {
        id: true,
        purchaseOrderId: true,
        trackingNumber: true,
        status: true
      }
    });

    console.log("\nDelivery Records in database:", deliveries.length);
    deliveries.forEach(d => {
      console.log(`- Delivery #${d.id}, PO #${d.purchaseOrderId}, Tracking: ${d.trackingNumber || 'N/A'}, Status: ${d.status}`);
    });

  } catch (error) {
    console.error("Error executing query:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
