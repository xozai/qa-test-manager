import { useState, useRef, useCallback } from 'react'
import { Upload, X, AlertTriangle, CheckCircle, FileText, Download, Loader2 } from 'lucide-react'
import type { TestCase, TestSuite } from '../../types'
import { importTestCasesFromCSV, downloadCSVTemplate } from '../../utils/csv'

interface ImportCSVModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (cases: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<void>
  testSuites: TestSuite[]
}

const PREVIEW_LIMIT = 8

export default function ImportCSVModal({ isOpen, onClose, onImport, testSuites }: ImportCSVModalProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>[] | null>(null)
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setFile(null)
    setParsed(null)
    setErrors([])
    setParsing(false)
    setImporting(false)
    setDone(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  async function processFile(f: File) {
    setFile(f)
    setParsed(null)
    setErrors([])
    setParsing(true)
    const result = await importTestCasesFromCSV(f, testSuites)
    setParsed(result.imported)
    setErrors(result.errors)
    setParsing(false)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) void processFile(f)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith('.csv')) void processFile(f)
  }

  async function handleImport() {
    if (!parsed || parsed.length === 0) return
    setImporting(true)
    await onImport(parsed)
    setImporting(false)
    setDone(true)
  }

  if (!isOpen) return null

  const validCount = parsed?.length ?? 0
  const errorCount = errors.length
  const preview = parsed?.slice(0, PREVIEW_LIMIT) ?? []
  const remaining = validCount - PREVIEW_LIMIT

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Import Test Cases</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Upload a CSV to bulk-import test cases</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {done ? (
            /* Success state */
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-emerald-500" />
              </div>
              <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Import Complete</p>
              <p className="text-sm text-zinc-500">{validCount} test case{validCount !== 1 ? 's' : ''} imported successfully.</p>
              <button
                onClick={handleClose}
                className="mt-2 px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              {!file && (
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-500/5'
                      : 'border-zinc-300 dark:border-zinc-700 hover:border-indigo-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-zinc-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Drop a CSV file here, or click to browse</p>
                    <p className="text-xs text-zinc-400 mt-1">Only .csv files are accepted</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </div>
              )}

              {/* File selected + parsing */}
              {file && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                  <FileText className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{file.name}</p>
                    <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  {!parsing && (
                    <button
                      onClick={reset}
                      className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {parsing && (
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Parsing CSV…
                </div>
              )}

              {/* Errors */}
              {errors.length > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 overflow-hidden">
                  <div className="px-4 py-2.5 flex items-center gap-2 border-b border-amber-200 dark:border-amber-800/50">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      {errorCount} row{errorCount !== 1 ? 's' : ''} with issues
                    </span>
                  </div>
                  <ul className="px-4 py-2 space-y-1 max-h-32 overflow-y-auto">
                    {errors.map((err, i) => (
                      <li key={i} className="text-xs text-amber-700 dark:text-amber-300">
                        <span className="font-medium">Row {err.row}:</span> {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview table */}
              {parsed !== null && validCount > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
                    Preview — {validCount} valid row{validCount !== 1 ? 's' : ''} to import
                  </p>
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-zinc-50 dark:bg-zinc-800">
                          <tr>
                            {['ID', 'Title', 'Suite', 'Priority', 'Steps'].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-medium text-zinc-500 uppercase tracking-wide whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {preview.map((tc, i) => {
                            const suite = testSuites.find(s => s.id === tc.testSuiteId)
                            return (
                              <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                <td className="px-3 py-2 font-mono text-indigo-400 whitespace-nowrap">{tc.testCaseId || '—'}</td>
                                <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200 max-w-[200px] truncate">{tc.title}</td>
                                <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">
                                  {suite?.name ?? (tc.testSuiteId ? '?' : '—')}
                                </td>
                                <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">{tc.priority}</td>
                                <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">{tc.steps.length} step{tc.steps.length !== 1 ? 's' : ''}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    {remaining > 0 && (
                      <div className="px-3 py-2 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-800">
                        + {remaining} more row{remaining !== 1 ? 's' : ''} not shown
                      </div>
                    )}
                  </div>
                </div>
              )}

              {parsed !== null && validCount === 0 && !parsing && (
                <p className="text-sm text-zinc-500 text-center py-4">
                  No valid rows found in this file. Check the errors above and try again.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
            <button
              onClick={() => downloadCSVTemplate(testSuites)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Template
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleImport()}
                disabled={!parsed || validCount === 0 || importing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Import {validCount > 0 ? `${validCount} test case${validCount !== 1 ? 's' : ''}` : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
