# Adding a New Component to the MDX Import Pipeline

Use this guide to add a JSX component handler for `sync:mdx`.
Reference implementation: `ambassadorHandler.ts`.

## Files to Touch

| File                                         | Change |
| -------------------------------------------- | ------ |
| `cms/src/components/blocks/<name>.json`      | Ensure Strapi block schema exists |
| `cms/scripts/sync-mdx/types.blocks.ts`       | Add payload interface and include it in `ParsedBlock` |
| `cms/scripts/sync-mdx/<name>Handler.ts`      | Add handler and `registerComponentHandler()` call |
| `cms/scripts/sync-mdx/<name>Handler.test.ts` | Add parser + handler tests |
| `cms/scripts/sync-mdx/config.ts`             | Add side-effect import: `import './<name>Handler'` |

## Steps

### 1. Add block payload type

In `types.blocks.ts`, define the REST payload shape:

```ts
export interface MyWidgetBlock extends StrapiBlockBase {
  __component: 'blocks.my-widget'
  title: string
  description?: string
}
```

Add `MyWidgetBlock` to `ParsedBlock`.

### 2. Start with a red test

Do not import your handler yet. Assert unregistered JSX fails with `UNSUPPORTED_COMPONENT`:

```ts
import { parseMdxToBlocks } from './mdxBlockParser'
import { ParserErrorCode } from './parserErrors'

it('fails before MyWidget is registered', async () => {
  await expect(
    parseMdxToBlocks('<MyWidget title="Hello" />', { locale: 'en' })
  ).rejects.toMatchObject({ code: ParserErrorCode.UNSUPPORTED_COMPONENT })
})
```

### 3. Implement handler

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

registerComponentHandler('MyWidget', handleMyWidget)
```

### 4. Update test to green

Import the handler for side-effect registration, then assert output:

```ts
import './myWidgetHandler'
import { parseMdxToBlocks } from './mdxBlockParser'

it('parses <MyWidget />', async () => {
  const blocks = await parseMdxToBlocks('<MyWidget title="Hello" />', {
    locale: 'en'
  })

  expect(blocks).toEqual([
    { __component: 'blocks.my-widget', title: 'Hello' }
  ])
})
```

### 5. Register for real sync runs

In `config.ts`, add:

```ts
import './<name>Handler'
```

Handler modules register against the singleton `COMPONENT_HANDLERS` map in `mdxBlockParser.ts`. Importing the module is enough.

## Attribute Helpers

Use `jsxExtract.ts`. Do not read `node.attributes` directly.

| Helper | Use |
| ------ | --- |
| `getStringAttr(node, 'name')` | Optional string |
| `getStringAttr(node, 'name', { required: true })` | Required string |
| `getBooleanAttr(node, 'name')` | Boolean or valueless boolean |
| `getStringArrayAttr(node, 'name')` | Static string arrays like `slugs={["a","b"]}` |

Invalid input must raise `MdxParserError`.

## Relation Fields

For relation fields inside blocks, use Strapi v5 `connect` syntax:

```ts
ambassador: {
  connect: [{ documentId: 'abc123' }]
}
```

For arrays:

```ts
ambassadors: {
  connect: [{ documentId: 'abc' }, { documentId: 'def' }]
}
```

Resolve slugs with `ctx.resolveRelation!(apiId, slug)`:

```ts
const { documentId } = await ctx.resolveRelation!('ambassadors', slug)
```

## Error Rules

Do not silently skip bad input.

- Missing required prop: `MISSING_REQUIRED_PROP`
- Non-static expression: `DYNAMIC_EXPRESSION`
- Unresolved relation slug: `UNRESOLVED_RELATION`
- Unknown JSX component: `UNSUPPORTED_COMPONENT` (core parser)

`buildPagePayload` in `mdxTransformer.ts` rethrows parser errors with the MDX slug in the message.

## Minimum Test Coverage

- Happy path
- Optional prop present and absent
- Missing required prop
- Dynamic expression in prop
- Mixed markdown + JSX order preservation

## PR Checklist

- [ ] Added block type in `types.blocks.ts` and `ParsedBlock`
- [ ] Added handler with `registerComponentHandler()`
- [ ] Added side-effect import in `config.ts`
- [ ] Used `jsxExtract.ts` helpers only
- [ ] Used relation `{ connect: [...] }` shape where needed
- [ ] Omitted optional fields when `undefined`
- [ ] Added coverage listed above
- [ ] `pnpm --dir cms test:sync-mdx` passes
- [ ] `pnpm --dir cms run sync:mdx:dry-run` has no new errors
