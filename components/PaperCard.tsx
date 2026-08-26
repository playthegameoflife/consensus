import { useState } from 'react'
import { Paper } from '@/lib/types'
import { getStudyType, formatAuthors } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ExternalLink, Quote, ArrowUpRight, Bookmark, BookmarkCheck } from 'lucide-react'
import {
  getCollections, createCollection, addPaperToCollection, removePaperFromCollection,
  isPaperInAnyCollection, Collection,
} from '@/lib/collections'

interface PaperCardProps {
  paper: Paper & { aiFinding?: string; consensusScore?: number }
  onSelect?: (paper: Paper) => void
}

const STUDY_COLORS: Record<string, string> = {
  'Meta-Analysis': 'bg-purple-100 text-purple-700',
  'Systematic Review': 'bg-indigo-100 text-indigo-700',
  'Clinical Trial': 'bg-blue-100 text-blue-700',
  RCT: 'bg-blue-100 text-blue-700',
  Review: 'bg-slate-100 text-slate-700',
  'Cross-Sectional': 'bg-teal-100 text-teal-700',
  Cohort: 'bg-green-100 text-green-700',
  'Case-Control': 'bg-amber-100 text-amber-700',
  Study: 'bg-slate-100 text-slate-600',
}

function CollectionPicker({
  paperId,
  onClose,
}: {
  paperId: string
  onClose: () => void
}) {
  const [collections, setCollections] = useState<Collection[]>(getCollections)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  function refresh() {
    setCollections(getCollections())
  }

  function handleAdd(colId: string) {
    addPaperToCollection(colId, paperId)
    refresh()
    onClose()
  }

  function handleRemove(colId: string) {
    removePaperFromCollection(colId, paperId)
    refresh()
  }

  function handleCreate() {
    if (!newName.trim()) return
    const col = createCollection(newName.trim())
    addPaperToCollection(col.id, paperId)
    setNewName('')
    setCreating(false)
    refresh()
    onClose()
  }

  const inCollections = collections.filter(c => c.paperIds.includes(paperId))

  return (
    <div className="w-64 p-2">
      <div className="text-xs font-semibold text-slate-500 px-2 pb-1">Save to collection</div>

      {inCollections.map(col => (
        <div key={col.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100">
          <BookmarkCheck className="w-3 h-3 text-blue-500" />
          <span className="flex-1 text-sm text-slate-700 truncate">{col.name}</span>
          <button
            onClick={() => handleRemove(col.id)}
            className="text-xs text-slate-400 hover:text-red-500"
          >
            Remove
          </button>
        </div>
      ))}

      {creating ? (
        <div className="px-2 py-1.5">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') { setCreating(false); setNewName('') }
            }}
            placeholder="Collection name..."
            className="w-full text-sm px-2 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-400"
          />
          <div className="flex gap-1 mt-1">
            <button onClick={handleCreate} className="flex-1 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">
              Create
            </button>
            <button onClick={() => { setCreating(false); setNewName('') }} className="flex-1 py-1 bg-slate-100 text-slate-600 text-xs rounded hover:bg-slate-200">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full text-left px-2 py-1.5 text-sm text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-3 h-3" />
          New collection
        </button>
      )}
    </div>
  )
}

function Plus({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function SaveButton({ paperId, saved }: { paperId: string; saved: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="absolute top-3 right-3 p-1.5 rounded-lg transition-all data-[state=open]:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <Bookmark
          className={`w-4 h-4 ${
            saved
              ? "fill-current text-blue-500"
              : "opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-500"
          }`}
        />
        <span className="sr-only">
          {saved ? "Saved to collection" : "Save to collection"}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="p-0 overflow-hidden z-[9999]">
        <CollectionPicker paperId={paperId} onClose={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PaperCard({ paper, onSelect }: PaperCardProps) {
  const studyType = getStudyType(paper)
  const colorClass = STUDY_COLORS[studyType] || STUDY_COLORS.Study
  const doi = paper.doi ? `https://doi.org/${paper.doi}` : undefined
  const arxivUrl = paper.externalIds?.ArXiv
    ? `https://arxiv.org/abs/${paper.externalIds.ArXiv}`
    : undefined
  const pdfUrl = paper.openAccessPdf?.url
  const linkUrl = doi || arxivUrl || pdfUrl
  const saved = isPaperInAnyCollection(paper.paperId)

  return (
    <Card className="p-5 hover:shadow-md transition-shadow duration-200 group relative">
      {/* Save button */}
      <SaveButton paperId={paper.paperId} saved={saved} />

      {/* Clickable card body */}
      <div onClick={() => onSelect?.(paper)} className="cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3 pr-8">
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-lg font-semibold text-slate-900 leading-snug group-hover:text-blue-700 transition-colors">
              {paper.title}
            </h3>
            <p className="text-sm text-slate-500 mt-1">{formatAuthors(paper.authors)}</p>
          </div>

          {/* Consensus dot */}
          {paper.consensusScore !== undefined && (
            <div
              className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ${
                paper.consensusScore > 0.5
                  ? 'bg-emerald-500'
                  : paper.consensusScore < -0.3
                  ? 'bg-red-500'
                  : 'bg-slate-300'
              }`}
              title={`Consensus: ${paper.consensusScore.toFixed(2)}`}
            />
          )}
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge variant="secondary" className={`text-xs font-medium ${colorClass}`}>
            {studyType}
          </Badge>
          {paper.journal && (
            <span className="text-xs text-slate-500 font-medium">{paper.journal}</span>
          )}
          {paper.year && <span className="text-xs text-slate-400">{paper.year}</span>}
          {paper.citationCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              {paper.citationCount.toLocaleString()}
            </span>
          )}
        </div>

        {/* AI Finding */}
        {paper.aiFinding && (
          <div className="bg-blue-50 rounded-lg p-3 mb-3">
            <div className="flex items-start gap-2">
              <Quote className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-900 leading-relaxed font-medium">
                {paper.aiFinding}
              </p>
            </div>
          </div>
        )}

        {/* Abstract snippet */}
        {paper.abstract && (
          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
            {paper.abstract}
          </p>
        )}
      </div>

      {/* Links */}
      {linkUrl && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
          {doi && (
            <a
              href={doi}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              DOI <ArrowUpRight className="w-3 h-3" />
            </a>
          )}
          {arxivUrl && (
            <a
              href={arxivUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              arXiv <ArrowUpRight className="w-3 h-3" />
            </a>
          )}
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              PDF <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </Card>
  )
}
