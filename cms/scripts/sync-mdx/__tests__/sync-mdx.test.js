const { describe, it, expect } = require('bun:test');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { scanMDXFiles } = require('../scan');
const { buildEntryData, syncContentType, updateMdxFrontmatter } = require('../sync');

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe('gray-matter parsing', () => {
  it('parses frontmatter and content', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-mdx-'));
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

describe('updateMdxFrontmatter', () => {
  it('adds a new field to frontmatter', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-mdx-'));
    const filePath = path.join(tmpDir, 'test.mdx');
    writeFile(
      filePath,
      ['---', 'title: "Hello"', 'slug: "hello"', '---', '', 'Body'].join('\n')
    );

    updateMdxFrontmatter(filePath, 'contentId', 'abc123');

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('contentId: abc123');
    expect(content).toContain('title: Hello');
    expect(content).toContain('slug: hello');
  });

  it('updates an existing field in frontmatter', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-mdx-'));
    const filePath = path.join(tmpDir, 'test.mdx');
    writeFile(
      filePath,
      [
        '---',
        'title: "Hello"',
        'contentId: "old-value"',
        '---',
        '',
        'Body'
      ].join('\n')
    );

    updateMdxFrontmatter(filePath, 'contentId', 'new-value');

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('contentId: new-value');
    expect(content).not.toContain('old-value');
  });

  it('preserves other fields when updating', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-mdx-'));
    const filePath = path.join(tmpDir, 'test.mdx');
    writeFile(
      filePath,
      [
        '---',
        'title: "Hello"',
        'localizes: "english-slug"',
        'locale: "es"',
        '---',
        '',
        'Body'
      ].join('\n')
    );

    updateMdxFrontmatter(filePath, 'contentId', 'abc123');

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('contentId: abc123');
    expect(content).toContain('localizes: english-slug');
    expect(content).toContain('locale: es');
    expect(content).toContain('title: Hello');
  });
});

describe('scanMDXFiles', () => {
  it('scans base and locale directories', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-mdx-'));
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
});

describe('syncContentType', () => {
  it('matches locale file via localizes field', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-mdx-'));
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
      summitPages: { dir: summitDir, apiId: 'summit-pages' }
    };

    await syncContentType('summitPages', {
      contentTypes,
      strapi,
      DRY_RUN: false
    });

    // Should match via localizes field and create localization
    expect(calls.createLocalization).toBe(1);

    // Should write contentId to locale file
    const localeContent = fs.readFileSync(
      path.join(esSummitDir, 'sobre-nosotros.mdx'),
      'utf-8'
    );
    expect(localeContent).toContain('contentId: doc-about');
    expect(localeContent).toContain('localizes: about');
  });

  it('writes contentId to English file after sync', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-mdx-'));
    const contentRoot = path.join(tmpDir, 'src', 'content');
    const summitDir = path.join(contentRoot, 'summit');

    writeFile(
      path.join(summitDir, 'new-page.mdx'),
      ['---', 'title: "New Page"', '---', '', 'Body'].join('\n')
    );

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
      summitPages: { dir: summitDir, apiId: 'summit-pages' }
    };

    await syncContentType('summitPages', {
      contentTypes,
      strapi,
      DRY_RUN: false
    });

    // Should write contentId to English file
    const englishContent = fs.readFileSync(
      path.join(summitDir, 'new-page.mdx'),
      'utf-8'
    );
    expect(englishContent).toContain('contentId: new-doc-id');
  });

  it('creates localization for summit pages using contentId slug match', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-mdx-'));
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
        'contentId: "code-of-conduct"',
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
      summitPages: { dir: summitDir, apiId: 'summit-pages' }
    };

    await syncContentType('summitPages', {
      contentTypes,
      strapi,
      DRY_RUN: false
    });

    expect(calls.createLocalization).toBe(1);
    expect(calls.updateLocalization).toBe(0);
  });

  it('updates localizes field when English slug changes', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-mdx-'));
    const contentRoot = path.join(tmpDir, 'src', 'content');
    const summitDir = path.join(contentRoot, 'summit');
    const esSummitDir = path.join(contentRoot, 'es', 'summit');

    // English file with NEW slug but same contentId
    writeFile(
      path.join(summitDir, 'new-english-slug.mdx'),
      [
        '---',
        'title: "About Us"',
        'contentId: "shared-content-id"',
        '---',
        '',
        'Body'
      ].join('\n')
    );

    // Spanish file with OLD localizes value but same contentId
    writeFile(
      path.join(esSummitDir, 'sobre-nosotros.mdx'),
      [
        '---',
        'title: "Sobre Nosotros"',
        'locale: "es"',
        'contentId: "shared-content-id"',
        'localizes: "old-english-slug"',
        '---',
        '',
        'Contenido'
      ].join('\n')
    );

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
      summitPages: { dir: summitDir, apiId: 'summit-pages' }
    };

    await syncContentType('summitPages', {
      contentTypes,
      strapi,
      DRY_RUN: false
    });

    // Should update localizes field to new English slug
    const localeContent = fs.readFileSync(
      path.join(esSummitDir, 'sobre-nosotros.mdx'),
      'utf-8'
    );
    expect(localeContent).toContain('localizes: new-english-slug');
    expect(localeContent).not.toContain('localizes: old-english-slug');
  });

  it('does not call mutating Strapi methods in dry-run', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-mdx-'));
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
      summitPages: { dir: summitDir, apiId: 'summit-pages' }
    };

    await syncContentType('summitPages', {
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
});
