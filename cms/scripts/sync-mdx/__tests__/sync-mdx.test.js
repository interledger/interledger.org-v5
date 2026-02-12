const { describe, it, expect, afterEach } = require('bun:test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const matter = require('gray-matter');

const { scanMDXFiles } = require('../scan');
const { buildEntryData, syncContentType, getEntryField } = require('../sync');

const tempDirs = new Set();

function makeTmpDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-mdx-'));
  tempDirs.add(tmpDir);
  return tmpDir;
}

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.clear();
});

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe('gray-matter parsing', () => {
  it('parses frontmatter and content', () => {
    const tmpDir = makeTmpDir();
    const filePath = path.join(tmpDir, 'sample.mdx');
    const fileContent = [
      '---',
      'title: "Hello"',
      'slug: "hello"',
      'order: 2',
      '---',
      '',
      'Body content'
    ].join('\n');
    writeFile(filePath, fileContent);

    const { data: frontmatter, content } = matter(fileContent);
    expect(frontmatter.title).toBe('Hello');
    expect(frontmatter.slug).toBe('hello');
    expect(frontmatter.order).toBe(2);
    expect(content.trim()).toBe('Body content');
  });
});

describe('getEntryField', () => {
  it('returns top-level field for Strapi v5 flat response', () => {
    const entry = { documentId: 'doc-1', slug: 'hello', content: '<p>Hi</p>' };
    expect(getEntryField(entry, 'content')).toBe('<p>Hi</p>');
    expect(getEntryField(entry, 'slug')).toBe('hello');
  });

  it('falls back to attributes for Strapi v4-style response', () => {
    const entry = { attributes: { content: '<p>Legacy</p>' } };
    expect(getEntryField(entry, 'content')).toBe('<p>Legacy</p>');
  });

  it('returns null for missing field', () => {
    expect(getEntryField({ slug: 'x' }, 'content')).toBeNull();
    expect(getEntryField(null, 'content')).toBeNull();
  });
});

describe('scanMDXFiles', () => {
  it('scans base and locale directories', () => {
    const tmpDir = makeTmpDir();
    const contentRoot = path.join(tmpDir, 'src', 'content');
    const blogDir = path.join(contentRoot, 'blog');
    const esBlogDir = path.join(contentRoot, 'es', 'blog');

    writeFile(
      path.join(blogDir, '2026-01-01-hello.mdx'),
      ['---', 'title: "Hello"', '---', '', 'Hi'].join('\n')
    );

    writeFile(
      path.join(esBlogDir, '2026-01-01-hola.mdx'),
      ['---', 'title: "Hola"', 'locale: "es"', 'localizes: "hello"', '---']
        .join('\n')
    );

    const contentTypes = {
      blog: { dir: blogDir }
    };

    const results = scanMDXFiles('blog', contentTypes);
    expect(results.length).toBe(2);

    const english = results.find((item) => item.locale === 'en');
    const spanish = results.find((item) => item.locale === 'es');

    expect(english.slug).toBe('hello');
    expect(english.isLocalization).toBe(false);
    expect(spanish.slug).toBe('hola');
    expect(spanish.isLocalization).toBe(true);
    expect(spanish.localizes).toBe('hello');
  });

  it('derives slug from filename and respects frontmatter slug and locale', () => {
    const tmpDir = makeTmpDir();
    const contentRoot = path.join(tmpDir, 'src', 'content');
    const blogDir = path.join(contentRoot, 'blog');
    const frBlogDir = path.join(contentRoot, 'fr', 'blog');

    writeFile(
      path.join(blogDir, '2026-02-02-hello-world.mdx'),
      ['---', 'title: "Hello"', '---', '', 'Hi'].join('\n')
    );

    writeFile(
      path.join(blogDir, 'custom.mdx'),
      ['---', 'title: "Custom"', 'slug: "custom-slug"', '---'].join('\n')
    );

    writeFile(
      path.join(frBlogDir, 'bonjour.mdx'),
      ['---', 'title: "Bonjour"', 'locale: "fr-CA"', '---'].join('\n')
    );

    writeFile(path.join(blogDir, 'ignore.txt'), 'skip');

    const contentTypes = {
      blog: { dir: blogDir }
    };

    const results = scanMDXFiles('blog', contentTypes);
    expect(results.length).toBe(3);

    const dated = results.find((item) => item.slug === 'hello-world');
    const custom = results.find((item) => item.slug === 'custom-slug');
    const french = results.find((item) => item.locale === 'fr-CA');

    expect(dated).toBeTruthy();
    expect(custom).toBeTruthy();
    expect(french.isLocalization).toBe(true);
  });
});

