/**
 * useAIAgent — calls the Anthropic Claude API to generate a test suite + test cases
 * from a natural language prompt.
 *
 * SECURITY NOTE: In production this API call should be proxied through a backend
 * or edge function (e.g. a Supabase Edge Function or Vercel API route) so the
 * API key is never exposed to the browser. For internal/team tools the VITE_
 * env var approach here is acceptable.
 */

import { useState } from 'react'
import type { TestStep, Priority } from '../types'

export interface GeneratedTestCase {
  testCaseId: string
  title: string
  description: string
  preconditions: string
  testData: string
  priority: Priority
  steps: TestStep[]
}

export interface GeneratedSuite {
  name: string
  description: string
  jiraNumber: string
}

export interface AIGeneratedOutput {
  suite: GeneratedSuite
  testCases: GeneratedTestCase[]
}

const SYSTEM_PROMPT = `You are a QA engineer expert. When given a description of what to test,
you generate a realistic, detailed test suite with associated test cases in valid JSON.

Rules:
- Generate between 5 and 15 test cases depending on the complexity of the feature
- Cover happy path, edge cases, and error/negative conditions
- Use realistic, specific values — never generic placeholders like "value1" or "test input"
- Test case IDs must follow the pattern TC-001, TC-002, etc.
- Each test case must have at least 3 steps with clear Action and Expected Result
- Steps must be concise and action-oriented (start with a verb)
- Priority must be exactly one of: High, Med, Low
- The jiraNumber field should be a realistic-looking ticket like "QA-101"
- Return ONLY valid JSON — no markdown, no code fences, no explanation

Return this exact JSON shape:
{
  "suite": {
    "name": "string",
    "description": "string",
    "jiraNumber": "string"
  },
  "testCases": [
    {
      "testCaseId": "TC-001",
      "title": "string",
      "description": "string",
      "preconditions": "string",
      "testData": "string",
      "priority": "High | Med | Low",
      "steps": [
        { "action": "string", "expectedResult": "string" }
      ]
    }
  ]
}`

function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

export function useAIAgent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AIGeneratedOutput | null>(null)

  async function generate(prompt: string) {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      setError('No API key configured. Add VITE_ANTHROPIC_API_KEY to your .env.local file.')
      return
    }
    if (!prompt.trim()) {
      setError('Please describe what you want to test.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt.trim() }],
        }),
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`API error ${response.status}: ${body}`)
      }

      const data = await response.json() as {
        content: { type: string; text: string }[]
      }

      const raw = data.content.find(c => c.type === 'text')?.text ?? ''
      const cleaned = stripFences(raw)

      let parsed: AIGeneratedOutput
      try {
        parsed = JSON.parse(cleaned) as AIGeneratedOutput
      } catch {
        throw new Error('Claude returned an unexpected format. Please try again.')
      }

      // Validate shape
      if (!parsed.suite || !Array.isArray(parsed.testCases)) {
        throw new Error('Generated output is missing required fields. Please try again.')
      }

      setResult(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setResult(null)
    setError(null)
  }

  return { generate, loading, error, result, reset }
}
