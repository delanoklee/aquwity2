import { createServerClient } from './supabase';

// Extract the authenticated user from a request
// Returns { user, error } - use this in every protected API route
export async function getUser(request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createServerClient();

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: 'Invalid or expired token' };
  }

  return { user, error: null };
}
