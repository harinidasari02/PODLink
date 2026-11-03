/**
 * Tally Prime XML (Import Data -> Vouchers). One Sales voucher per invoice.
 * ASSUMPTIONS (see TDD): ledger names "Freight Income" and the client's ledger exist in Tally; GST lines are
 * added by Tally's own voucher configuration, so this export carries the freight value only.
 * Tally cannot embed images in an import file, so POD images travel in the same ZIP, named by LR number.
 */
export interface TallyInvoice {
  company: string; number: string; date: string; // yyyy-mm-dd
  partyLedger: string; total: number; narration: string;
}

export function xmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
}

const money = (n: number) => n.toFixed(2);

export function buildTallyXml(inv: TallyInvoice): string {
  const date = inv.date.replace(/-/g, '');
  const party = xmlEscape(inv.partyLedger);
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Vouchers</REPORTNAME>
    <STATICVARIABLES><SVCURRENTCOMPANY>${xmlEscape(inv.company)}</SVCURRENTCOMPANY></STATICVARIABLES>
   </REQUESTDESC>
   <REQUESTDATA>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <VOUCHER VCHTYPE="Sales" ACTION="Create">
      <DATE>${date}</DATE>
      <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${xmlEscape(inv.number)}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${party}</PARTYLEDGERNAME>
      <NARRATION>${xmlEscape(inv.narration)}</NARRATION>
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>${party}</LEDGERNAME>
       <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
       <AMOUNT>-${money(inv.total)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>Freight Income</LEDGERNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <AMOUNT>${money(inv.total)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
     </VOUCHER>
    </TALLYMESSAGE>
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>
`;
}

/** Neutralise spreadsheet formula injection in CSV cells. */
export function csvCell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
