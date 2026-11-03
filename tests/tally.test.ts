import { describe, expect, it } from 'vitest';
import { buildTallyXml, csvCell, xmlEscape } from '@/lib/tally';

describe('tally export', () => {
  it('escapes XML special characters', () => {
    expect(xmlEscape(`A&B <"x"> 'y'`)).toBe('A&amp;B &lt;&quot;x&quot;&gt; &apos;y&apos;');
  });
  it('builds a balanced sales voucher', () => {
    const xml = buildTallyXml({ company: 'Co', number: 'INV-2026-0001', date: '2026-11-03', partyLedger: 'Company B & Sons', total: 64500, narration: 'LR: A, B' });
    expect(xml).toContain('<DATE>20261103</DATE>');
    expect(xml).toContain('<PARTYLEDGERNAME>Company B &amp; Sons</PARTYLEDGERNAME>');
    expect(xml).toContain('<AMOUNT>-64500.00</AMOUNT>');
    expect(xml).toContain('<AMOUNT>64500.00</AMOUNT>');
    expect(xml.match(/<ALLLEDGERENTRIES\.LIST>/g)).toHaveLength(2);
  });
  it('neutralises CSV formula injection', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+91')).toBe("'+91");
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
  });
});
