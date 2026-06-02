import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileAudio,
  X,
  Music,
  Check,
  Loader2,
  AlertCircle,
  Video,
  ArrowRight,
} from 'lucide-react';
import { audioApi, AudioUploadData } from '../../lib/audioApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { isMediaFilename } from '../../lib/mediaTypes';
import { speakerApi } from '../../lib/speakerApi';
import type { SpeakerSummary } from '../../types/speaker';

interface FileWithPreview extends File {
  preview?: string;
}

interface UploadFormData {
  title: string;
  description: string;
  speaker: string;
  topic: string;
  language: string;
}

const isVideoFile = (file: File) =>
  file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(file.name);

export function UploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [currentStep, setCurrentStep] = useState<'upload' | 'details' | 'success'>('upload');
  const [selectedSpeaker, setSelectedSpeaker] = useState<SpeakerSummary | null>(null);
  const [speakerError, setSpeakerError] = useState<string | null>(null);
  const [isResolvingSpeaker, setIsResolvingSpeaker] = useState(false);
  const [debouncedSpeakerQuery, setDebouncedSpeakerQuery] = useState('');
  const [formData, setFormData] = useState<UploadFormData>({
    title: '',
    description: '',
    speaker: '',
    topic: '',
    language: 'en',
  });

  const uploadMutation = useMutation({
    mutationFn: (data: AudioUploadData) => audioApi.upload(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audioStats'] });
      queryClient.invalidateQueries({ queryKey: ['recentDrafts'] });
      queryClient.invalidateQueries({ queryKey: ['stagingAudio'] });
      setCurrentStep('success');
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {

    const mediaFiles = acceptedFiles.filter((file) =>
      file.type.startsWith('audio/') ||
      file.type.startsWith('video/') ||
      isMediaFilename(file.name)
    );
    if (mediaFiles.length > 0) {
      setFiles(mediaFiles);
      // Auto-fill title from filename
      const fileName = mediaFiles[0].name.replace(/\.[^/.]+$/, '');
      setFormData((prev) => ({
        ...prev,
        title: fileName.replace(/[-_]/g, ' '),
      }));
      setCurrentStep('details');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSpeakerQuery(formData.speaker.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [formData.speaker]);

  const speakerQuery = useQuery({
    queryKey: ['speakers', debouncedSpeakerQuery],
    queryFn: ({ signal }) => speakerApi.listSpeakers(debouncedSpeakerQuery, signal),
    enabled: currentStep === 'details' && debouncedSpeakerQuery.length >= 2 && !isResolvingSpeaker,
    staleTime: 30_000,
    retry: false,
  });

  const resolveSpeakerForUpload = async () => {
    const speakerName = formData.speaker.trim();
    if (!speakerName) {
      return { speaker: undefined, speakerId: undefined };
    }

    if (selectedSpeaker && selectedSpeaker.name.toLowerCase() === speakerName.toLowerCase()) {
      return { speaker: selectedSpeaker.name, speakerId: selectedSpeaker.id };
    }

    const exactMatch = speakerQuery.data?.find(
      (speaker) => speaker.name.toLowerCase() === speakerName.toLowerCase()
    );
    if (exactMatch) {
      return { speaker: exactMatch.name, speakerId: exactMatch.id };
    }

    try {
      const createdSpeaker = await speakerApi.createSpeaker({ name: speakerName });
      queryClient.invalidateQueries({ queryKey: ['speakers'] });
      return { speaker: createdSpeaker.name, speakerId: createdSpeaker.id };
    } catch (error: any) {
      const message = String(error?.response?.data?.message ?? error?.message ?? '').toLowerCase();
      if (!message.includes('already exists')) {
        throw error;
      }

      const existingSpeakers = await speakerApi.listSpeakers(speakerName);
      const existingSpeaker = existingSpeakers.find(
        (speaker) => speaker.name.toLowerCase() === speakerName.toLowerCase()
      );
      if (!existingSpeaker) {
        throw error;
      }

      return { speaker: existingSpeaker.name, speakerId: existingSpeaker.id };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = files[0];

    try {
      setSpeakerError(null);
      setIsResolvingSpeaker(true);
      const speakerFields = await resolveSpeakerForUpload();
      setIsResolvingSpeaker(false);

      uploadMutation.mutate({
        file: file,
        title: formData.title,
        description: formData.description || undefined,
        speaker: speakerFields.speaker,
        speakerId: speakerFields.speakerId,
        category: formData.topic || undefined,
        mimeType: file.type || undefined,
        sizeBytes: file.size,
      });
    } catch (error) {
      setIsResolvingSpeaker(false);
      setSpeakerError(error instanceof Error ? error.message : 'Unable to save speaker.');
    }
  };

  const resetForm = () => {
    setFiles([]);
    setSelectedSpeaker(null);
    setSpeakerError(null);
    setIsResolvingSpeaker(false);
    setFormData({
      title: '',
      description: '',
      speaker: '',
      topic: '',
      language: 'en',
    });
    setCurrentStep('upload');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-slate-900">Upload Audio</h1>
        <p className="text-slate-500 mt-1">
          Add new audio or video files to your library. They'll be saved as drafts for review.
        </p>
      </motion.div>

      {/* Progress Steps */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-center gap-4"
      >
        {['upload', 'details', 'success'].map((step, index) => (
          <React.Fragment key={step}>
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  currentStep === step
                    ? 'bg-violet-600 text-white'
                    : index < ['upload', 'details', 'success'].indexOf(currentStep)
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {index < ['upload', 'details', 'success'].indexOf(currentStep) ? (
                  <Check className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`hidden sm:inline text-sm font-medium ${
                  currentStep === step ? 'text-slate-900' : 'text-slate-500'
                }`}
              >
                {step.charAt(0).toUpperCase() + step.slice(1)}
              </span>
            </div>
            {index < 2 && (
              <div className="w-12 h-0.5 bg-slate-200">
                <div
                  className={`h-full bg-violet-600 transition-all ${
                    index < ['upload', 'details', 'success'].indexOf(currentStep)
                      ? 'w-full'
                      : 'w-0'
                  }`}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {/* Step 1: Upload */}
        {currentStep === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card>
              <CardContent className="p-8">
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                    isDragActive
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-slate-300 hover:border-violet-400 hover:bg-slate-50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center gap-4">
                    <div
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
                        isDragActive
                          ? 'bg-violet-100 text-violet-600'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      <Upload className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-slate-700">
                        {isDragActive ? 'Drop your file here' : 'Drag & drop audio or video file'}
                      </p>
                      <p className="text-slate-500 mt-1">
                        or click to browse • MP3, WAV, OGG, M4A, FLAC, AAC, MP4, MOV, AVI, MKV, WEBM, M4V
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Music className="w-4 h-4" />
                      <span>Maximum file size: 500MB</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Details */}
        {currentStep === 'details' && (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Media Details</CardTitle>
                <CardDescription>
                  Fill in the metadata for your file
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* File Preview */}
                {files[0] && (
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                        {isVideoFile(files[0]) ? (
                          <Video className="w-6 h-6 text-white" />
                        ) : (
                          <FileAudio className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{files[0].name}</p>
                        <p className="text-sm text-slate-500">
                          {files[0].type} • {formatFileSize(files[0].size)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={resetForm}
                      className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-500"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      placeholder="Enter audio title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                      placeholder="Brief description of the audio content"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Speaker
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.speaker}
                          onChange={(e) => {
                            setFormData({ ...formData, speaker: e.target.value });
                            setSelectedSpeaker(null);
                            setSpeakerError(null);
                          }}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                          placeholder="Start typing a speaker name"
                          autoComplete="off"
                        />
                        {formData.speaker.trim() && !selectedSpeaker && (
                          <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                            {formData.speaker.trim().length < 2 ? (
                              <div className="px-4 py-2 text-sm text-slate-500">Type at least 2 characters to search speakers.</div>
                            ) : speakerQuery.isLoading || debouncedSpeakerQuery !== formData.speaker.trim() ? (
                              <div className="px-4 py-2 text-sm text-slate-500">Searching speakers...</div>
                            ) : speakerQuery.data && speakerQuery.data.length > 0 ? (
                              <>
                                {speakerQuery.data.map((speaker) => (
                                  <button
                                    key={speaker.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedSpeaker(speaker);
                                      setFormData({ ...formData, speaker: speaker.name });
                                      setSpeakerError(null);
                                    }}
                                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-slate-50"
                                  >
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
                                      {speaker.name.charAt(0).toUpperCase()}
                                    </span>
                                    <span className="font-medium text-slate-700">{speaker.name}</span>
                                  </button>
                                ))}
                                <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                                  Press Save as Draft to create "{formData.speaker.trim()}" if none of these match.
                                </div>
                              </>
                            ) : (
                              <div className="px-4 py-2 text-sm text-slate-500">
                                New speaker "{formData.speaker.trim()}" will be created on upload.
                              </div>
                            )}
                          </div>
                        )}
                        {selectedSpeaker && (
                          <p className="mt-1 text-xs text-emerald-600">
                            Linked to speaker profile: {selectedSpeaker.name}
                          </p>
                        )}
                        {speakerError && (
                          <p className="mt-1 text-xs text-rose-600">{speakerError}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Topic
                      </label>
                      <input
                        type="text"
                        value={formData.topic}
                        onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        placeholder="Topic or category"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Language
                    </label>
                    <select
                      value={formData.language}
                      onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                      aria-label="Language"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="he">Hebrew</option>
                      <option value="yi">Yiddish</option>
                    </select>
                  </div>

                  {uploadMutation.isError && (
                    <div className="flex items-center gap-2 p-4 bg-rose-50 rounded-lg text-rose-700">
                      <AlertCircle className="w-5 h-5" />
                      <span>Failed to upload. Please try again.</span>
                    </div>
                  )}

                  <div className="flex justify-between pt-4">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={uploadMutation.isPending || isResolvingSpeaker}
                      className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      {uploadMutation.isPending || isResolvingSpeaker ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {isResolvingSpeaker ? 'Preparing speaker...' : 'Uploading...'}
                        </>
                      ) : (
                        <>
                          Save as Draft
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Success */}
        {currentStep === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card>
              <CardContent className="p-12 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6"
                >
                  <Check className="w-10 h-10 text-emerald-600" />
                </motion.div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Upload Successful!</h2>
                <p className="text-slate-500 mb-8 max-w-sm mx-auto">
                  Your audio has been saved as a draft. You can review and publish it from the staging area.
                </p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={resetForm}
                    className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors inline-flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Another
                  </button>
                  <button
                    onClick={() => navigate('/admin/staging')}
                    className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2"
                  >
                    Go to Staging
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
