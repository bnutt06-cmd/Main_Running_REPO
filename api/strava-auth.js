// api/strava-auth.js
// Handles Strava OAuth flow:
//   GET /api/strava-auth          → redirect to Strava consent page
//   GET /api/strava-auth?code=xxx → exchange code for tokens, show refresh token to copy

export default async function handler(req, res) {
  const CLIENT_ID     = process.env.STRAVA_CLIENT_ID;
  const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
  const SITE_URL      = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.SITE_URL || 'http://localhost:3000';

  const REDIRECT_URI = `${SITE_URL}/api/strava-auth`;
  const SCOPE        = 'read,activity:read_all';
  const { code }     = req.query || {};

  // ── STEP 1: No code — redirect to Strava ──
  if (!code) {
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${SCOPE}`;
    res.setHeader('Location', authUrl);
    return res.status(302).end();
  }

  // ── STEP 2: Exchange code for tokens ──
  try {
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokenRes.ok || !tokens.refresh_token) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(`
        <html><body style="font-family:sans-serif;padding:40px;max-width:500px;margin:auto">
          <h2>⚠️ Strava Auth Failed</h2>
          <p>Could not exchange code for tokens.</p>
          <pre style="background:#f5f5f5;padding:12px;border-radius:8px;font-size:12px">${JSON.stringify(tokens, null, 2)}</pre>
          <p>Check your STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in Vercel environment variables.</p>
        </body></html>`);
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <html><body style="font-family:-apple-system,sans-serif;padding:40px;max-width:560px;margin:auto;background:#f5f5f7">
        <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
          <h2 style="color:#E8614A;margin-bottom:8px">✓ Strava Connected!</h2>
          <p style="color:#6e6e73;margin-bottom:24px">One last step — copy the token below and save it as a Vercel environment variable.</p>

          <div style="background:#f5f5f7;border-radius:10px;padding:16px;margin-bottom:16px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#aeaeb2;margin-bottom:6px">Your Refresh Token</div>
            <div style="font-family:monospace;font-size:13px;word-break:break-all;color:#1c1c1e;user-select:all">${tokens.refresh_token}</div>
          </div>

          <ol style="color:#3a3a3c;font-size:14px;line-height:1.8;padding-left:20px;margin-bottom:24px">
            <li>Go to <strong>Vercel → Your project → Settings → Environment Variables</strong></li>
            <li>Add variable: Key = <code style="background:#f5f5f7;padding:2px 6px;border-radius:4px">STRAVA_REFRESH_TOKEN</code></li>
            <li>Value = the token above</li>
            <li>Click Save, then <strong>Deployments → Redeploy</strong></li>
          </ol>

          <p style="font-size:13px;color:#aeaeb2">Athlete: <strong style="color:#1c1c1e">${tokens.athlete?.firstname} ${tokens.athlete?.lastname}</strong></p>
          <a href="/" style="display:inline-block;margin-top:16px;background:#E8614A;color:white;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">← Back to Dashboard</a>
        </div>
      </body></html>`);

  } catch(err) {
    return res.status(500).send(`Auth error: ${err.message}`);
  }
}
