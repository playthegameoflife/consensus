import { NextRequest, NextResponse } from 'next/server'
import { callLLM } from '@/lib/llm'
import { getPaperFullText } from '@/lib/fulltext'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { paperAbstract, question, chatHistory, paper } = await req.json()

    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // Full-text pipeline: when a Paper object is provided (has PDF sources),
    // read the actual paper like consensus.app. Falls back to abstract.
    let paperText = paperAbstract || ''
    let usedFullText = false
    let fullTextSource: string | null = null
    if (paper && paper.paperId) {
      const fullText = await getPaperFullText(paper)
      paperText = fullText.text || paperText
      usedFullText = fullText.usedFullText
      fullTextSource = fullText.source
    }

    // Build context from chat history (last 4 messages)
    const recentHistory = (chatHistory || []).slice(-4)
    let contextBlock = ''
    if (recentHistory.length > 0) {
      contextBlock = recentHistory
        .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n') + '\n\n'
    }

    const prompt = `You are a helpful research assistant. You are discussing a scholarly paper with the user.

PAPER CONTENT${usedFullText ? ' (FULL TEXT)' : ' (ABSTRACT)'}:
${paperText.slice(0, 30000) || 'No paper content available for this paper.'}

CONVERSATION HISTORY:
${contextBlock}

USER'S NEW QUESTION:
${question}

Please answer the question based on the paper content and the conversation history. Be specific and cite parts of the paper when relevant (methods, findings, discussion sections). If the paper does not contain information to answer the question, say so clearly.

Answer:`

    const answer = await callLLM(
      'You are a helpful research assistant discussing a scholarly paper. Answer questions directly and specifically based only on the paper content provided.',
      prompt,
      700
    )

    return NextResponse.json({
      answer: answer || 'No answer generated — add OPENROUTER_API_KEY to .env.local for AI answers.',
      usedFullText,
      fullTextSource,
    })
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
  }
}
