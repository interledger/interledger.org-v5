import { describe, it, expect } from 'vitest'
import { MdxParserError, ParserErrorCode } from './parserErrors'

describe('MdxParserError', () => {
  it('sets code, message, and component', () => {
    const err = new MdxParserError({
      code: ParserErrorCode.MISSING_REQUIRED_PROP,
      message: 'Required prop "slug" is missing.',
      component: 'Ambassador',
      prop: 'slug'
    })

    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(MdxParserError)
    expect(err.name).toBe('MdxParserError')
    expect(err.code).toBe(ParserErrorCode.MISSING_REQUIRED_PROP)
    expect(err.component).toBe('Ambassador')
    expect(err.prop).toBe('slug')
    expect(err.message).toContain('Ambassador')
    expect(err.message).toContain('slug')
  })

  it('includes line/column in message when provided', () => {
    const err = new MdxParserError({
      code: ParserErrorCode.UNSUPPORTED_COMPONENT,
      message: 'Unsupported JSX component "Foo".',
      component: 'Foo',
      line: 5,
      column: 3
    })

    expect(err.line).toBe(5)
    expect(err.column).toBe(3)
    expect(err.message).toContain('line 5:3')
  })

  it('omits location from message when line is not provided', () => {
    const err = new MdxParserError({
      code: ParserErrorCode.MDX_PARSE_ERROR,
      message: 'Failed to parse MDX.'
    })

    expect(err.line).toBeUndefined()
    expect(err.message).not.toContain('line')
    expect(err.message).toContain('[parser]')
  })

  it('exposes all error codes', () => {
    expect(ParserErrorCode.UNSUPPORTED_COMPONENT).toBe('UNSUPPORTED_COMPONENT')
    expect(ParserErrorCode.MISSING_REQUIRED_PROP).toBe('MISSING_REQUIRED_PROP')
    expect(ParserErrorCode.INVALID_PROP_VALUE).toBe('INVALID_PROP_VALUE')
    expect(ParserErrorCode.DYNAMIC_EXPRESSION).toBe('DYNAMIC_EXPRESSION')
    expect(ParserErrorCode.MDX_PARSE_ERROR).toBe('MDX_PARSE_ERROR')
    expect(ParserErrorCode.UNRESOLVED_RELATION).toBe('UNRESOLVED_RELATION')
    expect(ParserErrorCode.CONFLICTING_PROPS).toBe('CONFLICTING_PROPS')
  })
})
