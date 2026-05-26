// api/gpx-proxy.js
// Proxies GPX files from Google Drive (bypasses CORS)
// Usage: /api/gpx-proxy?id=FILE_ID

export default async function handler(req, res) {
  const fileId = req.query?.id;
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return res.status(400).json({ error: 'Missing or invalid file id' });
  }

  // Try multiple endpoints — Drive's behaviour depends on file size, sharing, etc.
  const endpoints = [
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download`,
    `https://docs.google.com/uc?export=download&id=${fileId}`,
  ];

  let lastError = '';
  let lastPreview = '';

  for (const url of endpoints) {
    try {
      let response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; UnleashedRunCoaching/1.0)',
        },
      });

      let body = await response.text();
      const contentType = response.headers.get('content-type') || '';

      // Handle Drive's "large file" interstitial — extract confirmation token
      if (contentType.includes('text/html') && (body.includes('confirm=') || body.includes('download_warning'))) {
        const confirmMatch = body.match(/confirm=([0-9A-Za-z_-]+)/) || body.match(/name="confirm"\s+value="([^"]+)"/);
        const uuidMatch    = body.match(/name="uuid"\s+value="([^"]+)"/);
        if (confirmMatch) {
          const confirmUrl = uuidMatch
            ? `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirmMatch[1]}&uuid=${uuidMatch[1]}`
            : `${url}&confirm=${confirmMatch[1]}`;
          response = await fetch(confirmUrl, { redirect: 'follow' });
          body = await response.text();
        }
      }

      // Sanity check — does this look like GPX?
      if (body.trim().startsWith('<?xml') || body.includes('<gpx') || body.includes('<trkpt')) {
        res.setHeader('Content-Type', 'application/gpx+xml');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).send(body);
      }

      lastError = `${url} → returned ${response.status} ${contentType}`;
      lastPreview = body.slice(0, 300);
    } catch (err) {
      lastError = `${url} → ${err.message}`;
    }
  }

  return res.status(502).json({
    error: 'Could not fetch GPX from Drive. Make sure the file is shared as "Anyone with the link can view".',
    debug: lastError,
    preview: lastPreview,
  });
}

