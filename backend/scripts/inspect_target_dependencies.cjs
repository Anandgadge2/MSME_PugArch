const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectDependencies() {
  const targetBidIds = [1, 2, 3, 4, 5, 6, 7, 8, 11];
  const targetContractIds = [1, 2];
  const targetAuctionIds = [1];
  const targetReqIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 19];

  console.log('=== TARGET BIDS ===');
  const bids = await prisma.procurementBid.findMany({
    where: { id: { in: targetBidIds } },
    include: {
      documents: true,
      participations: {
        include: {
          documents: true,
          evaluations: true
        }
      },
      awards: true,
      evaluations: true,
      clarifications: {
        include: {
          files: true
        }
      },
      invitations: true
    }
  });
  console.log(`Found ${bids.length} target ProcurementBids`);
  bids.forEach(b => {
    console.log(`  Bid #${b.id} [${b.bidNumber}] "${b.title}" - Parts: ${b.participations.length}, Awards: ${b.awards.length}, Docs: ${b.documents.length}`);
  });

  console.log('\n=== PURCHASE ORDERS LINKED TO TARGET BIDS ===');
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      OR: [
        { sourceType: 'procurementBid', sourceId: { in: targetBidIds } },
        { poNumber: { in: bids.map(b => `PO-${b.bidNumber}`) } }
      ]
    },
    select: {
      id: true,
      poNumber: true,
      buyerId: true,
      sourceType: true,
      sourceId: true
    }
  });
  console.log(`Found ${pos.length} PurchaseOrders linked to target bids:`);
  pos.forEach(po => {
    console.log(`  PO #${po.id} [${po.poNumber}] buyerId=${po.buyerId}, Invoices=${po.invoices.length}, Escrows=${po.escrowAccounts.length}, Payments=${po.payments.length}`);
  });

  console.log('\n=== TARGET CONTRACTS ===');
  const contracts = await prisma.contract.findMany({
    where: { id: { in: targetContractIds } }
  });
  contracts.forEach(c => {
    console.log(`  Contract #${c.id} [${c.contractNumber}] "${c.title}"`);
  });

  console.log('\n=== TARGET AUCTIONS ===');
  const auctions = await prisma.auction.findMany({
    where: { id: { in: targetAuctionIds } },
    include: {
      participants: true,
      bids: true,
      timeExtensions: true
    }
  });
  auctions.forEach(a => {
    console.log(`  Auction #${a.id} [${a.auctionCode}] "${a.title}" - Parts: ${a.participants.length}, Bids: ${a.bids.length}`);
  });

  console.log('\n=== TARGET REQUIREMENTS ===');
  const reqs = await prisma.requirement.findMany({
    where: { id: { in: targetReqIds } },
    include: {
      items: true,
      clarifications: true
    }
  });
  console.log(`Found ${reqs.length} target Requirements`);

  console.log('\n=== TARGET BUYER REQUIREMENTS ===');
  const buyerReqs = await prisma.buyerRequirement.findMany({
    where: {
      createdById: 4,
      title: { in: bids.map(b => b.title).concat(contracts.map(c => c.title)) }
    },
    include: {
      responses: true
    }
  });
  console.log(`Found ${buyerReqs.length} target BuyerRequirements:`);
  buyerReqs.forEach(br => console.log(`  BuyerReq #${br.id} "${br.title}" - Responses: ${br.responses.length}`));
}

inspectDependencies()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
