import { describe, expect, it } from 'vitest'
import { convert } from '../src/convert.js'

/**
 * @typedef {import('../src/types.js').SchemaElement} SchemaElement
 */

describe('convert function', () => {
  const name = 'name'
  it('returns the same data if converted_type is undefined', () => {
    const data = [1, 2, 3]
    const schemaElement = { name }
    expect(convert(data, schemaElement)).toEqual(data)
  })

  it('converts byte arrays to UTF8 strings', () => {
    const data = [new TextEncoder().encode('test'), new TextEncoder().encode('vitest')]
    /** @type {SchemaElement} */
    const schemaElement = { name, converted_type: 'UTF8' }
    expect(convert(data, schemaElement)).toEqual(['test', 'vitest'])
  })

  it('converts numbers to DECIMAL', () => {
    const data = [100, 200]
    /** @type {SchemaElement} */
    const schemaElement = { name, converted_type: 'DECIMAL' }
    expect(convert(data, schemaElement)).toEqual([100, 200])
  })

  it('converts numbers to DECIMAL with scale', () => {
    const data = [100, 200]
    /** @type {SchemaElement} */
    const schemaElement = { name, converted_type: 'DECIMAL', scale: 2 }
    expect(convert(data, schemaElement)).toEqual([1, 2])
  })

  it('converts bigint to DECIMAL', () => {
    const data = [BigInt(1000), BigInt(2000)]
    /** @type {SchemaElement} */
    const schemaElement = { name, converted_type: 'DECIMAL' }
    expect(convert(data, schemaElement)).toEqual([1000n, 2000n])
  })

  it('converts bigint to DECIMAL with scale', () => {
    const data = [BigInt(10), BigInt(20)]
    /** @type {SchemaElement} */
    const schemaElement = { name, converted_type: 'DECIMAL', scale: 2 }
    expect(convert(data, schemaElement)).toEqual([0.1, 0.2])
  })

  it('converts byte arrays to DECIMAL', () => {
    const data = [new Uint8Array([0, 0, 0, 100]), new Uint8Array([0, 0, 0, 200])]
    /** @type {SchemaElement} */
    const schemaElement = { name, converted_type: 'DECIMAL', scale: 0 }
    expect(convert(data, schemaElement)).toEqual([100, 200])
  })

  it('converts epoch time to DATE', () => {
    const data = [1, 2] // days since epoch
    /** @type {SchemaElement} */
    const schemaElement = { name, converted_type: 'DATE' }
    expect(convert(data, schemaElement)).toEqual([new Date(86400000), new Date(86400000 * 2)])
  })

  it('converts milliseconds to TIME_MILLIS', () => {
    const now = Date.now()
    const data = [now]
    /** @type {SchemaElement} */
    const schemaElement = { name, converted_type: 'TIME_MILLIS' }
    expect(convert(data, schemaElement)).toEqual([new Date(now)])
  })

  it('converts INT96 to DATE', () => {
    // from alltypes_plain.parquet
    const data = [45284764452596988585705472n, 45284764452597048585705472n]
    /** @type {SchemaElement} */
    const schemaElement = { name, type: 'INT96' }
    expect(convert(data, schemaElement)).toEqual([new Date('2009-03-01T00:00:00.000Z'), new Date('2009-03-01T00:01:00.000Z')])
  })

  it('parses strings to JSON', () => {
    const data = ['{"key": true}', '{"quay": 314}']
    /** @type {SchemaElement} */
    const schemaElement = { name, converted_type: 'JSON' }
    expect(convert(data, schemaElement)).toEqual([{ key: true }, { quay: 314 }])
  })

  it('throws error for BSON conversion', () => {
    const data = [{}]
    /** @type {SchemaElement} */
    const schemaElement = { name, converted_type: 'BSON' }
    expect(() => convert(data, schemaElement))
      .toThrow('parquet bson not supported')
  })

  it('throws error for INTERVAL conversion', () => {
    const data = [{}]
    /** @type {SchemaElement} */
    const schemaElement = { name, converted_type: 'INTERVAL' }
    expect(() => convert(data, schemaElement))
      .toThrow('parquet interval not supported')
  })
})