describe('buildEntryData', () => {
  it('builds paragraph content for pages from MDX body', () => {
    const mdx = {
      frontmatter: { title: 'Hello' },
      slug: 'hello',
      content: '# Hi there'
    };
    const data = buildEntryData('foundation-pages', mdx);
    expect(Array.isArray(data.content)).toBe(true);
    expect(data.content[0].__component).toBe('blocks.paragraph');
    expect(data.content[0].content).toContain('<h1>Hi there</h1>');
  });

  it('preserves existing content when MDX body is empty', () => {
    const mdx = {
      frontmatter: { title: 'Hello' },
      slug: 'hello',
      content: '   '
    };
    const existingEntry = {
      attributes: {
        content: [{ __component: 'blocks.paragraph', content: '<p>Keep</p>' }]
      }
    };
    const data = buildEntryData('foundation-pages', mdx, existingEntry);
    expect(data.content).toEqual(existingEntry.attributes.content);
  });

  it('preserves hero when not provided', () => {
    const mdx = {
      frontmatter: { title: 'Summit' },
      slug: 'summit',
      content: 'Body'
    };
    const existingEntry = {
      attributes: {
        hero: { title: 'Existing', description: 'Keep' }
      }
    };
    const data = buildEntryData('summit-pages', mdx, existingEntry);
    expect(data.hero).toEqual(existingEntry.attributes.hero);
  });

  it('builds hero from frontmatter when provided', () => {
    const mdx = {
      frontmatter: {
        title: 'Foundation',
        heroTitle: 'Hero Title',
        heroDescription: 'Hero Description'
      },
      slug: 'foundation',
      content: 'Body'
    };
    const data = buildEntryData('foundation-pages', mdx);
    expect(data.hero).toEqual({
      title: 'Hero Title',
      description: 'Hero Description'
    });
  });

  it('builds blog entries with HTML content and publishedAt', () => {
    const mdx = {
      frontmatter: {
        title: 'Blog Title',
        description: 'Blog Desc',
        date: '2026-01-01'
      },
      slug: 'blog-title',
      content: 'Hello **world**'
    };
    const data = buildEntryData('blog', mdx);
    expect(data.title).toBe('Blog Title');
    expect(data.description).toBe('Blog Desc');
    expect(data.slug).toBe('blog-title');
    expect(data.date).toBe('2026-01-01');
    expect(data.content).toContain('<p>');
    expect(typeof data.publishedAt).toBe('string');
  });
});

