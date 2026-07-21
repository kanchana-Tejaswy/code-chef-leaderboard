import { describe, it, expect, vi, beforeEach } from 'vitest';
import { proxy } from '../src/proxy';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('next/server', () => {
  const NextResponse = {
    next: vi.fn(() => ({ cookies: { set: vi.fn() }, headers: new Map() })),
    redirect: vi.fn((url) => ({ status: 307, headers: new Map([['location', url.toString()]]) })),
    json: vi.fn((data, options) => ({ data, status: options?.status || 200, headers: options?.headers }))
  };
  class NextRequest {
    constructor(url) {
      this.nextUrl = new URL(url);
      this.nextUrl.clone = () => new URL(url);
      this.cookies = { getAll: vi.fn(() => []), set: vi.fn() };
    }
  }
  return { NextResponse, NextRequest };
});

const mockSupabaseAuth = vi.fn().mockResolvedValue({ data: { user: null } });

vi.mock('@supabase/ssr', () => {
  return {
    createServerClient: vi.fn(() => ({
      auth: {
        getUser: mockSupabaseAuth
      }
    }))
  };
});

describe('Proxy and API Auth Responses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Redirects unauthenticated protected page to /login', async () => {
    mockSupabaseAuth.mockResolvedValueOnce({ data: { user: null } });
    const req = new NextRequest('http://localhost/dashboard');
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/login');
  });

  it('Does not redirect unauthenticated API to /login', async () => {
    mockSupabaseAuth.mockResolvedValueOnce({ data: { user: null } });
    const req = new NextRequest('http://localhost/api/dashboard/analytics');
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
  });

  it('Allows public routes without redirect', async () => {
    mockSupabaseAuth.mockResolvedValueOnce({ data: { user: null } });
    const req = new NextRequest('http://localhost/login');
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
  });
});
