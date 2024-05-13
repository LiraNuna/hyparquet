import { describe, expect, it } from 'vitest'
import { readPlain } from '../src/plain.js'

describe('readPlain', () => {

  it('reads BOOLEAN values', () => {
    const view = new DataView(new ArrayBuffer(1))
    view.setUint8(0, 0b00000101) // true, false, true
    const reader = { view, offset: 0 }
    const result = readPlain(reader, 'BOOLEAN', 3)
    expect(result).toEqual([true, false, true])
    expect(reader.offset).toBe(1)
  })

  it('reads INT32 values', () => {
    const view = new DataView(new ArrayBuffer(4))
    view.setInt32(0, 123456789, true) // little-endian
    const reader = { view, offset: 0 }
    const result = readPlain(reader, 'INT32', 1)
    expect(result).toEqual(new Int32Array([123456789]))
    expect(reader.offset).toBe(4)
  })

  it('reads INT64 values', () => {
    const view = new DataView(new ArrayBuffer(8))
    view.setBigInt64(0, BigInt('1234567890123456789'), true)
    const reader = { view, offset: 0 }
    const result = readPlain(reader, 'INT64', 1)
    expect(result).toEqual(new BigInt64Array([1234567890123456789n]))
    expect(reader.offset).toBe(8)
  })

  it('reads INT96 values', () => {
    const buffer = new ArrayBuffer(12)
    const view = new DataView(buffer)

    // INT96 value split into 64-bit low part and 32-bit high part
    const low = BigInt('0x0123456789ABCDEF')
    const high = 0x02345678
    view.setBigInt64(0, low, true)
    view.setInt32(8, high, true)
    const reader = { view, offset: 0 }
    const result = readPlain(reader, 'INT96', 1)
    const expectedValue = (BigInt(high) << 64n) | low
    expect(result).toEqual([expectedValue])
    expect(reader.offset).toBe(12)
  })

  it('reads FLOAT values', () => {
    const view = new DataView(new ArrayBuffer(4))
    view.setFloat32(0, 1234.5, true) // little-endian
    const reader = { view, offset: 0 }
    const result = readPlain(reader, 'FLOAT', 1)
    expect(result).toEqual(new Float32Array([1234.5]))
    expect(reader.offset).toBe(4)
  })

  it('reads DOUBLE values', () => {
    const view = new DataView(new ArrayBuffer(8))
    view.setFloat64(0, 12345.6789, true) // little-endian
    const reader = { view, offset: 0 }
    const result = readPlain(reader, 'DOUBLE', 1)
    expect(result).toEqual(new Float64Array([12345.6789]))
    expect(reader.offset).toBe(8)
  })

  it('reads BYTE_ARRAY values', () => {
    const view = new DataView(new ArrayBuffer(10))
    view.setInt32(0, 3, true) // length 3
    view.setUint8(4, 1)
    view.setUint8(5, 2)
    view.setUint8(6, 3)
    const reader = { view, offset: 0 }
    const result = readPlain(reader, 'BYTE_ARRAY', 1)
    expect(result).toEqual([new Uint8Array([1, 2, 3])])
    expect(reader.offset).toBe(7)
  })

  it('reads FIXED_LEN_BYTE_ARRAY values', () => {
    const fixedLength = 3
    const view = new DataView(new ArrayBuffer(fixedLength))
    view.setUint8(0, 4)
    view.setUint8(1, 5)
    view.setUint8(2, 6)
    const reader = { view, offset: 0 }
    const result = readPlain(reader, 'FIXED_LEN_BYTE_ARRAY', fixedLength)
    expect(result).toEqual(new Uint8Array([4, 5, 6]))
    expect(reader.offset).toBe(fixedLength)
  })

  it('throws an error for unhandled types', () => {
    const view = new DataView(new ArrayBuffer(0))
    const reader = { view, offset: 0 }
    /** @type any */
    const invalidType = 'invalidType'
    expect(() => readPlain(reader, invalidType, 1))
      .toThrow(`parquet unhandled type: ${invalidType}`)
  })
})
