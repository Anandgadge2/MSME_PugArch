import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, BookOpen, CalendarDays, CheckCircle2, ClipboardList, FileText, Landmark, Mail, Phone, ShieldCheck, Store, Users } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/card';
import { Input, Select } from '../components/ui/input';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { shgApi, type ShgProfile } from '../features/shg/api';
import SellerOnboarding from './SellerOnboarding';

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
  ['UDYAM_CERTIFICATE', 'Udyam Registration Certificate'],
  ['LEADER_KYC', 'Group Leader Aadhaar/KYC or digital verification proof'],
  ['BANK_PASSBOOK', 'Bank Passbook / Cancelled Cheque'],
  ['MEMBER_LIST', 'Member List'],
] as const;

export default function ShgOnboarding({ section = 'onboarding' }: { section?: string }) {
  const { user } = useAuth();
  const [accountModel, setAccountModel] = useState<'seller' | 'native' | null>(() => {
    if (user?.role !== 'shg') return 'seller';
    if (user?.shgProfile) return 'native';
    if (user?.sellerProfile) return 'seller';
    return null;
  });

  useEffect(() => {
    if (user?.role !== 'shg') {
      setAccountModel('seller');
      return;
    }
    if (user.shgProfile) {
      setAccountModel('native');
      return;
    }
    if (user.sellerProfile) {
      setAccountModel('seller');
      return;
    }

    let active = true;
    api.fetch('/api/auth/me')
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.message || 'Unable to resolve SHG profile.');
        if (active) setAccountModel(body?.user?.shgProfile ? 'native' : 'seller');
      })
      // The established HerSHG registration flow is seller-backed, so this is
      // the safest compatibility fallback if profile resolution is unavailable.
      .catch(() => {
        if (active) setAccountModel('seller');
      });
    return () => {
      active = false;
    };
  }, [user]);

  if (!accountModel) {
    return <div className="space-y-4 animate-pulse" aria-label="Resolving SHG profile"><div className="h-28 rounded-[22px] bg-slate-200/70" /><div className="h-64 rounded-[22px] bg-slate-200/60" /></div>;
  }

  // HerSHG registrations historically use the seller account model. Keep
  // those accounts on the mature seller profile APIs, but open the exact SHG
  // section selected in the portal instead of always falling back to PAN.
  if (accountModel === 'seller') {
    if (section === 'onboarding') return <SellerOnboarding />;
    if (section === 'profile') return <SellerOnboarding initialSection="sellerProfile" />;
    if (section === 'bank-details') return <SellerOnboarding initialSection="bank" />;
    if (section === 'documents') return <SellerOnboarding initialSection="documents" />;
    return <SellerBackedShgPage section={section} />;
  }

  return <NativeShgOnboarding section={section} />;
}

