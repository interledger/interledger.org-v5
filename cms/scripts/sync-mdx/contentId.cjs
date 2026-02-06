const crypto = require('crypto');
const fs = require('fs');

/**
 * Generate a unique contentId for linking EN/ES content.
 * Uses nanoid-style alphanumeric IDs (21 chars).
 */
function generateContentId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(21);
  let id = '';
  for (let i = 0; i < 21; i++) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}

/**
 * Update or add a frontmatter field in an MDX file.
 * @param {string} filepath - Path to the MDX file
 * @param {string} key - Frontmatter key to update
 * @param {string} value - Value to set
 * @returns {boolean} - Whether the file was modified
 */
function updateMdxFrontmatter(filepath, key, value) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const match = content.match(/^(---\n)([\s\S]*?)(\n---)([\s\S]*)$/);

  if (!match) {
    console.warn(`   ⚠️  Could not parse frontmatter in: ${filepath}`);
    return false;
  }

  const [, openDelim, frontmatterBody, closeDelim, rest] = match;
  const lines = frontmatterBody.split('\n');

  // Check if key already exists
  let keyExists = false;
  let keyIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const colonIndex = lines[i].indexOf(':');
    if (colonIndex > 0) {
      const existingKey = lines[i].substring(0, colonIndex).trim();
      if (existingKey === key) {
        keyExists = true;
        keyIndex = i;
        break;
      }
    }
  }

  const quotedValue = `"${value}"`;

  if (keyExists) {
    // Update existing key
    lines[keyIndex] = `${key}: ${quotedValue}`;
  } else {
    // Add new key after the last line
    lines.push(`${key}: ${quotedValue}`);
  }

  const newContent = openDelim + lines.join('\n') + closeDelim + rest;
  fs.writeFileSync(filepath, newContent, 'utf-8');
  return true;
}

/**
 * Read a specific frontmatter field from an MDX file.
 * @param {string} filepath - Path to the MDX file
 * @param {string} key - Frontmatter key to read
 * @returns {string|null} - Value or null if not found
 */
function readMdxFrontmatterField(filepath, key) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);

  if (!match) return null;

  const lines = match[1].split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const existingKey = line.substring(0, colonIndex).trim();
      if (existingKey === key) {
        let value = line.substring(colonIndex + 1).trim();
        value = value.replace(/^["']|["']$/g, '');
        return value;
      }
    }
  }

  return null;
}

module.exports = {
  generateContentId,
  updateMdxFrontmatter,
  readMdxFrontmatterField
};
