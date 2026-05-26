import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  FileAudio,
  Check,
  Loader2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Settings2,
  Play,
  Trash2,
  RefreshCw,
  User,
  Tag,
  FileText,
  Save,
  Copy,  
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { s3Api, type S3ObjectInfo, type StagingFileMetadata, isDuplicateError, parseDuplicateMessage } from '../../lib/s3Api';
import { formatFileSize } from '../../lib/bulkImportUtils';

interface FileMetadataEdit extends StagingFileMetadata {
  isEditing?: boolean;
  originalFilename: string;
  size: number;
}

export function ProcessUploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<FileMetadataEdit[]>([]);
  const [processing, setProcessing] = useState(false);
  // CHANGED: Added duplicates array to separate from real errors
  const [processResult, setProcessResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
    duplicates: string[];
  } | null>(null);

  // Bulk edit state
  const [bulkSpeaker, setBulkSpeaker] = useState('');
  const [bulkTopic, setBulkTopic] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // Load staging files on mount
  useEffect(() => {
    loadStagingFiles();
  }, []);

  const loadStagingFiles = async () => {
    setLoading(true);
    try {
      const response = await s3Api.listStagingFiles();
      const fileEdits: FileMetadataEdit[] = response.objects.map((obj: S3ObjectInfo) => ({
        stagingKey: obj.s3Key,
        filename: obj.filename,
        originalFilename: obj.filename,
        size: obj.size,
        title: extractTitle(obj.filename),
        speaker: '',
        topic: '',
        series: '',
        description: '',
      }));
      setFiles(fileEdits);
    } catch (error) {
      console.error('Failed to load staging files:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractTitle = (filename: string): string => {
    return filename
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[-_]/g, ' ') // Replace separators with spaces
      .replace(/^\d+[\s.]+/, '') // Remove leading track numbers
      .trim();
  };

  const updateFile = (stagingKey: string, updates: Partial<FileMetadataEdit>) => {
    setFiles(prev => prev.map(f => 
      f.stagingKey === stagingKey ? { ...f, ...updates } : f
    ));
  };

  const toggleSelectFile = (stagingKey: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(stagingKey)) {
        next.delete(stagingKey);
      } else {
        next.add(stagingKey);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.stagingKey)));
    }
  };

  const applyBulkEdit = () => {
    setFiles(prev => prev.map(f => {
      if (selectedFiles.has(f.stagingKey)) {
        return {
          ...f,
          speaker: bulkSpeaker || f.speaker,
          topic: bulkTopic || f.topic,
        };
      }
      return f;
    }));
    setBulkSpeaker('');
    setBulkTopic('');
  };

  const handleProcess = async () => {
    setProcessing(true);
    setProcessResult(null);

    try {
      const request = {
        files: files.map(f => ({
          stagingKey: f.stagingKey,
          filename: f.filename,
          title: f.title,
          speaker: f.speaker,
          topic: f.topic,
          series: f.series,
          description: f.description,
        })),
      };

      const result = await s3Api.processStagedFiles(request);

      const duplicateEntries = result.failed.filter(f => isDuplicateError(f));
      const errorEntries = result.failed.filter(f => !isDuplicateError(f));
      setProcessResult({
        success: result.successCount,
        failed: errorEntries.length,
        errors: errorEntries.map(f => `${f.filename}: ${f.error}`),
        duplicates: duplicateEntries.map(f => `${f.filename}: ${parseDuplicateMessage(f.error)}`),
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['audioStats'] });
      queryClient.invalidateQueries({ queryKey: ['stagingAudio'] });

      // CHANGED: Redirect if no real errors (duplicates are informational, not blocking)
      if (errorEntries.length === 0) {
        setTimeout(() => {
          navigate('/admin/staging');
        }, 2000);
      }
    } catch (error) {
      console.error('Processing failed:', error);
      setProcessResult({
        success: 0,
        failed: files.length,
        errors: ['Processing failed: ' + (error instanceof Error ? error.message : 'Unknown error')],
        duplicates: [],
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleClearStaging = async () => {
    if (!confirm('Are you sure you want to delete all staged files? This cannot be undone.')) {
      return;
    }

    try {
      await s3Api.clearStaging();
      setFiles([]);
      navigate('/admin/bulk-upload');
    } catch (error) {
      console.error('Failed to clear staging:', error);
    }
  };

  // Calculate stats
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const filesWithSpeaker = files.filter(f => f.speaker).length;
  const filesWithTopic = files.filter(f => f.topic).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <FileAudio className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">No Files in Staging</h2>
            <p className="text-slate-500 mb-6">
              Upload files first, then come back here to organize metadata.
            </p>
            <button
              onClick={() => navigate('/admin/bulk-upload')}
              className="px-5 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700"
            >
              Go to Bulk Upload
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-slate-900">Process Uploaded Files</h1>
        <p className="text-slate-500 mt-1">
          Organize metadata for your uploaded files before importing
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-4 gap-4"
      >
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{files.length}</p>
            <p className="text-sm text-slate-500">Files</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{formatFileSize(totalSize)}</p>
            <p className="text-sm text-slate-500">Total Size</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{filesWithSpeaker}</p>
            <p className="text-sm text-slate-500">With Speaker</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{filesWithTopic}</p>
            <p className="text-sm text-slate-500">With Topic</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Bulk Edit Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bulk Edit</CardTitle>
            <CardDescription>
              Select files and apply metadata to all at once
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <User className="w-4 h-4 inline mr-1" />
                  Speaker
                </label>
                <input
                  type="text"
                  value={bulkSpeaker}
                  onChange={(e) => setBulkSpeaker(e.target.value)}
                  placeholder="e.g., Rabbi Cohen"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Tag className="w-4 h-4 inline mr-1" />
                  Topic
                </label>
                <input
                  type="text"
                  value={bulkTopic}
                  onChange={(e) => setBulkTopic(e.target.value)}
                  placeholder="e.g., Torah Study"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={applyBulkEdit}
                disabled={selectedFiles.size === 0 || (!bulkSpeaker && !bulkTopic)}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 
                           disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Apply to {selectedFiles.size} selected
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Files Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Files to Process</CardTitle>
                <CardDescription>
                  Edit titles, speakers, and topics for each file
                </CardDescription>
              </div>
              <button
                onClick={selectAll}
                className="text-sm text-violet-600 hover:text-violet-700 font-medium"
              >
                {selectedFiles.size === files.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-2 w-8">
                      <input
                        type="checkbox"
                        checked={selectedFiles.size === files.length}
                        onChange={selectAll}
                        className="rounded border-slate-300"
                      />
                    </th>
                    <th className="text-left py-3 px-2">Title</th>
                    <th className="text-left py-3 px-2">Speaker</th>
                    <th className="text-left py-3 px-2">Topic</th>
                    <th className="text-left py-3 px-2 w-24">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file, index) => (
                    <motion.tr
                      key={file.stagingKey}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-2 px-2">
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(file.stagingKey)}
                          onChange={() => toggleSelectFile(file.stagingKey)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={file.title}
                          onChange={(e) => updateFile(file.stagingKey, { title: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                        />
                        <p className="text-xs text-slate-400 mt-0.5 truncate" title={file.originalFilename}>
                          {file.originalFilename}
                        </p>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={file.speaker || ''}
                          onChange={(e) => updateFile(file.stagingKey, { speaker: e.target.value })}
                          placeholder="Speaker name"
                          className="w-full px-2 py-1 rounded border border-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={file.topic || ''}
                          onChange={(e) => updateFile(file.stagingKey, { topic: e.target.value })}
                          placeholder="Topic"
                          className="w-full px-2 py-1 rounded border border-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="py-2 px-2 text-slate-500">
                        {formatFileSize(file.size)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Result Message */}
      <AnimatePresence>
        {processResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className={processResult.failed === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {processResult.failed === 0 ? (
                    <Check className="w-5 h-5 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">
                      {processResult.failed === 0
                        ? `Successfully imported ${processResult.success} files!`
                        : `Imported ${processResult.success} files, ${processResult.failed} failed`}
                      {processResult.duplicates.length > 0 &&
                        ` (${processResult.duplicates.length} duplicate${processResult.duplicates.length > 1 ? 's' : ''} skipped)`}
                    </p>
                    {/* Duplicates — info box */}
                    {processResult.duplicates.length > 0 && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Copy className="w-3.5 h-3.5 text-blue-600" />
                          <p className="text-sm font-medium text-blue-800">
                            {processResult.duplicates.length} duplicate{processResult.duplicates.length > 1 ? 's' : ''} skipped:
                          </p>
                        </div>
                        <ul className="text-sm text-blue-700 space-y-0.5">
                          {processResult.duplicates.slice(0, 5).map((d, i) => (
                            <li key={`dup-${i}`}>• {d}</li>
                          ))}
                          {processResult.duplicates.length > 5 && (
                            <li>• ...and {processResult.duplicates.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                    {/* Real errors — warning box */}
                    {processResult.errors.length > 0 && (
                      <ul className="text-sm text-slate-600 mt-2 space-y-1">
                        {processResult.errors.slice(0, 5).map((err, i) => (
                          <li key={`err-${i}`}>• {err}</li>
                        ))}
                        {processResult.errors.length > 5 && (
                          <li>• ...and {processResult.errors.length - 5} more errors</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex justify-between"
      >
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/admin/bulk-upload')}
            className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium 
                       hover:bg-slate-50 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Upload
          </button>
          <button
            onClick={handleClearStaging}
            className="px-5 py-2.5 rounded-lg border border-red-200 text-red-600 font-medium 
                       hover:bg-red-50 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
        <button
          onClick={handleProcess}
          disabled={processing || files.length === 0}
          className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 
                     text-white font-medium hover:opacity-90 disabled:opacity-50 
                     flex items-center gap-2"
        >
          {processing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Import {files.length} Files
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
}

export default ProcessUploadPage;