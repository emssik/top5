import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { printResult, formatTable, die, type Column } from '../src/lib/output'

describe('output', () => {
  describe('formatTable', () => {
    it('returns "(none)" for empty rows', () => {
      const columns: Column<{ name: string }>[] = [
        { header: 'Name', value: (r) => r.name },
      ]
      expect(formatTable([], columns)).toBe('  (none)')
    })

    it('formats a simple table with headers', () => {
      interface Row { code: string; name: string }
      const columns: Column<Row>[] = [
        { header: 'Code', value: (r) => r.code },
        { header: 'Name', value: (r) => r.name },
      ]
      const rows: Row[] = [
        { code: 'PRJ', name: 'My Project' },
        { code: 'APP', name: 'Mobile App' },
      ]
      const result = formatTable(rows, columns)
      // Header should be present
      expect(result).toContain('Code')
      expect(result).toContain('Name')
      // Rows should be present
      expect(result).toContain('PRJ')
      expect(result).toContain('My Project')
      expect(result).toContain('APP')
      expect(result).toContain('Mobile App')
    })

    it('pads columns to align', () => {
      interface Row { a: string; b: string }
      const columns: Column<Row>[] = [
        { header: 'A', value: (r) => r.a },
        { header: 'B', value: (r) => r.b },
      ]
      const rows: Row[] = [
        { a: 'short', b: 'x' },
        { a: 'longervalue', b: 'y' },
      ]
      const result = formatTable(rows, columns)
      const lines = result.split('\n')
      // All lines should have the same structure
      expect(lines.length).toBe(3) // header + 2 rows
    })

    it('respects explicit width', () => {
      interface Row { val: string }
      const columns: Column<Row>[] = [
        { header: 'V', value: (r) => r.val, width: 20 },
      ]
      const rows: Row[] = [{ val: 'hi' }]
      const result = formatTable(rows, columns)
      // The padded value should be at least 20 chars wide
      const dataLine = result.split('\n')[1]
      // 2 leading spaces + content
      expect(dataLine.length).toBeGreaterThanOrEqual(22)
    })

    it('supports right alignment', () => {
      interface Row { num: string }
      const columns: Column<Row>[] = [
        { header: 'Num', value: (r) => r.num, align: 'right', width: 10 },
      ]
      const rows: Row[] = [{ num: '42' }]
      const result = formatTable(rows, columns)
      const dataLine = result.split('\n')[1]
      // Right-aligned: spaces then "42"
      expect(dataLine.trimStart()).toMatch(/^\s*42$/)
    })
  })

  describe('printResult', () => {
    let logSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
      logSpy.mockRestore()
    })

    it('prints JSON when json option is true', () => {
      const data = { projects: [{ id: '1', name: 'Test' }] }
      printResult(data, { json: true })
      expect(logSpy).toHaveBeenCalledOnce()
      const output = logSpy.mock.calls[0][0]
      expect(JSON.parse(output)).toEqual(data)
    })

    it('JSON output is pretty-printed with 2-space indent', () => {
      printResult({ a: 1 }, { json: true })
      const output = logSpy.mock.calls[0][0]
      expect(output).toBe(JSON.stringify({ a: 1 }, null, 2))
    })

    it('calls formatFn when json is not set', () => {
      const formatFn = vi.fn(() => 'formatted output')
      printResult({ data: 'test' }, { formatFn })
      expect(formatFn).toHaveBeenCalledOnce()
      expect(logSpy).toHaveBeenCalledWith('formatted output')
    })

    it('json takes priority over formatFn', () => {
      const formatFn = vi.fn(() => 'formatted')
      printResult({ x: 1 }, { json: true, formatFn })
      // JSON wins — formatFn not called
      expect(formatFn).not.toHaveBeenCalled()
      expect(JSON.parse(logSpy.mock.calls[0][0])).toEqual({ x: 1 })
    })
  })

  describe('die', () => {
    it('prints error message to stderr and exits', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called')
      }) as never)

      expect(() => die('Something went wrong')).toThrow('process.exit called')
      expect(errorSpy).toHaveBeenCalledWith('Error: Something went wrong')
      expect(exitSpy).toHaveBeenCalledWith(1)

      errorSpy.mockRestore()
      exitSpy.mockRestore()
    })
  })
})
