/**
 * Splits raw text into chunks respecting conversation turn boundaries.
 * Never splits mid-turn when possible.
 *
 * @param {string} text - Raw document text
 * @param {number} maxChars - Maximum characters per chunk (default 30000)
 * @param {boolean} respectTurns - Whether to respect turn boundaries (default true)
 * @returns {string[]} Array of text chunks
 */
export function chunkByTurns(text, maxChars = 30000, respectTurns = true) {
  if (!text || text.length === 0) return [];
  if (text.length <= maxChars) return [text];

  if (!respectTurns) {
    return chunkBySize(text, maxChars);
  }

  // Split on turn boundaries: **Human**, **Assistant**, ---, or double newlines
  const turnPattern = /(?=\n\n---\n\n|\n\n\*\*Human\*\*|\n\n\*\*Assistant\*\*|\n\n)/;
  const segments = text.split(turnPattern).filter(s => s.length > 0);

  // Greedily pack segments into chunks
  const chunks = [];
  let current = '';

  for (const segment of segments) {
    // If a single segment exceeds maxChars, split it by double newlines as fallback
    if (segment.length > maxChars) {
      if (current.length > 0) {
        chunks.push(current);
        current = '';
      }
      const subSegments = segment.split(/(?=\n\n)/).filter(s => s.length > 0);
      for (const sub of subSegments) {
        if (sub.length > maxChars) {
          // Last resort: hard split
          if (current.length > 0) {
            chunks.push(current);
            current = '';
          }
          const hardChunks = chunkBySize(sub, maxChars);
          chunks.push(...hardChunks);
        } else if (current.length + sub.length > maxChars) {
          chunks.push(current);
          current = sub;
        } else {
          current += sub;
        }
      }
      continue;
    }

    if (current.length + segment.length > maxChars) {
      if (current.length > 0) {
        chunks.push(current);
      }
      current = segment;
    } else {
      current += segment;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function chunkBySize(text, maxChars) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxChars));
    i += maxChars;
  }
  return chunks;
}
