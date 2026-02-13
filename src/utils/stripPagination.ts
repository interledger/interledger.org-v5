export default function stripPagination(path: string) {
  const parts = path.replace(/\/$/, '').split('/');
  return isNaN(Number(parts.at(-1)))
    ? path
    : parts.slice(0, -1).join('/');
}