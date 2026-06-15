import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileText, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input, Select } from '../components/ui/input';
import { Stepper } from '../components/ui/stepper';
import { cn } from '../lib/utils';
import { shgApi } from '../features/shg/api';
import { useAuth } from '../hooks/useAuth';

const shgTypeOptions = [
  ['WOMEN_SHG', 'Women SHG (Mahila Bachat Gat)'],
  ['FARMER_PRODUCER_GROUP', 'Farmer SHG / Producer Group'],
  ['ARTISAN_HANDICRAFT_SHG', 'Artisan / Handicraft SHG'],
  ['DAIRY_COOPERATIVE_SHG', 'Dairy Cooperative / SHG'],
  ['LIVELIHOOD_SHG', 'Livelihood SHG'],
  ['TRIBAL_SHG', 'Tribal SHG'],
  ['YOUTH_SHG', 'Youth SHG'],
  ['OTHER_SHG', 'Other Self-Help Group'],
] as const;

const states: Record<string, string[]> = {
  Odisha: ['Jharsuguda', 'Sambalpur', 'Bargarh', 'Sundargarh'],
  Maharashtra: ['Nagpur', 'Pune', 'Mumbai Suburban', 'Nashik'],
};

const mandatoryChecklist = {
  personal: [
    'Active Email ID for OTP verification of SHG representative',
    'Active Mobile Number of authorized representative',
  ],
  business: [
    'SHG Formation Resolution / Meeting Resolution',
    'Group Leader Aadhaar / KYC',
    'Bank Passbook / Cancelled Cheque',
    'Member List with signatures',
    'Address Proof',
    'Authorization Letter for the representative',
  ],
};

const optionalChecklist = [
  'PAN Card',
  'Udyam Registration Certificate',
  'GST Certificate',
  'NRLM / SRLM / Mission Shakti Certificate or ID',
  'Training / Skill Certificates',
  'Product Photos / Catalogue',
  'Women Empowerment / Capacity Building Certificate',
  'Activity-specific certificate such as FSSAI / trade / cooperative certificate',
];

const roleOptions = [
  ['PRESIDENT', 'President'],
  ['SECRETARY', 'Secretary'],
  ['TREASURER', 'Treasurer'],
  ['LEADER', 'Leader'],
  ['COORDINATOR', 'Coordinator'],
  ['AUTHORIZED_REPRESENTATIVE', 'Authorized Representative'],
  ['OTHER', 'Other'],
] as const;

const defaultOrg = {
  shgType: 'WOMEN_SHG',
  state: 'Odisha',
  district: 'Jharsuguda',
  block: '',
  gramPanchayat: '',
  village: '',
  pincode: '',
  shgName: '',
  formationYear: String(new Date().getFullYear()),
  formationDate: '',
  memberCount: '',
  registrationStatus: 'UNREGISTERED',
  registrationNumber: '',
  nrlmId: '',
  promotedBy: 'NRLM',
  mainActivity: '',
  provideAdditionalDetails: false,
  gstin: '',
  udyamNumber: '',
  website: '',
};

