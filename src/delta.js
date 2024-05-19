import { readVarInt, readZigZagBigInt } from './thrift.js'

/**
 * @typedef {import('./types.d.ts').DataReader} DataReader
 * @param {DataReader} reader
 * @param {number} nValues number of values to read
 * @param {Int32Array | BigInt64Array} output output array
 */
export function deltaBinaryUnpack(reader, nValues, output) {
  const int32 = output instanceof Int32Array
  const blockSize = readVarInt(reader)
  const miniblockPerBlock = readVarInt(reader)
  readVarInt(reader) // assert(count === nValues)
  let value = readZigZagBigInt(reader) // first value
  let outputIndex = 0
  output[outputIndex++] = int32 ? Number(value) : value

  const valuesPerMiniblock = blockSize / miniblockPerBlock

  while (outputIndex < nValues) {
    // new block
    const minDelta = readZigZagBigInt(reader)
    const bitWidths = new Uint8Array(miniblockPerBlock)
    for (let i = 0; i < miniblockPerBlock; i++) {
      bitWidths[i] = reader.view.getUint8(reader.offset++)
    }

    for (let i = 0; i < miniblockPerBlock && outputIndex < nValues; i++) {
      // new miniblock
      const bitWidth = BigInt(bitWidths[i])
      if (bitWidth) {
        let bitpackPos = 0n
        let miniblockCount = valuesPerMiniblock
        const mask = (1n << bitWidth) - 1n
        while (miniblockCount && outputIndex < nValues) {
          let bits = BigInt(reader.view.getUint8(reader.offset)) >> bitpackPos & mask // TODO: don't re-read value every time
          bitpackPos += bitWidth
          while (bitpackPos >= 8) {
            bitpackPos -= 8n
            reader.offset++
            if (bitpackPos) {
              bits |= BigInt(reader.view.getUint8(reader.offset)) << bitWidth - bitpackPos & mask
            }
          }
          const delta = minDelta + bits
          value += delta
          output[outputIndex++] = int32 ? Number(value) : value
          miniblockCount--
        }
        if (miniblockCount) {
          // consume leftover miniblock
          reader.offset += Math.ceil((miniblockCount * Number(bitWidth) + Number(bitpackPos)) / 8)
        }
      } else {
        for (let j = 0; j < valuesPerMiniblock && outputIndex < nValues; j++) {
          value += minDelta
          output[outputIndex++] = int32 ? Number(value) : value
        }
      }
    }
  }
}
