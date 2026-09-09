'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
let client: SupabaseClient | null = null;
let initialized: Promise<void> | null = null;
async function initialize() {
  const response = await fetch('/api/session', { cache: 'no-store' });
  const config = await response.json();
  if (!response.ok) throw new ApiError(config.error, response.status);
  if (config.backend === 'supabase') {
    client ??= createClient(config.url, config.key);
    const {
      data: { session },
      error,
    } = await client.auth.getSession();
    if (error)
      throw new ApiError('Your guest session could not be restored.', 401);
    if (!session) {
      const result = await client.auth.signInAnonymously();
      if (result.error)
        throw new ApiError(
          'We could not start your guest session. Please try again.',
          503,
        );
    }
  } else {
    const session = await fetch('/api/session', { method: 'POST' });
    if (!session.ok)
      throw new ApiError(
        'We could not start your guest session. Please try again.',
        503,
      );
  }
}
export async function identity() {
  initialized ??= initialize().catch((error) => {
    initialized = null;
    throw error;
  });
  await initialized;
  return client;
}
export async function api<T>(url: string, body?: unknown): Promise<T> {
  const supabase = await identity();
  const token = supabase
    ? (await supabase.auth.getSession()).data.session?.access_token
    : undefined;
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    cache: 'no-store',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.error || 'Something went wrong. Please try again.',
      response.status,
    );
  return data as T;
}
