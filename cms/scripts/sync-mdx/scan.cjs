const fs = require('fs');
const path = require('path');
const { parseMDX } = require('./mdx');

function scanDirectory({ baseDir, locale, isLocalization }) {
  const mdxFiles = [];

  if (!fs.existsSync(baseDir)) {
    return mdxFiles;
  }

  const files = fs.readdirSync(baseDir);
  for (const file of files) {
    if (!file.endsWith('.mdx')) continue;

    const filepath = path.join(baseDir, file);
    const { frontmatter, content } = parseMDX(filepath);

    let slug = frontmatter.slug;
    if (!slug) {
      slug = file.replace(/\.mdx$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
    }

    mdxFiles.push({
      file,
      filepath,
      slug,
      locale: frontmatter.locale || locale,
      frontmatter,
      content,
      isLocalization,
      localizes: frontmatter.localizes || null
    });
  }

  return mdxFiles;
}

function scanMDXFiles(contentType, contentTypes) {
  const config = contentTypes[contentType];
  const baseDir = config.dir;
  const mdxFiles = [];

  // Base directory (default locale)
  mdxFiles.push(
    ...scanDirectory({
      baseDir,
      locale: 'en',
      isLocalization: false
    })
  );

  // Locale directories: src/content/<locale>/<contentTypeDir>
  const contentDir = path.dirname(baseDir);
  if (!fs.existsSync(contentDir)) {
    return mdxFiles;
  }

  const localeDirs = fs.readdirSync(contentDir, { withFileTypes: true });
  for (const localeDir of localeDirs) {
    if (!localeDir.isDirectory()) continue;
    if (localeDir.name === path.basename(baseDir)) continue;

    const localeContentDir = path.join(
      contentDir,
      localeDir.name,
      path.basename(baseDir)
    );

    if (!fs.existsSync(localeContentDir)) continue;

    mdxFiles.push(
      ...scanDirectory({
        baseDir: localeContentDir,
        locale: localeDir.name,
        isLocalization: true
      })
    );
  }

  return mdxFiles;
}

module.exports = {
  scanMDXFiles
};
