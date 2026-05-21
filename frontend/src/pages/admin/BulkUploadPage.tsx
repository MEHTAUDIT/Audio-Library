import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  FolderOpen,
  Server,
  FileArchive,
  Check,
  Loader2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Settings2,
  Eye,
  Play,
  RefreshCw,
  Info,
  Copy,  // ADDED: icon for duplicate files
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { FolderMappingConfig } from '../../components/bulk-import/FolderMappingConfig';
import { PreviewTable } from '../../components/bulk-import/PreviewTable';
import {
  analyzeStructure,
  buildSuggestedMapping,
  applyMappingToFiles,
  formatFileSize,
  calculateTotalSize,
} from '../../lib/bulkImportUtils';
import { audioApi } from '../../lib/audioApi';
import { api } from '../../lib/api';
import { s3Api, type UploadProgress as S3UploadProgress, isDuplicateError, parseDuplicateMessage, splitDuplicatesAndErrors } from '../../lib/s3Api';
import type {
  DetectedStructure,
  FolderStructureMapping,
  MappedAudioFile,
} from '../../types/bulkImport';

type UploadMode = 'browser' | 'server';
type Step = 'select' | 'configure' | 'preview' | 'upload' | 'complete';

interface UploadProgress {
  total: number;
  completed: number;
  failed: number;
  current: string;
  errors: Array<{ file: string; error: string; isDuplicate?: boolean }>; // CHANGED: added isDuplicate flag
}

