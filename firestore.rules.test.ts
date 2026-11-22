/**
 * Security TDD Verification Suite for Kinetix Play Firestore Rules
 * Tests all 12 Dirty Dozen payloads against expected PERMISSION_DENIED outcomes.
 */

export interface SecurityTestCase {
  id: string;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 'DD-01',
    name: 'Unauthenticated Game Creation',
    operation: 'create',
    path: '/games/fake-game',
    auth: null,
    payload: { title: 'Fake' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-02',
    name: 'Non-Admin Game Modification',
    operation: 'update',
    path: '/games/chrono-eclipse',
    auth: { uid: 'regular-user-1', email: 'player@example.com', email_verified: true },
    payload: { title: 'Hacked Title' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-03',
    name: 'Shadow Field Injection on Game',
    operation: 'create',
    path: '/games/shadow-game',
    auth: { uid: 'admin-1', email: 'mainkode4@gmail.com', email_verified: true },
    payload: { title: 'Test', isVerified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04',
    name: 'Insufficient Screenshots (< 3)',
    operation: 'create',
    path: '/games/two-screens',
    auth: { uid: 'admin-1', email: 'mainkode4@gmail.com', email_verified: true },
    payload: { screenshots: ['/a.jpg', '/b.jpg'] },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    name: 'Empty Download Links',
    operation: 'create',
    path: '/games/no-links',
    auth: { uid: 'admin-1', email: 'mainkode4@gmail.com', email_verified: true },
    payload: { downloadLinks: [] },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    name: 'Self-Assigned Admin Role in User Profile',
    operation: 'create',
    path: '/users/regular-user-1',
    auth: { uid: 'regular-user-1', email: 'player@example.com', email_verified: true },
    payload: { uid: 'regular-user-1', role: 'admin' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    name: 'PII Cross-User Profile Read',
    operation: 'get',
    path: '/users/victim-user-2',
    auth: { uid: 'regular-user-1', email: 'player@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08',
    name: 'Comment Author Spoofing',
    operation: 'create',
    path: '/games/chrono-eclipse/comments/c1',
    auth: { uid: 'attacker-1', email: 'attacker@example.com', email_verified: true },
    payload: { gameId: 'chrono-eclipse', userId: 'victim-2', content: 'Spoofed' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-09',
    name: 'Orphaned Wishlist Item',
    operation: 'create',
    path: '/users/regular-user-1/wishlist/nonexistent-game',
    auth: { uid: 'regular-user-1', email: 'player@example.com', email_verified: true },
    payload: { userId: 'regular-user-1', gameId: 'nonexistent-game' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10',
    name: 'Unverified Email Admin Spoof',
    operation: 'create',
    path: '/games/spoof-admin',
    auth: { uid: 'spoof-uid', email: 'mainkode4@gmail.com', email_verified: false },
    payload: { title: 'Spoofed' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    name: 'Path ID Poisoning',
    operation: 'get',
    path: '/games/../../etc/passwd',
    auth: { uid: 'regular-user-1', email: 'player@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    name: 'Unscoped Activity List Scraping',
    operation: 'list',
    path: '/activities',
    auth: { uid: 'regular-user-1', email: 'player@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
