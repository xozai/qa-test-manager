import { useState } from 'react'
import {
  Sparkles, RefreshCw, Wand2, ChevronDown, ChevronRight,
  CheckSquare, Square, Download, AlertTriangle, Bot,
} from 'lucide-react'
import { useAIAgent, type GeneratedTestCase } from '../../hooks/useAIAgent'
import type { TestSuite, TestCase, Priority, TestStatus } from '../../types'
import Badge from '../common/Badge'

interface AIAssistantProps {
  testSuites: TestSuite[]
  existingTestCaseIds: string[]
  onImport: (suite: Omit<TestSuite, 'id'>, cases: Omit<TestCase, 'id'>[]) => void
  onImportToSuite: (suiteId: string, cases: Omit<TestCase, 'id'>[]) => void
  onNavigate: (view: 'testcases') => void
}

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

const EXAMPLE_PROMPTS = [
  'User login flow with email and password — include edge cases for invalid credentials and locked accounts',
  'E-commerce checkout process — cover cart, shipping, payment, and order confirmation',
  'Password reset flow — happy path, expired links, invalid tokens, and rate limiting',
  'File upload feature — valid files, oversized files, unsupported formats, network failure',
]

export default function AIAssistant({ testSuites, existingTestCaseIds, onImport, onImportToSuite, onNavigate }: AIAssistantProps) {
  const { generate, loading, error, result, reset } = useAIAgent()
  const [prompt, setPrompt] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editedSuiteName, setEditedSuiteName] = useState('')
  const [editedSuiteDesc, setEditedSuiteDesc] = useState('')
  const [editedJira, setEditedJira] = useState('')
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(false)
  // Target suite mode
  const [targetMode, setTargetMode] = useState<'new' | 'existing'>('new')
  const [targetSuiteId, setTargetSuiteId] = useState('')

  async function handleGenerate() {
    await generate(prompt)
  }

  // When result arrives, pre-select all and seed editable suite fields
  function onResultReady() {
    if (!result) return
    setSelectedIds(new Set(result.testCases.map(tc => tc.testCaseId)))
    setEditedSuiteName(result.suite.name)
    setEditedSuiteDesc(result.suite.description)
    setEditedJira(result.suite.jiraNumber)
    setImported(false)
  }

  // React to result change
  const [lastResultId, setLastResultId] = useState<string | null>(null)
  if (result && lastResultId !== result.suite.name + result.testCases.length) {
    setLastResultId(result.suite.name + result.testCases.length)
    onResultReady()
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (!result) return
    if (selectedIds.size === result.testCases.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(result.testCases.map(tc => tc.testCaseId)))
  }

  function handleImport() {
    if (!result) return
    setImporting(true)

    // Calculate next TC number from existing IDs
    const maxNum = Math.max(0, ...existingTestCaseIds.map(id => {
      const m = id.match(/TC-?(\d+)/i)
      return m ? parseInt(m[1], 10) : 0
    }))

    const selectedCases = result.testCases.filter(tc => selectedIds.has(tc.testCaseId))

    if (targetMode === 'existing' && targetSuiteId) {
      const cases: Omit<TestCase, 'id'>[] = selectedCases.map((tc, i) => ({
        testCaseId: `TC-${String(maxNum + i + 1).padStart(3, '0')}`,
        title: tc.title,
        description: tc.description,
        preconditions: tc.preconditions,
        testData: tc.testData,
        priority: tc.priority as Priority,
        testSuiteId: targetSuiteId,
        qaStatus: 'Not Run' as TestStatus,
        uatStatus: 'Not Run' as TestStatus,
        batStatus: 'Not Run' as TestStatus,
        steps: tc.steps,
        attributeValues: {},
        parentId: null,
      }))
      onImportToSuite(targetSuiteId, cases)
    } else {
      const suiteId = genId()
      const suite: Omit<TestSuite, 'id'> = {
        name: editedSuiteName || result.suite.name,
        description: editedSuiteDesc || result.suite.description,
        jiraNumber: editedJira || result.suite.jiraNumber,
        ownerId: '',
        isHidden: false,
        attributes: [],
      }
      const cases: Omit<TestCase, 'id'>[] = selectedCases.map((tc, i) => ({
        testCaseId: `TC-${String(maxNum + i + 1).padStart(3, '0')}`,
        title: tc.title,
        description: tc.description,
        preconditions: tc.preconditions,
        testData: tc.testData,
        priority: tc.priority as Priority,
        testSuiteId: suiteId,
        qaStatus: 'Not Run' as TestStatus,
        uatStatus: 'Not Run' as TestStatus,
        batStatus: 'Not Run' as TestStatus,
        steps: tc.steps,
        attributeValues: {},
        parentId: null,
      }))
      onImport(suite, cases)
    }

    setImporting(false)
    setImported(true)
    setTimeout(() => onNavigate('testcases'), 1200)
  }

  const fieldCls = 'w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent transition-colors'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">AI Assistant</h1>
        </div>
        <p className="text-sm text-zinc-500 ml-11">
          Describe a feature or flow in plain English and Claude will generate a full test suite.
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">

          {/* Prompt input */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              What do you want to test?
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              placeholder="e.g. Generate a test suite for a user login flow with email and password, including edge cases for invalid credentials and locked accounts."
              className={`${fieldCls} resize-none`}
              disabled={loading}
            />

            {/* Example prompts */}
            {!result && (
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-2">Examples:</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_PROMPTS.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => setPrompt(ex)}
                      className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left"
                    >
                      {ex.length > 60 ? ex.slice(0, 57) + '…' : ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all shadow-sm"
              >
                {loading
                  ? <><RefreshCw className="w-4 h-4 animate-spin" />Generating…</>
                  : <><Sparkles className="w-4 h-4" />Generate Test Suite</>
                }
              </button>
              {result && (
                <button
                  onClick={() => { reset(); setImported(false); setTargetMode('new'); setTargetSuiteId('') }}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />Regenerate
                </button>
              )}
            </div>

            {loading && (
              <p className="text-sm text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Generating test cases… this usually takes 10–20 seconds.
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-0.5">Generation failed</p>
                <p className="text-xs opacity-80">{error}</p>
              </div>
            </div>
          )}

          {/* Success imported */}
          {imported && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckSquare className="w-4 h-4 flex-shrink-0" />
              Imported successfully! Navigating to Test Cases…
            </div>
          )}

          {/* Result preview */}
          {result && !imported && (
            <div className="space-y-4">
              {/* Editable suite header */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Wand2 className="w-4 h-4 text-indigo-500" />
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Generated Suite — review & edit before importing</p>
                </div>

                {/* Target suite mode toggle */}
                <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg w-fit">
                  <button
                    onClick={() => setTargetMode('new')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${targetMode === 'new' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                  >
                    Create new suite
                  </button>
                  <button
                    onClick={() => setTargetMode('existing')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${targetMode === 'existing' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                  >
                    Add to existing suite
                  </button>
                </div>

                {targetMode === 'new' ? (
                  <>
                    <div className="grid grid-cols-[1fr_auto] gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Suite Name</label>
                        <input value={editedSuiteName} onChange={e => setEditedSuiteName(e.target.value)} className={fieldCls} />
                      </div>
                      <div className="w-36">
                        <label className="block text-xs font-medium text-zinc-500 mb-1">JIRA Number</label>
                        <input value={editedJira} onChange={e => setEditedJira(e.target.value)} className={fieldCls} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Description</label>
                      <textarea value={editedSuiteDesc} onChange={e => setEditedSuiteDesc(e.target.value)} rows={2} className={`${fieldCls} resize-none`} />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Target Suite</label>
                    <select
                      value={targetSuiteId}
                      onChange={e => setTargetSuiteId(e.target.value)}
                      className={fieldCls}
                    >
                      <option value="">— Select a suite —</option>
                      {testSuites.filter(s => !s.isHidden).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Test case table */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Test Cases
                    <span className="ml-2 text-xs text-zinc-400">({selectedIds.size} of {result.testCases.length} selected)</span>
                  </p>
                  <button onClick={toggleAll} className="text-xs text-indigo-500 hover:text-indigo-400 transition-colors">
                    {selectedIds.size === result.testCases.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>

                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {result.testCases.map((tc: GeneratedTestCase) => {
                    const isSelected = selectedIds.has(tc.testCaseId)
                    const isExpanded = expandedId === tc.testCaseId
                    return (
                      <div key={tc.testCaseId} className={`transition-colors ${isSelected ? '' : 'opacity-50'}`}>
                        <div className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                          <button onClick={() => toggleSelect(tc.testCaseId)} className="flex-shrink-0">
                            {isSelected
                              ? <CheckSquare className="w-4 h-4 text-indigo-500" />
                              : <Square className="w-4 h-4 text-zinc-300 dark:text-zinc-600" />
                            }
                          </button>
                          <span className="font-mono text-xs text-indigo-400 w-14 flex-shrink-0">{tc.testCaseId}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{tc.title}</p>
                            {tc.description && (
                              <p className="text-xs text-zinc-500 truncate mt-0.5">{tc.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="priority" value={tc.priority}>{tc.priority}</Badge>
                            <span className="text-xs text-zinc-400">{tc.steps.length} steps</span>
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : tc.testCaseId)}
                              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                            >
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-12 pb-4 space-y-3 bg-zinc-50/60 dark:bg-zinc-800/30">
                            {tc.preconditions && (
                              <div>
                                <p className="text-xs font-medium text-zinc-500 mb-1">Preconditions</p>
                                <p className="text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{tc.preconditions}</p>
                              </div>
                            )}
                            {tc.testData && (
                              <div>
                                <p className="text-xs font-medium text-zinc-500 mb-1">Test Data</p>
                                <p className="text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{tc.testData}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-medium text-zinc-500 mb-2">Steps</p>
                              <div className="space-y-1.5">
                                {tc.steps.map((step, i) => (
                                  <div key={i} className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="flex gap-2">
                                      <span className="font-mono text-zinc-400 w-4 flex-shrink-0">{i + 1}.</span>
                                      <div>
                                        <p className="text-zinc-500 mb-0.5">Action</p>
                                        <p className="text-zinc-700 dark:text-zinc-300">{step.action}</p>
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-zinc-500 mb-0.5">Expected</p>
                                      <p className="text-zinc-700 dark:text-zinc-300">{step.expectedResult}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Import button */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-zinc-500">
                  {targetMode === 'existing' && targetSuiteId
                    ? `${selectedIds.size} test case${selectedIds.size !== 1 ? 's' : ''} will be added to "${testSuites.find(s => s.id === targetSuiteId)?.name ?? '…'}"`
                    : `${selectedIds.size} test case${selectedIds.size !== 1 ? 's' : ''} will be imported into a new suite.`
                  }
                </p>
                <button
                  onClick={handleImport}
                  disabled={selectedIds.size === 0 || importing || (targetMode === 'existing' && !targetSuiteId)}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Import Selected ({selectedIds.size})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