export function BulkUploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quickUploadRef = useRef<HTMLInputElement>(null);

  // State
  // CHANGED: Default to 'server' mode — S3 check will switch to 'browser' if S3 is enabled
  const [mode, setMode] = useState<UploadMode>('server');
  const [step, setStep] = useState<Step>('select');
  const [files, setFiles] = useState<File[]>([]);
  const [structure, setStructure] = useState<DetectedStructure | null>(null);
  const [mapping, setMapping] = useState<FolderStructureMapping | null>(null);
  const [mappedFiles, setMappedFiles] = useState<MappedAudioFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  
  // Server mode state
  const [serverPath, setServerPath] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  
  // S3 mode state
  const [useS3, setUseS3] = useState<boolean | null>(null);
  const [s3Progress, setS3Progress] = useState<Map<string, S3UploadProgress>>(new Map());

  // Handle folder selection (browser mode)
  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setFiles(selectedFiles);
    
    // Analyze structure
    const fileData = selectedFiles.map(f => ({
      relativePath: (f as any).webkitRelativePath || f.name,
      name: f.name,
      size: f.size,
    }));
    
    const detectedStructure = analyzeStructure(fileData);
    setStructure(detectedStructure);
    
    // Build suggested mapping
    const suggestedMapping = buildSuggestedMapping(detectedStructure);
    setMapping(suggestedMapping);
    
    // Move to configure step
    setStep('configure');
  }, []);

  // Handle quick upload (S3 staging mode - upload first, organize metadata after)
  const handleQuickUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    if (!useS3) {
      alert('Quick upload requires S3 to be enabled. Please use the standard upload flow.');
      return;
    }

    // Filter to audio files only
    const audioFiles = selectedFiles.filter(f => 
      /\.(mp3|wav|ogg|m4a|flac|aac|wma|mp4|mkv|avi|mov|webm|wmv|m4v)$/i.test(f.name) // CHANGED: added video formats
    );

    if (audioFiles.length === 0) {
      alert('No audio files found in the selected folder.');
      return;
    }

    setFiles(audioFiles);
    setStep('upload');
    setUploadProgress({
      total: audioFiles.length,
      completed: 0,
      failed: 0,
      current: 'Starting upload...',
      errors: [],
    });

    try {
      // Upload directly to S3 staging
      const result = await s3Api.uploadToStaging(
        audioFiles,
        3, // concurrency
        (progressMap) => {
          let completed = 0;
          let failed = 0;
          let current = '';
          const errors: Array<{ file: string; error: string }> = [];
          
          progressMap.forEach(progress => {
            if (progress.status === 'completed') completed++;
            if (progress.status === 'failed') {
              failed++;
              errors.push({ file: progress.filename, error: progress.error || 'Failed' });
            }
            if (progress.status === 'uploading') current = progress.filename;
          });
          
          setUploadProgress({
            total: audioFiles.length,
            completed,
            failed,
            current,
            errors,
          });
        }
      );

      if (result.success || result.filesUploaded > 0) {
        // Notify backend that uploads are complete
        await s3Api.notifyUploadComplete();
        
        // Redirect to processing page
        navigate('/admin/process-upload');
      } else {
        setUploadProgress(prev => prev ? {
          ...prev,
          errors: result.errors.map(e => ({ file: 'Upload', error: e })),
        } : null);
        setStep('complete');
      }
    } catch (error) {
      console.error('Quick upload error:', error);
      setUploadProgress(prev => prev ? {
        ...prev,
        errors: [{ file: 'Upload', error: error instanceof Error ? error.message : 'Upload failed' }],
      } : null);
      setStep('complete');
    }
  }, [useS3, navigate]);

  // Handle server path scan
  const handleServerScan = async () => {
    if (!serverPath.trim()) return;
    
    setIsScanning(true);
    try {
      // Call backend API to scan the path using the api client (includes auth token)
      const response = await api.post('/bulk-import/scan', { sourcePath: serverPath });
      
      setStructure(response.data.structure);
      setMapping(response.data.suggestedMapping);
      setStep('configure');
    } catch (error) {
      console.error('Scan error:', error);
      alert('Failed to scan the specified path. Please check the path and try again.');
    } finally {
      setIsScanning(false);
    }
  };

  // Apply mapping and generate preview
  const handleGeneratePreview = () => {
    if (!mapping) return;
    
    if (mode === 'browser') {
      const fileData = files.map(f => ({
        relativePath: (f as any).webkitRelativePath || f.name,
        name: f.name,
        size: f.size,
      }));
      
      const mapped = applyMappingToFiles(fileData, mapping);
      setMappedFiles(mapped);
    } else {
      // For server mode, we'll get the mapped files from the backend
      // For now, use the sample files from structure
      if (structure) {
        const mapped = structure.sampleFiles.map(path => {
          const parts = path.split(/[/\\]/);
          return {
            originalPath: path,
            relativePath: path,
            filename: parts[parts.length - 1],
            title: parts[parts.length - 1].replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
          };
        });
        setMappedFiles(mapped as MappedAudioFile[]);
      }
    }
    
    setStep('preview');
  };

  // Handle file update in preview
  const handleFileUpdate = (index: number, updatedFile: MappedAudioFile) => {
    const newFiles = [...mappedFiles];
    newFiles[index] = updatedFile;
    setMappedFiles(newFiles);
  };

  // Check if S3 is enabled on mount
  React.useEffect(() => {
    const checkS3 = async () => {
      try {
        const enabled = await s3Api.isEnabled();
        setUseS3(enabled);
        //  Auto-select mode based on S3 availability
        // S3 enabled → "From Computer" (uploads to S3), S3 disabled → "From Server Path" (local batch)
        setMode(enabled ? 'browser' : 'server');
        console.log('S3 storage:', enabled ? 'enabled' : 'disabled (using local)');
      } catch {
        setUseS3(false);
        setMode('server'); 
      }
    };
    checkS3();
  }, []);

  // Start upload (handles both S3 and local modes)
  const handleStartUpload = async () => {
    setStep('upload');
    setUploadProgress({
      total: mappedFiles.length,
      completed: 0,
      failed: 0,
      current: '',
      errors: [],
    });

    // If S3 is enabled and we're in browser mode, use S3 bulk upload
    if (useS3 && mode === 'browser') {
      await handleS3BulkUpload();
      return;
    }

    if (mode === 'server') {
      try {
        setUploadProgress(prev => prev ? { ...prev, current: 'Importing batch...' } : null);
        
        const result = await api.post('/bulk-import/execute', {
          sourcePath: serverPath,
          mapping: mapping,
          files: mappedFiles,
        });

        const data = result.data;
        setUploadProgress({
          total: data.totalFiles,
          completed: data.successCount,
          failed: data.errorCount + data.duplicateCount,
          current: '',
          errors: [
            ...(data.errors || []).map((e: any) => ({ file: e.filename, error: e.error, isDuplicate: false })),
            ...(data.duplicateFiles || []).map((f: string) => ({ file: f, error: 'Duplicate', isDuplicate: true })), // CHANGED: tagged as duplicate
          ],
        });
      } catch (error) {
        setUploadProgress(prev => prev ? {
          ...prev,
          errors: [{ file: 'Batch import', error: error instanceof Error ? error.message : 'Import failed' }],
        } : null);
      }

      queryClient.invalidateQueries({ queryKey: ['audioStats'] });
      queryClient.invalidateQueries({ queryKey: ['stagingAudio'] });
      setStep('complete');
      return;
    }

    // Browser mode without S3 — upload files one by one via regular upload endpoint
    // CHANGED: errors array now tracks isDuplicate to show duplicates as info, not errors
    const errors: Array<{ file: string; error: string; isDuplicate?: boolean }> = [];
    let completed = 0;
    let failed = 0;

    for (let i = 0; i < mappedFiles.length; i++) {
      const mappedFile = mappedFiles[i];
      
      setUploadProgress(prev => prev ? {
        ...prev,
        current: mappedFile.title,
      } : null);

      try {
        const file = files.find(f => 
          (f as any).webkitRelativePath === mappedFile.originalPath || 
          f.name === mappedFile.filename
        );
        
        if (file) {
          await audioApi.upload({
            file,
            title: mappedFile.title,
            speaker: mappedFile.speaker,
            category: mappedFile.topic,
            description: mappedFile.series,
          });
        }
        completed++;
      } catch (error: any) {
        failed++;
        // CHANGED: Detect 409 duplicate response from AudioController and show friendly message
        if (error.response?.status === 409 && error.response?.data?.error === 'DUPLICATE_FILE') {
          errors.push({
            file: mappedFile.title,
            error: error.response.data.existingTitle
              ? `Already exists as "${error.response.data.existingTitle}"`
              : 'This file already exists in the library',
            isDuplicate: true,
          });
        } else {
          errors.push({
            file: mappedFile.title,
            error: error instanceof Error ? error.message : 'Upload failed',
            isDuplicate: false,
          });
        }
      }

      setUploadProgress({
        total: mappedFiles.length,
        completed,
        failed,
        current: mappedFile.title,
        errors,
      });
    }

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['audioStats'] });
    queryClient.invalidateQueries({ queryKey: ['stagingAudio'] });
    
    setStep('complete');
  };

  // S3 bulk upload with parallel uploads directly to S3
  const handleS3BulkUpload = async () => {
    // Build the upload payload matching files to metadata
    const uploadPayload = mappedFiles.map(mappedFile => {
      const file = files.find(f => 
        (f as any).webkitRelativePath === mappedFile.originalPath || 
        f.name === mappedFile.filename
      );
      
      return {
        file: file!,
        metadata: {
          title: mappedFile.title,
          speaker: mappedFile.speaker,
          topic: mappedFile.topic,
          series: mappedFile.series,
          description: mappedFile.series,
        },
      };
    }).filter(item => item.file);

    try {
      const result = await s3Api.bulkUpload(
        uploadPayload,
        3, // Concurrency: 3 parallel uploads
        (progressMap) => {
          setS3Progress(progressMap);
          
          // Calculate overall progress
          let completed = 0;
          let failed = 0;
          let current = '';
          const errors: Array<{ file: string; error: string }> = [];
          
          progressMap.forEach(progress => {
            if (progress.status === 'completed') completed++;
            if (progress.status === 'failed') {
              failed++;
              errors.push({ file: progress.filename, error: progress.error || 'Upload failed' });
            }
            if (progress.status === 'uploading') current = progress.filename;
          });
          
          setUploadProgress({
            total: mappedFiles.length,
            completed,
            failed,
            current,
            errors,
          });
        }
      );

      // Parse duplicate errors separately from real errors
      // so the UI can display them with different styling (info vs warning)
      const { duplicates, errors: realErrors } = splitDuplicatesAndErrors(result.failed);
      setUploadProgress({
        total: result.totalProcessed,
        completed: result.successCount,
        failed: result.failureCount,
        current: '',
        errors: [
          ...realErrors.map(f => ({ file: f.filename, error: f.error, isDuplicate: false })),
          ...duplicates.map(f => ({ file: f.filename, error: parseDuplicateMessage(f.error), isDuplicate: true })),
        ],
      });
    } catch (error) {
      console.error('S3 bulk upload error:', error);
      setUploadProgress(prev => prev ? {
        ...prev,
        errors: [...prev.errors, { 
          file: 'Bulk upload', 
          error: error instanceof Error ? error.message : 'Upload failed' 
        }],
      } : null);
    }

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['audioStats'] });
    queryClient.invalidateQueries({ queryKey: ['stagingAudio'] });
    
    setStep('complete');
  };

  // Reset to start
  const handleReset = () => {
    setFiles([]);
    setStructure(null);
    setMapping(null);
    setMappedFiles([]);
    setUploadProgress(null);
    setServerPath('');
    setS3Progress(new Map());
    setStep('select');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Progress percentage
  const progressPercent = uploadProgress 
    ? Math.round((uploadProgress.completed / uploadProgress.total) * 100)
    : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-slate-900">Bulk Upload</h1>
        <p className="text-slate-500 mt-1">
          Import multiple audio files with metadata extracted from folder structure
        </p>
      </motion.div>

      {/* Progress Steps */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-center gap-2"
      >
        {[
          { key: 'select', label: 'Select', icon: FolderOpen },
          { key: 'configure', label: 'Configure', icon: Settings2 },
          { key: 'preview', label: 'Preview', icon: Eye },
          { key: 'upload', label: 'Upload', icon: Upload },
          { key: 'complete', label: 'Complete', icon: Check },
        ].map((s, index, arr) => {
          const stepIndex = arr.findIndex(x => x.key === step);
          const thisIndex = index;
          const isActive = step === s.key;
          const isComplete = thisIndex < stepIndex;
          const Icon = s.icon;
          
          return (
            <React.Fragment key={s.key}>
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isActive
                      ? 'bg-violet-600 text-white'
                      : isComplete
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span
                  className={`hidden sm:inline text-sm font-medium ${
                    isActive ? 'text-slate-900' : 'text-slate-500'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {index < arr.length - 1 && (
                <div className="w-8 h-0.5 bg-slate-200">
                  <div
                    className={`h-full bg-violet-600 transition-all ${
                      thisIndex < stepIndex ? 'w-full' : 'w-0'
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </motion.div>

      <AnimatePresence mode="wait">
        {/* Step 1: Select Source */}
        {step === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Mode tabs */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit">
              <button
                onClick={() => setMode('browser')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  mode === 'browser'
                    ? 'bg-white shadow text-slate-900'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FolderOpen className="w-4 h-4 inline-block mr-2" />
                From Computer
              </button>
              <button
                onClick={() => setMode('server')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  mode === 'server'
                    ? 'bg-white shadow text-slate-900'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Server className="w-4 h-4 inline-block mr-2" />
                From Server Path
              </button>
            </div>

            {mode === 'browser' ? (
              <Card>
                <CardContent className="p-8">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer 
                               transition-all border-slate-300 hover:border-violet-400 hover:bg-slate-50"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFolderSelect}
                      {...({ webkitdirectory: 'true', directory: 'true' } as any)}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 
                                      flex items-center justify-center">
                        <FolderOpen className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-lg font-medium text-slate-700">
                          Select a folder to upload
                        </p>
                        <p className="text-slate-500 mt-1">
                          Choose a folder containing your organized audio files
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Info box */}
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg flex gap-3">
                    <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-700">
                      <p className="font-medium">Expected folder structure</p>
                      <p className="mt-1">
                        Organize your files in folders by speaker, topic, or category. 
                        For example: <code className="bg-blue-100 px-1 rounded">Speaker Name / Topic / audio.mp3</code>
                      </p>
                    </div>
                  </div>

                  {/* Quick Upload option (S3 only) */}
                  {useS3 && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-700">Quick Upload Mode</p>
                          <p className="text-sm text-slate-500 mt-0.5">
                            Upload files first, organize metadata after
                          </p>
                        </div>
                        <button
                          onClick={() => quickUploadRef.current?.click()}
                          className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 
                                     text-white font-medium hover:opacity-90 flex items-center gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          Quick Upload Folder
                        </button>
                        <input
                          ref={quickUploadRef}
                          type="file"
                          onChange={handleQuickUpload}
                          {...({ webkitdirectory: 'true', directory: 'true' } as any)}
                          className="hidden"
                        />
                      </div>
                    </div>
                  )}

                  {!useS3 && (
                    <div className="mt-6 p-4 bg-amber-50 rounded-lg flex gap-3">
                      <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-700">
                        <p className="font-medium">Local storage mode</p>
                        <p className="mt-1">
                          S3 is not enabled. Files will be uploaded one at a time to local storage.
                          For faster bulk import, use the <strong>From Server Path</strong> tab —
                          place files on the server and import the entire batch at once.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Server Path</CardTitle>
                  <CardDescription>
                    Enter the path to a folder on the server containing your audio files
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Folder Path
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={serverPath}
                        onChange={(e) => setServerPath(e.target.value)}
                        placeholder="/path/to/audio/library or C:\Audio\Library"
                        className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 
                                   focus:ring-2 focus:ring-violet-500 focus:border-transparent
                                   font-mono text-sm"
                      />
                      <button
                        onClick={handleServerScan}
                        disabled={!serverPath.trim() || isScanning}
                        className="px-5 py-2.5 rounded-lg bg-violet-600 text-white font-medium 
                                   hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed
                                   inline-flex items-center gap-2"
                      >
                        {isScanning ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Scanning...
                          </>
                        ) : (
                          <>
                            <FolderOpen className="w-4 h-4" />
                            Scan Path
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* ZIP upload option */}
                  <div className="pt-4 border-t border-slate-200">
                    <p className="text-sm text-slate-500 mb-3">Or upload a ZIP archive:</p>
                    <button
                      onClick={() => {/* TODO: ZIP upload */}}
                      className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 
                                 font-medium hover:bg-slate-50 inline-flex items-center gap-2"
                    >
                      <FileArchive className="w-4 h-4" />
                      Upload ZIP File
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {/* Step 2: Configure Mapping */}
        {step === 'configure' && structure && mapping && (
          <motion.div
            key="configure"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Configure Folder Mapping</CardTitle>
                <CardDescription>
                  Tell us how your folders are organized so we can extract the right metadata
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Summary */}
                <div className="p-4 bg-slate-50 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Detected</p>
                    <p className="font-medium text-slate-900">
                      {structure.totalFiles} audio files in {structure.levels.length} folder levels
                    </p>
                  </div>
                  {mode === 'browser' && files.length > 0 && (
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Total size</p>
                      <p className="font-medium text-slate-900">
                        {formatFileSize(files.reduce((sum, f) => sum + f.size, 0))}
                      </p>
                    </div>
                  )}
                </div>

                {/* Mapping config */}
                <FolderMappingConfig
                  structure={structure}
                  mapping={mapping}
                  onMappingChange={setMapping}
                />

                {/* Actions */}
                <div className="flex justify-between pt-4 border-t border-slate-200">
                  <button
                    onClick={handleReset}
                    className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 
                               font-medium hover:bg-slate-50 inline-flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    onClick={handleGeneratePreview}
                    className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 
                               text-white font-medium hover:opacity-90 inline-flex items-center gap-2"
                  >
                    Generate Preview
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Review Import</CardTitle>
                <CardDescription>
                  Review and edit the extracted metadata before importing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Summary */}
                <div className="p-4 bg-emerald-50 rounded-lg flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="font-medium text-emerald-900">
                      Ready to import {mappedFiles.length} files
                    </p>
                    <p className="text-sm text-emerald-700">
                      {mode === 'browser' 
                        ? `Total size: ${formatFileSize(calculateTotalSize(mappedFiles))}`
                        : 'Files will be copied from server path'}
                    </p>
                  </div>
                </div>

                {/* Preview table */}
                <PreviewTable
                  files={mappedFiles}
                  onFileUpdate={handleFileUpdate}
                />

                {/* Actions */}
                <div className="flex justify-between pt-4 border-t border-slate-200">
                  <button
                    onClick={() => setStep('configure')}
                    className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 
                               font-medium hover:bg-slate-50 inline-flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Configure
                  </button>
                  <button
                    onClick={handleStartUpload}
                    className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 
                               text-white font-medium hover:opacity-90 inline-flex items-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Start Import ({mappedFiles.length} files)
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 4: Uploading */}
        {step === 'upload' && uploadProgress && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card>
              <CardContent className="p-8">
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-violet-100 flex items-center justify-center mx-auto">
                    <Loader2 className="w-10 h-10 text-violet-600 animate-spin" />
                  </div>
                  
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Uploading files...
                    </h2>
                    <p className="text-slate-500 mt-1">
                      {uploadProgress.completed} of {uploadProgress.total} files complete
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="max-w-md mx-auto">
                    <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-violet-600 to-indigo-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <p className="text-sm text-slate-500 mt-2">
                      {progressPercent}% complete
                    </p>
                  </div>

                  {/* Current file */}
                  <p className="text-sm text-slate-600">
                    Current: <span className="font-medium">{uploadProgress.current}</span>
                  </p>

                  {/* Error count */}
                  {uploadProgress.failed > 0 && (
                    <div className="flex items-center justify-center gap-2 text-amber-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>{uploadProgress.failed} files failed</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && uploadProgress && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card>
              <CardContent className="p-12 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
                    uploadProgress.failed === 0 || uploadProgress.errors.every(e => e.isDuplicate)
                      ? 'bg-emerald-100'
                      : 'bg-amber-100'
                  }`}
                >

                  {uploadProgress.failed === 0 || uploadProgress.errors.every(e => e.isDuplicate) ? (
                    <Check className="w-10 h-10 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-10 h-10 text-amber-600" />
                  )}
                </motion.div>
                

                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  {uploadProgress.failed === 0
                    ? 'Import Complete!'
                    : uploadProgress.errors.every(e => e.isDuplicate)
                      ? 'Import Complete!'
                      : 'Import Completed with Errors'}
                </h2>
                <p className="text-slate-500 mb-2">
                  Successfully imported {uploadProgress.completed} of {uploadProgress.total} files
                  {uploadProgress.errors.filter(e => e.isDuplicate).length > 0 &&
                    ` (${uploadProgress.errors.filter(e => e.isDuplicate).length} duplicate${uploadProgress.errors.filter(e => e.isDuplicate).length > 1 ? 's' : ''} skipped)`}
                </p>
                
                {/* CHANGED: Separate duplicate files (blue/info) from real errors (amber/warning) */}
                {(() => {
                  const duplicates = uploadProgress.errors.filter(e => e.isDuplicate);
                  const realErrors = uploadProgress.errors.filter(e => !e.isDuplicate);
                  return (
                    <div className="max-w-md mx-auto mt-6 mb-8 space-y-4">
                      {/* Duplicates — informational, not failures */}
                      {duplicates.length > 0 && (
                        <div className="p-4 bg-blue-50 rounded-lg text-left">
                          <div className="flex items-center gap-2 mb-2">
                            <Copy className="w-4 h-4 text-blue-600" />
                            <p className="font-medium text-blue-800">
                              {duplicates.length} duplicate{duplicates.length > 1 ? 's' : ''} skipped:
                            </p>
                          </div>
                          <ul className="text-sm text-blue-700 space-y-1 max-h-32 overflow-y-auto">
                            {duplicates.map((err, i) => (
                              <li key={`dup-${i}`}>• {err.file}: {err.error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {/* Real errors — actual failures */}
                      {realErrors.length > 0 && (
                        <div className="p-4 bg-amber-50 rounded-lg text-left">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            <p className="font-medium text-amber-800">
                              {realErrors.length} file{realErrors.length > 1 ? 's' : ''} failed:
                            </p>
                          </div>
                          <ul className="text-sm text-amber-700 space-y-1 max-h-32 overflow-y-auto">
                            {realErrors.map((err, i) => (
                              <li key={`err-${i}`}>• {err.file}: {err.error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}
                
                <div className="flex justify-center gap-4 mt-8">
                  <button
                    onClick={handleReset}
                    className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 
                               font-medium hover:bg-slate-50 inline-flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Import More
                  </button>
                  <a
                    href="/admin/staging"
                    className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 
                               text-white font-medium hover:opacity-90 inline-flex items-center gap-2"
                  >
                    Go to Staging
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BulkUploadPage;