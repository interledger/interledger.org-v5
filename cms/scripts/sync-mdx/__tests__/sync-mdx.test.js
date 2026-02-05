const { describe, it, expect } = require('bun:test');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { parseMDX } = require('../mdx');
const { markdownToHTML } = require('../markdown');
const { scanMDXFiles } = require('../scan');

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe('parseMDX', () => {
  it('parses frontmatter and content', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-mdx-'));
    const filePath = path.join(tmpDir, 'sample.mdx');
    writeFile(
      filePath,
      [
        '---',
        'title: "Hello"',
        'slug: "hello"',
        'order: 2',
        '---',
        '',
        'Body content'
      ].join('\n')
    );

    const result = parseMDX(filePath);
    expect(result.frontmatter.title).toBe('Hello');
    expect(result.frontmatter.slug).toBe('hello');
    expect(result.frontmatter.order).toBe(2);
    expect(result.content).toBe('Body content');
  });
});

describe('markdownToHTML', () => {
  it('converts basic markdown to HTML', () => {
    const html = markdownToHTML('# Title\n\n**Bold** and *italics*');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('<em>italics</em>');
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
