const fs = require('fs');
const { NUMERIC_FIELDS } = require('./config');

function parseMDX(filepath, numericFields = NUMERIC_FIELDS) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---(?:\n([\s\S]*))?$/);

  if (!match) return { frontmatter: {}, content: '' };

  const frontmatter = {};
  const lines = match[1].split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();

      value = value.replace(/^["']|["']$/g, '');

      if (numericFields.includes(key) && /^\d+$/.test(value)) {
        value = parseInt(value, 10);
      }

      frontmatter[key] = value;
    }
  }

  return { frontmatter, content: (match[2] || '').trim() };
}

module.exports = {
  parseMDX
};