function NativeShgOnboarding({ section = 'onboarding' }: { section?: string }) {
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
                    {Array.from(new Set([...requiredDocs.map(([type]) => type), 'REGISTRATION_CERTIFICATE', 'ADDRESS_PROOF', 'FORMATION_RESOLUTION', 'AUTHORIZATION_LETTER', 'PAN_CARD', 'GST_CERTIFICATE', 'NRLM_SRLM_CERTIFICATE', 'TRAINING_CERTIFICATE', 'PRODUCT_CATALOGUE', 'OTHER'])).map(type => <option key={type}>{type}</option>)}
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

function SellerBackedShgPage({ section }: { section: string }) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<any>(() => ({ user, profile: user?.sellerProfile || null }));
  const [loading, setLoading] = useState(!user?.sellerProfile);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.fetch('/api/auth/me', { skipCache: true })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.message || 'Unable to load the SHG workspace.');
        if (active) setSnapshot(body);
      })
      .catch((reason: any) => {
        if (active) setError(reason?.message || 'Unable to load the SHG workspace.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse" aria-label="Loading SHG workspace">
        <div className="h-28 rounded-[22px] bg-slate-200/70" />
        <div className="h-64 rounded-[22px] bg-slate-200/60" />
      </div>
    );
  }

  const currentUser = snapshot?.user || user || {};
  const profile = snapshot?.profile || currentUser?.sellerProfile || {};
  const organization = currentUser?.organization || {};
  const registration = currentUser?.registrationDetails || {};
  const documents = Array.isArray(profile?.sellerDocuments) ? profile.sellerDocuments : [];
  const bankAccounts = Array.isArray(profile?.bankAccounts) ? profile.bankAccounts : [];
  const memberDocuments = documents.filter((document: any) =>
    ['member_list', 'formation_resolution', 'authorization_letter'].includes(String(document?.documentType || '').toLowerCase())
  );
  const meetings = Array.isArray(profile?.meetings)
    ? profile.meetings
    : Array.isArray(registration?.meetings)
      ? registration.meetings
      : [];

  if (section === 'members') {
    return (
      <ShgSectionLayout
        title="SHG Members"
        description="Review the registered group strength and the member-list records submitted for verification."
        action={<Link href="/shg/documents" className={primaryActionClass}>Manage Member Documents <ArrowRight className="h-4 w-4" /></Link>}
      >
        {error && <InlineNotice tone="error">{error}</InlineNotice>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Declared Members" value={registration?.memberCount || profile?.memberCount || '—'} icon={Users} />
          <MetricTile label="Member Records" value={memberDocuments.length} icon={FileText} />
          <MetricTile label="SHG Type" value={registration?.shgType || 'HerSHG'} icon={Store} compact />
          <MetricTile label="Verification" value={organization?.verificationStatus || currentUser?.onboardingStatus || 'Pending'} icon={ShieldCheck} compact />
        </div>
        <Card>
          <CardHeader><CardTitle>Member records and resolutions</CardTitle></CardHeader>
          <CardContent>
            {memberDocuments.length ? (
              <Table>
                <TableHeader><TableRow><TableHead>Record</TableHead><TableHead>File</TableHead><TableHead>Status</TableHead><TableHead>Uploaded</TableHead></TableRow></TableHeader>
                <TableBody>
                  {memberDocuments.map((document: any) => (
                    <TableRow key={document.id || document.documentType}>
                      <TableCell>{readable(document.documentType)}</TableCell>
                      <TableCell>{document.fileAsset?.originalName || document.fileName || 'Uploaded document'}</TableCell>
                      <TableCell><StatusBadge value={document.status || 'UPLOADED'} /></TableCell>
                      <TableCell>{formatDate(document.uploadedAt || document.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyWorkspaceState
                icon={Users}
                title="No member list has been uploaded"
                text="Upload the SHG member list and signed resolutions from Documents to complete the group record."
                href="/shg/documents"
                action="Open Documents"
              />
            )}
          </CardContent>
        </Card>
      </ShgSectionLayout>
    );
  }

  if (section === 'meetings') {
    return (
      <ShgSectionLayout
        title="SHG Meetings"
        description="Keep meeting dates, decisions, signed minutes, and resolutions easy to find for compliance review."
        action={<Link href="/shg/documents" className={primaryActionClass}>Upload Minutes <ArrowRight className="h-4 w-4" /></Link>}
      >
        {error && <InlineNotice tone="error">{error}</InlineNotice>}
        <Card>
          <CardHeader><CardTitle>Meeting register</CardTitle></CardHeader>
          <CardContent>
            {meetings.length ? (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Meeting</TableHead><TableHead>Agenda</TableHead><TableHead>Decision</TableHead></TableRow></TableHeader>
                <TableBody>{meetings.map((meeting: any, index: number) => (
                  <TableRow key={meeting.id || index}>
                    <TableCell>{formatDate(meeting.meetingDate || meeting.date)}</TableCell>
                    <TableCell>{meeting.title || `Meeting ${index + 1}`}</TableCell>
                    <TableCell>{meeting.agenda || '—'}</TableCell>
                    <TableCell>{meeting.decisions || meeting.resolution || '—'}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : (
              <EmptyWorkspaceState
                icon={CalendarDays}
                title="No meeting records yet"
                text="Signed meeting minutes and resolutions can be maintained from the Documents page."
                href="/shg/documents"
                action="Manage Documents"
              />
            )}
          </CardContent>
        </Card>
      </ShgSectionLayout>
    );
  }

  if (section === 'schemes') {
    const schemes = [
      ['Marketplace readiness', 'Complete verification and publish catalogue items to become visible to institutional buyers.', '/shg/products'],
      ['Procurement opportunities', 'Browse active RFQs, tenders, and buyer requirements available to verified suppliers.', '/shg/opportunities'],
      ['SHG documentation support', 'Keep bank, member, authorization, and registration records ready for portal review.', '/shg/documents'],
    ];
    return (
      <ShgSectionLayout title="Schemes and Opportunities" description="Portal pathways that help verified SHGs participate in local procurement.">
        <div className="grid gap-4 lg:grid-cols-3">
          {schemes.map(([title, text, href]) => (
            <Card key={title} className="h-full">
              <CardContent className="flex h-full flex-col p-5">
                <BookOpen className="h-6 w-6 text-[#12335f]" />
                <h2 className="mt-4 text-base font-black text-slate-950">{title}</h2>
                <p className="mt-2 flex-1 text-sm font-medium leading-6 text-slate-600">{text}</p>
                <Link href={href} className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#12335f]">Open <ArrowRight className="h-4 w-4" /></Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </ShgSectionLayout>
    );
  }

  if (section === 'support') {
    return (
      <ShgSectionLayout title="SHG Support" description="Get help with onboarding, documents, catalogue listings, orders, and payments.">
        <div className="grid gap-4 md:grid-cols-3">
          <SupportCard icon={Phone} title="Call Helpdesk" text="1800-123-4567" href="tel:18001234567" />
          <SupportCard icon={Mail} title="Email Support" text="support@jsgsmile.in" href="mailto:support@jsgsmile.in" />
          <SupportCard icon={BookOpen} title="Portal Help" text="Procedures, policies, and documentation guidance" href="/help" />
        </div>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div><h2 className="text-sm font-black text-slate-950">Protect your account</h2><p className="mt-1 text-sm font-medium leading-6 text-slate-600">Portal support will never ask for your password, OTP, complete bank account number, or Aadhaar number by email, phone, or chat.</p></div>
            </div>
          </CardContent>
        </Card>
      </ShgSectionLayout>
    );
  }

  return (
    <ShgSectionLayout title={section === 'dashboard' ? 'SHG Dashboard' : readable(section)} description="Manage your SHG portal records and procurement activity.">
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Profile Status" value={readable(currentUser?.onboardingStatus || 'Pending')} icon={ShieldCheck} compact />
        <MetricTile label="Bank Accounts" value={bankAccounts.length} icon={Landmark} />
        <MetricTile label="Documents" value={documents.length} icon={FileText} />
        <MetricTile label="Members" value={registration?.memberCount || '—'} icon={Users} />
      </div>
      {section === 'dashboard' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <NativeQuickLink title="Onboarding Hub" text="Review SHG verification, bank, and document readiness." href="/shg/onboarding" />
          <NativeQuickLink title="Members" text="Review group strength and member-list records." href="/shg/members" />
          <NativeQuickLink title="Products" text="Manage catalogue items offered by the SHG." href="/shg/products" />
          <NativeQuickLink title="Orders" text="Track purchase orders and fulfilment activity." href="/shg/orders" />
        </div>
      )}
    </ShgSectionLayout>
  );
}

const primaryActionClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#12335f] px-4 text-xs font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-[#0b2447]';

function ShgSectionLayout({ title, description, action, children }: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div><h1 className="text-2xl font-black tracking-tight text-slate-950">{title}</h1><p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-slate-600">{description}</p></div>
          {action}
        </CardContent>
      </Card>
      {children}
    </div>
  );
}

function MetricTile({ label, value, icon: Icon, compact = false }: { label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; compact?: boolean }) {
  return (
    <Card><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p><p className={cn('mt-2 font-black text-slate-950', compact ? 'break-words text-sm' : 'text-2xl')}>{value}</p></div><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#12335f]"><Icon className="h-5 w-5" /></div></div></CardContent></Card>
  );
}

function StatusBadge({ value }: { value: string }) {
  const normalized = String(value || '').toUpperCase();
  const variant = normalized.includes('REJECT') ? 'error' : normalized.includes('VERIF') || normalized.includes('APPROV') ? 'success' : 'warning';
  return <Badge variant={variant}>{readable(value)}</Badge>;
}

function InlineNotice({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'error' }) {
  return <div className={cn('rounded-xl border px-4 py-3 text-sm font-semibold', tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-700')}>{children}</div>;
}

function EmptyWorkspaceState({ icon: Icon, title, text, href, action }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string; href: string; action: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#12335f] shadow-sm"><Icon className="h-6 w-6" /></div><h3 className="mt-4 text-base font-black text-slate-950">{title}</h3><p className="mt-1 max-w-lg text-sm font-medium leading-6 text-slate-600">{text}</p><Link href={href} className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#12335f]">{action}<ArrowRight className="h-4 w-4" /></Link></div>
  );
}

function SupportCard({ icon: Icon, title, text, href }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string; href: string }) {
  const externalAction = href.startsWith('tel:') || href.startsWith('mailto:');
  const content = <><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#12335f]"><Icon className="h-5 w-5" /></div><h2 className="mt-4 text-sm font-black text-slate-950">{title}</h2><p className="mt-1 break-words text-sm font-medium leading-6 text-slate-600">{text}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-black uppercase tracking-wide text-[#12335f]">Open <ArrowRight className="h-4 w-4" /></span></>;
  return <Card className="transition hover:-translate-y-0.5 hover:shadow-md"><CardContent className="p-5">{externalAction ? <a href={href} className="block">{content}</a> : <Link href={href} className="block">{content}</Link>}</CardContent></Card>;
}

const readable = (value: unknown) => String(value || '—').replaceAll('_', ' ').replaceAll('-', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
const formatDate = (value: unknown) => {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

function ShgDashboardSection({ section, profile, progress }: { section: string; profile: ShgProfile; progress: number }) {
  const status = profile.applicationStatus || 'IN_PROGRESS';

  if (section === 'profile') {
    return (
      <ShgSectionLayout title="SHG Profile" description="Registered group and authorized representative details used across the portal.">
        <Card><CardHeader><CardTitle>Group details</CardTitle></CardHeader><CardContent><ReadonlyGrid profile={profile} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Authorized representative</CardTitle></CardHeader><CardContent><LeaderPanel profile={profile} /></CardContent></Card>
      </ShgSectionLayout>
    );
  }

  if (section === 'members') {
    const members = profile.members || [];
    return (
      <ShgSectionLayout title="SHG Members" description="Members and office bearers registered against this SHG application." action={<Link href="/shg/onboarding" className={primaryActionClass}>Manage in Onboarding <ArrowRight className="h-4 w-4" /></Link>}>
        <Card><CardHeader><CardTitle>Member register</CardTitle></CardHeader><CardContent>{members.length ? <SimpleTable rows={members} columns={['name', 'mobile', 'officeRole', 'gender', 'age', 'kycStatus']} /> : <EmptyWorkspaceState icon={Users} title="No members added" text="Add the SHG members and office bearers from the onboarding workflow." href="/shg/onboarding" action="Open Onboarding" />}</CardContent></Card>
      </ShgSectionLayout>
    );
  }

  if (section === 'bank-details') {
    const accounts = profile.bankAccounts || [];
    return (
      <ShgSectionLayout title="Bank Details" description="Owner-scoped SHG bank accounts used for verification and settlements." action={<Link href="/shg/onboarding" className={primaryActionClass}>Manage Bank Accounts <ArrowRight className="h-4 w-4" /></Link>}>
        <Card><CardHeader><CardTitle>Registered accounts</CardTitle></CardHeader><CardContent>{accounts.length ? <SimpleTable rows={accounts} columns={['bankName', 'accountHolderName', 'accountNumberMasked', 'ifsc', 'branchName', 'isPrimary', 'verificationStatus']} /> : <EmptyWorkspaceState icon={Landmark} title="No bank account registered" text="Add a primary SHG bank account before final submission." href="/shg/onboarding" action="Add Bank Account" />}</CardContent></Card>
      </ShgSectionLayout>
    );
  }

  if (section === 'documents') {
    return (
      <ShgSectionLayout title="SHG Documents" description="Required and optional records uploaded for SHG verification." action={<Link href="/shg/onboarding" className={primaryActionClass}>Upload Documents <ArrowRight className="h-4 w-4" /></Link>}>
        <Card><CardHeader><CardTitle>Document checklist</CardTitle></CardHeader><CardContent><DocumentTable profile={profile} /></CardContent></Card>
      </ShgSectionLayout>
    );
  }

  if (section === 'meetings') {
    const meetings = profile.meetings || [];
    return (
      <ShgSectionLayout title="SHG Meetings" description="Meeting dates, agendas, decisions, and linked resolutions for the group.">
        <Card><CardHeader><CardTitle>Meeting register</CardTitle></CardHeader><CardContent>{meetings.length ? <SimpleTable rows={meetings} columns={['meetingDate', 'title', 'agenda', 'decisions']} /> : <EmptyWorkspaceState icon={CalendarDays} title="No meetings recorded" text="Meeting records will appear here when they are added to the SHG profile." href="/shg/onboarding" action="Open Onboarding" />}</CardContent></Card>
      </ShgSectionLayout>
    );
  }

  if (section === 'schemes') {
    return (
      <ShgSectionLayout title="Schemes and Opportunities" description="Use the portal to prepare your SHG for catalogue discovery and procurement participation.">
        <div className="grid gap-4 lg:grid-cols-3"><NativeQuickLink title="Complete onboarding" text="Finish group, bank, member, and document verification." href="/shg/onboarding" /><NativeQuickLink title="Publish products" text="Create catalogue items for institutional buyers." href="/shg/products" /><NativeQuickLink title="Find opportunities" text="Review procurement opportunities open to suppliers." href="/shg/opportunities" /></div>
      </ShgSectionLayout>
    );
  }

  if (section === 'support') {
    return (
      <ShgSectionLayout title="SHG Support" description="Get help with onboarding, documents, catalogue listings, orders, and payments.">
        <div className="grid gap-4 md:grid-cols-3"><SupportCard icon={Phone} title="Call Helpdesk" text="1800-123-4567" href="tel:18001234567" /><SupportCard icon={Mail} title="Email Support" text="support@jsgsmile.in" href="mailto:support@jsgsmile.in" /><SupportCard icon={BookOpen} title="Portal Help" text="Procedures, policies, and documentation guidance" href="/help" /></div>
      </ShgSectionLayout>
    );
  }

  return (
    <ShgSectionLayout title="SHG Dashboard" description={`Welcome back, ${profile.shgName}. Track onboarding readiness and open the next task directly from your dashboard.`} action={<StatusBadge value={status} />}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Onboarding Progress" value={`${progress}%`} icon={ClipboardList} />
        <MetricTile label="Members" value={profile.members?.length || profile.memberCount || 0} icon={Users} />
        <MetricTile label="Documents" value={profile.documents?.length || 0} icon={FileText} />
        <MetricTile label="Bank Accounts" value={profile.bankAccounts?.length || 0} icon={Landmark} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><NativeQuickLink title="Onboarding Hub" text="Complete or review SHG verification." href="/shg/onboarding" /><NativeQuickLink title="Members" text="Review group and office-bearer records." href="/shg/members" /><NativeQuickLink title="Products" text="Manage the SHG catalogue." href="/shg/products" /><NativeQuickLink title="Orders" text="Track purchase orders and delivery." href="/shg/orders" /></div>
    </ShgSectionLayout>
  );
}

function NativeQuickLink({ title, text, href }: { title: string; text: string; href: string }) {
  return <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md"><CardContent className="flex h-full flex-col p-5"><h2 className="text-sm font-black text-slate-950">{title}</h2><p className="mt-2 flex-1 text-sm font-medium leading-6 text-slate-600">{text}</p><Link href={href} className="mt-4 inline-flex items-center gap-1 text-xs font-black uppercase tracking-wide text-[#12335f]">Open <ArrowRight className="h-4 w-4" /></Link></CardContent></Card>;
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
