import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ClipboardList, FileText, Landmark, Users } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/card';
import { Input, Select } from '../components/ui/input';
import { cn } from '../lib/utils';
import { shgApi, type ShgProfile } from '../features/shg/api';

const steps = [
  'SHG Verification',
  'Leader Details',
  'Bank Details',
  'Member Information',
  'Business / Activity',
  'Documents Upload',
  'Review & Submit',
];

const requiredDocs = [
  ['LEADER_KYC', 'Group Leader Aadhaar/KYC or digital verification proof'],
  ['BANK_PASSBOOK', 'Bank Passbook / Cancelled Cheque'],
  ['MEMBER_LIST', 'Member List'],
  ['ADDRESS_PROOF', 'Address Proof'],
  ['FORMATION_RESOLUTION', 'SHG Formation Resolution'],
  ['AUTHORIZATION_LETTER', 'Authorization Letter'],
] as const;

export default function ShgOnboarding({ section = 'onboarding' }: { section?: string }) {
  const [profile, setProfile] = useState<ShgProfile | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<any>({});
  const [bank, setBank] = useState({ bankName: '', accountHolderName: '', accountNumber: '', confirmAccountNumber: '', ifsc: '', branchName: '', accountType: 'Savings', isPrimary: true });
  const [member, setMember] = useState({ name: '', mobile: '', officeRole: 'MEMBER', gender: '', age: '', isOfficeBearer: false });
  const [documentDraft, setDocumentDraft] = useState({ documentType: 'LEADER_KYC', fileName: '', mimeType: 'application/pdf', size: '' });
  const [otp, setOtp] = useState('');
  const [finalOtpVerified, setFinalOtpVerified] = useState(false);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  const progress = useMemo(() => {
    if (!profile) return 0;
    const completed = [
      Boolean(profile.shgName && profile.state && profile.district && profile.village),
      Boolean(profile.representativeFirstName && profile.representativeMobile),
      Boolean(profile.bankAccounts?.some(item => item.isPrimary)),
      Boolean((profile.members || []).length),
      Boolean(profile.organization || draft.business),
      requiredDocs.every(([type]) => profile.documents?.some(doc => doc.documentType === type && ['UPLOADED', 'UNDER_REVIEW', 'VERIFIED'].includes(doc.status))),
      profile.applicationStatus === 'PENDING_REVIEW' || profile.applicationStatus === 'APPROVED',
    ].filter(Boolean).length;
    return Math.round((completed / steps.length) * 100);
  }, [profile, draft.business]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await shgApi.get<ShgProfile>('/api/shg/onboarding');
      setProfile(data);
    } catch (error: any) {
      setMessage(error.message || 'Unable to load SHG onboarding.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveStep = async () => {
    if (!profile) return;
    setSaving(true);
    setMessage('');
    try {
      const updated = await shgApi.patch<ShgProfile>(`/api/shg/onboarding/step/${activeStep + 1}`, {
        completed: true,
        completionPercent: progress,
        data: draft[activeStep] || {},
      });
      setProfile(updated);
      setMessage('Draft saved.');
    } catch (error: any) {
      setMessage(error.message || 'Unable to save draft.');
    } finally {
      setSaving(false);
    }
  };

  const saveBank = async () => {
    setSaving(true);
    try {
      await shgApi.post('/api/shg/bank-accounts', bank);
      setBank({ bankName: '', accountHolderName: '', accountNumber: '', confirmAccountNumber: '', ifsc: '', branchName: '', accountType: 'Savings', isPrimary: true });
      await load();
      setMessage('Bank details saved.');
    } catch (error: any) {
      setMessage(error.message || 'Unable to save bank details.');
    } finally {
      setSaving(false);
    }
  };

  const addMember = async () => {
    setSaving(true);
    try {
      await shgApi.post('/api/shg/members', { ...member, age: member.age ? Number(member.age) : undefined });
      setMember({ name: '', mobile: '', officeRole: 'MEMBER', gender: '', age: '', isOfficeBearer: false });
      await load();
      setMessage('Member saved.');
    } catch (error: any) {
      setMessage(error.message || 'Unable to save member.');
    } finally {
      setSaving(false);
    }
  };

  const addDocument = async () => {
    setSaving(true);
    try {
      await shgApi.post('/api/shg/documents', { ...documentDraft, size: documentDraft.size ? Number(documentDraft.size) : undefined, required: requiredDocs.some(([type]) => type === documentDraft.documentType) });
      setDocumentDraft({ documentType: 'LEADER_KYC', fileName: '', mimeType: 'application/pdf', size: '' });
      await load();
      setMessage('Document metadata saved.');
    } catch (error: any) {
      setMessage(error.message || 'Unable to save document.');
    } finally {
      setSaving(false);
    }
  };

  const sendFinalOtp = async () => {
    setSaving(true);
    try {
      await shgApi.post('/api/shg/final-otp/send', {});
      setMessage('Final submission OTP sent to the login email.');
    } catch (error: any) {
      setMessage(error.message || 'Unable to send final OTP.');
    } finally {
      setSaving(false);
    }
  };

  const verifyFinalOtp = async () => {
    setSaving(true);
    try {
      await shgApi.post('/api/shg/final-otp/verify', { otp });
      setFinalOtpVerified(true);
      setMessage('Final OTP verified.');
    } catch (error: any) {
      setMessage(error.message || 'Invalid final OTP.');
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      const updated = await shgApi.post<ShgProfile>('/api/shg/submit', { declarationAccepted });
      setProfile(updated);
      setMessage(`Application submitted${updated.applicationNumber ? `: ${updated.applicationNumber}` : ''}.`);
    } catch (error: any) {
      setMessage(error.message || 'Unable to submit application.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="grid gap-4"><div className="h-28 rounded-lg bg-slate-200/70 animate-pulse" /><div className="h-72 rounded-lg bg-slate-200/70 animate-pulse" /></div>;
  }

  if (!profile) {
    return <Card><CardContent className="p-6 text-sm text-slate-600">{message || 'SHG profile is not available.'}</CardContent></Card>;
  }

  if (section !== 'onboarding') {
    return <ShgDashboardSection section={section} profile={profile} progress={progress} />;
  }

  return (
    <div className="space-y-5">
      {message && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">{message}</div>}
      <Card>
        <CardContent className="flex flex-col justify-between gap-4 p-5 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">SHG ONBOARDING HUB</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{profile.shgName}</h1>
            <p className="text-sm text-slate-500">{profile.district}, {profile.state}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={profile.applicationStatus === 'APPROVED' ? 'success' : profile.applicationStatus === 'REJECTED' ? 'error' : 'warning'}>{profile.applicationStatus.replaceAll('_', ' ')}</Badge>
            <div className="min-w-48">
              <div className="mb-1 flex justify-between text-xs font-bold text-slate-500"><span>Progress</span><span>{progress}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-navy" style={{ width: `${progress}%` }} /></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card>
          <CardContent className="space-y-2 p-3">
            {steps.map((step, index) => (
              <button
                key={step}
                onClick={() => setActiveStep(index)}
                className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold', activeStep === index ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50')}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-xs">{index + 1}</span>
                {step}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{steps[activeStep]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {activeStep === 0 && <ReadonlyGrid profile={profile} />}
            {activeStep === 1 && <LeaderPanel profile={profile} />}
            {activeStep === 2 && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="Bank Name *" value={bank.bankName} onChange={e => setBank(prev => ({ ...prev, bankName: e.target.value }))} />
                  <Input label="Account Holder Name *" value={bank.accountHolderName} onChange={e => setBank(prev => ({ ...prev, accountHolderName: e.target.value }))} />
                  <Input label="Account Number *" value={bank.accountNumber} onChange={e => setBank(prev => ({ ...prev, accountNumber: e.target.value }))} />
                  <Input label="Confirm Account Number *" value={bank.confirmAccountNumber} onChange={e => setBank(prev => ({ ...prev, confirmAccountNumber: e.target.value }))} />
                  <Input label="IFSC Code *" value={bank.ifsc} onChange={e => setBank(prev => ({ ...prev, ifsc: e.target.value.toUpperCase() }))} />
                  <Input label="Branch Name" value={bank.branchName} onChange={e => setBank(prev => ({ ...prev, branchName: e.target.value }))} />
                  <Select label="Account Type" value={bank.accountType} onChange={e => setBank(prev => ({ ...prev, accountType: e.target.value }))}><option>Savings</option><option>Current</option></Select>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-600"><input type="checkbox" checked={bank.isPrimary} onChange={e => setBank(prev => ({ ...prev, isPrimary: e.target.checked }))} /> Primary account</label>
                </div>
                <Button onClick={saveBank} disabled={saving}>Save Bank Account</Button>
                <SimpleTable rows={profile.bankAccounts || []} columns={['bankName', 'accountHolderName', 'accountNumberMasked', 'ifsc', 'isPrimary']} />
              </div>
            )}
            {activeStep === 3 && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Input label="Member Name *" value={member.name} onChange={e => setMember(prev => ({ ...prev, name: e.target.value }))} />
                  <Input label="Mobile" value={member.mobile} onChange={e => setMember(prev => ({ ...prev, mobile: e.target.value }))} />
                  <Select label="Role" value={member.officeRole} onChange={e => setMember(prev => ({ ...prev, officeRole: e.target.value }))}>
                    {['MEMBER', 'PRESIDENT', 'SECRETARY', 'TREASURER', 'LEADER', 'COORDINATOR', 'AUTHORIZED_REPRESENTATIVE', 'OTHER'].map(role => <option key={role}>{role}</option>)}
                  </Select>
                  <Input label="Gender" value={member.gender} onChange={e => setMember(prev => ({ ...prev, gender: e.target.value }))} />
                  <Input label="Age" value={member.age} onChange={e => setMember(prev => ({ ...prev, age: e.target.value }))} />
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-600"><input type="checkbox" checked={member.isOfficeBearer} onChange={e => setMember(prev => ({ ...prev, isOfficeBearer: e.target.checked }))} /> Office bearer</label>
                </div>
                <div className="flex flex-wrap gap-2"><Button onClick={addMember} disabled={saving}>Add Member</Button><Button variant="outline" onClick={() => window.location.href = '/api/shg/members/export-csv'}>CSV Export</Button></div>
                <SimpleTable rows={profile.members || []} columns={['name', 'mobile', 'officeRole', 'gender', 'age', 'kycStatus']} />
              </div>
            )}
            {activeStep === 4 && <BusinessPanel draft={draft} setDraft={setDraft} />}
            {activeStep === 5 && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <Select label="Document Type" value={documentDraft.documentType} onChange={e => setDocumentDraft(prev => ({ ...prev, documentType: e.target.value }))}>
                    {[...requiredDocs.map(([type]) => type), 'REGISTRATION_CERTIFICATE', 'PAN_CARD', 'UDYAM_CERTIFICATE', 'GST_CERTIFICATE', 'NRLM_SRLM_CERTIFICATE', 'TRAINING_CERTIFICATE', 'PRODUCT_CATALOGUE', 'OTHER'].map(type => <option key={type}>{type}</option>)}
                  </Select>
                  <Input label="File Name" value={documentDraft.fileName} onChange={e => setDocumentDraft(prev => ({ ...prev, fileName: e.target.value }))} />
                  <Select label="MIME Type" value={documentDraft.mimeType} onChange={e => setDocumentDraft(prev => ({ ...prev, mimeType: e.target.value }))}><option value="application/pdf">PDF</option><option value="image/jpeg">JPG/JPEG</option><option value="image/png">PNG</option></Select>
                  <Input label="Size (bytes)" value={documentDraft.size} onChange={e => setDocumentDraft(prev => ({ ...prev, size: e.target.value }))} />
                </div>
                <Button onClick={addDocument} disabled={saving}>Save Document Metadata</Button>
                <DocumentTable profile={profile} />
              </div>
            )}
            {activeStep === 6 && (
              <div className="space-y-4">
                <Review profile={profile} progress={progress} />
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={declarationAccepted} onChange={e => setDeclarationAccepted(e.target.checked)} className="mt-1" />
                  <span>I confirm that the details submitted are true and correct. I am authorized to submit this SHG onboarding application on behalf of the group.</span>
                </label>
                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <Input label="Final OTP" value={otp} onChange={e => setOtp(e.target.value)} />
                  <div className="flex items-end"><Button variant="outline" onClick={sendFinalOtp} disabled={saving}>Send OTP</Button></div>
                  <div className="flex items-end"><Button variant="outline" onClick={verifyFinalOtp} disabled={saving || !otp}>Verify OTP</Button></div>
                </div>
                <Button onClick={submit} disabled={saving || !declarationAccepted || !finalOtpVerified}>Final Submission</Button>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-100 pt-4">
              <Button variant="outline" onClick={() => setActiveStep(step => Math.max(0, step - 1))}>Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={saveStep} disabled={saving}>Save as Draft</Button>
                <Button onClick={() => setActiveStep(step => Math.min(steps.length - 1, step + 1))}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ShgDashboardSection({ section, profile, progress }: { section: string; profile: ShgProfile; progress: number }) {
  const title = section.replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase());
  const cards = [
    ['Overview', `${progress}% complete`, ClipboardList],
    ['Members', String(profile.members?.length || 0), Users],
    ['Documents', String(profile.documents?.length || 0), FileText],
    ['Bank Accounts', String(profile.bankAccounts?.length || 0), Landmark],
  ];
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          {cards.map(([label, value, Icon]: any) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
              <Icon className="mb-3 h-5 w-5 text-brand-navy" />
              <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5 text-sm text-slate-600">
          This SHG workspace is connected to the onboarding profile. Detailed workflows for this tab will use the same owner-scoped SHG APIs and existing marketplace/payment modules.
        </CardContent>
      </Card>
    </div>
  );
}

function ReadonlyGrid({ profile }: { profile: ShgProfile }) {
  const rows = [
    ['SHG Type', profile.shgType],
    ['SHG Name', profile.shgName],
    ['State', profile.state],
    ['District', profile.district],
    ['Village', profile.village],
    ['Members', profile.memberCount],
    ['Registration Status', profile.registrationStatus],
  ];
  return <div className="grid gap-3 md:grid-cols-2">{rows.map(([label, value]) => <InfoRow key={String(label)} label={String(label)} value={value} />)}</div>;
}

function LeaderPanel({ profile }: { profile: ShgProfile }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <InfoRow label="Leader Name" value={`${profile.representativeFirstName || ''} ${profile.representativeLastName || ''}`.trim() || '-'} />
      <InfoRow label="Role" value={profile.representativeRole || '-'} />
      <InfoRow label="Mobile" value={profile.representativeMobile || '-'} />
      <InfoRow label="Email" value={profile.representativeEmail || '-'} />
    </div>
  );
}

function BusinessPanel({ draft, setDraft }: { draft: any; setDraft: (value: any) => void }) {
  const business = draft.business || {};
  const setField = (field: string, value: any) => setDraft((prev: any) => ({ ...prev, business: { ...(prev.business || {}), [field]: value } }));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Input label="Primary Product or Service *" value={business.primaryProduct || ''} onChange={e => setField('primaryProduct', e.target.value)} />
      <Select label="Activity Category *" value={business.activityCategory || 'Agriculture'} onChange={e => setField('activityCategory', e.target.value)}>
        {['Agriculture', 'Horticulture', 'Food Processing', 'Handicraft', 'Handloom', 'Dairy', 'Poultry', 'Fishery', 'Tailoring / Garments', 'Retail / Trading', 'Services', 'Forest Produce', 'Other'].map(item => <option key={item}>{item}</option>)}
      </Select>
      <Select label="Monthly Income Range *" value={business.monthlyIncomeRange || 'Below INR 10,000'} onChange={e => setField('monthlyIncomeRange', e.target.value)}>
        {['Below INR 10,000', 'INR 10,000 - INR 25,000', 'INR 25,000 - INR 50,000', 'INR 50,000 - INR 1,00,000', 'Above INR 1,00,000'].map(item => <option key={item}>{item}</option>)}
      </Select>
      <Input label="Years of Operation *" value={business.yearsOfOperation || ''} onChange={e => setField('yearsOfOperation', e.target.value)} />
      <Select label="Market Area *" value={business.marketArea || 'Local Village / Town'} onChange={e => setField('marketArea', e.target.value)}>
        {['Local Village / Town', 'District Level', 'State Level', 'National Level'].map(item => <option key={item}>{item}</option>)}
      </Select>
      <Input label="Production Capacity" value={business.productionCapacity || ''} onChange={e => setField('productionCapacity', e.target.value)} />
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-600"><input type="checkbox" checked={Boolean(business.marketplaceInterested)} onChange={e => setField('marketplaceInterested', e.target.checked)} /> Interested in marketplace listing</label>
    </div>
  );
}

function DocumentTable({ profile }: { profile: ShgProfile }) {
  const docs = profile.documents || [];
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Status</TableHead><TableHead>Required</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader>
      <TableBody>
        {[...requiredDocs.map(([type, label]) => ({ documentType: type, label, required: true })), ...docs.filter(doc => !requiredDocs.some(([type]) => type === doc.documentType)).map(doc => ({ ...doc, label: doc.documentType, required: doc.required }))].map(row => {
          const uploaded = docs.find(doc => doc.documentType === row.documentType);
          return (
            <TableRow key={row.documentType}>
              <TableCell>{row.label}</TableCell>
              <TableCell><Badge variant={uploaded?.status === 'VERIFIED' ? 'success' : uploaded ? 'warning' : 'default'}>{uploaded?.status || 'NOT_UPLOADED'}</Badge></TableCell>
              <TableCell>{row.required ? 'Required' : 'Optional'}</TableCell>
              <TableCell>{uploaded?.remarks || '-'}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function Review({ profile, progress }: { profile: ShgProfile; progress: number }) {
  const missingDocs = requiredDocs.filter(([type]) => !profile.documents?.some(doc => doc.documentType === type && ['UPLOADED', 'UNDER_REVIEW', 'VERIFIED'].includes(doc.status)));
  const hasPrimaryBank = profile.bankAccounts?.some(bank => bank.isPrimary);
  return (
    <div className="space-y-3">
      <InfoRow label="Profile Completeness" value={`${progress}%`} />
      <InfoRow label="Primary Bank Account" value={hasPrimaryBank ? 'Available' : 'Missing'} />
      <InfoRow label="Missing Required Documents" value={missingDocs.length ? missingDocs.map(([, label]) => label).join(', ') : 'None'} />
      {missingDocs.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800"><AlertCircle className="mr-2 inline h-4 w-4" /> Complete missing documents before final submission.</div>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value || '-'}</p></div>;
}

function SimpleTable({ rows, columns }: { rows: any[]; columns: string[] }) {
  if (!rows.length) return <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No records yet.</p>;
  return (
    <Table>
      <TableHeader><TableRow>{columns.map(column => <TableHead key={column}>{column}</TableHead>)}</TableRow></TableHeader>
      <TableBody>
        {rows.map(row => <TableRow key={row.id}>{columns.map(column => <TableCell key={column}>{typeof row[column] === 'boolean' ? (row[column] ? 'Yes' : 'No') : row[column] || '-'}</TableCell>)}</TableRow>)}
      </TableBody>
    </Table>
  );
}
