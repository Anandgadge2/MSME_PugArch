import os
import re
import json

def parse_policy_txt(file_path, comp_name, main_titles):
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # Clean page markers
    text = re.sub(r'---\s*PAGE\s*\d+\s*---', '', text)
    text = text.replace('[DD/MM/YYYY]', '30/07/2026').replace('[30/07/2026]', '30/07/2026')
    
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    
    jsx_lines = []
    jsx_lines.append(f'export function {comp_name}() {{')
    jsx_lines.append('  return (')
    jsx_lines.append('    <div className="space-y-4 font-sans text-xs sm:text-sm text-slate-700 leading-relaxed">')
    
    in_list = False
    
    for i, line in enumerate(lines):
        escaped = (line.replace('&', '&amp;')
                       .replace('<', '&lt;')
                       .replace('>', '&gt;')
                       .replace('{', '&#123;')
                       .replace('}', '&#125;'))
        
        # Main Document Title
        if line in main_titles or (i == 0 and len(line) < 60 and line.isupper()):
            if in_list:
                jsx_lines.append('      </ul>')
                in_list = False
            jsx_lines.append('      <div className="text-center border-b border-slate-200 pb-4 mb-4">')
            jsx_lines.append(f'        <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">{escaped}</h2>')
            jsx_lines.append('      </div>')
        elif line.strip() == 'POLICY':
            continue
        # Sub-title / Portal identity line
        elif line.startswith('JSG SMILE') or line.startswith('Website:') or line.startswith('Effective Date:'):
            if in_list:
                jsx_lines.append('      </ul>')
                in_list = False
            jsx_lines.append(f'      <p className="text-center text-xs font-bold text-slate-500 uppercase tracking-wide">{escaped}</p>')
        # Section Header (e.g. 1. PURPOSE, 2. DEFINITIONS, etc.)
        elif re.match(r'^\d+\.\s+[A-Z\s&,()\/]+$', line):
            if in_list:
                jsx_lines.append('      </ul>')
                in_list = False
            sec_id = re.sub(r'[^a-zA-Z0-9]', '-', line.lower()).strip('-')
            jsx_lines.append(f'      <h3 id="{sec_id}" className="text-sm font-black text-[#0b2447] mt-6 mb-2 border-l-4 border-[#0b2447] pl-3 uppercase tracking-wide">{escaped}</h3>')
        # Sub-heading (e.g. 3.1 Personal Information, Stage 1 - Account Creation)
        elif re.match(r'^\d+\.\d+\s+', line) or line.startswith('Stage ') or line.startswith('Step ') or line in ['Buyers', 'Suppliers', 'Mandatory Requirements', 'Preferred Requirements', 'Preferred Registrations', 'Business Documents', 'Banking Documents', 'Product and Service Documents', 'Authorized Representative Documents']:
            if in_list:
                jsx_lines.append('      </ul>')
                in_list = False
            jsx_lines.append(f'      <h4 className="text-xs sm:text-sm font-bold text-slate-900 mt-3 mb-1">{escaped}</h4>')
        # Bullet items starting with • or - or numbered list
        elif line.startswith('•') or line.startswith('- ') or (len(line) > 3 and line[0].isdigit() and line[1:3] == '. ' and len(line) < 120):
            if not in_list:
                jsx_lines.append('      <ul className="space-y-1.5 pl-2 my-2">')
                in_list = True
            item_text = escaped
            if item_text.startswith('•') or item_text.startswith('- '):
                item_text = item_text[1:].strip()
            elif item_text[0].isdigit() and item_text[1:3] == '. ':
                item_text = item_text[3:].strip()
            jsx_lines.append(f'        <li className="flex items-start gap-2"><span className="text-[#0b2447] font-bold shrink-0">•</span><span>{item_text}</span></li>')
        # Regular paragraph
        else:
            if in_list:
                jsx_lines.append('      </ul>')
                in_list = False
            jsx_lines.append(f'      <p className="leading-relaxed text-slate-700">{escaped}</p>')
            
    if in_list:
        jsx_lines.append('      </ul>')
    jsx_lines.append('    </div>')
    jsx_lines.append('  );')
    jsx_lines.append('}')
    return '\n'.join(jsx_lines)

# Read docs_extracted_clean.json for the 4 already cleanly extracted
with open(r'docs_extracted_clean.json', 'r', encoding='utf-8') as f:
    docs = json.load(f)

def clean_doc_text(raw_text):
    cleaned = re.sub(r'---\s*PAGE\s*\d+\s*---', '', raw_text)
    cleaned = cleaned.replace('[DD/MM/YYYY]', '30/07/2026').replace('[30/07/2026]', '30/07/2026')
    return cleaned

# Generate code
all_code = ["import React from 'react';\n"]

# 1. Terms and Conditions
with open('tmp_gtc.txt', 'w', encoding='utf-8') as f:
    f.write(clean_doc_text(docs['Terms_and_Conditions.pdf']))
all_code.append(parse_policy_txt('tmp_gtc.txt', 'GtcContent', ['TERMS & CONDITIONS', 'TERMS AND CONDITIONS']))

# 2. Privacy Policy
all_code.append('\n' + parse_policy_txt('docs/Privacy_Policy_JSG_Smile.txt', 'PrivacyPolicyContent', ['PRIVACY POLICY']))

# 3. MSME Registration & Supplier Participation Agreement
with open('tmp_supp.txt', 'w', encoding='utf-8') as f:
    f.write(clean_doc_text(docs['MSME_Registration_Supplier_Participation_Agreement.pdf']))
all_code.append('\n' + parse_policy_txt('tmp_supp.txt', 'SupplierAgreementContent', ['MSME REGISTRATION & SUPPLIER PARTICIPATION AGREEMENT']))

# 4. Vendor Verification Policy
with open('tmp_vend.txt', 'w', encoding='utf-8') as f:
    f.write(clean_doc_text(docs['Vendor_Verification_Policy.pdf']))
all_code.append('\n' + parse_policy_txt('tmp_vend.txt', 'VerificationPolicyContent', ['VENDOR VERIFICATION, EMPANELMENT & APPROVAL POLICY']))

# 5. Order Placement & Procurement Facilitation Policy
all_code.append('\n' + parse_policy_txt('docs/Order_Placement_and_Procurement_Facilitation_Policy.txt', 'OrderPlacementPolicyContent', ['ORDER PLACEMENT & PROCUREMENT FACILITATION POLICY', 'ORDER PLACEMENT & PROCUREMENT FACILITATION']))

# 6. Order Cancellation, Withdrawal & Refund Policy
all_code.append('\n' + parse_policy_txt('docs/Order_Cancellation_Withdrawal_and_Refund_Policy.txt', 'OrderCancellationPolicyContent', ['ORDER CANCELLATION, WITHDRAWAL & REFUND POLICY', 'ORDER CANCELLATION, WITHDRAWAL & REFUND']))

# 7. Data Sharing Consent Agreement
with open('tmp_data.txt', 'w', encoding='utf-8') as f:
    f.write(clean_doc_text(docs['Data_Sharing_Consent_Agreement.pdf']))
all_code.append('\n' + parse_policy_txt('tmp_data.txt', 'ConsentPolicyContent', ['DATA SHARING CONSENT & USER AUTHORIZATION AGREEMENT']))

target_path = r'frontend/src/components/registration/LegalDocumentsText.tsx'
with open(target_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(all_code))

for tmp in ['tmp_gtc.txt', 'tmp_supp.txt', 'tmp_vend.txt', 'tmp_data.txt']:
    if os.path.exists(tmp):
        os.remove(tmp)

print(f"Successfully generated all 7 official policies into {target_path}!")
