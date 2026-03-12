export function sanitizeFilename(str) {
  return str
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\-]/g, '');
}

export function sanitizeTitle(str) {
  return sanitizeFilename(str);
}

export function getOutputFileName(passTitle, fileName) {
  const sanitizedTitle = sanitizeTitle(passTitle);
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  const sanitizedFile = sanitizeFilename(baseName);
  return `${sanitizedTitle}_${sanitizedFile}.md`;
}

export function getCollatedFileName(fileName) {
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  const sanitizedFile = sanitizeFilename(baseName);
  return `${sanitizedFile}_collated.md`;
}
