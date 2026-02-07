'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      if (data.session) {
        // Redirect back to the Electron app with the tokens
        const params = new URLSearchParams({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          user_id: data.user.id,
          email: data.user.email,
        });

        setSuccess(true);

        // Redirect to custom protocol - Electron will catch this
        window.location.href = `acuity://auth-callback?${params.toString()}`;

        // Show a fallback message in case the redirect doesn't work
        setTimeout(() => {
          setSuccess('redirected');
        }, 2000);
      }
    } catch (err) {
      setError('Could not connect to server.');
      setLoading(false);
    }
  }

  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #1a1a2e;
            color: #e0e0e0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .container {
            width: 380px;
            padding: 40px;
            background: #16213e;
            border-radius: 16px;
            border: 1px solid #0f3460;
          }
          .logo { text-align: center; font-size: 28px; font-weight: bold; margin-bottom: 8px; color: #e94560; }
          .subtitle { text-align: center; font-size: 14px; color: #888; margin-bottom: 32px; }
          .tabs { display: flex; margin-bottom: 24px; border-bottom: 1px solid #0f3460; }
          .tab {
            flex: 1; padding: 10px; text-align: center; cursor: pointer;
            font-size: 15px; color: #888; border-bottom: 2px solid transparent;
            transition: all 0.2s; background: none; border-top: none; border-left: none; border-right: none;
          }
          .tab.active { color: #e94560; border-bottom-color: #e94560; }
          input {
            width: 100%; padding: 12px 14px; margin-bottom: 14px;
            border: 1px solid #0f3460; border-radius: 8px;
            background: #1a1a2e; color: #e0e0e0; font-size: 15px; outline: none;
          }
          input:focus { border-color: #e94560; }
          button[type="submit"] {
            width: 100%; padding: 12px; background: #e94560; color: white;
            border: none; border-radius: 8px; font-size: 15px; cursor: pointer;
            transition: background 0.2s; margin-top: 4px;
          }
          button[type="submit"]:hover { background: #c73e54; }
          button[type="submit"]:disabled { background: #555; cursor: not-allowed; }
          .error { color: #e94560; font-size: 13px; margin-bottom: 14px; }
          .success {
            text-align: center; padding: 20px 0;
          }
          .success h2 { color: #4ade80; margin-bottom: 12px; font-size: 20px; }
          .success p { color: #888; font-size: 14px; line-height: 1.5; }
        `}} />
      </head>
      <body>
        <div className="container">
          <div className="logo">ACUITY</div>
          <div className="subtitle">Stay focused on what matters</div>

          {success === 'redirected' ? (
            <div className="success">
              <h2>✓ Signed in!</h2>
              <p>You can close this tab and return to the Acuity app.</p>
              <p style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
                If the app didn't open automatically, make sure Acuity is running.
              </p>
            </div>
          ) : success ? (
            <div className="success">
              <h2>✓ Signed in!</h2>
              <p>Redirecting to the Acuity app...</p>
            </div>
          ) : (
            <>
              <div className="tabs">
                <button
                  className={`tab ${mode === 'login' ? 'active' : ''}`}
                  onClick={() => { setMode('login'); setError(''); }}
                >
                  Sign In
                </button>
                <button
                  className={`tab ${mode === 'signup' ? 'active' : ''}`}
                  onClick={() => { setMode('signup'); setError(''); }}
                >
                  Sign Up
                </button>
              </div>

              {error && <div className="error">{error}</div>}

              <form onSubmit={handleSubmit}>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="submit" disabled={loading}>
                  {loading
                    ? (mode === 'login' ? 'Signing in...' : 'Signing up...')
                    : (mode === 'login' ? 'Sign In' : 'Sign Up')
                  }
                </button>
              </form>
            </>
          )}
        </div>
      </body>
    </html>
  );
}
