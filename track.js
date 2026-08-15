// api/track.js — anonymous install/active-user counter.
//
// Records only a random per-device ID and a timestamp — no names,
// phone numbers, business data, or IP logging beyond what Vercel's
// own platform does by default for every request. Requires a Vercel
// KV (Upstash Redis) database connected to this project; if none is
// connected yet, this quietly reports "not configured" and the app
// falls back to showing no numbers rather than fake ones.

module.exports = async function handler(req, res) {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  res.setHeader('Cache-Control', 'no-store');

  if (!KV_URL || !KV_TOKEN) {
    res.status(200).json({ ok: false, error: 'not_configured' });
    return;
  }

  const deviceId = ((req.query && req.query.deviceId) || '').toString().trim().slice(0, 120);
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const headers = { Authorization: `Bearer ${KV_TOKEN}` };

  try {
    if (deviceId && /^[a-zA-Z0-9-]+$/.test(deviceId)) {
      // ZADD registers a brand-new device (counted in totalDownloads)
      // or refreshes an existing one's last-seen score (keeps it
      // counted in activeUsers for another 30 days).
      await fetch(`${KV_URL}/zadd/duka:devices/${now}/${encodeURIComponent(deviceId)}`, { headers });
    }

    const [cardRes, countRes] = await Promise.all([
      fetch(`${KV_URL}/zcard/duka:devices`, { headers }),
      fetch(`${KV_URL}/zcount/duka:devices/${thirtyDaysAgo}/${now}`, { headers })
    ]);
    const cardData = await cardRes.json();
    const countData = await countRes.json();

    res.status(200).json({
      ok: true,
      totalDownloads: cardData.result || 0,
      activeUsers: countData.result || 0
    });
  } catch (err) {
    res.status(200).json({ ok: false, error: 'server_error' });
  }
}
