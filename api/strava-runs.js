// api/strava-runs.js
// Refreshes Strava access token and returns recent runs

export default async function handler(req, res) {
  const CLIENT_ID     = process.env.STRAVA_CLIENT_ID;
  const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
  const REFRESH_TOKEN = process.env.STRAVA_REFRESH_TOKEN;

  if (!REFRESH_TOKEN) {
    return res.status(401).json({ error: 'Strava not connected. Visit /api/strava-auth to connect.' });
  }

  try {
    // ── Refresh the access token ──
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type:    'refresh_token',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(502).json({ error: 'Token refresh failed', detail: tokenData });
    }

    const ACCESS_TOKEN = tokenData.access_token;

    // ── Fetch last 100 activities ──
    const activitiesRes = await fetch(
      'https://www.strava.com/api/v3/athlete/activities?per_page=100&page=1',
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
    );

    if (!activitiesRes.ok) {
      const err = await activitiesRes.text();
      return res.status(activitiesRes.status).json({ error: err });
    }

    const activities = await activitiesRes.json();

    const runs = activities
      .filter(a => a.type === 'Run' || a.sport_type === 'Run')
      .map(a => ({
        id:                   a.id,
        name:                 a.name,
        start_date_local:     a.start_date_local,
        distance:             a.distance,
        moving_time:          a.moving_time,
        elapsed_time:         a.elapsed_time,
        total_elevation_gain: a.total_elevation_gain,
        average_heartrate:    a.average_heartrate || null,
        max_heartrate:        a.max_heartrate || null,
        average_cadence:      a.average_cadence || null,
        average_speed:        a.average_speed,
        max_speed:            a.max_speed,
        type:                 a.type,
        sport_type:           a.sport_type,
        kudos_count:          a.kudos_count,
        gear_id:              a.gear_id || null,
      }));

    res.setHeader('Cache-Control', 'public, max-age=600');
    return res.status(200).json(runs);

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
