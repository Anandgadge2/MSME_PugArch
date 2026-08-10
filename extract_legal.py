import json
import re

with open(r'c:\Pugarch\jsgSMILE\MSME_PugArch\docs_extracted_clean.json', 'r', encoding='utf-8') as f:
    docs = json.load(f)

def text_to_jsx(raw_text, component_name):
    # Remove header page markers like --- PAGE X ---
    cleaned = re.sub(r'---\s*PAGE\s*\d+\s*---', '', raw_text)
    # Replace placeholder date with default 30/07/2026
    cleaned = cleaned.replace('[DD/MM/YYYY]', '30/07/2026').replace('[30/07/2026]', '30/07/2026')
    
    lines = [l.strip() for l in cleaned.split('\n') if l.strip()]
    
    jsx_lines = []
    jsx_lines.append(f'export function {component_name}() {{')
    jsx_lines.append('  return (')
    jsx_lines.append('    <div className="space-y-3 font-sans text-xs sm:text-sm text-slate-700 leading-relaxed">')
    
    in_list = False

    for line in lines:
        escaped = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('{', '&#123;').replace('}', '&#125;')
        
        # Main Document Title
        if line in [
            'TERMS & CONDITIONS',
            'MSME REGISTRATION & SUPPLIER PARTICIPATION AGREEMENT',
            'DATA SHARING CONSENT & USER AUTHORIZATION AGREEMENT',
            'VENDOR VERIFICATION, EMPANELMENT & APPROVAL POLICY'
        ]:
            if in_list:
                jsx_lines.append('      </ul>')
                in_list = False
            jsx_lines.append(f'      <div className="text-center border-b border-slate-200 pb-4 mb-4">')
            jsx_lines.append(f'        <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">{escaped}</h2>')
            jsx_lines.append(f'      </div>')
        
        # Sub-title / Portal identity line
        elif line.startswith('JSG SMILE') or line.startswith('Website:') or line.startswith('Effective Date:'):
            if in_list:
                jsx_lines.append('      </ul>')
                in_list = False
            jsx_lines.append(f'      <p className="text-center text-xs font-bold text-slate-500 uppercase tracking-wide">{escaped}</p>')

        # Section Header (e.g., 1. INTRODUCTION, 2. DEFINITIONS, 3. NATURE OF THE PORTAL)
        elif re.match(r'^\d+\.\s+[A-Z\s&,()\/]+$', line):
            if in_list:
                jsx_lines.append('      </ul>')
                in_list = False
            jsx_lines.append(f'      <h3 className="text-sm font-black text-[#12335f] mt-6 mb-2 border-l-4 border-[#12335f] pl-3 uppercase tracking-wide">{escaped}</h3>')

        # Sub-heading (e.g. 3.1 JSG SMILE is solely..., 4.1 Buyers, Step 1 – Account Creation)
        elif re.match(r'^\d+\.\d+\s+', line) or line in ['Buyers', 'Suppliers', 'Mandatory Requirements', 'Preferred Requirements', 'Preferred Registrations', 'Business Documents', 'Banking Documents', 'Product and Service Documents', 'Authorized Representative Documents'] or line.startswith('Step '):
            if in_list:
                jsx_lines.append('      </ul>')
                in_list = False
            jsx_lines.append(f'      <h4 className="text-xs sm:text-sm font-bold text-slate-900 mt-3 mb-1">{escaped}</h4>')

        # Bullet items starting with •
        elif line.startswith('•') or line.startswith('1. ') or line.startswith('2. ') or line.startswith('3. ') or line.startswith('4. ') or line.startswith('5. ') or line.startswith('a. ') or line.startswith('b. ') or line.startswith('c. '):
            if not in_list:
                jsx_lines.append('      <ul className="space-y-1.5 pl-2 my-2">')
                in_list = True
            item_text = escaped
            if item_text.startswith('•'):
                item_text = item_text[1:].strip()
            jsx_lines.append(f'        <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>{item_text}</span></li>')

        # Regular Paragraph
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

code = ['import React from \'react\';\n']
code.append(text_to_jsx(docs['Terms_and_Conditions.pdf'], 'GtcContent'))
code.append('\n' + text_to_jsx(docs['MSME_Registration_Supplier_Participation_Agreement.pdf'], 'SupplierAgreementContent'))
code.append('\n' + text_to_jsx(docs['Data_Sharing_Consent_Agreement.pdf'], 'ConsentPolicyContent'))
code.append('\n' + text_to_jsx(docs['Vendor_Verification_Policy.pdf'], 'VerificationPolicyContent'))

output_path = r'c:\Pugarch\jsgSMILE\MSME_PugArch\frontend\src\components\registration\LegalDocumentsText.tsx'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(code))

print('Successfully regenerated LegalDocumentsText.tsx with government portal layout!')
