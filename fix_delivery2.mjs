import fs from 'fs';

let content = fs.readFileSync('frontend/src/features/delivery/pages/DeliveryListPage.tsx', 'utf8');

// Use regex to be resilient to line endings
const pattern = /      \};\r?\n    <div className="space-y-6">/;

const fixedPart = `      };
    }
    // Fallback: lightweight client-side counters from current page
    const inMovement = processedOrders.filter(r =>
      ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'AT_HUB', 'PICKED_UP'].includes(r.status)
    ).length;
    const completed = processedOrders.filter(r =>
      ['DELIVERED', 'ACCEPTED', 'CLOSED', 'PAYMENT_RELEASED'].includes(r.status)
    ).length;
    const risk = processedOrders.filter(r =>
      ['DELAYED', 'DELIVERY_FAILED', 'DISPUTE_RAISED', 'RETURNED', 'CANCELLED'].includes(r.status)
    ).length;
    return { inMovement, completed, risk };
  }, [processedOrders, reportQuery.data]);

  const startIndex = (page - 1) * pageSize;
  const isInitialLoading = listQuery.isLoading && !listQuery.data;
  const isBackgroundFetching = listQuery.isFetching && !!listQuery.data;

  if (selectedId) {
    return <DeliveryDetailPage deliveryId={selectedId} onClose={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-6">`;

content = content.replace(pattern, fixedPart);

fs.writeFileSync('frontend/src/features/delivery/pages/DeliveryListPage.tsx', content);
console.log('Fixed broken DeliveryListPage.tsx with regex');
