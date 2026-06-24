import type { Snapshot } from '@/types/roadmap'

// Local-dev fallback for the roadmap page. `astro dev` has no Netlify Blobs
// runtime, so the SSR page renders this instead of the live snapshot (see
// src/pages/developers/roadmap.astro). The shape mirrors the real Linear
// snapshot; dates are illustrative and sit in the current timeline window.
export const ROADMAP_FIXTURE: Snapshot = {
  generatedAt: '2026-06-22T00:00:00.000Z',
  teams: [
    {
      id: 'team-rafiki',
      name: 'Rafiki',
      key: 'RAF',
      color: null,
      childrenIds: [],
      projectCount: 3
    },
    {
      id: 'team-open-payments',
      name: 'Open Payments',
      key: 'OP',
      color: null,
      childrenIds: ['team-op-tooling'],
      projectCount: 2
    },
    {
      id: 'team-op-tooling',
      name: 'Open Payments Tooling',
      key: 'OPT',
      color: null,
      childrenIds: [],
      projectCount: 1
    },
    {
      id: 'team-web-monetization',
      name: 'Web Monetization',
      key: 'WM',
      color: null,
      childrenIds: [],
      projectCount: 2
    }
  ],
  projects: [
    {
      id: 'proj-rafiki-v1',
      name: 'Rafiki v1 GA',
      description: 'General availability release of the Rafiki node.',
      color: null,
      state: 'started',
      icon: 'Rocket',
      priority: 1,
      progress: 0.6,
      sortOrder: 1,
      startDate: '2026-01-15',
      targetDate: '2026-09-30',
      completedAt: null,
      url: null,
      team: { id: 'team-rafiki', name: 'Rafiki', key: 'RAF', color: null },
      milestones: [
        { id: 'ms-raf-beta', name: 'Beta cut', targetDate: '2026-04-15' },
        {
          id: 'ms-raf-rc',
          name: 'Release candidate',
          targetDate: '2026-08-01'
        },
        { id: 'ms-raf-audit', name: 'Security audit', targetDate: '2026-11-15' }
      ]
    },
    {
      id: 'proj-rafiki-telemetry',
      name: 'Telemetry & observability',
      description: 'Operational metrics and tracing for Rafiki operators.',
      color: null,
      state: 'started',
      icon: 'Chart',
      priority: 2,
      progress: 0.3,
      sortOrder: 2,
      startDate: '2026-05-01',
      targetDate: '2027-02-28',
      completedAt: null,
      url: null,
      team: { id: 'team-rafiki', name: 'Rafiki', key: 'RAF', color: null },
      milestones: [
        {
          id: 'ms-tel-dash',
          name: 'Operator dashboard',
          targetDate: '2026-10-01'
        }
      ]
    },
    {
      id: 'proj-rafiki-admin',
      name: 'Admin UI refresh',
      description: 'Completed refresh of the Rafiki admin interface.',
      color: null,
      state: 'completed',
      icon: 'Dashboard',
      priority: 3,
      progress: 1,
      sortOrder: 3,
      startDate: '2026-01-01',
      targetDate: null,
      completedAt: '2026-03-20',
      url: null,
      team: { id: 'team-rafiki', name: 'Rafiki', key: 'RAF', color: null },
      milestones: []
    },
    {
      id: 'proj-op-spec',
      name: 'Open Payments spec 1.1',
      description: 'Next minor revision of the Open Payments specification.',
      color: null,
      state: 'started',
      icon: 'NotePad',
      priority: 1,
      progress: 0.5,
      sortOrder: 1,
      startDate: '2026-02-01',
      targetDate: '2026-12-15',
      completedAt: null,
      url: null,
      team: {
        id: 'team-open-payments',
        name: 'Open Payments',
        key: 'OP',
        color: null
      },
      milestones: [
        { id: 'ms-op-draft', name: 'Public draft', targetDate: '2026-06-01' },
        {
          id: 'ms-op-review',
          name: 'Community review',
          targetDate: '2026-10-01'
        }
      ]
    },
    {
      id: 'proj-op-sdk',
      name: 'TypeScript SDK',
      description: 'First-party Open Payments client SDK.',
      color: null,
      state: 'started',
      icon: 'CodeBlock',
      priority: 2,
      progress: 0.2,
      sortOrder: 1,
      startDate: '2026-07-01',
      targetDate: '2027-04-30',
      completedAt: null,
      url: null,
      team: {
        id: 'team-op-tooling',
        name: 'Open Payments Tooling',
        key: 'OPT',
        color: null
      },
      milestones: [
        { id: 'ms-sdk-alpha', name: 'Alpha', targetDate: '2026-11-01' }
      ]
    },
    {
      id: 'proj-wm-extension',
      name: 'Web Monetization extension 1.0',
      description: 'Stable release of the browser extension.',
      color: null,
      state: 'started',
      icon: 'Chrome',
      priority: 1,
      progress: 0.75,
      sortOrder: 1,
      startDate: '2026-01-01',
      targetDate: '2026-07-31',
      completedAt: null,
      url: null,
      team: {
        id: 'team-web-monetization',
        name: 'Web Monetization',
        key: 'WM',
        color: null
      },
      milestones: [
        { id: 'ms-wm-beta', name: 'Public beta', targetDate: '2026-05-01' }
      ]
    },
    {
      id: 'proj-wm-publisher',
      name: 'Publisher tools',
      description: 'Tooling for content publishers adopting Web Monetization.',
      color: null,
      state: 'started',
      icon: 'Write',
      priority: 2,
      progress: 0.1,
      sortOrder: 2,
      startDate: '2026-09-01',
      targetDate: '2027-06-30',
      completedAt: null,
      url: null,
      team: {
        id: 'team-web-monetization',
        name: 'Web Monetization',
        key: 'WM',
        color: null
      },
      milestones: []
    },
    {
      id: 'proj-research',
      name: 'Interledger research initiatives',
      description: 'Cross-cutting research not tied to a single team.',
      color: null,
      state: 'started',
      icon: 'Education',
      priority: 3,
      progress: 0.4,
      sortOrder: 1,
      startDate: '2026-03-01',
      targetDate: '2026-12-31',
      completedAt: null,
      url: null,
      team: null,
      milestones: [
        { id: 'ms-res-paper', name: 'Whitepaper', targetDate: '2026-09-15' }
      ]
    }
  ]
}
