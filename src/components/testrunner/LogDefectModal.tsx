import { useState, useEffect } from 'react'
import { Bug, X, Loader2 } from 'lucide-react'
import type { Defect, DefectSeverity } from '../../types'

interface LogDefectModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (defect: Omit<Defect, 'id' | 'createdAt' | 'reporterId'>) => Promise<void>
  testCaseId: string
  testCaseTitle: string
  runResultId?: string | null
}

const SEVERITIES: DefectSeverity[] = ['Critical', 'High', 'Med', 'Low']

const SEVERITY_STYLE: Record<DefectSeverity, string> = {
  Critical: 'bg-red-600 border-red-600 text-white',
  High:     'bg-orange-500 border-orange-500 text-white',
  Med:      'bg-amber-500 border-amber-500 text-white',
  Low:      'bg-zinc-500 border-zinc-500 text-white',
}

export default function LogDefectModal({
  isOpen, onClose, onSave,
  testCaseId, testCaseTitle, runResultId,
}: LogDefectModalProps) {
  const [title, setTitle] = useState('')
  const [severity, setSeverity] = useState<DefectSeverity>('High')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTitle(testCaseTitle)
      setSeverity('High')
      setDescription('')
      setSaving(false)
    }
  }, [isOpen, testCaseTitle])

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    await onSave({
      testCaseId,
      runResultId: runResultId ?? null,
      title: title.trim(),
      severity,
      description: description.trim(),
      status: 'Open',
    })
    setSaving(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4 text-red-400" />
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Log Defect</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Title <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Brief description of the defect"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Severity</label>
            <div className="flex gap-2">
              {SEVERITIES.map(s => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border-2 transition-colors ${
                    severity === s
                      ? SEVERITY_STYLE[s]
                      : 'border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 hover:border-zinc-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              placeholder="Steps to reproduce, expected vs actual behavior…"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={!title.trim() || saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <Bug className="w-3.5 h-3.5" />
            Log Defect
          </button>
        </div>
      </div>
    </div>
  )
}
