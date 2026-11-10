import fs from 'fs';

const filePath = 'backend/src/deep_procurement_test.ts';
let code = fs.readFileSync(filePath, 'utf8');

const target = `        items: {
          create: [
            {
              itemNumber: 1,
              title: 'Standard MSME Valves',
              quantity: 100,
              unitPrice: 5000,
              totalPrice: 500000
            }
          ]
        }`;

const replacement = `        items: {
          create: [
            {
              itemName: 'Standard MSME Valves',
              quantity: 100,
              unitOfMeasure: 'NOS',
              unitPrice: 5000,
              totalAmount: 500000
            }
          ]
        }`;

const normalizedCode = code.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');
const normalizedReplacement = replacement.replace(/\r\n/g, '\n');

if (normalizedCode.includes(normalizedTarget)) {
  code = normalizedCode.replace(normalizedTarget, normalizedReplacement);
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('Fixed PurchaseOrderItem schema fields in deep_procurement_test.ts');
} else {
  console.log('Target not found in deep_procurement_test.ts');
}
