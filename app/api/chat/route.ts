import { NextRequest, NextResponse } from 'next/server'
import { callLLM } from '@/lib/llm'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { paperAbstract, question, chatHistory } = await req.json()

    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
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

PAPER ABSTRACT:
${paperAbstract || 'No abstract available for this paper.'}

CONVERSATION HISTORY:
${contextBlock}

USER'S NEW QUESTION:
${question}

Please answer the question based on the paper abstract and the conversation history. Be specific and cite parts of the abstract when relevant. If the paper does not contain information to answer the question, say so clearly.

Answer:`

    const answer = await callLLM(
      'You are a helpful research assistant discussing a scholarly paper. Answer questions directly and specifically based only on the paper abstract provided.',
      prompt,
      500
    )

    return NextResponse.json({ answer: answer || 'No answer generated — add OPENROUTER_API_KEY to .env.local for AI answers.' })
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
  }
}
