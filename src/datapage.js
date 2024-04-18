import { readData, readPlain, readRleBitPackedHybrid, widthFromMaxInt } from './encoding.js'
import {
  getMaxDefinitionLevel,
  getMaxRepetitionLevel,
  isRequired,
  schemaElement,
  skipDefinitionBytes,
} from './schema.js'

const skipNulls = false // TODO

/**
 * @typedef {{ definitionLevels: number[], numNulls: number }} DefinitionLevels
 * @typedef {import("./types.d.ts").DataPage} DataPage
 * @typedef {import("./types.d.ts").ColumnMetaData} ColumnMetaData
 * @typedef {import("./types.d.ts").DataPageHeader} DataPageHeader
 * @typedef {import("./types.d.ts").DictionaryPageHeader} DictionaryPageHeader
 * @typedef {import("./types.d.ts").SchemaElement} SchemaElement
 */

/**
 * Read a data page from the given Uint8Array.
 *
 * @param {Uint8Array} bytes raw page data (should already be decompressed)
 * @param {DataPageHeader} daph data page header
 * @param {SchemaElement[]} schema schema for the file
 * @param {ColumnMetaData} columnMetadata metadata for the column
 * @returns {DataPage} definition levels, repetition levels, and array of values
 */
export function readDataPage(bytes, daph, schema, columnMetadata) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const reader = { view, offset: 0 }
  /** @type {any[]} */
  let values = []

  // repetition levels
  const repetitionLevels = readRepetitionLevels(
    reader, daph, schema, columnMetadata
  )

  // definition levels
  let definitionLevels = undefined
  let numNulls = 0
  // let maxDefinitionLevel = -1
  // TODO: move into readDefinitionLevels
  if (skipNulls && !isRequired(schema, columnMetadata.path_in_schema)) {
    // skip_definition_bytes
    reader.offset += skipDefinitionBytes(daph.num_values)
  } else {
    const dl = readDefinitionLevels(reader, daph, schema, columnMetadata.path_in_schema)
    definitionLevels = dl.definitionLevels
    numNulls = dl.numNulls
  }

  // read values based on encoding
  const nValues = daph.num_values - numNulls
  if (daph.encoding === 'PLAIN') {
    const { element } = schemaElement(schema, columnMetadata.path_in_schema)
    const utf8 = element.converted_type === 'UTF8'
    const plainObj = readPlain(reader, columnMetadata.type, nValues, utf8)
    values = Array.isArray(plainObj) ? plainObj : Array.from(plainObj)
  } else if (
    daph.encoding === 'PLAIN_DICTIONARY' ||
    daph.encoding === 'RLE_DICTIONARY' ||
    daph.encoding === 'RLE'
  ) {
    // bit width is stored as single byte
    let bitWidth
    // TODO: RLE encoding uses bitWidth = schemaElement.type_length
    if (columnMetadata.type === 'BOOLEAN') {
      bitWidth = 1
    } else {
      bitWidth = view.getUint8(reader.offset)
      reader.offset++
    }
    if (bitWidth) {
      const value = readRleBitPackedHybrid(
        reader, bitWidth, view.byteLength - reader.offset, nValues
      )
      values = Array.isArray(value) ? value : Array.from(value)
    } else {
      // nval zeros
      values = new Array(nValues).fill(0)
    }
  } else {
    throw new Error(`parquet unsupported encoding: ${daph.encoding}`)
  }

  return { definitionLevels, repetitionLevels, value: values }
}

/**
 * Read a page containing dictionary data.
 *
 * @param {Uint8Array} bytes raw page data
 * @param {DictionaryPageHeader} diph dictionary page header
 * @param {SchemaElement[]} schema schema for the file
 * @param {ColumnMetaData} columnMetadata metadata for the column
 * @returns {ArrayLike<any>} array of values
 */
export function readDictionaryPage(bytes, diph, schema, columnMetadata) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const reader = { view, offset: 0 }
  return readPlain(reader, columnMetadata.type, diph.num_values, false)
}

/**
 * Read the repetition levels from this page, if any.
 *
 * @typedef {import("./types.d.ts").DataReader} DataReader
 * @param {DataReader} reader data view for the page
 * @param {DataPageHeader} daph data page header
 * @param {SchemaElement[]} schema schema for the file
 * @param {ColumnMetaData} columnMetadata metadata for the column
 * @returns {any[]} repetition levels and number of bytes read
 */
function readRepetitionLevels(reader, daph, schema, columnMetadata) {
  if (columnMetadata.path_in_schema.length > 1) {
    const maxRepetitionLevel = getMaxRepetitionLevel(schema, columnMetadata.path_in_schema)
    if (maxRepetitionLevel) {
      const bitWidth = widthFromMaxInt(maxRepetitionLevel)
      return readData(
        reader, daph.repetition_level_encoding, daph.num_values, bitWidth
      )
    }
  }
  return []
}

/**
 * Read the definition levels from this page, if any.
 *
 * @param {DataReader} reader data view for the page
 * @param {DataPageHeader} daph data page header
 * @param {SchemaElement[]} schema schema for the file
 * @param {string[]} path_in_schema path in the schema
 * @returns {DefinitionLevels} definition levels and number of bytes read
 */
function readDefinitionLevels(reader, daph, schema, path_in_schema) {
  if (!isRequired(schema, path_in_schema)) {
    const maxDefinitionLevel = getMaxDefinitionLevel(schema, path_in_schema)
    const bitWidth = widthFromMaxInt(maxDefinitionLevel)
    if (bitWidth) {
      // num_values is index 1 for either type of page header
      const definitionLevels = readData(
        reader, daph.definition_level_encoding, daph.num_values, bitWidth
      )

      // count nulls
      let numNulls = daph.num_values
      for (const def of definitionLevels) {
        if (def === maxDefinitionLevel) numNulls--
      }
      if (numNulls === 0) {
        definitionLevels.length = 0
      }

      return { definitionLevels, numNulls }
    }
  }
  return { definitionLevels: [], numNulls: 0 }
}
