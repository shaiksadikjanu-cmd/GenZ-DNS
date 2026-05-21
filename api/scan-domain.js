// api/scan-domain.js — Vercel serverless function
// Groq key never touches the browser. Safe.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { domain, targetUrl, userEmail, userName } = req.body;

  if (!domain || !targetUrl) {
    return res.status(400).json({ error: 'Missing domain or targetUrl' });
  }

  // Key comes from Vercel env — never written in code
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_API_KEY) {
    return res.status(500).json({ isHarmful: false, reason: 'AI gatekeeper offline.' });
  }

  const prompt = `You are a strict security AI for a student network.
Analyze this domain name: "${domain}" and target URL: "${targetUrl}".
Reject if it contains adult, illegal, violent, spam, hacking, or piracy content.
Reply ONLY with valid JSON: {"isHarmful": true or false, "reason": "short explanation"}`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });

    const aiData = await groqRes.json();
    const text   = aiData.choices?.[0]?.message?.content || '{}';
    const result = JSON.parse(text);

    return res.status(200).json({
      isHarmful: result.isHarmful ?? false,
      reason:    result.reason    ?? 'No reason given'
    });

  } catch (err) {
    console.error('Groq error:', err);
    // Fail open — don't block registration if AI is down
    return res.status(200).json({ isHarmful: false, reason: 'AI offline, manual review pending.' });
  }
}
