import * as XLSX from 'xlsx';

/**
 * Creates a realistic synthetic multi-sheet sample workbook mirroring A1-A3,
 * B Phone Check, C Marketplace (Apps to search + Explanation), and D Rewrite.
 */
export function buildSampleAuditFile(): File {
  const wb = XLSX.utils.book_new();

  const summaryRows = [
    ['Claim audit tracker', '', '', '', '', '', '', ''],
    ['Sample workbook mirroring A1 HIGH, A2 PARTIAL, A3 LOW, B Phone Check, C Marketplace, and Table D.', '', '', '', '', '', '', ''],
    ['Sheet', 'Leads', 'Result filled', 'Remaining', 'CONFIRMED', 'REFUTED', 'CANNOT VERIFY', 'CONFIGURATION'],
    ['A1 HIGH', 4, 4, 0, 2, 1, 1, '—'],
    ['A2 PARTIAL', 3, 3, 0, 1, 1, 1, '—'],
    ['A3 LOW', 2, 2, 0, 1, 0, 1, '—'],
    ['B Phone Check', 3, 2, 1, 1, 0, 0, 1],
    ['C Marketplace', 3, 3, 0, '—', '—', '—', '—'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');

  const a1Rows = [
    ['#', 'Lead', 'URL / Social', 'Claim (verbatim)', 'AI Result', 'Result', 'Corrected Prompt'],
    [
      '12',
      '𝐓𝐀𝐑𝐑𝐈𝐊𝐎',
      'https://tarriko.example.com',
      'Direct ordering link on homepage routes to broken third-party cart',
      'VERDICT: CONFIRMED — Checked live site on mobile: Order Online button returns HTTP 404 at /order-now.',
      'CONFIRMED',
      'Old prompt text that should NOT be copied into Corrected Prompt',
    ],
    [
      '18',
      'Bistro Lumiere',
      'https://bistrolumiere.example.com',
      'No online reservation widget found on homepage',
      'VERDICT: REFUTED — Embedded Resy booking widget loads cleanly below hero fold.',
      'REFUTED',
      '',
    ],
    [
      '27',
      'Saffron & Pine',
      'https://saffronandpine.example.com',
      'Lunch menu missing pricing on site',
      'VERDICT: CANNOT VERIFY — Menu opens in dynamic PDF viewer that could not be parsed statically.',
      'CANNOT VERIFY',
      '',
    ],
    [
      '34',
      'Atelier Crenn Sample',
      'https://atelier-sample.example.com',
      'Outdated seasonal tasting menu PDF from last quarter',
      'VERDICT: CONFIRMED — Main navigation Tasting Menu link still resolves to Winter 2025 PDF despite Spring menu launch.',
      'CONFIRMED',
      '',
    ],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a1Rows), 'A1 HIGH');

  const a2Rows = [
    ['#', 'Lead', 'URL / Social', 'Claim (verbatim)', 'AI Result', 'Result'],
    [
      '41',
      'Nori Ramen Bar',
      'https://noriramen.example.com',
      'Online ordering disabled after 8pm despite 10pm kitchen hours',
      'VERDICT: CONFIRMED — Toast checkout cutoff is set to 20:00 while homepage hours state 22:00.',
      'CONFIRMED',
    ],
    [
      '44',
      'Bistro Lumiere',
      'https://bistrolumiere.example.com',
      'Mobile menu text unreadable on iOS',
      'VERDICT: CANNOT VERIFY — Requires live iOS Safari viewport check.',
      'CANNOT VERIFY',
    ],
    [
      '52',
      'Harbor Oyster Co',
      'https://harboroyster.example.com',
      'SSL certificate warning on checkout subdomain',
      'VERDICT: REFUTED — Valid TLS certificate verified on order.harboroyster.example.com.',
      'REFUTED',
    ],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a2Rows), 'A2 PARTIAL');

  const a3Rows = [
    ['#', 'Lead', 'URL / Social', 'Claim (verbatim)', 'AI Result', 'Result'],
    [
      '61',
      'Casa Verde Taqueria',
      'https://casaverde.example.com',
      'Catering inquiry form fails validation silently',
      'VERDICT: CONFIRMED — Submit button throws uncaught JS validation error with no confirmation message.',
      'CONFIRMED',
    ],
    [
      '65',
      'Olive & Oak',
      'https://oliveandoak.example.com',
      'Private dining capacity unclear',
      'VERDICT: CANNOT VERIFY — Private dining page omits guest capacity; requires phone confirmation.',
      'CANNOT VERIFY',
    ],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a3Rows), 'A3 LOW');

  const bRows = [
    ['#', 'Lead', 'URL / Social', 'Claim (verbatim)', 'Result', 'Explanation (optional)'],
    [
      '1',
      'Copper Kettle Diner',
      'https://copperkettle.example.com',
      'Phone line rings to full voicemail during peak dinner service',
      'CONFIRMED',
      'Called 6:45pm Thu — automated mailbox full message, no callback option.',
    ],
    [
      '2',
      'Harbor Oyster Co',
      'https://harboroyster.example.com',
      'Online pickup paused during Friday rush',
      'CONFIGURATION',
      'Intentional 45-min kitchen pause banner displayed cleanly on ordering page.',
    ],
    [
      '3',
      'Cedar Street Bakery',
      'https://cedarbakery.example.com',
      'Custom cake order phone line goes unanswered',
      '',
      'Remaining unverified row — awaiting evening phone test.',
    ],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bRows), 'B Phone Check');

  const cRows = [
    ['#', 'Lead', 'URL / Social', 'Apps to search (name+city)', 'Result', 'Explanation (optional)'],
    [
      '1',
      'Nori Ramen Bar',
      'https://noriramen.example.com',
      'Nori Ramen Bar Seattle (DoorDash / UberEats)',
      'LISTED - INFLATED',
      'Tonkotsu Ramen is $16 on direct website vs $21.50 on DoorDash (+34% markup).',
    ],
    [
      '2',
      'Harbor Oyster Co',
      'https://harboroyster.example.com',
      'Harbor Oyster Co Portland (UberEats)',
      'LISTED - FAIR PRICES',
      'Oyster Platter is $28 on direct website vs $28 on UberEats across all sampled items.',
    ],
    [
      '3',
      'Olive & Oak',
      'https://oliveandoak.example.com',
      'Olive & Oak Austin (DoorDash / UberEats / Grubhub)',
      'NOT LISTED',
      'No third-party delivery marketplace listings found.',
    ],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cRows), 'C Marketplace');

  const dRows = [
    ['#', 'Lead', 'URL / Social', 'Reason', 'Corrected one-sentence pitch angle'],
    [
      '1',
      'Tarriko',
      'https://tarriko.example.com',
      'Broken mobile checkout link observed directly',
      'Quick heads-up: your homepage Order Online button currently hits a 404 on mobile — happy to share the exact link fix we spotted.',
    ],
    [
      '2',
      'Atelier Crenn Sample',
      'https://atelier-sample.example.com',
      'Fine dining — NEVER pitch commission',
      'Your Spring tasting menu is live on social, but the main site header still links guests to the Winter tasting PDF.',
    ],
    [
      '3',
      'Velvet Fork Kitchen',
      'https://velvetfork.example.com',
      'Direct UX rewrite — no verification check required',
      'Replacing your 4MB homepage PDF menu with a clean mobile menu section would let dinner guests browse specials in one tap.',
    ],
    [
      '4',
      'Marrow & Thyme',
      'https://marrowthyme.example.com',
      'Reservation flow improvement — no verification needed',
      'Adding a direct Reserve Table link in your sticky mobile header would eliminate two extra taps for weekend diners.',
    ],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dRows), 'Table D');

  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new File([arrayBuffer], 'sample_claim_audit_tracker.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
