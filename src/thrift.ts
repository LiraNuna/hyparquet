import type { Decoded } from './types.ts'

// TCompactProtocol types
const CompactType = {
  STOP: 0,
  TRUE: 1,
  FALSE: 2,
  BYTE: 3,
  I16: 4,
  I32: 5,
  I64: 6,
  DOUBLE: 7,
  BINARY: 8,
  LIST: 9,
  SET: 10,
  MAP: 11,
  STRUCT: 12,
  UUID: 13,
}

/**
 * Parse TCompactProtocol
 */
export function deserializeTCompactProtocol(buffer: ArrayBuffer): Decoded<Record<string, any>> {
  const view = new DataView(buffer)
  let byteLength = 0
  let lastFid = 0
  const value: Record<string, any> = {}

  while (byteLength < buffer.byteLength) {
    // Parse each field based on its type and add to the result object
    const [type, fid, newIndex, newLastFid] = readFieldBegin(view, byteLength, lastFid)
    byteLength = newIndex
    lastFid = newLastFid

    if (type === CompactType.STOP) {
      break
    }

    // Handle the field based on its type
    let fieldValue
    [fieldValue, byteLength] = readElement(view, type, byteLength)
    value[`field_${fid}`] = fieldValue
  }

  return { value, byteLength }
}

/**
 * Read a single element based on its type
 * @returns [value, newIndex]
 */
function readElement(view: DataView, type: number, index: number): [any, number] {
  switch (type) {
  case CompactType.TRUE:
    return [true, index]
  case CompactType.FALSE:
    return [false, index]
  case CompactType.BYTE:
    // read byte directly
    return [view.getInt8(index), index + 1]
  case CompactType.I16:
  case CompactType.I32:
    return readZigZag(view, index)
  case CompactType.I64:
    return readZigZagBigInt(view, index)
  case CompactType.DOUBLE:
    return [view.getFloat64(index, true), index + 8]
  case CompactType.BINARY: {
    // strings are encoded as utf-8, no \0 delimiter
    const [stringLength, stringIndex] = readVarInt(view, index)
    const strBytes = new Uint8Array(view.buffer, stringIndex, stringLength)
    return [new TextDecoder().decode(strBytes), stringIndex + stringLength]
  }
  case CompactType.LIST: {
    const [elemType, listSize, listIndex] = readCollectionBegin(view, index)
    index = listIndex
    const listValues = []
    for (let i = 0; i < listSize; i++) {
      let listElem
      [listElem, index] = readElement(view, elemType, index)
      listValues.push(listElem)
    }
    return [listValues, index]
  }
  case CompactType.STRUCT: {
    const structValues: {[key: string]: any} = {}
    let structLastFid = 0
    while (true) {
      let structFieldType, structFid, structIndex
      [structFieldType, structFid, structIndex, structLastFid] = readFieldBegin(view, index, structLastFid)
      index = structIndex
      if (structFieldType === CompactType.STOP) {
        break
      }
      let structFieldValue
      [structFieldValue, index] = readElement(view, structFieldType, index)
      structValues[`field_${structFid}`] = structFieldValue
    }
    return [structValues, index]
  }
  // TODO: MAP and SET
  case CompactType.UUID: {
    // Read 16 bytes to uuid string
    let uuid = ''
    for (let i = 0; i < 16; i++) {
      uuid += view.getUint8(index++).toString(16).padStart(2, '0')
    }
    return [uuid, index]
  }
  default:
    throw new Error(`Unhandled type: ${type}`)
  }
}

/**
 * Var int, also known as Unsigned LEB128.
 * Var ints take 1 to 5 bytes (int32) or 1 to 10 bytes (int64).
 * Takes a Big Endian unsigned integer, left-pads the bit-string to make it a
 * multiple of 7 bits, splits it into 7-bit groups, prefix the most-significant
 * 7-bit group with the 0 bit, prefixing the remaining 7-bit groups with the
 * 1 bit and encode the resulting bit-string as Little Endian.
 */
function readVarInt(view: DataView, index: number): [number, number] {
  let result = 0
  let shift = 0
  while (true) {
    const byte = view.getUint8(index++)
    result |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) {
      return [result, index]
    }
    shift += 7
  }
}

/**
 * Read a varint as a bigint.
 */
function readVarBigInt(view: DataView, index: number): [bigint, number] {
  let result = BigInt(0)
  let shift = BigInt(0)
  while (true) {
    const byte = BigInt(view.getUint8(index++))
    result |= (byte & BigInt(0x7f)) << shift
    if ((byte & BigInt(0x80)) === BigInt(0)) {
      return [result, index]
    }
    shift += BigInt(7)
  }
}

/**
 * Values of type int32 and int64 are transformed to a zigzag int.
 * A zigzag int folds positive and negative numbers into the positive number space.
 */
function readZigZag(view: DataView, index: number): [number, number] {
  const [zigzag, newIndex] = readVarInt(view, index)
  // convert zigzag to int
  const value = (zigzag >>> 1) ^ -(zigzag & 1)
  return [value, newIndex]
}

/**
 * A zigzag int folds positive and negative numbers into the positive number space.
 * This version returns a BigInt.
 */
function readZigZagBigInt(view: DataView, index: number): [bigint, number] {
  const [zigzag, newIndex] = readVarBigInt(view, index)
  // convert zigzag to int
  const value = (zigzag >> BigInt(1)) ^ -(zigzag & BigInt(1))
  return [value, newIndex]
}

/**
 * Get thrift type from half a byte
 */
function getCompactType(byte: number): number {
  return byte & 0x0f
}

/**
 * Read field type and field id
 */
function readFieldBegin(view: DataView, index: number, lastFid: number): [number, number, number, number] {
  const type = view.getUint8(index++)
  if ((type & 0x0f) === CompactType.STOP) {
    // STOP also ends a struct
    return [0, 0, index, lastFid]
  }
  const delta = type >> 4
  let fid // field id
  if (delta === 0) {
    // not a delta, read zigzag varint field id
    [fid, index] = readZigZag(view, index)
  } else {
    // add delta to last field id
    fid = lastFid + delta
  }
  return [getCompactType(type), fid, index, fid]
}

function readCollectionBegin(view: DataView, index: number): [number, number, number] {
  const sizeType = view.getUint8(index++)
  const size = sizeType >> 4
  const type = getCompactType(sizeType)
  if (size === 15) {
    const [newSize, newIndex] = readVarInt(view, index)
    return [type, newSize, newIndex]
  }
  return [type, size, index]
}

/**
 * Convert int to varint. Outputs 1-5 bytes for int32.
 */
export function toVarInt(n: number): number[] {
  let idx = 0
  const varInt = []
  while (true) {
    if ((n & ~0x7f) === 0) {
      varInt[idx++] = n
      break
    } else {
      varInt[idx++] = (n & 0x7f) | 0x80
      n >>>= 7
    }
  }
  return varInt
}
