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
}

export interface ProcessStagingRequest {
  files: StagingFileMetadata[];
}

export interface ClearStagingResponse {
  deletedCount: number;
  message: string;
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

// ============ API Functions ============

export const s3Api = {
  /**
   * Check if S3 is enabled on the backend
   */
  isEnabled: async (): Promise<boolean> => {
    try {
      // Try to hit the S3 endpoint - if it works, S3 is enabled
      await api.post('/s3/upload-url', { filename: 'test.mp3', contentType: 'audio/mpeg' });
      return true;
    } catch {
      // ┌──────────────────────────────────────────────────────────────┐
      // │ FIXED: Return false for ALL errors, not just 404             │
      // │                                                              │
      // │ BEFORE: Only returned false for 404, returned true for       │
      // │ everything else (500, network errors, undefined response).   │
      // │ This made the frontend think S3 was enabled when it wasn't,  │
      // │ causing /s3/upload-urls/batch calls that always fail locally. │
      // │                                                              │
      // │ AFTER: Any error = S3 not available.                         │
      // └──────────────────────────────────────────────────────────────┘
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
   * Confirm a single upload and create audio record
   */
  confirmUpload: async (request: ConfirmUploadRequest): Promise<void> => {
    await api.post('/s3/confirm-upload', request);
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
    // 1. Get pre-signed URL
    const presigned = await s3Api.getUploadUrl({
      filename: file.name,
      contentType: file.type || 'audio/mpeg',
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
        contentType: f.file.type || 'audio/mpeg',
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
          results.push({ s3Key, success: true });
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
        contentType: f.type || 'audio/mpeg',
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
};