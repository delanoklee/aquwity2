import { getUser } from '@/lib/auth';
import { createAuthenticatedClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// GET /api/history - retrieve user's observation history
export async function GET(request) {
  const { user, error: authError } = await getUser(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  try {
    const token = request.headers.get('authorization').replace('Bearer ', '');
    const supabase = createAuthenticatedClient(token);

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'today';
    const limit = parseInt(searchParams.get('limit') || '500');

    // Calculate date range
    let startDate;
    const now = new Date();
    switch (range) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'all':
      default:
        startDate = new Date(0);
    }

    const { data, error } = await supabase
      .from('observations')
      .select('*')
      .eq('user_id', user.id)
      .gte('observed_at', startDate.toISOString())
      .order('observed_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
