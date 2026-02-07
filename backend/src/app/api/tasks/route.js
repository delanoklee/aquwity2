import { getUser } from '@/lib/auth';
import { createAuthenticatedClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// GET /api/tasks - retrieve user's completed tasks
export async function GET(request) {
  const { user, error: authError } = await getUser(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  try {
    const token = request.headers.get('authorization').replace('Bearer ', '');
    const supabase = createAuthenticatedClient(token);

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'all';

    let query = supabase
      .from('completed_tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false });

    if (range === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query = query.gte('completed_at', today.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/tasks - mark a task as completed
export async function POST(request) {
  const { user, error: authError } = await getUser(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  try {
    const { task, focused_ms, distracted_ms } = await request.json();

    if (!task || !task.trim()) {
      return NextResponse.json(
        { error: 'Task text is required' },
        { status: 400 }
      );
    }

    const token = request.headers.get('authorization').replace('Bearer ', '');
    const supabase = createAuthenticatedClient(token);

    const { data, error } = await supabase
      .from('completed_tasks')
      .insert({
        user_id: user.id,
        task: task.trim(),
        focused_ms: focused_ms || 0,
        distracted_ms: distracted_ms || 0,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
