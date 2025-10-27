import he from 'he';

export function sanitizeHtml(input: string) {
  return he.encode(input, { useNamedReferences: true });
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}
