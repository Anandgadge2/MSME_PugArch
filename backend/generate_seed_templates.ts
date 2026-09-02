import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

const OUTPUT_DIR = path.resolve('seeded_templates');

// We use reliable placeholder images and dummy PDFs that the backend can download
const IMAGE_URLS = [
  'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158',
  'https://images.unsplash.com/photo-1581092160562-40aa08e11576',
  'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952',
  'https://images.unsplash.com/photo-1530124566582-a618bc2615dc',
  'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122',
  'https://images.unsplash.com/photo-1581092335397-9583eb92d232'
];

const DOC_URLS = [
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf',
  'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/test/pdfs/xfa_xobject.pdf'
];

const getRandomImages = () => {
    const shuffled = [...IMAGE_URLS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3 + Math.floor(Math.random() * 2)).join(', '); // 3 to 4 images
};

const getRandomDocs = () => {
    const shuffled = [...DOC_URLS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 2 + Math.floor(Math.random() * 2)).join(', '); // 2 to 3 docs
};

async function main() {
    const productCategories = await prisma.category.findMany({ where: { isActive: true, OR: [{ type: 'PRODUCT' }, { type: 'BOTH' }] } });
    const serviceCategories = await prisma.category.findMany({ where: { isActive: true, OR: [{ type: 'SERVICE' }, { type: 'BOTH' }] } });

    const prodCatNames = productCategories.map(c => c.name);
    const servCatNames = serviceCategories.map(c => c.name);

    const defaultProdCat = prodCatNames[0] || 'Safety Equipment & Industrial Safety';
    const defaultServCat = servCatNames[0] || 'Industrial Maintenance Services';

    // 1. Generate Products
    const productHeaders = [
      'Product Name *', 'Category *', 'Status', 'Description', 'Price *', 'Currency', 'GST Rate (%)',
      'Unit Of Measure *', 'HSN Code', 'SKU', 'Brand', 'Model Number', 'Item Condition', 'MSME Made (Yes/No)',
      'Original Price', 'Discount Price', 'Discount Percent', 'Offer Label', 'Offer Start Date (YYYY-MM-DD)',
      'Offer End Date (YYYY-MM-DD)', 'Bulk Deal Available (Yes/No)', 'Bulk Minimum Quantity', 'Image URLs', 'Document URLs'
    ];
    
    const products = [];
    const prodSpecs = [];
    
    for (let i = 1; i <= 20; i++) {
        const name = `Premium Industrial Product Variant ${i}`;
        const sku = `PROD-2026-${1000 + i}`;
        const cat = prodCatNames[i % prodCatNames.length] || defaultProdCat;
        
        products.push([
            name, cat, 'ACTIVE', `High quality industrial product ${i} with premium build. Ideal for heavy duty applications.`, (150 * i), 'INR', 18,
            'Nos', `HSN${8000+i}`, sku, `IndustrialBrand${i}`, `MOD-PRO-${i}`, 'NEW', 'Yes', 
            (180 * i), '', '', 'Special Offer', '', '', 'Yes', 10, getRandomImages(), getRandomDocs()
        ]);

        prodSpecs.push([sku, name, 'Material', `High-Grade Alloy Type ${i}`, '']);
        prodSpecs.push([sku, name, 'Weight', `${i * 1.5}`, 'Kg']);
        prodSpecs.push([sku, name, 'Warranty', '2 Years', '']);
        prodSpecs.push([sku, name, 'Safety Standard', 'ISO 9001:2015', '']);
    }

    // 2. Generate Services
    const serviceHeaders = [
      'Service Name *', 'Category *', 'Status', 'Description', 'Pricing Model *', 'Base Price *', 'Currency',
      'GST Rate (%)', 'Service Area *', 'Scope Of Work', 'Deliverables', 'Inclusions', 'Exclusions', 'SLA Response Time', 'Duration',
      'Original Price', 'Discount Price', 'Discount Percent', 'Offer Label', 'Offer Start Date (YYYY-MM-DD)', 'Offer End Date (YYYY-MM-DD)',
      'Bulk Deal Available (Yes/No)', 'Bulk Minimum Quantity', 'Image URLs', 'Document URLs'
    ];

    const services = [];
    const servSpecs = [];

    for (let i = 1; i <= 20; i++) {
        const name = `Professional Maintenance & Audit Service ${i}`;
        const cat = servCatNames[i % servCatNames.length] || defaultServCat;

        services.push([
            name, cat, 'ACTIVE', `Comprehensive industrial service ${i} provided by certified experts. Includes end-to-end management.`, 'FIXED', (5000 * i), 'INR',
            18, 'Pan-India', `Perform thorough audit and preventive maintenance for facility ${i}.`, `Detailed Audit Report, Compliance Certificate ${i}`, `Travel, Calibrated Tools, Engineer Visit`, `Spare Parts, Consumables`,
            '24 Hours', '1 Year Contract', (6000 * i), '', '', 'Annual Discount', '', '', 'Yes', 3, getRandomImages(), getRandomDocs()
        ]);

        servSpecs.push([name, 'Certified Technicians', `Yes - Grade A Level ${i}`, '']);
        servSpecs.push([name, 'Visit Frequency', `${i + 1} visits per year`, 'Visits']);
        servSpecs.push([name, 'Emergency Support', `24x7 Breakdown On-call`, '']);
    }

    // Prepare Workbooks
    const wbProd = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbProd, XLSX.utils.aoa_to_sheet([productHeaders, ...products]), 'Products');
    XLSX.utils.book_append_sheet(wbProd, XLSX.utils.aoa_to_sheet([['Product SKU', 'Product Name', 'Specification Name *', 'Specification Value *', 'Unit'], ...prodSpecs]), 'Product Specifications');
    XLSX.utils.book_append_sheet(wbProd, XLSX.utils.aoa_to_sheet([['Categories'], ...prodCatNames.map(c => [c])]), 'Dropdown Values');

    const wbServ = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbServ, XLSX.utils.aoa_to_sheet([serviceHeaders, ...services]), 'Services');
    XLSX.utils.book_append_sheet(wbServ, XLSX.utils.aoa_to_sheet([['Service Name', 'Specification Name *', 'Specification Value *', 'Unit'], ...servSpecs]), 'Service Specifications');
    XLSX.utils.book_append_sheet(wbServ, XLSX.utils.aoa_to_sheet([['Categories'], ...servCatNames.map(c => [c])]), 'Dropdown Values');

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const prodPath = path.join(OUTPUT_DIR, 'Seeded_Products_Import.xlsx');
    const servPath = path.join(OUTPUT_DIR, 'Seeded_Services_Import.xlsx');

    fs.writeFileSync(prodPath, XLSX.write(wbProd, { type: 'buffer', bookType: 'xlsx' }));
    fs.writeFileSync(servPath, XLSX.write(wbServ, { type: 'buffer', bookType: 'xlsx' }));

    console.log('Successfully generated seeded templates.');
    console.log('Product Path:', prodPath);
    console.log('Service Path:', servPath);
}

main().catch(console.error);
