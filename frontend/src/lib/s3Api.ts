import { api } from './api';

// ============ Types ============

export interface UploadUrlRequest {
  filename: string;
  contentType: string;
  fileSize?: number;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  s3Key: string;
  expiresAt: string;
  httpMethod: string;
  headers: Record<string, string>;
  originalFilename?: string;
}

export interface BatchUploadUrlRequest {
  files: UploadUrlRequest[];
}

export interface BatchUploadUrlResponse {
  uploads: PresignedUploadResponse[];
  totalFiles: number;
}

export interface ConfirmUploadRequest {
  s3Key: string;
  filename: string;
  title?: string;
  speaker?: string;
  topic?: string;
  series?: string;
  description?: string;
  tags?: string[];
  genres?: string[];
}

export interface BatchConfirmUploadRequest {
  files: ConfirmUploadRequest[];
}

export interface ConfirmError {
  s3Key: string;
  filename: string;
  error: string;
}

export interface BatchConfirmResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  succeeded: string[];
  failed: ConfirmError[];
}

export interface S3ObjectInfo {
  s3Key: string;
  filename: string;
  size: number;
  lastModified: string;
}

export interface ListObjectsResponse {
  objects: S3ObjectInfo[];
  totalCount: number;
  prefix?: string;
}

// ============ Staging Types ============

export interface StagingStatusResponse {
  tenantId: string;
  filesInStaging: number;
  files: S3ObjectInfo[];
  status: string;
}

export interface StagingFileMetadata {
  stagingKey: string;
  filename: string;
  title?: string;
  speaker?: string;
  topic?: string;
  series?: string;
  description?: string;
  tags?: string[];
  genres?: string[];
}

export interface ProcessStagingRequest {
  files: StagingFileMetadata[];
}

export interface ClearStagingResponse {
  deletedCount: number;
  message: string;
}


export interface MultipartInitiateRequest {
  filename: string;
  contentType: string;
  fileSize: number;
  partSize?: number;
}

export interface MultipartInitiateResponse {
  uploadId: string;
  s3Key: string;
  partSize: number;
  totalParts: number;
  multipartThreshold: number;
  partUrls: MultipartPartUrl[];
}

export interface MultipartPartUrl {
  partNumber: number;
  uploadUrl: string;
  offset: number;
  size: number;
}

export interface CompletedPart {
  partNumber: number;
  eTag: string;
}

export interface MultipartStatusResponse {
  uploadId: string;
  s3Key: string;
  partSize: number;
  totalParts: number;
  uploadedParts: Array<{ partNumber: number; eTag: string; size: number }>;
  remainingPartNumbers: number[];
  remainingPartUrls: MultipartPartUrl[];
}

/** Tracks in-progress multipart upload for resume */
export interface MultipartUploadState {
  uploadId: string;
  s3Key: string;
  filename: string;
  fileSize: number;
  partSize: number;
  totalParts: number;
  completedParts: CompletedPart[];
  startedAt: string;
}

export interface MultipartProgress {
  filename: string;
  s3Key: string;
  totalBytes: number;
  uploadedBytes: number;
  percent: number;
  partsCompleted: number;
  partsTotal: number;
  status: 'uploading' | 'completing' | 'completed' | 'failed' | 'resuming';
  resumeState: MultipartUploadState;
}

// ============ Upload Progress Tracking ============

export interface UploadProgress {
  filename: string;
  s3Key: string;
  loaded: number;
  total: number;
  percent: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
}

export type ProgressCallback = (progress: UploadProgress) => void;

/** Prefix the backend uses for duplicate file errors */
export const DUPLICATE_ERROR_PREFIX = 'DUPLICATE_FILE:';

/** 409 response body from single-file confirmUpload */
export interface DuplicateFileInfo {
  error: 'DUPLICATE_FILE';
  message: string;
  existingAudioId: string;
  existingTitle: string;
}

/** Check if a ConfirmError is a duplicate (not a real failure) */
export function isDuplicateError(err: ConfirmError): boolean {
  return err.error.startsWith(DUPLICATE_ERROR_PREFIX);
}

/** Strip the DUPLICATE_FILE: prefix and return a user-friendly message */
export function parseDuplicateMessage(error: string): string {
  if (error.startsWith(DUPLICATE_ERROR_PREFIX)) {
    return error.substring(DUPLICATE_ERROR_PREFIX.length).trim();
  }
  return error;
}

