/**
 * Single source of truth for one proposal.
 *
 * The shape below is the contract the store and every UI module read from.
 * Swap this object for an API response and nothing else has to change.
 *
 * Section kinds
 *   'toggles'    -> independent optional line items (FeatureToggleCard)
 *   'quantities' -> unit-priced items with a stepper/slider (QuantitySelector)
 *   'tier'       -> mutually exclusive options, exactly one selected (TierSelector)
 */

export const proposalTemplate = {
  meta: {
    proposalId: 'PRP-2026-0148',
    version: '1.2',
    issuedOn: '2026-08-17',
    validUntil: '2026-09-16',
    currency: 'USD',
    locale: 'en-US',
    studio: {
      name: 'Northbound Studio',
      site: 'northbound.studio',
    },
    leadContact: {
      name: 'Amelia Hart',
      role: 'Principal & Project Lead',
      email: 'amelia@northbound.studio',
    },
  },

  client: {
    name: 'Daniel Reyes',
    company: 'Vantage Freight',
    projectTitle: 'Vantage Freight — Customer Portal & Booking Platform',
    summary:
      'A single portal where your customers quote a shipment, book it, and track it to delivery — replacing the current mix of spreadsheets, phone calls, and three disconnected tools.',
    brief: [
      'Vantage Freight moves roughly 4,000 shipments a quarter, and today every one of them passes through a manual quote. Your operations team re-keys the same details into a spreadsheet, a legacy TMS, and an email thread. The cost is not only time: it is the two-day median gap between a customer asking for a price and receiving one, which is where the majority of lost deals originate.',
      'This engagement builds the customer-facing layer that closes that gap. Customers get instant, rules-based quoting against your own rate tables, one-click booking, and live shipment status. Your team gets a single queue instead of three inboxes, plus the reporting layer that finally makes margin per lane visible.',
      'The scope below is modular by design. The foundation phase is fixed; every subsequent capability is priced independently so you can commit to the core now and stage the rest across the fiscal year without renegotiating the whole agreement.',
    ],
    objectives: [
      'Cut median quote turnaround from two days to under two minutes',
      'Consolidate three operational tools into one auditable system of record',
      'Expose margin per lane, per customer, and per service level in real time',
      'Ship a foundation the in-house team can extend without the studio',
    ],
  },

  basePackage: {
    id: 'base-foundation',
    name: 'Foundation Engagement',
    description:
      'The non-negotiable core: discovery, architecture, the design system, and the production build of quoting, booking, and tracking. Everything else on this page extends this foundation.',
    price: 48000,
    timeline: '10 weeks',
    includes: [
      'Two-week discovery: stakeholder interviews, lane and rate-table audit, technical constraints',
      'Information architecture and end-to-end flows for quote, book, and track',
      'A component-level design system in Figma, handed over with tokens',
      'Production front-end build, responsive from 375px upward',
      'Rules-based quoting engine wired to your existing rate tables',
      'Booking workflow with document generation and email confirmation',
      'Shipment tracking with carrier status ingestion',
      'Role-based access for admin, operations, and customer users',
      'WCAG 2.2 AA accessibility conformance across all shipped screens',
      'Deployment pipeline, monitoring, and a two-week hypercare window',
    ],
  },

  sections: [
    {
      id: 'phase-integrations',
      label: 'Phase 02',
      title: 'Integrations & Automation',
      description:
        'Each integration removes a category of manual work. Priced and delivered independently, so you can sequence them against your own systems roadmap.',
      kind: 'toggles',
      items: [
        {
          id: 'int-erp',
          name: 'ERP & accounting sync',
          description:
            'Two-way sync with your accounting system so a booked shipment becomes an invoice without anyone re-keying it. Includes reconciliation reporting and a failure queue with retry.',
          price: 9500,
          note: 'Removes an estimated 12 hours of finance admin per week',
          recommended: true,
          defaultOn: true,
        },
        {
          id: 'int-carrier',
          name: 'Carrier API network',
          description:
            'Direct connections to your six highest-volume carriers for live rates, tender, and status events. Additional carriers can be added later at a fixed per-carrier rate.',
          price: 14000,
          note: 'Live rates replace the nightly spreadsheet import',
          recommended: true,
          defaultOn: true,
        },
        {
          id: 'int-edi',
          name: 'EDI transaction layer',
          description:
            'EDI 204, 210, 214, and 990 support for enterprise shippers who cannot consume a REST API. Includes a trading-partner onboarding runbook.',
          price: 18500,
          note: 'Required by three of your named enterprise prospects',
          defaultOn: false,
        },
        {
          id: 'int-documents',
          name: 'Document automation',
          description:
            'Bills of lading, commercial invoices, and customs paperwork generated from booking data, with e-signature capture and an immutable audit trail.',
          price: 7500,
          defaultOn: false,
        },
      ],
    },

    {
      id: 'phase-intelligence',
      label: 'Phase 03',
      title: 'Analytics & Intelligence',
      description:
        'The reporting layer that turns the operational data the portal collects into decisions about pricing and capacity.',
      kind: 'toggles',
      items: [
        {
          id: 'ana-margin',
          name: 'Margin intelligence dashboard',
          description:
            'Live margin per lane, per customer, and per service level, with variance alerts when a lane drops below its target threshold.',
          price: 11000,
          note: 'The single most requested item in discovery',
          recommended: true,
          defaultOn: true,
        },
        {
          id: 'ana-forecast',
          name: 'Demand forecasting model',
          description:
            'A trained model over three years of your historical volume, surfacing lane-level demand forecasts and seasonal capacity warnings.',
          price: 16000,
          defaultOn: false,
        },
        {
          id: 'ana-customer',
          name: 'Customer-facing reporting',
          description:
            'A white-labelled reporting view your customers access directly: spend, on-time performance, and exception history, exportable to CSV and PDF.',
          price: 8500,
          defaultOn: false,
        },
      ],
    },

    {
      id: 'scope-quantities',
      label: 'Phase 04',
      title: 'Scope Variables',
      description:
        'Volume-driven items. Move each control to match the scale you actually need; the total updates as you go.',
      kind: 'quantities',
      items: [
        {
          id: 'qty-screens',
          name: 'Additional portal screens',
          description:
            'Screens beyond the fourteen included in the foundation — designed, built, tested, and documented in the design system.',
          unitLabel: 'screen',
          unitLabelPlural: 'screens',
          unitPrice: 1800,
          min: 0,
          max: 20,
          step: 1,
          default: 4,
        },
        {
          id: 'qty-locales',
          name: 'Additional languages',
          description:
            'Full localisation of the interface, transactional email, and generated documents, including right-to-left layout support where applicable.',
          unitLabel: 'language',
          unitLabelPlural: 'languages',
          unitPrice: 4200,
          min: 0,
          max: 8,
          step: 1,
          default: 1,
        },
        {
          id: 'qty-training',
          name: 'Team training sessions',
          description:
            'Live, recorded sessions for your operations and customer-success teams, each covering one workflow end to end with a written runbook.',
          unitLabel: 'session',
          unitLabelPlural: 'sessions',
          unitPrice: 950,
          min: 0,
          max: 12,
          step: 1,
          default: 3,
        },
      ],
    },

    {
      id: 'support-tier',
      label: 'Phase 05',
      title: 'Ongoing Partnership',
      description:
        'What happens after launch. One tier applies for the first twelve months and can be changed at renewal.',
      kind: 'tier',
      defaultOptionId: 'sup-standard',
      options: [
        {
          id: 'sup-essential',
          name: 'Essential',
          summary: 'Keep the lights on.',
          price: 0,
          priceLabel: 'Included',
          features: [
            'Business-hours email support',
            'Next-business-day response target',
            'Security patches and dependency updates',
            'Quarterly platform health report',
          ],
        },
        {
          id: 'sup-standard',
          name: 'Standard',
          summary: 'Continuous improvement, not just maintenance.',
          price: 12000,
          badge: 'Recommended',
          features: [
            'Everything in Essential',
            'Four-hour response target during business hours',
            'Sixteen development hours per month, rolling over one month',
            'Monthly roadmap and analytics review',
            'Direct channel to the delivery team',
          ],
        },
        {
          id: 'sup-partner',
          name: 'Partner',
          summary: 'The studio operates as your product team.',
          price: 34000,
          features: [
            'Everything in Standard',
            'One-hour response target with on-call escalation',
            'Fifty development hours per month',
            'Dedicated technical lead and named designer',
            'Quarterly on-site strategy session',
            '99.9% uptime commitment with service credits',
          ],
        },
      ],
    },
  ],

  discounts: [
    {
      id: 'disc-bundle',
      label: 'Multi-phase commitment',
      description: 'Applied automatically when four or more optional capabilities are selected.',
      type: 'percent',
      value: 0.05,
      condition: { minOptionalItems: 4 },
    },
    {
      id: 'disc-early',
      label: 'Signature before 16 September',
      description: 'Locks current-year rates for the full engagement.',
      type: 'fixed',
      value: 3500,
      condition: { always: true },
    },
  ],

  tax: {
    id: 'tax-sales',
    label: 'Sales tax',
    rate: 0.075,
    note: 'Applied to the discounted subtotal at the prevailing state rate.',
  },

  payment: {
    schedule: [
      { label: 'On signature', share: 0.35 },
      { label: 'At design sign-off', share: 0.3 },
      { label: 'On production launch', share: 0.35 },
    ],
    terms: 'Net 14 from invoice date. All figures in USD, exclusive of third-party licence fees.',
  },
};

export default proposalTemplate;
