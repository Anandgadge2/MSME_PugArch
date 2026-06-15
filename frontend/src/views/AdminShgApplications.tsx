import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '../components/ui/button';
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/card';
import { Input, Select } from '../components/ui/input';
import { shgApi, type ShgProfile } from '../features/shg/api';

export default function AdminShgApplications() {
  const pathname = usePathname() || '';
  const idMatch = pathname.match(/\/admin\/shg-applications\/(\d+)/);
  const [rows, setRows] = useState<ShgProfile[]>([]);
  const [detail, setDetail] = useState<ShgProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({ status: '', district: '', shgType: '', registrationStatus: '', search: '' });
  const [remarks, setRemarks] = useState('');

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      if (idMatch) {
        setDetail(await shgApi.get<ShgProfile>(`/api/admin/shg-applications/${idMatch[1]}`));
      } else {
        const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
        setRows(await shgApi.get<ShgProfile[]>(`/api/admin/shg-applications?${query.toString()}`));
      }
    } catch (error: any) {
      setMessage(error.message || 'Unable to load SHG applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [pathname]);

  const act = async (action: 'approve' | 'reject' | 'request-correction') => {
    if (!detail) return;
    try {
      const body = action === 'reject' ? { reason: remarks } : { remarks, sections: ['documents'] };
      const updated = await shgApi.post<ShgProfile>(`/api/admin/shg-applications/${detail.id}/${action}`, body);
      setDetail(updated);
      setMessage(`Application ${action.replace('-', ' ')} saved.`);
    } catch (error: any) {
      setMessage(error.message || 'Action failed.');
    }
  };

  if (loading) return <div className="h-72 rounded-lg bg-slate-200/70 animate-pulse" />;

  if (idMatch && detail) {
    return (
      <div className="space-y-5">
        {message && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">{message}</div>}
        <Card>
          <CardHeader>
            <CardTitle>{detail.shgName}</CardTitle>
            <p className="text-sm text-slate-500">{detail.applicationNumber || 'Draft application'} | {detail.district}, {detail.state}</p>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <Info label="Status" value={<Badge variant={detail.applicationStatus === 'APPROVED' ? 'success' : detail.applicationStatus === 'REJECTED' ? 'error' : 'warning'}>{detail.applicationStatus}</Badge>} />
            <Info label="SHG Type" value={detail.shgType} />
            <Info label="Registration" value={detail.registrationStatus} />
            <Info label="Submitted By" value={detail.representativeEmail || '-'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Review Notes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="min-h-24 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-brand-navy"
              placeholder="Admin remarks or correction reason"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => act('approve')}>Approve</Button>
              <Button variant="outline" onClick={() => act('request-correction')}>Request Correction</Button>
              <Button variant="danger" onClick={() => act('reject')}>Reject</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Status</TableHead><TableHead>Required</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader>
              <TableBody>
                {(detail.documents || []).map((doc: any) => (
                  <TableRow key={doc.id}>
                    <TableCell>{doc.documentType}</TableCell>
                    <TableCell><Badge variant={doc.status === 'VERIFIED' ? 'success' : doc.status === 'NEEDS_CORRECTION' ? 'error' : 'warning'}>{doc.status}</Badge></TableCell>
                    <TableCell>{doc.required ? 'Required' : 'Optional'}</TableCell>
                    <TableCell>{doc.remarks || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Audit Timeline</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(detail.auditLogs || []).map((log: any) => (
              <div key={log.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-slate-800">{log.action}</p>
                <p className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {message && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">{message}</div>}
      <Card>
        <CardHeader><CardTitle>SHG Applications</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <Input label="Search" value={filters.search} onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))} />
          <Select label="Status" value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}>
            <option value="">All</option><option>DRAFT</option><option>IN_PROGRESS</option><option>PENDING_REVIEW</option><option>CORRECTION_REQUIRED</option><option>APPROVED</option><option>REJECTED</option>
          </Select>
          <Input label="District" value={filters.district} onChange={e => setFilters(prev => ({ ...prev, district: e.target.value }))} />
          <Select label="Registered" value={filters.registrationStatus} onChange={e => setFilters(prev => ({ ...prev, registrationStatus: e.target.value }))}>
            <option value="">All</option><option>REGISTERED</option><option>UNREGISTERED</option>
          </Select>
          <div className="flex items-end"><Button onClick={load}>Apply</Button></div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Application No.</TableHead><TableHead>SHG Name</TableHead><TableHead>District</TableHead><TableHead>Type</TableHead><TableHead>Registration</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id}>
                  <TableCell>{row.applicationNumber || '-'}</TableCell>
                  <TableCell>{row.shgName}</TableCell>
                  <TableCell>{row.district}</TableCell>
                  <TableCell>{row.shgType}</TableCell>
                  <TableCell>{row.registrationStatus}</TableCell>
                  <TableCell><Badge variant={row.applicationStatus === 'APPROVED' ? 'success' : row.applicationStatus === 'REJECTED' ? 'error' : 'warning'}>{row.applicationStatus}</Badge></TableCell>
                  <TableCell><Button size="sm" variant="outline" onClick={() => { window.location.href = `/admin/shg-applications/${row.id}`; }}>Review</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><div className="mt-1 text-sm font-semibold text-slate-800">{value}</div></div>;
}
