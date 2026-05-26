// api/parse-session.js
// Vercel serverless function — proxies session notes to Anthropic API

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { system, user } = req.body || {};
  if (!user) {
    return res.status(400).json({ error: 'Missing user message' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: system || '',
        messages: [{ role: 'user', content: user }],
      }),
    });

    const rawText = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Anthropic API returned ${response.status}`,
        detail: rawText,
      });
    }

    const data = JSON.parse(rawText);
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
