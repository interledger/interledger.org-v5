# Adding a New Component to the MDX Import Pipeline

This guide walks you through wiring up a new JSX component so the MDX → Strapi sync pipeline can parse it into the correct dynamic-zone block payload.

Use the Ambassador handler (`ambassadorHandler.ts`) as the reference implementation.

## Files You Will Touch

| File                                         | What to do                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `cms/src/components/blocks/<name>.json`      | Strapi component schema must exist first                                               |
| `cms/scripts/sync-mdx/types.blocks.ts`       | Add a payload interface + include it in `ParsedBlock` union                            |
| `cms/scripts/sync-mdx/<name>Handler.ts`      | Handler function + registration                                                        |
| `cms/scripts/sync-mdx/<name>Handler.test.ts` | Tests for the handler                                                                  |
| `cms/scripts/sync-mdx/config.ts`             | Side-effect import if handler self-registers (usually just `import './<name>Handler'`) |

## Step-by-Step

### 1. Define the block payload type

In `types.blocks.ts`, add an interface that describes the **Strapi REST API body** (not the schema type). Every block must extend `StrapiBlockBase` and set `__component`.

```ts
export interface MyWidgetBlock extends StrapiBlockBase {
  __component: 'blocks.my-widget'
  title: string
  description?: string
}
```

Add it to the `ParsedBlock` union at the bottom of the file.

### 2. Write the handler (TDD — red first)

Create `<name>Handler.test.ts`. Import `parseMdxToBlocks` and write a test that parses your component's JSX and asserts the expected block output:

```ts
import './myWidgetHandler' // side-effect: registers handler
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'

const ctx: ParserContext = { locale: 'en' }

it('parses <MyWidget title="Hello" />', async () => {
  const blocks = await parseMdxToBlocks('<MyWidget title="Hello" />', ctx)
  expect(blocks).toEqual([{ __component: 'blocks.my-widget', title: 'Hello' }])
})
```

Run it — it should fail with `UNSUPPORTED_COMPONENT` because no handler is registered yet. That's the RED phase.

### 3. Implement the handler

Create `<name>Handler.ts`:

```ts
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx'
import type { ParsedBlock, MyWidgetBlock } from './types.blocks'
import { getStringAttr } from './jsxExtract'
import { registerComponentHandler, type ParserContext } from './mdxBlockParser'

async function handleMyWidget(
  node: MdxJsxFlowElement,
  _ctx: ParserContext
): Promise<ParsedBlock[]> {
  const title = getStringAttr(node, 'title', { required: true })
  const description = getStringAttr(node, 'description')

  const block: MyWidgetBlock = {
    __component: 'blocks.my-widget',
    title
  }
  if (description !== undefined) {
    block.description = description
  }
  return [block]
}

// Self-register on import
registerComponentHandler('MyWidget', handleMyWidget)
```

Run tests — they should go GREEN.

### 4. Wire the handler into the pipeline

In `config.ts`, add the side-effect import so the handler is registered before any sync runs:

```ts
import './<name>Handler'
```

This goes next to the existing `import './ambassadorHandler'` line. That's all that's needed — `buildParsedPagePayload` already passes the parser context through.

**How registration works:** `COMPONENT_HANDLERS` in `mdxBlockParser.ts` is a module-level singleton — Node's module cache guarantees only one instance exists per process. When your handler module calls `registerComponentHandler('MyWidget', handleMyWidget)` at the top level, importing the module is enough to populate the registry. The bare `import './<name>Handler'` in `config.ts` triggers this side-effect before any parsing runs. No explicit init call or factory setup needed.

### 5. Write the full test suite

Cover at minimum:

- [x] Happy path with all required props
- [x] Optional props present vs absent
- [x] Missing required prop → `MISSING_REQUIRED_PROP`
- [x] Dynamic expression in prop → `DYNAMIC_EXPRESSION`
- [x] Mixed content (your component + markdown) → blocks in document order

## Attribute Extractors

Use the helpers in `jsxExtract.ts` — do NOT read AST node attributes directly:

| Helper                                            | Use for         | Example JSX                                          |
| ------------------------------------------------- | --------------- | ---------------------------------------------------- |
| `getStringAttr(node, 'name')`                     | String props    | `title="Hello"`                                      |
| `getStringAttr(node, 'name', { required: true })` | Required string | Throws if missing                                    |
| `getBooleanAttr(node, 'name')`                    | Boolean props   | `showLinks`, `showLinks={true}`, `showLinks={false}` |
| `getStringArrayAttr(node, 'name')`                | String arrays   | `slugs={["a","b"]}` or `slugs={['a','b']}`           |

All extractors throw `MdxParserError` with the right error code on bad input. They handle single and double quotes in arrays.

## Relation Fields (Gotcha: Strapi v5 Connect Syntax)

If your component has a relation field (e.g. linking to another content type), you **must** wrap the resolved documentId in Strapi v5's `connect` syntax.

**Correct**:

```ts
ambassador: {
  connect: [{ documentId: 'abc123' }]
}
```

For arrays of relations:

```ts
ambassadors: {
  connect: [{ documentId: 'abc' }, { documentId: 'def' }]
}
```

Use `ctx.resolveRelation!(apiId, slug)` to resolve slugs to document IDs. The resolver handles locale fallback automatically.

```ts
const { documentId } = await ctx.resolveRelation!('ambassadors', slug)
const block = {
  __component: 'blocks.ambassador',
  ambassador: { connect: [{ documentId }] }
}
```

## Error Handling

The parser is **strict by design**. Do not silently skip or default on bad input.

- Missing required props → throw `MISSING_REQUIRED_PROP`
- Dynamic expressions → throw `DYNAMIC_EXPRESSION`
- Unresolved relation slugs → throw `UNRESOLVED_RELATION`
- Unknown components → throw `UNSUPPORTED_COMPONENT` (handled by the core parser, not your handler)

`buildPagePayload` in `mdxTransformer.ts` catches `MdxParserError` and re-throws with the file slug prepended for easier debugging.

## Testing Utilities

- `parseMdxToBlocks(mdxBody, ctx)` — end-to-end: MDX string → block array. Use this for handler integration tests.
- `createMdxFile({ slug, frontmatter, content })` — from `test-utils.ts`, creates an `MDXFile` object for `buildPagePayload` tests.
- For resolver tests, create a mock: `async (_apiId, slug) => ({ documentId: \`doc-\${slug}\` })`

## Checklist Before Opening PR

- [ ] Block type added to `types.blocks.ts` and included in `ParsedBlock` union
- [ ] Handler created and self-registers via `registerComponentHandler()`
- [ ] Side-effect import added in `config.ts`
- [ ] All attribute extraction uses `jsxExtract.ts` helpers (no raw AST access)
- [ ] Relation fields use `{ connect: [...] }` syntax
- [ ] Optional fields omitted from payload when `undefined` (don't send `undefined` — let Strapi schema defaults apply)
- [ ] Tests cover: happy path, optional props, missing required, dynamic expression, mixed content
- [ ] `pnpm --dir cms test:sync-mdx` all green
- [ ] `pnpm --dir cms run sync:mdx:dry-run` no new errors
