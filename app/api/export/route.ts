import { NextRequest, NextResponse } from 'next/server'
import { paperToRis } from '@/lib/collections'
import { Paper } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const { papers } = await req.json() as { papers: Paper[] }

    if (!papers?.length) {
      return NextResponse.json({ error: 'No papers provided' }, { status: 400 })
    }

    const ris = papers.map(paperToRis).join('\n')
    return new NextResponse(ris, {
      headers: {
        'Content-Type': 'application/x-research-info-systems',
        'Content-Disposition': `attachment; filename="consensus-export.ris"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
