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
        const params = new URLSearchParams({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          user_id: data.user.id,
          email: data.user.email,
        });

        setSuccess(true);
        window.location.href = `acuity://auth-callback?${params.toString()}`;

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: `
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f0e2c4;
            color: #2c3e47;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            position: relative;
            overflow: hidden;
          }
          body::before {
            content: '';
            position: fixed;
            inset: 0;
            background:
              radial-gradient(ellipse at 30% 20%, rgba(184, 207, 160, 0.12) 0%, transparent 50%),
              radial-gradient(ellipse at 70% 70%, rgba(78, 122, 140, 0.08) 0%, transparent 50%);
            pointer-events: none;
          }
          .container {
            width: 380px;
            padding: 40px;
            background: #faf4e8;
            border-radius: 16px;
            border: 1px solid rgba(78, 122, 140, 0.08);
            box-shadow: 0 8px 40px rgba(44, 62, 71, 0.08);
            position: relative;
            z-index: 1;
            animation: fade-in 0.5s ease forwards;
          }
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .logo-area {
            text-align: center;
            margin-bottom: 8px;
          }
          .logo-area svg {
            margin-bottom: 12px;
          }
          .logo {
            text-align: center;
            font-family: 'Cormorant Garamond', Georgia, serif;
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 4px;
            color: #2c3e47;
            letter-spacing: 0.5px;
          }
          .subtitle {
            text-align: center;
            font-size: 13px;
            color: #8b7355;
            margin-bottom: 32px;
            letter-spacing: 0.2px;
          }
          .tabs {
            display: flex;
            margin-bottom: 24px;
            border-bottom: 1px solid rgba(78, 122, 140, 0.1);
          }
          .tab {
            flex: 1;
            padding: 10px;
            text-align: center;
            cursor: pointer;
            font-family: 'DM Sans', sans-serif;
            font-size: 14px;
            font-weight: 500;
            color: #8b7355;
            border: none;
            border-bottom: 2px solid transparent;
            background: none;
            transition: all 0.2s;
          }
          .tab:hover {
            color: #4e7a8c;
          }
          .tab.active {
            color: #4e7a8c;
            border-bottom-color: #4e7a8c;
          }
          input {
            width: 100%;
            padding: 12px 14px;
            margin-bottom: 14px;
            border: 1px solid rgba(78, 122, 140, 0.12);
            border-radius: 10px;
            background: #f0e2c4;
            color: #2c3e47;
            font-family: 'DM Sans', sans-serif;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s, background 0.2s;
          }
          input::placeholder {
            color: rgba(78, 122, 140, 0.35);
          }
          input:focus {
            border-color: rgba(78, 122, 140, 0.35);
            background: #fff;
          }
          button[type="submit"] {
            width: 100%;
            padding: 13px;
            background: #4e7a8c;
            color: #faf4e8;
            border: none;
            border-radius: 10px;
            font-family: 'DM Sans', sans-serif;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            letter-spacing: 0.3px;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            margin-top: 4px;
            box-shadow: 0 4px 16px rgba(78, 122, 140, 0.18);
          }
          button[type="submit"]:hover {
            background: #3d6070;
            transform: translateY(-1px);
            box-shadow: 0 6px 24px rgba(78, 122, 140, 0.25);
          }
          button[type="submit"]:active {
            transform: translateY(0);
          }
          button[type="submit"]:disabled {
            background: rgba(78, 122, 140, 0.3);
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
          }
          .error {
            color: #c0706a;
            font-size: 13px;
            margin-bottom: 14px;
          }
          .success {
            text-align: center;
            padding: 20px 0;
          }
          .success h2 {
            color: #8aad6e;
            margin-bottom: 12px;
            font-family: 'Cormorant Garamond', Georgia, serif;
            font-size: 22px;
            font-weight: 600;
          }
          .success p {
            color: #8b7355;
            font-size: 14px;
            line-height: 1.5;
          }
        `}} />
      </head>
      <body>
        <div className="container">
          <div className="logo-area">
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 3C9 3 4 9.5 4 16s5 13 12 13 12-6.5 12-13S23 3 16 3Z" fill="none" stroke="#4e7a8c" strokeWidth="1.5" opacity="0.3"/>
              <circle cx="16" cy="16" r="7" fill="none" stroke="#4e7a8c" strokeWidth="1.5"/>
              <circle cx="16" cy="16" r="2.5" fill="#b8cfa0"/>
              <path d="M16 3C16 3 18.5 7.5 18.5 10" stroke="#b8cfa0" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
            </svg>
          </div>
          <div className="logo">Aquwity</div>
          <div className="subtitle">Stay focused on what matters</div>

          {success === 'redirected' ? (
            <div className="success">
              <h2>✓ Signed in</h2>
              <p>You can close this tab and return to Aquwity.</p>
              <p style={{ marginTop: '12px', fontSize: '12px', color: 'rgba(78, 122, 140, 0.4)' }}>
                If the app didn't open automatically, make sure Aquwity is running.
              </p>
            </div>
          ) : success ? (
            <div className="success">
              <h2>✓ Signed in</h2>
              <p>Redirecting to Aquwity...</p>
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
