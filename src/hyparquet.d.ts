export { AsyncBuffer, FileMetaData, SchemaTree } from './types'

/**
 * Read parquet data rows from a file-like object.
 * Reads the minimal number of row groups and columns to satisfy the request.
 *
 * Returns a void promise when complete, and to throw errors.
 * Data is returned in onComplete, not the return promise, because
 * if onComplete is undefined, we parse the data, and emit chunks, but skip
 * computing the row view directly. This saves on allocation if the caller
 * wants to cache the full chunks, and make their own view of the data from
 * the chunks.
 *
 * @param {object} options read options
 * @param {AsyncBuffer} options.file file-like object containing parquet data
 * @param {FileMetaData} [options.metadata] parquet file metadata
 * @param {number[]} [options.columns] columns to read, all columns if undefined
 * @param {number} [options.rowStart] first requested row index (inclusive)
 * @param {number} [options.rowEnd] last requested row index (exclusive)
 * @param {(chunk: ColumnData) => void} [options.onChunk] called when a column chunk is parsed. chunks may include row data outside the requested range.
 * @param {(rows: any[][]) => void} [options.onComplete] called when all requested rows and columns are parsed
 * @returns {Promise<void>} resolves when all requested rows and columns are parsed
 */
export async function parquetRead(options: ParquetReadOptions): Promise<void>

/**
 * Read parquet metadata from an async buffer.
 *
 * An AsyncBuffer is like an ArrayBuffer, but the slices are loaded
 * asynchronously, possibly over the network.
 *
 * To make this efficient, we initially request the last 512kb of the file,
 * which is likely to contain the metadata. If the metadata length exceeds the
 * initial fetch, 512kb, we request the rest of the metadata from the AsyncBuffer.
 *
 * This ensures that we either make one 512kb initial request for the metadata,
 * or two requests for exactly the metadata size.
 *
 * @param {AsyncBuffer} asyncBuffer parquet file contents
 * @param {number} initialFetchSize initial fetch size in bytes (default 512kb)
 * @returns {Promise<FileMetaData>} parquet metadata object
 */
export async function parquetMetadataAsync(asyncBuffer: AsyncBuffer, initialFetchSize: number = 1 << 19 /* 512kb */): Promise<FileMetaData>

/**
 * Read parquet metadata from a buffer
 *
 * @param {ArrayBuffer} arrayBuffer parquet file contents
 * @returns {FileMetaData} parquet metadata object
 */
export function parquetMetadata(arrayBuffer: ArrayBuffer): FileMetaData

/**
 * Return a tree of schema elements from parquet metadata.
 *
 * @param {FileMetaData} metadata parquet metadata object
 * @returns {SchemaTree} tree of schema elements
 */
export function parquetSchema(metadata: SchemaElement[]): SchemaTree

/**
 * Decompress snappy data.
 * Accepts an output buffer to avoid allocating a new buffer for each call.
 *
 * @param {Uint8Array} inputArray compressed data
 * @param {Uint8Array} outputArray output buffer
 * @returns {boolean} true if successful
 */
export function snappyUncompress(inputArray: Uint8Array, outputArray: Uint8Array): boolean

/**
 * Replace bigints with numbers.
 * When parsing parquet files, bigints are used to represent 64-bit integers.
 * However, JSON does not support bigints, so it's helpful to convert to numbers.
 *
 * @param {any} obj object to convert
 * @returns {unknown} converted object
 */
export function toJson(obj: any): unknown

/**
 * Parquet query options for reading data
 */
export interface ParquetReadOptions {
  file: AsyncBuffer // file-like object containing parquet data
  metadata?: FileMetaData // parquet metadata, will be parsed if not provided
  columns?: number[] // columns to read, all columns if undefined
  rowStart?: number // inclusive
  rowEnd?: number // exclusive
  onChunk?: (chunk: ColumnData) => void // called when a column chunk is parsed. chunks may be outside the requested range.
  onComplete?: (rows: any[][]) => void // called when all requested rows and columns are parsed
}

/**
 * A run of column data
 */
export interface ColumnData {
  column: number
  data: ArrayLike<any>
  rowStart: number
  rowEnd: number
}
