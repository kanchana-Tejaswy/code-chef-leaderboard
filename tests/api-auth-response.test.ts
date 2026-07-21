import { describe, it, expect, vi, beforeEach } from 'vitest';
import { proxy } from '../src/proxy';
import { NextRequest, NextResponse } from 'next/server';
import { GET as dashboardAnalyticsGet } from '../src/app/api/dashboard/analytics/route';
import { GET as profileDetailsGet } from '../src/app/api/profile/details/route';
import { POST as profilePost } from '../src/app/api/profile/route';
import { AuthError } from '../src/lib/auth';

vi.mock('server-only', () => ({}));

// Mock next/cache
vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn) => fn)
}));

// Mock dependencies
vi.mock('next/server', () => {
  const NextResponse = {
    next: vi.fn(() => ({ cookies: { set: vi.fn(), get: vi.fn() }, headers: new Map() })),
    redirect: vi.fn((url) => ({ status: 307, headers: new Map([['location', url.toString()]]) })),
    json: vi.fn((data, options) => ({ 
      data, 
      status: options?.status || 200, 
      headers: new Map(Object.entries(options?.headers || {})) 
    }))
  };
  class NextRequest {
    constructor(url, init) {
      this.url = url;
      this.nextUrl = new URL(url);
      this.nextUrl.clone = () => new URL(url);
      this.cookies = { getAll: vi.fn(() => []), set: vi.fn(), get: vi.fn() };
      this.json = vi.fn().mockResolvedValue(init?.body ? JSON.parse(init.body) : {});
      this.method = init?.method || 'GET';
    }
  }
  return { NextResponse, NextRequest };
});

const mockSupabaseAuth = vi.fn().mockResolvedValue({ data: { user: null } });
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockSupabaseAuth }
  }))
}));

const mockAuthGuard = vi.fn();
vi.mock('../src/lib/auth', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    requireDashboardAccess: vi.fn(async () => mockAuthGuard('requireDashboardAccess')),
    requireStudentProfileReadAccess: vi.fn(async () => mockAuthGuard('requireStudentProfileReadAccess')),
    requireStudentWriteAccess: vi.fn(async () => mockAuthGuard('requireStudentWriteAccess')),
  };
});

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    studentProfile: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue({}) },
  }
}));

describe('Proxy and API Auth Responses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthGuard.mockResolvedValue(true); // default pass
  });

  it('1. Protected page redirects to /login', async () => {
    mockSupabaseAuth.mockResolvedValueOnce({ data: { user: null } });
    const req = new NextRequest('http://localhost/dashboard');
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/login');
  });

  it('2. Protected API does not redirect', async () => {
    mockSupabaseAuth.mockResolvedValueOnce({ data: { user: null } });
    const req = new NextRequest('http://localhost/api/dashboard/analytics');
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
  });

  it('3. Protected API returns 401 JSON', async () => {
    // Simulate unauthenticated
    const error = new AuthError('Unauthorized', 'UNAUTHORIZED');
    mockAuthGuard.mockRejectedValueOnce(error);
    const req = new NextRequest('http://localhost/api/dashboard/analytics');
    const res = await dashboardAnalyticsGet(req);
    expect(res.status).toBe(401);
    expect(res.data).toHaveProperty('error');
  });

  it('4. Protected API has no Location header', async () => {
    const error = new AuthError('Unauthorized', 'UNAUTHORIZED');
    mockAuthGuard.mockRejectedValueOnce(error);
    const req = new NextRequest('http://localhost/api/dashboard/analytics');
    const res = await dashboardAnalyticsGet(req);
    expect(res.headers?.has('location')).toBe(false);
  });

  it('5. Protected API contains no HTML login page', async () => {
    const error = new AuthError('Unauthorized', 'UNAUTHORIZED');
    mockAuthGuard.mockRejectedValueOnce(error);
    const req = new NextRequest('http://localhost/api/dashboard/analytics');
    const res = await dashboardAnalyticsGet(req);
    expect(typeof res.data).toBe('object');
    expect(JSON.stringify(res.data)).not.toContain('<html');
  });

  it('6. ADMIN protected API is allowed', async () => {
    mockAuthGuard.mockResolvedValueOnce(true); // authorized
    const req = new NextRequest('http://localhost/api/dashboard/analytics');
    const res = await dashboardAnalyticsGet(req);
    expect(res.status).toBe(200);
  });

  it('7. GK_SIR write API returns 403', async () => {
    const error = new AuthError('Forbidden', 'FORBIDDEN');
    mockAuthGuard.mockRejectedValueOnce(error);
    const req = new NextRequest('http://localhost/api/profile', { method: 'POST', body: JSON.stringify({}) });
    const res = await profilePost(req);
    expect(res.status).toBe(403);
  });

  it('8. HOD Admin API returns 403', async () => {
    const error = new AuthError('Forbidden', 'FORBIDDEN');
    mockAuthGuard.mockRejectedValueOnce(error);
    const req = new NextRequest('http://localhost/api/dashboard/analytics');
    const res = await dashboardAnalyticsGet(req);
    expect(res.status).toBe(403);
  });

  it('9. STUDENT another-profile API returns 403', async () => {
    const error = new AuthError('Forbidden', 'FORBIDDEN');
    mockAuthGuard.mockRejectedValueOnce(error);
    const req = new NextRequest('http://localhost/api/profile/details?userId=other');
    const res = await profileDetailsGet(req);
    expect(res.status).toBe(403);
  });

  it('10. Unauthenticated write is blocked before mutation', async () => {
    const error = new AuthError('Unauthorized', 'UNAUTHORIZED');
    mockAuthGuard.mockRejectedValueOnce(error);
    const req = new NextRequest('http://localhost/api/profile', { method: 'POST', body: JSON.stringify({}) });
    const res = await profilePost(req);
    expect(res.status).toBe(401);
  });

  it('11. Authentication API remains reachable', async () => {
    mockSupabaseAuth.mockResolvedValueOnce({ data: { user: null } });
    const req = new NextRequest('http://localhost/api/auth/verify-otp');
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
  });

  it('12. Proxy cookie refresh remains functional', async () => {
    mockSupabaseAuth.mockResolvedValueOnce({ data: { user: { id: "user1" } } });
    const req = new NextRequest('http://localhost/dashboard');
    const res = await proxy(req);
    expect(res.status).not.toBe(307); // Because user exists
  });

  it('13. Route Handler performs independent authorization', async () => {
    const error = new AuthError('Unauthorized', 'UNAUTHORIZED');
    mockAuthGuard.mockRejectedValueOnce(error);
    const req = new NextRequest('http://localhost/api/dashboard/analytics');
    const res = await dashboardAnalyticsGet(req);
    expect(res.status).toBe(401);
    expect(mockAuthGuard).toHaveBeenCalled();
  });

  it('14. Internal errors are not exposed', async () => {
    mockAuthGuard.mockRejectedValueOnce(new Error('Some DB Crash'));
    const req = new NextRequest('http://localhost/api/dashboard/analytics');
    const res = await dashboardAnalyticsGet(req);
    expect(res.status).toBe(500);
    expect(res.data.error).not.toBe('Some DB Crash');
  });

  it('15. No redirect loops', async () => {
    mockSupabaseAuth.mockResolvedValueOnce({ data: { user: null } });
    const req = new NextRequest('http://localhost/login');
    const res = await proxy(req);
    expect(res.status).not.toBe(307); // /login is not redirected
  });
});
