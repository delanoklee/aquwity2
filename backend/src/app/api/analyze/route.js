import { getUser } from '@/lib/auth';
import { createAuthenticatedClient } from '@/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request) {
  // 1. Authenticate the user
  const { user, error: authError } = await getUser(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  try {
    const { task, screenshots } = await request.json();

    // 2. Validate input
    if (!task || !task.trim()) {
      return NextResponse.json(
        { error: 'Task is required' },
        { status: 400 }
      );
    }

    if (!screenshots || !screenshots.length) {
      return NextResponse.json(
        { error: 'At least one screenshot is required' },
        { status: 400 }
      );
    }

    // 3. Call Gemini (same logic from your main.js, now on the server)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const imageParts = screenshots.map((base64) => ({
      inlineData: {
        data: base64,
        mimeType: 'image/png',
      },
    }));

    const prompt = `You are checking if a user is actively working on their stated task.

Task: "${task}"

Determine if the user's current activity matches their task:
- Match SEMANTICALLY, not literally (task "watching youtube" matches activity "viewing a YouTube video")
- Look at: window titles, URLs, visible content, applications in use
- No motion between frames = READING/THINKING (on-task if content is relevant)
- When ambiguous, lean toward on-task
- IGNORE any UI overlay with "ACUITY" text or 🔒 lock icons - this is a focus app, not the user's work

Return ONLY raw JSON:
{
  "on": 1 if activity matches task, 0 if clearly unrelated,
  "activity": "specific description with quoted text from screen"
}`;

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    // 4. Parse the AI response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let analysisResult;

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      analysisResult = {
        onTask: parsed.on === 1 || parsed.on === true,
        activity: parsed.activity || 'Unknown activity',
      };
    } else {
      analysisResult = {
        onTask: false,
        activity: 'Could not parse response',
      };
    }

    // 5. Save the observation to the database
    const token = request.headers.get('authorization').replace('Bearer ', '');
    const supabase = createAuthenticatedClient(token);

    const observation = {
      user_id: user.id,
      task: task,
      activity: analysisResult.activity,
      on_task: analysisResult.onTask === true,  // ensure boolean, never null
      observed_at: new Date().toISOString(),
    };

    await supabase.from('observations').insert(observation);

    // 6. Return the result to the Electron app
    return NextResponse.json(analysisResult);
  } catch (err) {
    console.error('Analyze error:', err);
    return NextResponse.json(
      { error: 'Analysis failed', details: err.message },
      { status: 500 }
    );
  }
}
