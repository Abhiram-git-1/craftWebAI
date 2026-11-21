// const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
// const DEFAULT_MODEL = 'cohere/north-mini-code:free';
// const TIMEOUT_MS = Math.min(Math.max(Number(process.env.OPENROUTER_TIMEOUT_MS || 300000), 60000), 600000);

// function providerError(message, statusCode = 502) {
//   const error = new Error(message);
//   error.statusCode = statusCode;
//   return error;
// }

// const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// function getText(payload) {
//   const content = payload?.choices?.[0]?.message?.content;
//   if (typeof content === 'string') return content.trim();
//   if (Array.isArray(content)) return content.map((part) => part?.text || '').join('').trim();
//   return '';
// }

// async function requestCompletion({ system, prompt, maxTokens, jsonMode = false }) {
//   const apiKey = process.env.OPENROUTER_API_KEY;
//   const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
//   if (!apiKey) throw providerError('OPENROUTER_API_KEY is missing from server/.env.', 503);

//   const body = {
//     model,
//     messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
//     temperature: 0.15,
//     max_tokens: maxTokens,
//   };
//   // JSON mode is used only for the small planning response. File source is returned as plain text.
//   // Do not force response_format: some OpenRouter free coding models reject it.
//   // The planning response is parsed and validated as JSON by requestAIJson.

//   let response;
//   let raw = '';
//   for (let attempt = 0; attempt < 2; attempt += 1) {
//     try {
//       response = await fetch(OPENROUTER_API_URL, {
//         method: 'POST',
//         headers: {
//           Authorization: `Bearer ${apiKey}`,
//           'Content-Type': 'application/json',
//           'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:5173',
//           'X-OpenRouter-Title': process.env.OPENROUTER_APP_NAME || 'carftWebAI',
//         },
//         body: JSON.stringify(body),
//         signal: AbortSignal.timeout(TIMEOUT_MS),
//       });
//       raw = await response.text();
//       if (response.ok) break;
//       if (![408, 425, 429, 500, 502, 503, 504].includes(response.status) || attempt === 1) break;
//       await delay(1200 * (attempt + 1));
//     } catch (cause) {
//       if (attempt === 1) {
//         throw providerError(cause?.name === 'TimeoutError'
//           ? `OpenRouter timed out after ${Math.round(TIMEOUT_MS / 1000)} seconds.`
//           : `Could not connect to OpenRouter: ${cause.message}`, 504);
//       }
//       await delay(1000);
//     }
//   }

//   let payload;
//   try { payload = JSON.parse(raw); }
//   catch { throw providerError('OpenRouter returned an unreadable response.'); }

//   if (!response?.ok) {
//     const status = response?.status || 502;
//     const message = payload?.error?.message || 'Unknown provider error';
//     throw providerError(`OpenRouter request failed (${status}): ${message}`, status >= 400 && status < 500 ? status : 502);
//   }

//   const choice = payload?.choices?.[0];
//   const text = getText(payload);
//   if (!text) {
//     const reason = choice?.finish_reason || 'unknown';
//     const detail = choice?.error?.message || payload?.error?.message || '';
//     if (reason === 'length') throw providerError(`Model output limit reached (${payload?.model || model}). ${detail}`);
//     throw providerError(`Model returned no content (finish reason: ${reason}). ${detail}`.trim());
//   }
//   return { text, payload };
// }

// export async function requestAIJson({ system, prompt, maxTokens = 5000 }) {
//   const { text } = await requestCompletion({ system, prompt, maxTokens, jsonMode: false });
//   const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
//   try { return JSON.parse(cleaned); }
//   catch {
//     const start = cleaned.indexOf('{');
//     const end = cleaned.lastIndexOf('}');
//     if (start >= 0 && end > start) {
//       try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* handled below */ }
//     }
//     throw providerError('The model did not return a valid JSON website plan. Please retry.');
//   }
// }

// export async function requestAIText({ system, prompt, maxTokens = 12000 }) {
//   const result = await requestCompletion({ system, prompt, maxTokens, jsonMode: false });
//   return result.text;
// }

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "recursive/flint-v1.0:free";
const TIMEOUT_MS = Math.min(
  Math.max(Number(process.env.OPENROUTER_TIMEOUT_MS || 300000), 60000),
  600000,
);

function providerError(message, statusCode = 502) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content))
    return content
      .map((part) => part?.text || "")
      .join("")
      .trim();
  return "";
}

async function requestCompletion({
  system,
  prompt,
  maxTokens,
  jsonMode = false,
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  if (!apiKey)
    throw providerError("OPENROUTER_API_KEY is missing from server/.env.", 503);

  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature: 0.15,
    max_tokens: maxTokens,
  };
  // JSON mode is used only for the small planning response. File source is returned as plain text.
  // Do not force response_format: some OpenRouter free coding models reject it.
  // The planning response is parsed and validated as JSON by requestAIJson.

  let response;
  let raw = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            process.env.OPENROUTER_SITE_URL || "http://localhost:5173",
          "X-OpenRouter-Title": process.env.OPENROUTER_APP_NAME || "carftWebAI",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      raw = await response.text();
      if (response.ok) break;
      if (
        ![408, 425, 429, 500, 502, 503, 504].includes(response.status) ||
        attempt === 1
      )
        break;
      await delay(1200 * (attempt + 1));
    } catch (cause) {
      if (attempt === 1) {
        throw providerError(
          cause?.name === "TimeoutError"
            ? `OpenRouter timed out after ${Math.round(TIMEOUT_MS / 1000)} seconds.`
            : `Could not connect to OpenRouter: ${cause.message}`,
          504,
        );
      }
      await delay(1000);
    }
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw providerError("OpenRouter returned an unreadable response.");
  }

  if (!response?.ok) {
    const status = response?.status || 502;
    const message = payload?.error?.message || "Unknown provider error";
    throw providerError(
      `OpenRouter request failed (${status}): ${message}`,
      status >= 400 && status < 500 ? status : 502,
    );
  }

  const choice = payload?.choices?.[0];
  const text = getText(payload);
  if (!text) {
    const reason = choice?.finish_reason || "unknown";
    const detail = choice?.error?.message || payload?.error?.message || "";
    if (reason === "length")
      throw providerError(
        `Model output limit reached (${payload?.model || model}). ${detail}`,
      );
    throw providerError(
      `Model returned no content (finish reason: ${reason}). ${detail}`.trim(),
    );
  }
  return { text, payload };
}

export async function requestAIJson({ system, prompt, maxTokens = 5000 }) {
  const { text } = await requestCompletion({
    system,
    prompt,
    maxTokens,
    jsonMode: false,
  });
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* handled below */
      }
    }
    throw providerError(
      "The model did not return a valid JSON website plan. Please retry.",
    );
  }
}

export async function requestAIText({ system, prompt, maxTokens = 12000 }) {
  const result = await requestCompletion({
    system,
    prompt,
    maxTokens,
    jsonMode: false,
  });
  return result.text;
}
