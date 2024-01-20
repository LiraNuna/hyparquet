import fs from 'fs'

/**
 * Helper function to read .parquet file into ArrayBuffer
 *
 * @param {string} filePath
 * @returns {Promise<ArrayBuffer>}
 */
export async function readFileToArrayBuffer(filePath) {
  const buffer = await fs.promises.readFile(filePath)
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

/**
 * Wrap .parquet file in an AsyncBuffer
 *
 * @typedef {import('../src/types.js').AsyncBuffer} AsyncBuffer
 * @param {string} filePath
 * @returns {AsyncBuffer}
 */
export function fileToAsyncBuffer(filePath) {
  return {
    byteLength: fs.statSync(filePath).size,
    slice: async (start, end) => (await readFileToArrayBuffer(filePath)).slice(start, end),
  }
}
