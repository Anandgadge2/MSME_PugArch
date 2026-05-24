import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'object') {
    const maybeDecimal = value as { toString?: () => string; value?: unknown };
    if (maybeDecimal.value !== undefined) return toNumber(maybeDecimal.value);
    if (typeof maybeDecimal.toString === 'function') {
      const parsed = Number(maybeDecimal.toString());
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

async function main() {
  try {
    const buyer = await prisma.user.findFirst({ where: { name: 'Iron Man' } });
    if (!buyer) return;

    const products = await prisma.product.findMany({ include: { category: true, seller: true } });
    const services = await prisma.service.findMany({ include: { category: true, seller: true } });
    const allProducts = products.map(item => ({ ...item, itemKind: 'product' as const }));
    const allServices = services.map(item => ({ ...item, itemKind: 'service' as const }));
    const allItems = [...allProducts, ...allServices];

    console.log('All Marketplace Items:');
    allItems.forEach(item => {
      const price = item.itemKind === 'product' ? toNumber(item.price) : toNumber(item.basePrice);
      console.log(`- ${item.itemKind}-${item.id}: ${item.name} (price: ${price})`);
    });

    const purchaseRows = await prisma.directPurchase.findMany({
      where: { buyerId: buyer.id },
      include: { requirement: { include: { items: true } } }
    });

    const rfqRows = await prisma.quoteRequest.findMany({
      where: { buyerId: buyer.id }
    });

    console.log('\nMatching simulation:');
    const next: any = {};
    purchaseRows.forEach(row => {
      let matchedItem: any = undefined;

      // A. Match by requirement item productId or name
      if (row.requirement?.items?.length) {
        const reqItem = row.requirement.items[0];
        matchedItem = allItems.find(item => 
          (reqItem.productId && item.id === reqItem.productId) ||
          item.name.toLowerCase() === reqItem.itemName.toLowerCase()
        );
      }

      // B. Match by requirement title containing item name
      if (!matchedItem && row.requirement?.title) {
        matchedItem = allItems.find(item => 
          row.requirement.title.includes(item.name)
        );
      }

      // C. Fallback: If requirement is null, check if totalAmount matches the item price
      if (!matchedItem && row.totalAmount && Number(row.totalAmount) > 0) {
        matchedItem = allItems.find(item => {
          const price = item.itemKind === 'product' ? toNumber(item.price) : toNumber(item.basePrice);
          return price === Number(row.totalAmount);
        });
      }

      console.log(`DP ID ${row.id} totalAmount ${row.totalAmount} matches:`, matchedItem ? `${matchedItem.itemKind}-${matchedItem.id} (${matchedItem.name})` : 'NONE');
    });

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
