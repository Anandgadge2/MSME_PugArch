#!/usr/bin/env node

/**
 * Procurement Flow Diagnostics Tool
 * 
 * Checks the end-to-end procurement data integrity:
 * 1. Database schema (ProcurementBid + related tables)
 * 2. Data integrity (null fields, status distributions, date validity)
 * 3. Participation verification
 * 4. Award & PurchaseOrder linkage
 * 5. Audit trail status
 * 
 * Run: node backend/check_procurement_flow.mjs
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ path: new URL('../.env.example', import.meta.url).pathname });

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';

let passed = 0;
let failed = 0;
let warnings = 0;
const errors = [];

function heading(title) {
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}  ${title}${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════${RESET}\n`);
}

function check(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ${GREEN}✓${RESET} ${name}`);
  } else {
    failed++;
    console.log(`  ${RED}✗${RESET} ${name}`);
    if (detail) {
      console.log(`    ${YELLOW}${detail}${RESET}`);
      errors.push(`FAIL: ${name} — ${detail}`);
    }
  }
}

function warn(name, detail = '') {
  warnings++;
  console.log(`  ${YELLOW}⚠${RESET} ${name}`);
  if (detail) console.log(`    ${detail}`);
}

async function main() {
  console.log(`\n${BOLD}PROCUREMENT FLOW DIAGNOSTICS${RESET}`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`  Checks database schema, data integrity, and flow linkages`);
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log(`${'─'.repeat(50)}`);

  // ============= DATABASE CONNECTION =============
  heading('1. DATABASE CONNECTION');

  let prisma;
  try {
    prisma = new PrismaClient();
    await prisma.$connect();
    check('Database connection established', true);
  } catch (e) {
    check('Database connection', false, `Connection failed: ${e.message}`);
