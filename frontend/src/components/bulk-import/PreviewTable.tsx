import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileAudio,
  Edit2,
  Check,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import type { MappedAudioFile } from '../../types/bulkImport';
import { formatFileSize, validateMappedFile } from '../../lib/bulkImportUtils';
import { Badge } from '../ui/Badge';

interface PreviewTableProps {
  files: MappedAudioFile[];
  onFileUpdate: (index: number, updatedFile: MappedAudioFile) => void;
  maxPreview?: number;
}

export function PreviewTable({ files, onFileUpdate, maxPreview = 100 }: PreviewTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Filter files by search term
  const filteredFiles = files.filter(file =>
    file.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.speaker?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.topic?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.originalPath.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Limit display for performance
  const displayFiles = showAll ? filteredFiles : filteredFiles.slice(0, maxPreview);

  // Count validation errors
  const errorCount = files.filter(f => validateMappedFile(f).length > 0).length;

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <FileAudio className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p>No audio files detected</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search and stats */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h3 className="font-medium text-slate-900">
            Preview: {files.length} files
          </h3>
          {errorCount > 0 && (
            <Badge variant="danger">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errorCount} with errors
            </Badge>
          )}
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 
                       focus:ring-2 focus:ring-violet-500 focus:border-transparent w-64"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-12">#</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Title</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Speaker</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Topic</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-24">Size</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayFiles.map((file, index) => {
                const errors = validateMappedFile(file);
                const hasErrors = errors.length > 0;
                const isExpanded = expandedRows.has(index);
                const isEditing = editingRow === index;
                
                return (
                  <React.Fragment key={file.originalPath}>
                    <tr 
                      className={`
                        hover:bg-slate-50/50 transition-colors
                        ${hasErrors ? 'bg-rose-50/50' : ''}
                        ${file.isEdited ? 'bg-amber-50/30' : ''}
                      `}
                    >
                      <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileAudio className="w-4 h-4 text-violet-500 shrink-0" />
                          {isEditing ? (
                            <EditableCell
                              value={file.title}
                              onSave={(value) => {
                                onFileUpdate(index, { ...file, title: value, isEdited: true });
                              }}
                              onCancel={() => setEditingRow(null)}
                            />
                          ) : (
                            <span className="font-medium text-slate-900 truncate max-w-xs">
                              {file.title}
                            </span>
                          )}
                          {file.isEdited && (
                            <Badge variant="default" className="text-xs">edited</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {file.speaker ? (
                          <span className="text-slate-700">{file.speaker}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {file.topic ? (
                          <Badge variant="outline">{file.topic}</Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {file.sizeBytes ? formatFileSize(file.sizeBytes) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingRow(isEditing ? null : index)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 
                                       hover:text-violet-600 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleExpand(index)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 
                                       hover:text-slate-700 transition-colors"
                            title="Show details"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded details row */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.tr
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <td colSpan={6} className="bg-slate-50 px-4 py-3">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                  Original Path
                                </label>
                                <p className="font-mono text-xs text-slate-600 mt-1 break-all">
                                  {file.originalPath}
                                </p>
                              </div>
                              {file.series && (
                                <div>
                                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                    Series
                                  </label>
                                  <p className="text-slate-700 mt-1">{file.series}</p>
                                </div>
                              )}
                              {hasErrors && (
                                <div className="col-span-2">
                                  <div className="flex items-center gap-2 text-rose-600">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="text-sm font-medium">Validation Errors:</span>
                                  </div>
                                  <ul className="mt-1 text-sm text-rose-600 list-disc list-inside">
                                    {errors.map((error, i) => (
                                      <li key={i}>{error}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Show more button */}
        {filteredFiles.length > maxPreview && !showAll && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-center">
            <button
              onClick={() => setShowAll(true)}
              className="text-sm text-violet-600 hover:text-violet-700 font-medium"
            >
              Show all {filteredFiles.length} files
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface EditableCellProps {
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

function EditableCell({ value, onSave, onCancel }: EditableCellProps) {
  const [editValue, setEditValue] = useState(value);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave(editValue);
      onCancel();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="flex items-center gap-2 flex-1">
      <input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        className="flex-1 px-2 py-1 text-sm rounded border border-violet-300 
                   focus:ring-2 focus:ring-violet-500 focus:border-transparent"
      />
      <button
        onClick={() => { onSave(editValue); onCancel(); }}
        className="p-1 rounded bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
      >
        <Check className="w-3 h-3" />
      </button>
      <button
        onClick={onCancel}
        className="p-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export default PreviewTable;