export default function ShgRegistrationFlow() {
  const { login } = useAuth();
  const [stage, setStage] = useState(1);
  const [showDoc, setShowDoc] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsMeta, setTermsMeta] = useState<any>(null);
  const [innerStep, setInnerStep] = useState(1);
  const [org, setOrg] = useState(defaultOrg);
  const [verificationType, setVerificationType] = useState<'AADHAAR' | 'PAN'>('AADHAAR');
  const [identity, setIdentity] = useState({ aadhaarOrVid: '', pan: '', mobile: '', consent: false, nameAsPerPan: '', dob: '' });
  const [verifiedIdentity, setVerifiedIdentity] = useState<any>(null);
  const [rep, setRep] = useState({ firstName: '', lastName: '', role: 'AUTHORIZED_REPRESENTATIVE', email: '', mobile: '' });
  const [otp, setOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [credentials, setCredentials] = useState({ userId: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const allMandatoryChecked = useMemo(
    () => [...mandatoryChecklist.personal, ...mandatoryChecklist.business].every(item => checked[item]),
    [checked]
  );

  const passwordChecks = [
    ['12+ characters', credentials.password.length >= 12],
    ['Letter', /[A-Z]/.test(credentials.password)],
    ['Lowercase letter', /[a-z]/.test(credentials.password)],
    ['Numeric value', /\d/.test(credentials.password)],
    ['Special character', /[^A-Za-z0-9]/.test(credentials.password)],
    ['Passwords match', credentials.password.length > 0 && credentials.password === credentials.confirmPassword],
  ];

  const setOrgField = (field: string, value: any) => {
    setOrg(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'state') next.district = states[value]?.[0] || '';
      return next;
    });
  };

  const sendOtp = async () => {
    setLoading(true);
    setMessage('');
    try {
      await shgApi.publicPost('/api/shg/registration/send-email-otp', { email: rep.email });
      setMessage('OTP sent to the representative email.');
    } catch (error: any) {
      setMessage(error.message || 'Unable to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async () => {
    setLoading(true);
    setMessage('');
    try {
      await shgApi.publicPost('/api/shg/registration/verify-email-otp', { email: rep.email, otp });
      setEmailVerified(true);
      setMessage('Email verified successfully.');
    } catch (error: any) {
      setMessage(error.message || 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  const verifyIdentity = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = verificationType === 'AADHAAR'
        ? await shgApi.publicPost<any>('/api/shg/registration/verify-aadhaar', {
          aadhaarOrVid: identity.aadhaarOrVid,
          mobile: identity.mobile,
          consent: identity.consent,
        })
        : await shgApi.publicPost<any>('/api/shg/registration/verify-pan', {
          pan: identity.pan,
          nameAsPerPan: identity.nameAsPerPan,
          dob: identity.dob,
          consent: identity.consent,
        });
      setVerifiedIdentity(result);
      setRep(prev => ({ ...prev, mobile: identity.mobile || prev.mobile }));
      setMessage(`${verificationType === 'AADHAAR' ? 'Aadhaar' : 'PAN'} details verified successfully.`);
    } catch (error: any) {
      setMessage(error.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const acceptTerms = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await shgApi.publicPost('/api/shg/registration/terms', { accepted: true, version: 'SHG-GTC-2026-01' });
      setTermsMeta(result);
      setStage(3);
    } catch (error: any) {
      setMessage(error.message || 'Unable to record terms acceptance.');
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await shgApi.publicPost<any>('/api/shg/registration/create-account', {
        organization: {
          ...org,
          formationYear: Number(org.formationYear),
          memberCount: Number(org.memberCount),
          provideAdditionalDetails: Boolean(org.provideAdditionalDetails),
        },
        representative: {
          ...rep,
          email: rep.email,
          role: rep.role,
          maskedIdentifier: verifiedIdentity?.maskedAadhaar || verifiedIdentity?.maskedPan,
          identifierLast4: verifiedIdentity?.aadhaarLast4 || verifiedIdentity?.identifierLast4,
          verificationType,
          verificationReferenceId: verifiedIdentity?.verificationReferenceId,
        },
        credentials,
        terms: {
          accepted: termsAccepted,
          version: termsMeta?.termsVersion || 'SHG-GTC-2026-01',
          acceptedAt: termsMeta?.termsAcceptedAt || new Date().toISOString(),
        },
      });
      login(result.token || result.accessToken, result.user, result.refreshToken);
      window.location.href = result.redirectUrl || '/shg/onboarding';
    } catch (error: any) {
      setMessage(error.message || 'Unable to create SHG account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-slate-50 px-3 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link href="/" className="text-sm font-semibold text-brand-navy">JsgSmile</Link>
          <Link href="/login" className="text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-brand-navy">Login</Link>
        </div>
        <Stepper
          steps={[
            { id: 1, label: 'Pre-requisites' },
            { id: 2, label: 'Terms & Conditions' },
            { id: 3, label: 'Registration' },
          ]}
          currentStep={stage}
        />

        {message && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        {stage === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>SHG Pre-requisites</CardTitle>
              <p className="text-sm text-slate-500">Keep these records ready before starting herSHG registration.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <Select label="Business / Organisation Type *" value={org.shgType} onChange={e => setOrgField('shgType', e.target.value)}>
                {shgTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <Checklist title="Personal Details" items={mandatoryChecklist.personal} checked={checked} setChecked={setChecked} />
              <Checklist title="Business / SHG Details" items={mandatoryChecklist.business} checked={checked} setChecked={setChecked} />
              <Checklist title="Optional" items={optionalChecklist} checked={checked} setChecked={setChecked} optional />
              <div className="flex flex-col justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
                <Button variant="outline" onClick={() => setShowDoc(true)}><FileText className="mr-2 h-4 w-4" /> View Pre-requisites Document</Button>
                <Button disabled={!allMandatoryChecked} onClick={() => setStage(2)}>Proceed</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {stage === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>GENERAL TERMS & CONDITIONS (GTC)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="h-[55vh] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                <object data="/SHG_Registration_GTC.pdf" type="application/pdf" className="h-full w-full">
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                    <FileText className="h-10 w-10 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-700">Terms PDF is not available in this build.</p>
                    <a href="/SHG_Registration_GTC.pdf" target="_blank" rel="noreferrer" className="text-sm font-bold text-brand-navy underline">Open Terms PDF</a>
                  </div>
                </object>
              </div>
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-1 h-4 w-4" />
                <span>I have read and agree to the Terms & Conditions of JsgSmile.</span>
              </label>
              <div className="flex justify-between gap-3">
                <Button variant="outline" onClick={() => setStage(1)}>Back</Button>
                <Button disabled={!termsAccepted || loading} onClick={acceptTerms}>Proceed to Registration</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {stage === 3 && (
          <Card>
            <CardContent className="grid gap-5 p-4 md:grid-cols-[230px_minmax(0,1fr)]">
              <div className="space-y-2">
                {['Organisation Details', 'Personal Verification', 'Email Verification', 'User Credentials'].map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setInnerStep(index + 1)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm font-semibold',
                      innerStep === index + 1 ? 'border-brand-navy bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-xs">{index + 1}</span>
                    {label}
                  </button>
                ))}
              </div>
              <div className="min-w-0 space-y-5">
                {innerStep === 1 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Select label="SHG Type *" value={org.shgType} onChange={e => setOrgField('shgType', e.target.value)}>
                      {shgTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                    <Input label="SHG Name *" value={org.shgName} onChange={e => setOrgField('shgName', e.target.value)} />
                    <Select label="State *" value={org.state} onChange={e => setOrgField('state', e.target.value)}>
                      {Object.keys(states).map(state => <option key={state} value={state}>{state}</option>)}
                    </Select>
                    <Select label="District *" value={org.district} onChange={e => setOrgField('district', e.target.value)}>
                      {(states[org.state] || []).map(district => <option key={district} value={district}>{district}</option>)}
                    </Select>
                    <Input label="Block / ULB" value={org.block} onChange={e => setOrgField('block', e.target.value)} />
                    <Input label="Gram Panchayat / Ward" value={org.gramPanchayat} onChange={e => setOrgField('gramPanchayat', e.target.value)} />
                    <Input label="Village *" value={org.village} onChange={e => setOrgField('village', e.target.value)} />
                    <Input label="PIN Code" value={org.pincode} onChange={e => setOrgField('pincode', e.target.value)} />
                    <Input label="Formation Year *" value={org.formationYear} onChange={e => setOrgField('formationYear', e.target.value)} />
                    <Input label="Formation Date" type="date" value={org.formationDate} onChange={e => setOrgField('formationDate', e.target.value)} />
                    <Input label="Number of Members *" value={org.memberCount} onChange={e => setOrgField('memberCount', e.target.value)} />
                    <Select label="Registration Status *" value={org.registrationStatus} onChange={e => setOrgField('registrationStatus', e.target.value)}>
                      <option value="UNREGISTERED">Unregistered</option>
                      <option value="REGISTERED">Registered</option>
                    </Select>
                    {org.registrationStatus === 'REGISTERED' && <Input label="SHG Registration Number *" value={org.registrationNumber} onChange={e => setOrgField('registrationNumber', e.target.value)} />}
                    <Input label="NRLM / SRLM / Mission Shakti / LokOS ID" value={org.nrlmId} onChange={e => setOrgField('nrlmId', e.target.value)} />
                    <Select label="Promoted By" value={org.promotedBy} onChange={e => setOrgField('promotedBy', e.target.value)}>
                      {['NRLM', 'SRLM', 'Mission Shakti', 'NGO', 'Bank', 'Government Department', 'Self-formed', 'Other'].map(item => <option key={item}>{item}</option>)}
                    </Select>
                    <Input label="Main Activity *" value={org.mainActivity} onChange={e => setOrgField('mainActivity', e.target.value)} />
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 md:col-span-2">
                      <input type="checkbox" checked={org.provideAdditionalDetails} onChange={e => setOrgField('provideAdditionalDetails', e.target.checked)} />
                      Provide Additional Details
                    </label>
                    {org.provideAdditionalDetails && (
                      <>
                        <Input label="GSTIN" value={org.gstin} onChange={e => setOrgField('gstin', e.target.value.toUpperCase())} />
                        <Input label="Udyam Number" value={org.udyamNumber} onChange={e => setOrgField('udyamNumber', e.target.value.toUpperCase())} />
                        <Input label="Website" value={org.website} onChange={e => setOrgField('website', e.target.value)} />
                      </>
                    )}
                  </div>
                )}

                {innerStep === 2 && (
                  <div className="space-y-4">
                    <Select label="Verification Type" value={verificationType} onChange={e => setVerificationType(e.target.value as 'AADHAAR' | 'PAN')}>
                      <option value="AADHAAR">Aadhaar / Virtual ID</option>
                      <option value="PAN">Personal PAN</option>
                    </Select>
                    <div className="grid gap-4 md:grid-cols-2">
                      {verificationType === 'AADHAAR' ? (
                        <>
                          <Input label="Aadhaar Number / Virtual ID *" value={identity.aadhaarOrVid} onChange={e => setIdentity(prev => ({ ...prev, aadhaarOrVid: e.target.value }))} />
                          <Input label="Aadhaar Linked Mobile *" value={identity.mobile} onChange={e => setIdentity(prev => ({ ...prev, mobile: e.target.value }))} />
                        </>
                      ) : (
                        <>
                          <Input label="PAN Number *" value={identity.pan} onChange={e => setIdentity(prev => ({ ...prev, pan: e.target.value.toUpperCase() }))} />
                          <Input label="Name as per PAN" value={identity.nameAsPerPan} onChange={e => setIdentity(prev => ({ ...prev, nameAsPerPan: e.target.value }))} />
                          <Input label="Date of Birth" type="date" value={identity.dob} onChange={e => setIdentity(prev => ({ ...prev, dob: e.target.value }))} />
                        </>
                      )}
                    </div>
                    <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      <input type="checkbox" checked={identity.consent} onChange={e => setIdentity(prev => ({ ...prev, consent: e.target.checked }))} className="mt-1" />
                      <span>I consent to JsgSmile using this identity information only for SHG registration verification. Full Aadhaar/VID will not be stored and will be masked after entry.</span>
                    </label>
                    <Button onClick={verifyIdentity} disabled={loading || !identity.consent}>Verify {verificationType === 'AADHAAR' ? 'Aadhaar' : 'PAN'}</Button>
                    {verifiedIdentity && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                        <ShieldCheck className="mr-2 inline h-4 w-4" /> Aadhaar Details Verified Successfully.
                      </div>
                    )}
                    <div className="grid gap-4 md:grid-cols-2">
                      <Input label="First Name *" value={rep.firstName} onChange={e => setRep(prev => ({ ...prev, firstName: e.target.value }))} />
                      <Input label="Last Name" value={rep.lastName} onChange={e => setRep(prev => ({ ...prev, lastName: e.target.value }))} />
                      <Input label="Mobile Number *" value={rep.mobile} onChange={e => setRep(prev => ({ ...prev, mobile: e.target.value }))} />
                      <Select label="Role in Organisation *" value={rep.role} onChange={e => setRep(prev => ({ ...prev, role: e.target.value }))}>
                        {roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </Select>
                    </div>
                  </div>
                )}

                {innerStep === 3 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input label="Email Address *" value={rep.email} onChange={e => setRep(prev => ({ ...prev, email: e.target.value }))} />
                    <div className="flex items-end"><Button onClick={sendOtp} disabled={loading || !rep.email}>Send OTP</Button></div>
                    <Input label="OTP" value={otp} onChange={e => setOtp(e.target.value)} />
                    <div className="flex items-end"><Button onClick={verifyEmail} disabled={loading || !otp}>Verify OTP</Button></div>
                    {emailVerified && <div className="md:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">Email verified successfully.</div>}
                  </div>
                )}

                {innerStep === 4 && (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Input label="User ID *" value={credentials.userId} onChange={e => setCredentials(prev => ({ ...prev, userId: e.target.value }))} />
                      <Input label="Password *" type="password" value={credentials.password} onChange={e => setCredentials(prev => ({ ...prev, password: e.target.value }))} />
                      <Input label="Confirm Password *" type="password" value={credentials.confirmPassword} onChange={e => setCredentials(prev => ({ ...prev, confirmPassword: e.target.value }))} />
                    </div>
                    <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                      {passwordChecks.map(([label, ok]) => (
                        <div key={String(label)} className={cn('text-xs font-semibold', ok ? 'text-emerald-700' : 'text-slate-500')}>
                          <CheckCircle2 className="mr-2 inline h-3.5 w-3.5" /> {label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between border-t border-slate-100 pt-4">
                  <Button variant="outline" onClick={() => innerStep === 1 ? setStage(2) : setInnerStep(prev => prev - 1)}>Back</Button>
                  {innerStep < 4 ? (
                    <Button onClick={() => setInnerStep(prev => prev + 1)}>Next</Button>
                  ) : (
                    <Button onClick={createAccount} disabled={loading || !emailVerified || !verifiedIdentity || passwordChecks.some(([, ok]) => !ok)}>Create SHG Account</Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {showDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <Card className="max-h-[85vh] w-full max-w-3xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>SHG Pre-requisites Document</CardTitle>
              <Button variant="ghost" onClick={() => setShowDoc(false)}>Close</Button>
            </CardHeader>
            <CardContent className="space-y-3 overflow-y-auto">
              {[...mandatoryChecklist.personal, ...mandatoryChecklist.business, ...optionalChecklist].map((item, index) => (
                <div key={item} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                  <span className="font-bold text-brand-navy">{index + 1}</span>
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Checklist({
  title,
  items,
  checked,
  setChecked,
  optional,
}: {
  title: string;
  items: string[];
  checked: Record<string, boolean>;
  setChecked: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  optional?: boolean;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">{title}</h3>
      <div className="grid gap-2">
        {items.map(item => (
          <button
            key={item}
            type="button"
            onClick={() => setChecked(prev => ({ ...prev, [item]: !prev[item] }))}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3 text-left text-sm font-medium transition-colors',
              checked[item] ? 'border-brand-navy bg-slate-50 text-slate-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            )}
          >
            <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', checked[item] ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-300')}>
              {checked[item] && <CheckCircle2 className="h-3.5 w-3.5" />}
            </span>
            <span>{item}{optional ? <span className="ml-2 text-xs text-slate-400">Optional</span> : null}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
