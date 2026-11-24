import * as XLSX from 'xlsx';

/**
 * Generates a realistic multi-sheet sample workbook (SEND-NOW, VERIFY-FIRST, HOLD, DROP)
 * matching a lead master audit schema without a Prompt column so automatic Prompt injection
 * and the Lead Analysis helper can be demonstrated immediately.
 */
export function buildSampleAuditFile(): File {
  const wb = XLSX.utils.book_new();

  const headers = [
    'lead_id',
    'display_name',
    'city',
    'state',
    'website',
    'secondary_channel',
    'verdict',
    'proof_strength',
    'brand_anchor',
    'proven_fact',
    'target_trigger',
    'channel',
    'contact_value',
    'contact_flag',
    'batch',
  ];

  const sendNowRows = [
    headers,
    [
      'LD-101',
      'Tarriko Bistro',
      'Seattle',
      'WA',
      'https://tarriko.example.com',
      'https://instagram.com/tarrikobistro',
      'SEND-NOW',
      'STRONG',
      'Wood-fired coastal plates & late-night vermouth bar',
      'Primary "Order Online" button in mobile nav resolves to HTTP 404 at /order-now.',
      'Fix broken mobile ordering route before weekend dinner rush',
      'Email',
      'hello@tarriko.example.com',
      'VERIFIED',
      'Batch 04',
    ],
    [
      'LD-102',
      'Nori Ramen Bar',
      'Portland',
      'OR',
      'https://noriramen.example.com',
      'https://doordash.com/store/nori-ramen-example',
      'SEND-NOW',
      'STRONG',
      '24-hour tonkotsu broth & handmade alkaline noodles',
      'Direct site menu lists Tonkotsu Ramen at $16 while DoorDash markup is $21.50 (+34%) with no direct pickup prompt.',
      'Capture direct pickup margin from third-party delivery traffic',
      'Email',
      'team@noriramen.example.com',
      'VERIFIED',
      'Batch 04',
    ],
    [
      'LD-103',
      'Casa Verde Taqueria',
      'Austin',
      'TX',
      'https://casaverde.example.com',
      'https://facebook.com/casaverdeatx',
      'SEND-NOW',
      'STRONG',
      'Heirloom nixtamal tortillas & corporate taco catering',
      'Catering inquiry form silently fails client-side validation on submit with zero confirmation message.',
      'Repair catering lead capture form to recover lost group bookings',
      'Email',
      'events@casaverde.example.com',
      'VERIFIED',
      'Batch 05',
    ],
  ];

  const verifyFirstRows = [
    headers,
    [
      'LD-204',
      'Saffron & Pine',
      'Denver',
      'CO',
      'https://saffronandpine.example.com',
      'https://resy.com/cities/den/saffron-pine',
      'VERIFY-FIRST',
      'MEDIUM',
      'Seasonal mountain tasting menu & chef counter',
      'Lunch menu opens in an unindexed embedded PDF viewer that blocks mobile pinch-zoom.',
      'Confirm whether lunch service is still active Thu–Sat before pitching menu UX',
      'Phone',
      '(303) 555-0148',
      'NEEDS CHECK',
      'Batch 04',
    ],
    [
      'LD-205',
      'Cedar Street Bakery',
      'Minneapolis',
      'MN',
      'https://cedarbakery.example.com',
      'https://instagram.com/cedarstreetbakery',
      'VERIFY-FIRST',
      'MEDIUM',
      'Small-batch sourdough & custom celebration cakes',
      'Custom cake inquiry phone line rang to full voicemail during Thursday 4pm test.',
      'Verify current custom cake lead time and online deposit flow',
      'Email',
      'orders@cedarbakery.example.com',
      'MISSING',
      'Batch 05',
    ],
  ];

  const holdRows = [
    headers,
    [
      'LD-309',
      'Harbor Oyster Co',
      'San Diego',
      'CA',
      'https://harboroyster.example.com',
      'https://ubereats.com/store/harbor-oyster',
      'HOLD',
      'PARTIAL',
      'Raw bar & harborfront patio',
      'Intentional 45-minute Friday rush pickup pause banner detected; SSL and menu prices match site.',
      'Re-check in 30 days after patio remodel wraps',
      'Email',
      'info@harboroyster.example.com',
      'VERIFIED',
      'Batch 03',
    ],
  ];

  const dropRows = [
    headers,
    [
      'LD-412',
      'Bistro Lumiere',
      'Chicago',
      'IL',
      'https://bistrolumiere.example.com',
      '',
      'DROP',
      'WEAK',
      'French bistro & Sunday wine supper',
      'Embedded Resy widget, mobile menu, and SSL all verified healthy on live check.',
      'No conversion gap identified — remove from active outreach sequence',
      'Email',
      'contact@bistrolumiere.example.com',
      'DNC',
      'Batch 03',
    ],
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sendNowRows), 'SEND-NOW');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(verifyFirstRows), 'VERIFY-FIRST');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(holdRows), 'HOLD');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dropRows), 'DROP');

  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new File([arrayBuffer], 'lead_master_sample.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
