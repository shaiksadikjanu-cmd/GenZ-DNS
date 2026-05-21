export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { domain, targetUrl } = req.body;

  if (!domain || !targetUrl) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return res.status(200).json({ isHarmful: false, reason: 'AI offline.' });
  }

  // FIXED PROMPT: only checks for harmful content
  // never penalises mismatch between domain name and URL (that is expected)
  const prompt = `You are a content safety AI for a student network.
Your ONLY job is to check whether the TARGET URL contains harmful content.
Do NOT care whether the custom domain name matches the URL — they are always different by design.

Custom domain (ignore for safety check): "${domain}"
Target URL to check: "${targetUrl}"

Reject ONLY if the target URL is clearly:
- Adult / pornographic content
- Illegal streaming or piracy
- Malware or phishing
- Drug sales or violence

Normal sites like GitHub, Vercel, Netlify, YouTube, Google, college projects, portfolios — always SAFE.

Reply ONLY with valid JSON, no extra text:
{"isHarmful": false, "reason": "Safe for student network"}
or
{"isHarmful": true, "reason": "one line reason"}`;

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
        response_format: { type: 'json_object' },
        temperature: 0.1
      })
    });

    const aiData = await groqRes.json();
    const text   = aiData.choices?.[0]?.message?.content || '{}';

    let result;
    try {
      result = JSON.parse(text);
    } catch(e) {
      // if AI returns non-JSON, fail open (don't block the user)
      return res.status(200).json({ isHarmful: false, reason: 'AI parse error, approved.' });
    }

    return res.status(200).json({
      isHarmful: result.isHarmful ?? false,
      reason:    result.reason    ?? 'Approved'
    });

  } catch (err) {
    console.error('Groq error:', err);
    // fail open — never block registration because AI is down
    return res.status(200).json({ isHarmful: false, reason: 'AI offline, approved.' });
  }
}
