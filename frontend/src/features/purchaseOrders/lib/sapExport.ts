import { toast } from 'sonner';

/**
 * Triggers direct browser download of SAP MIRO / MIGO batch upload CSV
 */
export async function downloadSapMiroExport(invoiceId: number, fallbackFilename = 'SAP_MIRO_Batch.csv'): Promise<void> {
  try {
    toast.info('Generating SAP MIRO / MIGO batch CSV file...');
    const response = await fetch(`/api/invoices/${invoiceId}/export-sap`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMsg = `HTTP ${response.status}`;
      try {
        const json = JSON.parse(text);
        if (json.message) errorMsg = json.message;
      } catch {
        // use status
      }
      throw new Error(errorMsg);
    }

    const disposition = response.headers.get('Content-Disposition');
    let filename = fallbackFilename;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast.success(`SAP Batch File (${filename}) downloaded successfully!`);
  } catch (err: any) {
    toast.error(err.message || 'Unable to download SAP export');
  }
}
