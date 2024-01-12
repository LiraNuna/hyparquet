import { deserializeTCompactProtocol } from './thrift.js'

/**
 * Read parquet header, metadata, and schema information from a file
 *
 * @typedef {import("./types.d.ts").FileMetaData} FileMetaData
 * @param {ArrayBuffer} arrayBuffer parquet file contents
 * @returns {FileMetaData} metadata object
 */
export function parquetMetadata(arrayBuffer) {
  // DataView for easier manipulation of the buffer
  const view = new DataView(arrayBuffer)

  // Validate footer magic number "PAR1"
  if (view.byteLength < 8) {
    throw new Error('parquet file is too short')
  }
  if (view.getUint32(view.byteLength - 4, true) !== 0x31524150) {
    throw new Error('parquet file invalid magic number')
  }

  // Parquet files store metadata at the end of the file
  // Metadata length is 4 bytes before the last PAR1
  const metadataLengthOffset = view.byteLength - 8
  const metadataLength = view.getUint32(view.byteLength - 8, true)
  if (metadataLength <= 0) {
    throw new Error('parquet invalid metadata length')
  }
  if (metadataLength > view.byteLength - 8) {
    throw new Error('parquet metadata length exceeds buffer size')
  }

  const metadataOffset = metadataLengthOffset - metadataLength
  const metadataBuffer = view.buffer.slice(metadataOffset, metadataLengthOffset)
  const { value: metadata } = deserializeTCompactProtocol(metadataBuffer)

  // Parse parquet metadata from thrift data
  const version = metadata.field_1
  const schema = metadata.field_2.map((/** @type {any} */ field) => ({
    type: field.field_1,
    type_length: field.field_2,
    repetition_type: field.field_3,
    name: field.field_4,
    num_children: field.field_5,
    converted_type: field.field_6,
    scale: field.field_7,
    precision: field.field_8,
    field_id: field.field_9,
  }))
  const num_rows = metadata.field_3
  const row_groups = metadata.field_4.map((/** @type {any} */ rowGroup) => ({
    columns: rowGroup.field_1.map((/** @type {any} */ column) => ({
      file_path: column.field_1,
      file_offset: column.field_2,
      meta_data: column.field_3 && {
        type: column.field_3.field_1,
        encodings: column.field_3.field_2,
        path_in_schema: column.field_3.field_3,
        codec: column.field_3.field_4,
        num_values: column.field_3.field_5,
        total_uncompressed_size: column.field_3.field_6,
        total_compressed_size: column.field_3.field_7,
        key_value_metadata: column.field_3.field_8,
        data_page_offset: column.field_3.field_9,
        index_page_offset: column.field_3.field_10,
        dictionary_page_offset: column.field_3.field_11,
        statistics: column.field_3.field_12 && {
          max: column.field_3.field_12.field_1,
          min: column.field_3.field_12.field_2,
          null_count: column.field_3.field_12.field_3,
          distinct_count: column.field_3.field_12.field_4,
        },
        encoding_stats: column.field_3.field_13?.map((/** @type {any} */ encodingStat) => ({
          page_type: encodingStat.field_1,
          encoding: encodingStat.field_2,
          count: encodingStat.field_3,
        })),
      },
    })),
    total_byte_size: rowGroup.field_2,
    num_rows: rowGroup.field_3,
    sorting_columns: rowGroup.field_4?.map((/** @type {any} */ sortingColumn) => ({
      column_idx: sortingColumn.field_1,
      descending: sortingColumn.field_2,
      nulls_first: sortingColumn.field_3,
    })),
  }))
  const key_value_metadata = metadata.field_5?.map((/** @type {any} */ keyValue) => ({
    key: keyValue.field_1,
    value: keyValue.field_2,
  }))
  const created_by = metadata.field_6

  return {
    version,
    schema,
    num_rows,
    row_groups,
    key_value_metadata,
    created_by,
    metadata_length: metadataLength,
  }
}
