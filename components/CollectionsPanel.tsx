'use client'

import { useState, useEffect } from 'react'
import { BookMarked, Plus, Trash2, Edit2, X, Check, FolderOpen } from 'lucide-react'
import {
  getCollections, createCollection, deleteCollection, renameCollection,
  removePaperFromCollection, Collection,
} from '@/lib/collections'
import { Paper } from '@/lib/types'

interface CollectionsPanelProps {
  papers: Paper[]
  currentPaperId?: string
  onClose?: () => void
}

export default function CollectionsPanel({ papers, currentPaperId, onClose }: CollectionsPanelProps) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    setCollections(getCollections())
  }, [])

  function refresh() {
    setCollections(getCollections())
  }

  function handleCreate() {
    if (!newName.trim()) return
    createCollection(newName.trim())
    setNewName('')
    setCreating(false)
    refresh()
  }

  function handleDelete(id: string) {
    deleteCollection(id)
    refresh()
  }

  function startEdit(col: Collection) {
    setEditingId(col.id)
    setEditName(col.name)
  }

  function handleRename(id: string) {
    if (editName.trim()) renameCollection(id, editName.trim())
    setEditingId(null)
    refresh()
  }

  function handleRemovePaper(collectionId: string, paperId: string) {
    removePaperFromCollection(collectionId, paperId)
    refresh()
  }

  function getPapersForCollection(collection: Collection): Paper[] {
    return papers.filter(p => collection.paperIds.includes(p.paperId))
  }

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-500',
    pink: 'bg-pink-500',
    teal: 'bg-teal-500',
    indigo: 'bg-indigo-500',
    rose: 'bg-rose-500',
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-sm text-slate-700">
          <BookMarked className="w-4 h-4" />
          Collections
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setCreating(true); setNewName('') }}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            title="New collection"
          >
            <Plus className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {creating && (
        <div className="p-3 border-b border-slate-100 bg-slate-50">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') { setCreating(false); setNewName('') }
            }}
            placeholder="Collection name..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-blue-400"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleCreate}
              className="flex-1 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => { setCreating(false); setNewName('') }}
              className="flex-1 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="max-h-80 overflow-y-auto">
        {collections.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">
            <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No collections yet
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {collections.map(col => {
              const colPapers = getPapersForCollection(col)
              const isExpanded = expandedId === col.id
              return (
                <div key={col.id}>
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={() => setExpandedId(isExpanded ? null : col.id)}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colorMap[col.color] || 'bg-slate-400'}`} />
                    {editingId === col.id ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRename(col.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        onBlur={() => handleRename(col.id)}
                        onClick={e => e.stopPropagation()}
                        className="flex-1 text-sm px-1 py-0.5 rounded border border-blue-300 focus:outline-none focus:border-blue-400"
                      />
                    ) : (
                      <span className="flex-1 text-sm text-slate-700 truncate">{col.name}</span>
                    )}
                    <span className="text-xs text-slate-400">{colPapers.length}</span>
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={e => { e.stopPropagation(); startEdit(col) }}
                        className="p-1 rounded hover:bg-slate-200 text-slate-400 transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(col.id) }}
                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && colPapers.length > 0 && (
                    <div className="bg-slate-50/50 px-3 py-2">
                      {colPapers.map(paper => (
                        <div key={paper.paperId} className="flex items-center gap-2 py-1 group/row">
                          <span className="flex-1 text-xs text-slate-600 truncate">{paper.title}</span>
                          {currentPaperId !== paper.paperId && (
                            <button
                              onClick={() => handleRemovePaper(col.id, paper.paperId)}
                              className="opacity-0 group-hover/row:opacity-100 p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
