import { Paper } from './types'

export interface Collection {
  id: string
  name: string
  description?: string
  paperIds: string[]
  createdAt: number
  updatedAt: number
  color: string
}

const STORAGE_KEY = 'consensus_collections'

const COLORS = [
  'blue', 'green', 'red', 'purple', 'orange',
  'yellow', 'pink', 'teal', 'indigo', 'rose',
]

export function getCollections(): Collection[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveCollections(collections: Collection[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collections))
}

export function createCollection(name: string, description = ''): Collection {
  const collections = getCollections()
  const color = COLORS[collections.length % COLORS.length]
  const collection: Collection = {
    id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    description,
    paperIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    color,
  }
  collections.push(collection)
  saveCollections(collections)
  return collection
}

export function deleteCollection(id: string): void {
  saveCollections(getCollections().filter(c => c.id !== id))
}

export function renameCollection(id: string, name: string): void {
  const collections = getCollections()
  const col = collections.find(c => c.id === id)
  if (col) {
    col.name = name
    col.updatedAt = Date.now()
    saveCollections(collections)
  }
}

export function addPaperToCollection(collectionId: string, paperId: string): void {
  const collections = getCollections()
  const col = collections.find(c => c.id === collectionId)
  if (col && !col.paperIds.includes(paperId)) {
    col.paperIds.push(paperId)
    col.updatedAt = Date.now()
    saveCollections(collections)
  }
}

export function removePaperFromCollection(collectionId: string, paperId: string): void {
  const collections = getCollections()
  const col = collections.find(c => c.id === collectionId)
  if (col) {
    col.paperIds = col.paperIds.filter(id => id !== paperId)
    col.updatedAt = Date.now()
    saveCollections(collections)
  }
}

export function isPaperInAnyCollection(paperId: string): boolean {
  return getCollections().some(c => c.paperIds.includes(paperId))
}

export function getPaperCollections(paperId: string): Collection[] {
  return getCollections().filter(c => c.paperIds.includes(paperId))
}

export function exportCollectionBibtex(collectionId: string, papers: Paper[]): string {
  const collection = getCollections().find(c => c.id === collectionId)
  if (!collection) return ''
  const papers_in = papers.filter(p => collection.paperIds.includes(p.paperId))
  return papers_in.map(p => paperToBibtex(p)).join('\n\n')
}

export function paperToBibtex(paper: Paper): string {
  const id = (paper.paperId || '').replace(/[^a-zA-Z0-9]/g, '_')
  const year = paper.year || 'n.d.'
  const title = paper.title || 'Untitled'
  const authors = paper.authors?.map(a => a.name).join(' and ') || 'Unknown'
  const venue = paper.journal || ''

  let bibtex = `@article{${id},\n  title = {${title}},\n  author = {${authors}},\n  year = {${year}},`
  if (venue) bibtex += `\n  journal = {${venue}},`
  if (paper.citationCount !== undefined) bibtex += `\n  note = {Citations: ${paper.citationCount}},`
  bibtex += '\n}'
  return bibtex
}

export function paperToRis(paper: Paper): string {
  const lines: string[] = []
  lines.push('TY  - JOUR')
  if (paper.title) lines.push(`TI  - ${paper.title}`)
  paper.authors?.forEach(a => lines.push(`AU  - ${a.name}`))
  if (paper.year) lines.push(`PY  - ${paper.year}`)
  if (paper.journal) lines.push(`JO  - ${paper.journal}`)
  if (paper.abstract) lines.push(`AB  - ${paper.abstract}`)
  if (paper.citationCount !== undefined) lines.push(`NR  - ${paper.citationCount}`)
  if (paper.paperId) lines.push(`DO  - ${paper.paperId}`)
  if (paper.doi) lines.push(`DO  - ${paper.doi}`)
  lines.push('ER  -')
  return lines.join('\n')
}
