const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function classifyItem(item, apiKey) {
  const prompt = buildClassificationPrompt(item);

  const response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    })
  });

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const text = typeof raw === 'string' ? raw.trim() : '';

  if (!text) {
    return {
      emotionalValence: 'unknown',
      manipulationMechanic: 'unknown',
      manipulationIntensity: 0,
      urgencySignals: false,
      reasoning: 'Classification failed.',
      classifiedAt: Date.now()
    };
  }

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (!parsed.classifiedAt) parsed.classifiedAt = Date.now();
    return parsed;
  } catch (e) {
    return {
      emotionalValence: 'unknown',
      manipulationMechanic: 'unknown',
      manipulationIntensity: 0,
      urgencySignals: false,
      reasoning: 'Classification failed.',
      classifiedAt: Date.now()
    };
  }
}

function buildClassificationPrompt(item) {
  return `You are a content analysis system for a browser extension that audits social media algorithmic manipulation. Analyze the following piece of social media content and return ONLY a JSON object with no preamble, no markdown, no explanation outside the JSON.

CONTENT TO ANALYZE:
Platform: ${item.platform}
Content Type: ${item.contentType}
Text: "${(item.text || '').substring(0, 600)}"
Is Algorithmically Recommended (not from followed accounts): ${item.isRecommended}
Feed Position: ${item.feedPosition}
Visible Engagement: ${JSON.stringify(item.engagementMetrics || {})}

INSTRUCTIONS:
Classify this content according to the PRIMARY psychological/behavioral mechanism the algorithm is using to drive engagement via this content.

Return this exact JSON structure:
{
  "emotionalValence": one of ["positive", "negative", "neutral", "mixed", "provocative"],
  "manipulationMechanic": one of ["outrage", "fear", "social_comparison", "tribal_identity", "curiosity_gap", "compulsive_reward", "inspiration", "humor", "information", "controversy", "unknown"],
  "manipulationIntensity": a float between 0.0 (no manipulation) and 1.0 (extreme manipulation),
  "urgencySignals": boolean (true if content uses urgency language like "breaking", "you won't believe", "everyone is", "before it's too late", etc.),
  "reasoning": a single sentence (max 20 words) explaining your classification choice,
  "classifiedAt": ${Date.now()}
}

Be precise. If the content is genuinely informational or benign, score it low. Only score high when there is clear evidence of psychological manipulation mechanics.`;
}