/** Split a BatchConfirmResult's failed array into duplicates and real errors */
export function splitDuplicatesAndErrors(failed: ConfirmError[]): {
  duplicates: ConfirmError[];
  errors: ConfirmError[];
} {
  const duplicates: ConfirmError[] = [];
  const errors: ConfirmError[] = [];
  for (const err of failed) {
    if (isDuplicateError(err)) {
      duplicates.push(err);
    } else {
      errors.push(err);
    }
  }
  return { duplicates, errors };
}

// ============ API Functions ============

export const s3Api = {
  /**
   * Check if S3 is enabled on the backend
   */
  isEnabled: async (): Promise<boolean> => {
    try {
      const response = await api.get<{ s3Enabled: boolean }>('/storage/capabilities');
      return response.data.s3Enabled;
    } catch {
      return false;
    }
  },

  /**
   * Get a pre-signed URL for uploading a single file
   */
  getUploadUrl: async (request: UploadUrlRequest): Promise<PresignedUploadResponse> => {
    const response = await api.post<PresignedUploadResponse>('/s3/upload-url', request);
    return response.data;
  },

  /**
   * Get pre-signed URLs for batch upload
   */
  getBatchUploadUrls: async (request: BatchUploadUrlRequest): Promise<BatchUploadUrlResponse> => {
    const response = await api.post<BatchUploadUrlResponse>('/s3/upload-urls/batch', request);
    return response.data;
  },

  /**
   * Upload a file directly to S3 using a pre-signed URL
   */
  uploadToS3: async (
    file: File,
    presigned: PresignedUploadResponse,
    onProgress?: ProgressCallback
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress({
            filename: file.name,
            s3Key: presigned.s3Key,
            loaded: event.loaded,
            total: event.total,
            percent: Math.round((event.loaded / event.total) * 100),
            status: 'uploading',
          });
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (onProgress) {
            onProgress({
              filename: file.name,
              s3Key: presigned.s3Key,
              loaded: file.size,
              total: file.size,
              percent: 100,
              status: 'completed',
            });
          }
          resolve();
        } else {
          const error = `Upload failed with status ${xhr.status}`;
          if (onProgress) {
            onProgress({
              filename: file.name,
              s3Key: presigned.s3Key,
              loaded: 0,
              total: file.size,
              percent: 0,
              status: 'failed',
              error,
            });
          }
          reject(new Error(error));
        }
      });
      
      xhr.addEventListener('error', () => {
        const error = 'Network error during upload';
        if (onProgress) {
          onProgress({
            filename: file.name,
            s3Key: presigned.s3Key,
            loaded: 0,
            total: file.size,
            percent: 0,
            status: 'failed',
            error,
          });
        }
        reject(new Error(error));
      });
      
      xhr.open(presigned.httpMethod, presigned.uploadUrl);
      
      // Set required headers
      Object.entries(presigned.headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
      
      xhr.send(file);
    });
  },

  /**
   * Confirm a single upload and create audio record.
   * Throws DuplicateFileInfo (as error.duplicateInfo) if the file is a duplicate.
   */
  confirmUpload: async (request: ConfirmUploadRequest): Promise<void> => {
    try {
      await api.post('/s3/confirm-upload', request);
    } catch (error: any) {
      if (error.response?.status === 409 && error.response?.data?.error === 'DUPLICATE_FILE') {
        // CHANGED: Wrap 409 in a typed error so callers can handle duplicates gracefully
        const dupError = new Error(
          error.response.data.message || 'This file already exists in the library'
        ) as Error & { duplicateInfo: DuplicateFileInfo };
        dupError.duplicateInfo = error.response.data as DuplicateFileInfo;
        throw dupError;
      }
      throw error; // re-throw non-duplicate errors
    }
  },

  /**
   * Confirm multiple uploads at once
   */
  confirmBatchUploads: async (request: BatchConfirmUploadRequest): Promise<BatchConfirmResult> => {
    const response = await api.post<BatchConfirmResult>('/s3/confirm-uploads/batch', request);
    return response.data;
  },

  /**
   * List files in S3 for the current tenant
   */
  listFiles: async (subPath?: string): Promise<ListObjectsResponse> => {
    const params = subPath ? { subPath } : {};
    const response = await api.get<ListObjectsResponse>('/s3/files', { params });
    return response.data;
  },

  /**
   * Upload a file with automatic pre-signed URL handling
   * This is the high-level function for single file upload
   */
  uploadFile: async (
    file: File,
    metadata: Omit<ConfirmUploadRequest, 's3Key' | 'filename'>,
    onProgress?: ProgressCallback
  ): Promise<void> => {
    // ADDED: Route large files through multipart upload
    const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100MB

    if (file.size > MULTIPART_THRESHOLD) {
      const result = await s3Api.multipartUpload(file, {
        onProgress: (mp) => {
          onProgress?.({
            filename: file.name,
            s3Key: mp.s3Key,
            loaded: mp.uploadedBytes,
            total: mp.totalBytes,
            percent: mp.percent,
            status: mp.status === 'completed' ? 'completed' : 'uploading',
          });
        },
      });
      // Confirm upload after multipart complete
      await s3Api.confirmUpload({ s3Key: result.s3Key, filename: file.name, ...metadata });
      return;
    }

    // Small files: existing single PUT flow
    // 1. Get pre-signed URL
    const presigned = await s3Api.getUploadUrl({
      filename: file.name,
      contentType: file.type || 'application/octet-stream', 
      fileSize: file.size,
    });
    
    // 2. Upload to S3
    await s3Api.uploadToS3(file, presigned, onProgress);
    
    // 3. Confirm upload and create audio record
    await s3Api.confirmUpload({
      s3Key: presigned.s3Key,
      filename: file.name,
      ...metadata,
    });
  },

  /**
   * Bulk upload files with parallel S3 uploads
   * @param files Array of files with metadata
   * @param concurrency Number of parallel uploads (default 3)
   * @param onProgress Progress callback for each file
   */
  bulkUpload: async (
    files: Array<{ file: File; metadata: Omit<ConfirmUploadRequest, 's3Key' | 'filename'> }>,
    concurrency: number = 3,
    onProgress?: (progress: Map<string, UploadProgress>) => void
  ): Promise<BatchConfirmResult> => {
    // 1. Get all pre-signed URLs at once
    const urlRequest: BatchUploadUrlRequest = {
      files: files.map(f => ({
        filename: f.file.name,
        contentType: f.file.type || 'application/octet-stream',  
        fileSize: f.file.size,
      })),
    };
    
    const urlResponse = await s3Api.getBatchUploadUrls(urlRequest);
    
    // Map original files to their pre-signed URLs
    const uploadMap = new Map<string, { file: File; presigned: PresignedUploadResponse; metadata: any }>();
    files.forEach((f, index) => {
      const presigned = urlResponse.uploads[index];
      uploadMap.set(presigned.s3Key, {
        file: f.file,
        presigned,
        metadata: f.metadata,
      });
    });
    
    // Track progress for all files
    const progressMap = new Map<string, UploadProgress>();
    uploadMap.forEach((value, key) => {
      progressMap.set(key, {
        filename: value.file.name,
        s3Key: key,
        loaded: 0,
        total: value.file.size,
        percent: 0,
        status: 'pending',
      });
    });
    
    // 2. Upload to S3 in parallel with concurrency limit
    const uploadQueue = Array.from(uploadMap.entries());
    const results: { s3Key: string; success: boolean; error?: string }[] = [];
    
    // ADDED: Multipart threshold — files above this size use chunked resumable upload
    const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100MB

    const uploadWorker = async () => {
      while (uploadQueue.length > 0) {
        const entry = uploadQueue.shift();
        if (!entry) break;
        
        const [s3Key, { file, presigned }] = entry;
        
        try {
          // ADDED: Route large files through multipart upload for resumability
          if (file.size > MULTIPART_THRESHOLD) {
            const multipartResult = await s3Api.multipartUpload(file, {
              onProgress: (mp) => {
                progressMap.set(s3Key, {
                  filename: file.name,
                  s3Key: mp.s3Key,
                  loaded: mp.uploadedBytes,
                  total: mp.totalBytes,
                  percent: mp.percent,
                  status: mp.status === 'completed' ? 'completed' : 'uploading',
                });
                if (onProgress) onProgress(new Map(progressMap));
              },
            });
            // Use the multipart s3Key (may differ from presigned key)
            results.push({ s3Key: multipartResult.s3Key, success: true });
          } else {
            // Small files: existing single PUT flow
            await s3Api.uploadToS3(file, presigned, (progress) => {
              progressMap.set(s3Key, progress);
              if (onProgress) onProgress(new Map(progressMap));
            });
            results.push({ s3Key, success: true });
          }
        } catch (error: any) {
          results.push({ s3Key, success: false, error: error.message });
          progressMap.set(s3Key, {
            filename: file.name,
            s3Key,
            loaded: 0,
            total: file.size,
            percent: 0,
            status: 'failed',
            error: error.message,
          });
          if (onProgress) {
            onProgress(new Map(progressMap));
          }
        }
      }
    };
    
    // Start workers
    const workers = Array(Math.min(concurrency, uploadQueue.length))
      .fill(null)
      .map(() => uploadWorker());
    
    await Promise.all(workers);
    
    // 3. Confirm successful uploads
    const successfulUploads = results.filter(r => r.success);
    const confirmRequest: BatchConfirmUploadRequest = {
      files: successfulUploads.map(r => {
        const upload = uploadMap.get(r.s3Key)!;
        return {
          s3Key: r.s3Key,
          filename: upload.file.name,
          ...upload.metadata,
        };
      }),
    };
    
    if (confirmRequest.files.length === 0) {
      return {
        totalProcessed: files.length,
        successCount: 0,
        failureCount: files.length,
        succeeded: [],
        failed: results
          .filter(r => !r.success)
          .map(r => ({
            s3Key: r.s3Key,
            filename: uploadMap.get(r.s3Key)!.file.name,
            error: r.error || 'Upload failed',
          })),
      };
    }
    
    const confirmResult = await s3Api.confirmBatchUploads(confirmRequest);
    
    // Merge upload failures with confirm failures
    const uploadFailures = results
      .filter(r => !r.success)
      .map(r => ({
        s3Key: r.s3Key,
        filename: uploadMap.get(r.s3Key)!.file.name,
        error: r.error || 'Upload failed',
      }));
    
    return {
      totalProcessed: files.length,
      successCount: confirmResult.successCount,
      failureCount: uploadFailures.length + confirmResult.failureCount,
      succeeded: confirmResult.succeeded,
      failed: [...uploadFailures, ...confirmResult.failed],
    };
  },

  // ============ Staging Methods ============

  /**
   * Get pre-signed URLs for staging uploads (files not yet processed)
   */
  getStagingUploadUrls: async (request: BatchUploadUrlRequest): Promise<BatchUploadUrlResponse> => {
    const response = await api.post<BatchUploadUrlResponse>('/s3/staging/upload-urls', request);
    return response.data;
  },

  /**
   * Notify backend that staging uploads are complete
   */
  notifyUploadComplete: async (): Promise<StagingStatusResponse> => {
    const response = await api.post<StagingStatusResponse>('/s3/staging/upload-complete');
    return response.data;
  },

  /**
   * List files in staging area
   */
  listStagingFiles: async (): Promise<ListObjectsResponse> => {
    const response = await api.get<ListObjectsResponse>('/s3/staging/files');
    return response.data;
  },

  /**
   * Process staged files (move to permanent storage and create audio records)
   */
  processStagedFiles: async (request: ProcessStagingRequest): Promise<BatchConfirmResult> => {
    const response = await api.post<BatchConfirmResult>('/s3/staging/process', request);
    return response.data;
  },

  /**
   * Clear all files in staging area
   */
  clearStaging: async (): Promise<ClearStagingResponse> => {
    const response = await api.delete<ClearStagingResponse>('/s3/staging/clear');
    return response.data;
  },

  /**
   * Upload files to staging (upload only, no metadata processing)
   * After this completes, call notifyUploadComplete() and redirect to processing page
   */
  uploadToStaging: async (
    files: File[],
    concurrency: number = 3,
    onProgress?: (progress: Map<string, UploadProgress>) => void
  ): Promise<{ success: boolean; filesUploaded: number; errors: string[] }> => {
    // 1. Get staging upload URLs
    const urlRequest: BatchUploadUrlRequest = {
      files: files.map(f => ({
        filename: f.name,
        contentType: f.type || 'application/octet-stream', 
        fileSize: f.size,
      })),
    };
    
    const urlResponse = await s3Api.getStagingUploadUrls(urlRequest);
    
    // Map files to URLs
    const uploadMap = new Map<string, { file: File; presigned: PresignedUploadResponse }>();
    files.forEach((file, index) => {
      const presigned = urlResponse.uploads[index];
      uploadMap.set(presigned.s3Key, { file, presigned });
    });
    
    // Track progress
    const progressMap = new Map<string, UploadProgress>();
    uploadMap.forEach((value, key) => {
      progressMap.set(key, {
        filename: value.file.name,
        s3Key: key,
        loaded: 0,
        total: value.file.size,
        percent: 0,
        status: 'pending',
      });
    });
    
    // 2. Upload to S3 in parallel
    const uploadQueue = Array.from(uploadMap.entries());
    const errors: string[] = [];
    let successCount = 0;
    
    const uploadWorker = async () => {
      while (uploadQueue.length > 0) {
        const entry = uploadQueue.shift();
        if (!entry) break;
        
        const [s3Key, { file, presigned }] = entry;
        
        try {
          await s3Api.uploadToS3(file, presigned, (progress) => {
            progressMap.set(s3Key, progress);
            if (onProgress) {
              onProgress(new Map(progressMap));
            }
          });
          successCount++;
        } catch (error: any) {
          errors.push(`${file.name}: ${error.message}`);
          progressMap.set(s3Key, {
            filename: file.name,
            s3Key,
            loaded: 0,
            total: file.size,
            percent: 0,
            status: 'failed',
            error: error.message,
          });
          if (onProgress) {
            onProgress(new Map(progressMap));
          }
        }
      }
    };
    
    // Start workers
    const workers = Array(Math.min(concurrency, uploadQueue.length))
      .fill(null)
      .map(() => uploadWorker());
    
    await Promise.all(workers);
    
    return {
      success: errors.length === 0,
      filesUploaded: successCount,
      errors,
    };
  },

  multipart: {
    /** Initiate a multipart upload — returns uploadId + presigned part URLs */
    initiate: async (request: MultipartInitiateRequest): Promise<MultipartInitiateResponse> => {
      const response = await api.post<MultipartInitiateResponse>('/s3/multipart/initiate', request);
      return response.data;
    },

    /** Upload a single part to its presigned URL — returns eTag from S3 response */
    uploadPart: (url: string, chunk: Blob, onProgress?: (loaded: number, total: number) => void): Promise<string> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        if (onProgress) {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) onProgress(e.loaded, e.total);
          });
        }

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const eTag = xhr.getResponseHeader('ETag') || '';
            resolve(eTag.replace(/"/g, '')); // S3 returns eTag wrapped in quotes
          } else {
            reject(new Error(`Part upload failed: status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error during part upload')));
        xhr.addEventListener('timeout', () => reject(new Error('Part upload timed out')));

        xhr.open('PUT', url);
        xhr.send(chunk);
      });
    },

    /** Get upload status for resume — returns which parts S3 already has */
    getStatus: async (
      s3Key: string, uploadId: string, partSize: number, fileSize: number
    ): Promise<MultipartStatusResponse> => {
      const response = await api.get<MultipartStatusResponse>('/s3/multipart/status', {
        params: { s3Key, uploadId, partSize, fileSize },
      });
      return response.data;
    },

    /** Complete the multipart upload — S3 assembles parts into final object */
    complete: async (s3Key: string, uploadId: string, parts: CompletedPart[]): Promise<void> => {
      await api.post('/s3/multipart/complete', { s3Key, uploadId, parts });
    },

    /** Abort/cancel — deletes uploaded parts from S3 */
    abort: async (s3Key: string, uploadId: string): Promise<void> => {
      await api.delete('/s3/multipart/abort', { params: { s3Key, uploadId } });
    },
  },

  /**
   * ADDED: High-level multipart upload orchestrator.
   * Splits file into chunks, uploads in parallel with retry, supports resume.
   * After completion, caller should use confirmUpload() to create the audio record.
   */
  multipartUpload: async (
    file: File,
    options?: {
      concurrency?: number;
      partRetries?: number;
      onProgress?: (progress: MultipartProgress) => void;
      resumeState?: MultipartUploadState;
    }
  ): Promise<{ s3Key: string; uploadId: string }> => {
    const concurrency = options?.concurrency ?? 3;
    const partRetries = options?.partRetries ?? 3;

    let uploadId: string;
    let s3Key: string;
    let partSize: number;
    let totalParts: number;
    let partUrls: MultipartPartUrl[];
    const completedParts: CompletedPart[] = [];
    let uploadedBytes = 0;

    // Helper to report progress
    const reportProgress = (status: MultipartProgress['status']) => {
      options?.onProgress?.({
        filename: file.name,
        s3Key,
        totalBytes: file.size,
        uploadedBytes,
        percent: Math.round((uploadedBytes / file.size) * 100),
        partsCompleted: completedParts.length,
        partsTotal: totalParts,
        status,
        resumeState: { uploadId, s3Key, filename: file.name, fileSize: file.size,
          partSize, totalParts, completedParts: [...completedParts],
          startedAt: new Date().toISOString() },
      });
    };

    // RESUME: If we have a saved state, check what S3 already has
    if (options?.resumeState) {
      const rs = options.resumeState;
      uploadId = rs.uploadId;
      s3Key = rs.s3Key;
      partSize = rs.partSize;
      totalParts = rs.totalParts;

      reportProgress('resuming');

      const status = await s3Api.multipart.getStatus(s3Key, uploadId, partSize, file.size);

      // Add already-uploaded parts
      for (const p of status.uploadedParts) {
        completedParts.push({ partNumber: p.partNumber, eTag: p.eTag });
        uploadedBytes += p.size;
      }

      // Get URLs for remaining parts only
      partUrls = status.remainingPartUrls;

    } else {
      // FRESH: Initiate new multipart upload
      const initResponse = await s3Api.multipart.initiate({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        fileSize: file.size,
      });

      uploadId = initResponse.uploadId;
      s3Key = initResponse.s3Key;
      partSize = initResponse.partSize;
      totalParts = initResponse.totalParts;
      partUrls = initResponse.partUrls;
    }

    reportProgress('uploading');

    // Upload remaining parts in parallel with retry
    const partQueue = [...partUrls];
    const errors: string[] = [];

    const uploadWorker = async () => {
      while (partQueue.length > 0) {
        const part = partQueue.shift();
        if (!part) break;

        // Slice the file chunk for this part
        const chunk = file.slice(part.offset, part.offset + part.size);

        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= partRetries; attempt++) {
          try {
            const eTag = await s3Api.multipart.uploadPart(
              part.uploadUrl,
              chunk,
              (loaded, total) => {
                // Per-part progress — add to aggregate
                const partUploaded = uploadedBytes +
                  completedParts.filter(p => p.partNumber < part.partNumber).length * 0 + loaded;
                options?.onProgress?.({
                  filename: file.name,
                  s3Key,
                  totalBytes: file.size,
                  uploadedBytes: Math.min(
                    uploadedBytes + loaded,
                    file.size
                  ),
                  percent: Math.round(((uploadedBytes + loaded) / file.size) * 100),
                  partsCompleted: completedParts.length,
                  partsTotal: totalParts,
                  status: 'uploading',
                  resumeState: { uploadId, s3Key, filename: file.name, fileSize: file.size,
                    partSize, totalParts, completedParts: [...completedParts],
                    startedAt: new Date().toISOString() },
                });
              }
            );

            completedParts.push({ partNumber: part.partNumber, eTag });
            uploadedBytes += part.size;
            reportProgress('uploading');
            lastError = null;
            break; // Success — exit retry loop
          } catch (err: any) {
            lastError = err;
            if (attempt < partRetries) {
              // Wait before retry (exponential backoff: 1s, 2s, 4s)
              await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
            }
          }
        }

        if (lastError) {
          errors.push(`Part ${part.partNumber}: ${lastError.message}`);
        }
      }
    };

    // Start parallel workers
    const workers = Array(Math.min(concurrency, partQueue.length))
      .fill(null)
      .map(() => uploadWorker());

    await Promise.all(workers);

    // Check for failures
    if (errors.length > 0) {
      reportProgress('failed');
      throw new Error(`Multipart upload failed: ${errors.join('; ')}`);
    }

    // Complete the multipart upload
    reportProgress('completing');
    await s3Api.multipart.complete(s3Key, uploadId, completedParts);
    reportProgress('completed');

    return { s3Key, uploadId };
  },
};