describe('syncContentType', () => {
  it('matches locale file via localizes field', async () => {
    const tmpDir = makeTmpDir();
    const contentRoot = path.join(tmpDir, 'src', 'content');
    const summitDir = path.join(contentRoot, 'summit');
    const esSummitDir = path.join(contentRoot, 'es', 'summit');

    writeFile(
      path.join(summitDir, 'about.mdx'),
      ['---', 'title: "About"', '---', '', 'Body'].join('\n')
    );

    writeFile(
      path.join(esSummitDir, 'sobre-nosotros.mdx'),
      [
        '---',
        'title: "Sobre Nosotros"',
        'locale: "es"',
        'localizes: "about"',
        '---',
        '',
        'Contenido'
      ].join('\n')
    );

    const existingEntry = {
      documentId: 'doc-about',
      slug: 'about',
      locale: 'en'
    };

    const calls = { createLocalization: 0 };

    const strapi = {
      getAllEntries: async () => [existingEntry],
      findBySlug: async (apiId, slug, locale) => {
        if (locale === 'en' && slug === 'about') return existingEntry;
        return null;
      },
      createLocalization: async () => {
        calls.createLocalization++;
      },
      updateLocalization: async () => {},
      updateEntry: async () => ({ data: existingEntry }),
      createEntry: async () => ({ data: existingEntry }),
      deleteEntry: async () => {}
    };

    const contentTypes = {
      'summit-pages': { dir: summitDir, apiId: 'summit-pages' }
    };

    await syncContentType('summit-pages', {
      contentTypes,
      strapi,
      DRY_RUN: false
    });

    // Import-only: match via localizes and create localization in Strapi
    expect(calls.createLocalization).toBe(1);
  });

  it('creates English entry without modifying MDX (import-only)', async () => {
    const tmpDir = makeTmpDir();
    const contentRoot = path.join(tmpDir, 'src', 'content');
    const summitDir = path.join(contentRoot, 'summit');

    const originalContent = ['---', 'title: "New Page"', '---', '', 'Body'].join('\n');
    writeFile(path.join(summitDir, 'new-page.mdx'), originalContent);

    const createdEntry = {
      documentId: 'new-doc-id',
      slug: 'new-page',
      locale: 'en'
    };

    const strapi = {
      getAllEntries: async () => [],
      findBySlug: async () => null,
      createLocalization: async () => {},
      updateLocalization: async () => {},
      updateEntry: async () => ({ data: createdEntry }),
      createEntry: async () => ({ data: createdEntry }),
      deleteEntry: async () => {}
    };

    const contentTypes = {
      'summit-pages': { dir: summitDir, apiId: 'summit-pages' }
    };

    await syncContentType('summit-pages', {
      contentTypes,
      strapi,
      DRY_RUN: false
    });

    // Import-only: MDX file unchanged
    const englishContent = fs.readFileSync(path.join(summitDir, 'new-page.mdx'), 'utf-8');
    expect(englishContent).toBe(originalContent);
    expect(englishContent).not.toContain('contentId');
  });

  it('creates localization for summit pages using localizes field', async () => {
    const tmpDir = makeTmpDir();
    const contentRoot = path.join(tmpDir, 'src', 'content');
    const summitDir = path.join(contentRoot, 'summit');
    const esSummitDir = path.join(contentRoot, 'es', 'summit');

    writeFile(
      path.join(summitDir, 'code-of-conduct.mdx'),
      ['---', 'title: "Code of Conduct"', '---', '', 'Body'].join('\n')
    );

    writeFile(
      path.join(esSummitDir, 'codigo-de-conducta.mdx'),
      [
        '---',
        'title: "Código de conducta"',
        'locale: "es"',
        'localizes: "code-of-conduct"',
        '---',
        '',
        'Contenido'
      ].join('\n')
    );

    const existingEntry = {
      documentId: 'doc-1',
      slug: 'code-of-conduct',
      locale: 'en'
    };

    const calls = {
      createLocalization: 0,
      updateLocalization: 0,
      updateEntry: 0,
      createEntry: 0,
      deleteEntry: 0,
      findBySlug: []
    };

    const strapi = {
      getAllEntries: async () => [existingEntry],
      findBySlug: async (apiId, slug, locale) => {
        calls.findBySlug.push({ apiId, slug, locale });
        if (locale === 'en' && slug === 'code-of-conduct') return existingEntry;
        return null;
      },
      createLocalization: async () => {
        calls.createLocalization++;
      },
      updateLocalization: async () => {
        calls.updateLocalization++;
      },
      updateEntry: async () => {
        calls.updateEntry++;
        return { data: existingEntry };
      },
      createEntry: async () => {
        calls.createEntry++;
        return { data: { documentId: 'doc-1', slug: 'code-of-conduct' } };
      },
      deleteEntry: async () => {
        calls.deleteEntry++;
      }
    };

    const contentTypes = {
      'summit-pages': { dir: summitDir, apiId: 'summit-pages' }
    };

    await syncContentType('summit-pages', {
      contentTypes,
      strapi,
      DRY_RUN: false
    });

    expect(calls.createLocalization).toBe(1);
    expect(calls.updateLocalization).toBe(0);
  });

  it('syncs localization to Strapi without modifying MDX (import-only)', async () => {
    const tmpDir = makeTmpDir();
    const contentRoot = path.join(tmpDir, 'src', 'content');
    const summitDir = path.join(contentRoot, 'summit');
    const esSummitDir = path.join(contentRoot, 'es', 'summit');

    const spanishOriginal = [
      '---',
      'title: "Sobre Nosotros"',
      'locale: "es"',
      'localizes: "new-english-slug"',
      '---',
      '',
      'Contenido'
    ].join('\n');

    writeFile(
      path.join(summitDir, 'new-english-slug.mdx'),
      ['---', 'title: "About Us"', '---', '', 'Body'].join('\n')
    );
    writeFile(path.join(esSummitDir, 'sobre-nosotros.mdx'), spanishOriginal);

    const existingEntry = {
      documentId: 'shared-content-id',
      slug: 'new-english-slug',
      locale: 'en'
    };

    const strapi = {
      getAllEntries: async () => [existingEntry],
      findBySlug: async (apiId, slug, locale) => {
        if (locale === 'en' && slug === 'new-english-slug') return existingEntry;
        return null;
      },
      createLocalization: async () => {},
      updateLocalization: async () => {},
      updateEntry: async () => ({ data: existingEntry }),
      createEntry: async () => ({ data: existingEntry }),
      deleteEntry: async () => {}
    };

    const contentTypes = {
      'summit-pages': { dir: summitDir, apiId: 'summit-pages' }
    };

    await syncContentType('summit-pages', {
      contentTypes,
      strapi,
      DRY_RUN: false
    });

    // Import-only: MDX file unchanged
    const localeContent = fs.readFileSync(path.join(esSummitDir, 'sobre-nosotros.mdx'), 'utf-8');
    expect(localeContent).toBe(spanishOriginal);
  });

  it('does not call mutating Strapi methods in dry-run', async () => {
    const tmpDir = makeTmpDir();
    const contentRoot = path.join(tmpDir, 'src', 'content');
    const summitDir = path.join(contentRoot, 'summit');

    writeFile(
      path.join(summitDir, 'code-of-conduct.mdx'),
      ['---', 'title: "Code of Conduct"', '---', '', 'Body'].join('\n')
    );

    const calls = {
      createLocalization: 0,
      updateLocalization: 0,
      updateEntry: 0,
      createEntry: 0,
      deleteEntry: 0
    };

    const strapi = {
      getAllEntries: async () => [],
      findBySlug: async () => null,
      createLocalization: async () => {
        calls.createLocalization++;
      },
      updateLocalization: async () => {
        calls.updateLocalization++;
      },
      updateEntry: async () => {
        calls.updateEntry++;
      },
      createEntry: async () => {
        calls.createEntry++;
      },
      deleteEntry: async () => {
        calls.deleteEntry++;
      }
    };

    const contentTypes = {
      'summit-pages': { dir: summitDir, apiId: 'summit-pages' }
    };

    await syncContentType('summit-pages', {
      contentTypes,
      strapi,
      DRY_RUN: true
    });

    expect(calls.createEntry).toBe(0);
    expect(calls.updateEntry).toBe(0);
    expect(calls.createLocalization).toBe(0);
    expect(calls.updateLocalization).toBe(0);
    expect(calls.deleteEntry).toBe(0);
  });

  it('matches unmatched locale files to Strapi entries via localizes', async () => {
    const tmpDir = makeTmpDir();
    const contentRoot = path.join(tmpDir, 'src', 'content');
    const summitDir = path.join(contentRoot, 'summit');
    const esSummitDir = path.join(contentRoot, 'es', 'summit');

    fs.mkdirSync(summitDir, { recursive: true });

    writeFile(
      path.join(esSummitDir, 'sobre.mdx'),
      [
        '---',
        'title: "Sobre"',
        'locale: "es"',
        'localizes: "about"',
        '---',
        '',
        'Contenido'
      ].join('\n')
    );

    const entry = {
      documentId: 'doc-about',
      slug: 'about',
      locale: 'en'
    };

    const calls = { createLocalization: 0, updateLocalization: 0 };

    const strapi = {
      getAllEntries: async () => [entry],
      findBySlug: async () => null,
      createLocalization: async () => {
        calls.createLocalization++;
      },
      updateLocalization: async () => {
        calls.updateLocalization++;
      },
      updateEntry: async () => ({ data: entry }),
      createEntry: async () => ({ data: entry }),
      deleteEntry: async () => {}
    };

    const contentTypes = {
      'summit-pages': { dir: summitDir, apiId: 'summit-pages' }
    };

    await syncContentType('summit-pages', {
      contentTypes,
      strapi,
      DRY_RUN: false
    });

    expect(calls.createLocalization).toBe(1);
    expect(calls.updateLocalization).toBe(0);

    // Import-only: MDX unchanged (localizes "about" used for matching)
    const localeContent = fs.readFileSync(path.join(esSummitDir, 'sobre.mdx'), 'utf-8');
    expect(localeContent).toContain('localizes: "about"');
  });

  it('deletes orphaned English entries not present in MDX', async () => {
    const tmpDir = makeTmpDir();
    const contentRoot = path.join(tmpDir, 'src', 'content');
    const summitDir = path.join(contentRoot, 'summit');

    writeFile(
      path.join(summitDir, 'keep.mdx'),
      ['---', 'title: "Keep"', '---', '', 'Body'].join('\n')
    );

    const entries = [
      { documentId: 'doc-keep', slug: 'keep', locale: 'en' },
      { documentId: 'doc-remove', slug: 'remove', locale: 'en' }
    ];

    const calls = { deleteEntry: [] };

    const strapi = {
      getAllEntries: async () => entries,
      findBySlug: async (apiId, slug, locale) => {
        if (locale === 'en' && slug === 'keep') return entries[0];
        return null;
      },
      createLocalization: async () => {},
      updateLocalization: async () => {},
      updateEntry: async () => ({ data: entries[0] }),
      createEntry: async () => ({ data: entries[0] }),
      deleteEntry: async (apiId, documentId) => {
        calls.deleteEntry.push(documentId);
      }
    };

    const contentTypes = {
      'summit-pages': { dir: summitDir, apiId: 'summit-pages' }
    };

    await syncContentType('summit-pages', {
      contentTypes,
      strapi,
      DRY_RUN: false
    });

    expect(calls.deleteEntry).toEqual(['doc-remove']);
  });
});
