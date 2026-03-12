/**
 * Parses [REVISIT: filename, reason] markers from synthesis output text.
 *
 * @param {string} text - Synthesis output text
 * @returns {Array<{filename: string, reason: string, status: string}>}
 */
export function parseRevisitMarkers(text) {
  if (!text) return [];

  const markers = [];
  const regex = /\[REVISIT:\s*(.+?),\s*(.+?)\]/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    markers.push({
      filename: match[1].trim(),
      reason: match[2].trim(),
      status: 'queued',
    });
  }

  return markers;
}
