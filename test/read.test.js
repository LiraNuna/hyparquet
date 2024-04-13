import { describe, expect, it } from 'vitest'
import { parquetRead } from '../src/hyparquet.js'
import { toJson } from '../src/utils.js'
import { fileToAsyncBuffer } from './helpers.js'

describe('parquetRead', () => {
  it('throws error for undefined file', async () => {
    const file = undefined
    await expect(parquetRead({ file }))
      .rejects.toThrow('parquet file is required')
  })

  it('filter by row', async () => {
    const file = fileToAsyncBuffer('test/files/rowgroups.parquet')
    await parquetRead({
      file,
      rowEnd: 2,
      onComplete: rows => {
        /* eslint-disable no-sparse-arrays */
        expect(toJson(rows)).toEqual([
          [1], [2],
        ])
      },
    })
  })

  it('read a single column', async () => {
    const file = fileToAsyncBuffer('test/files/datapage_v2.snappy.parquet')
    await parquetRead({
      file,
      columns: ['c'],
      onChunk: chunk => {
        expect(toJson(chunk)).toEqual({
          columnName: 'c',
          columnData: [2, 3, 4, 5, 2],
          rowStart: 0,
          rowEnd: 5,
        })
      },
      onComplete: (rows) => {
        /* eslint-disable no-sparse-arrays */
        expect(toJson(rows)).toEqual([
          [2],
          [3],
          [4],
          [5],
          [2],
        ])
      },
    })
  })

  it('read a list-like column', async () => {
    const file = fileToAsyncBuffer('test/files/datapage_v2.snappy.parquet')
    await parquetRead({
      file,
      columns: ['e'],
      onChunk: chunk => {
        expect(toJson(chunk)).toEqual({
          columnName: 'e',
          columnData: [[1, 2, 3], null, null, [1, 2, 3], [1, 2]],
          rowStart: 0,
          rowEnd: 5,
        })
      },
      onComplete: rows => {
        /* eslint-disable no-sparse-arrays */
        expect(toJson(rows)).toEqual([
          [[1, 2, 3]],
          [null],
          [null],
          [[1, 2, 3]],
          [[1, 2]],
        ])
      },
    })
  })

  it('read a map-like column', async () => {
    const file = fileToAsyncBuffer('test/files/Int_Map.parquet')
    await parquetRead({
      file,
      columns: ['int_map'],
      onChunk: chunk => {
        expect(toJson(chunk)).toEqual({
          columnName: 'int_map',
          columnData: [
            { k1: 1, k2: 100 },
            { k1: 2, k2: null },
            { },
            { },
            { },
            null,
            { k1: null, k3: null },
          ],
          rowStart: 0,
          rowEnd: 7,
        })
      },
      onComplete: rows => {
        /* eslint-disable no-sparse-arrays */
        expect(toJson(rows)).toEqual([
          [{ k1: 1, k2: 100 }],
          [{ k1: 2, k2: null }],
          [{ }],
          [{ }],
          [{ }],
          [null],
          [{ k1: null, k3: null }],
        ])
      },
    })
  })
})
