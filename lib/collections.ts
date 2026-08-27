import { Paper } from './types'

export interface Collection {
  id: string
  name: string
  description?: string
  paperIds: string[]
  /** Full paper snapshots — enables standalone My Library view without re-fetching */
  papers?: Record<string, Paper>
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
    papers: {},
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

export function addPaperToCollection(collectionId: string, paper: Paper): void {
  const collections = getCollections()
  const col = collections.find(c => c.id === collectionId)
  if (col && !col.paperIds.includes(paper.paperId)) {
    col.paperIds.push(paper.paperId)
    col.papers = col.papers || {}
    col.papers[paper.paperId] = paper
    col.updatedAt = Date.now()
    saveCollections(collections)
  }
}

export function removePaperFromCollection(collectionId: string, paperId: string): void {
  const collections = getCollections()
  const col = collections.find(c => c.id === collectionId)
  if (col) {
    col.paperIds = col.paperIds.filter(id => id !== paperId)
    if (col.papers) {
      delete col.papers[paperId]
    }
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

/** Papers stored across all collections (My Library = union). */
export function getLibraryPapers(): Paper[] {
  const seen = new Map<string, Paper>()
  for (const col of getCollections()) {
    for (const pid of col.paperIds) {
      const p = col.papers?.[pid]
      if (p) seen.set(pid, p)
    }
  }
  return Array.from(seen.values())
}

/** Papers in one collection, from stored snapshots (or filtered prop fallback). */
export function getCollectionPapers(collectionId: string): Paper[] {
  const col = getCollections().find(c => c.id === collectionId)
  if (!col) return []
  return col.paperIds
    .map(pid => col.papers?.[pid])
    .filter((p): p is Paper => !!p)
}

export function exportCollectionBibtex(collectionId: string, papers: Paper[]): string {
  const collection = getCollections().find(c => c.id === collectionId)
  if (!collection) return ''
  const papers_in = papers.filter(p => collection.paperIds.includes(p.paperId))
  return papers_in.map(p => paperToBibtex(p)).join('\n\n')
}

export function paperToBibtex(p: Paper): string {
  const key = p.paperId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'paper'
  const authors = (p.authors || []).map(a => a.name).join(' and ')
  return [
    '@article{' + key + ',',
    `  title = {${(p.title || '').replace(/[{}]/g, '')}},`,
    `  year = {${p.year || ''}},`,
    p.journal ? `  journal = {${p.journal.replace(/[{}]/g, '')}},` : '',
    authors ? `  author = {${authors}},` : '',
    p.doi ? `  doi = {${p.doi}},` : '',
    '}',
  ].filter(Boolean).join('\n')
}

/** RIS export for a single paper (used by the export API route). */
export function paperToRis(p: Paper): string {
  const authors = (p.authors || []).map(a => a.name).join(', ')
  const lines = [
    'TY  - JOUR',
    p.title ? `TI  - ${p.title}` : '',
    p.journal ? `JO  - ${p.journal}` : '',
    p.year ? `PY  - ${p.year}` : '',
    authors ? `AU  - ${authors}` : '',
    p.doi ? `DO  - ${p.doi}` : '',
    p.abstract ? `AB  - ${p.abstract}` : '',
    'ER  - ',
  ].filter(Boolean)
  return lines.join('\n')
}
