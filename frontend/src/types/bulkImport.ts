/**
 * Bulk Import Types
 * 
 * These types define the folder structure mapping configuration
 * that is shared between browser-based and server-side bulk imports.
 */

// Fields that can be extracted from folder structure
export type AudioField = 'speaker' | 'topic' | 'language' | 'series' | 'title' | 'tags' | 'genres';

// How a folder level maps to audio metadata
export type LevelMappingType = 
  | { type: 'map_to_field'; field: AudioField }
  | { type: 'append_to_field'; field: AudioField; separator?: string }
  | { type: 'skip' }
  | { type: 'filename' };  // Final level - the actual audio files

// Configuration for a single folder level
export interface LevelConfig {
  depth: number;
  sampleValues: string[];  // Sample folder names at this level for preview
  mapping: LevelMappingType;
  suggestedMapping?: LevelMappingType;  // AI/heuristic suggestion
  confidence?: number;  // 0-1 confidence in suggestion
}

// Complete folder structure mapping configuration
export interface FolderStructureMapping {
  levels: LevelConfig[];
  filenamePattern?: FilenamePattern;
  combineSeparator: string;  // " > " or " - " or " / "
}

// Pattern for parsing metadata from filenames
export interface FilenamePattern {
  enabled: boolean;
  template: string;  // e.g., "{speaker} - {title}" or "{title} ({year})"
  regex?: string;    // Compiled regex pattern
}

// Detected folder structure from analysis
export interface DetectedStructure {
  rootPath: string;
  levels: DetectedLevel[];
  totalFiles: number;
  sampleFiles: string[];  // First few file paths for preview
}

export interface DetectedLevel {
  depth: number;
  sampleValues: string[];  // Unique folder names at this level
  totalFolders: number;
}

// A file with its extracted metadata based on mapping
export interface MappedAudioFile {
  originalPath: string;
  relativePath: string;
  filename: string;
  
  // Extracted metadata
  title: string;
  speaker?: string;
  topic?: string;
  language?: string;
  series?: string;
  tags?: string[];
  genres?: string[];
  
  // File info
  sizeBytes?: number;
  
  // For editing before import
  isEdited?: boolean;
  validationErrors?: string[];
}

// Preset mapping configurations
export interface MappingPreset {
  id: string;
  name: string;
  description: string;
  levels: Array<{ depth: number; mapping: LevelMappingType }>;
}

// Common presets
export const MAPPING_PRESETS: MappingPreset[] = [
  {
    id: 'speaker-topic',
    name: 'Speaker → Topic',
    description: 'First level is speaker, second is topic',
    levels: [
      { depth: 0, mapping: { type: 'map_to_field', field: 'speaker' } },
      { depth: 1, mapping: { type: 'map_to_field', field: 'topic' } },
    ],
  },
  {
    id: 'topic-speaker',
    name: 'Topic → Speaker',
    description: 'First level is topic, second is speaker',
    levels: [
      { depth: 0, mapping: { type: 'map_to_field', field: 'topic' } },
      { depth: 1, mapping: { type: 'map_to_field', field: 'speaker' } },
    ],
  },
  {
    id: 'category-topic-speaker',
    name: 'Category → Topic → Speaker',
    description: 'Three levels: category combines with topic',
    levels: [
      { depth: 0, mapping: { type: 'map_to_field', field: 'topic' } },
      { depth: 1, mapping: { type: 'append_to_field', field: 'topic', separator: ' > ' } },
      { depth: 2, mapping: { type: 'map_to_field', field: 'speaker' } },
    ],
  },
  {
    id: 'speaker-series-topic',
    name: 'Speaker → Series → Topic',
    description: 'Speaker, then series name, then topic',
    levels: [
      { depth: 0, mapping: { type: 'map_to_field', field: 'speaker' } },
      { depth: 1, mapping: { type: 'map_to_field', field: 'series' } },
      { depth: 2, mapping: { type: 'map_to_field', field: 'topic' } },
    ],
  },
  {
    id: 'speaker-genre-tag',
    name: 'Speaker -> Genre -> Tag',
    description: 'Speaker, then genre/category, then a searchable tag',
    levels: [
      { depth: 0, mapping: { type: 'map_to_field', field: 'speaker' } },
      { depth: 1, mapping: { type: 'map_to_field', field: 'genres' } },
      { depth: 2, mapping: { type: 'map_to_field', field: 'tags' } },
    ],
  },
  {
    id: 'skip-speaker-topic',
    name: 'Skip → Speaker → Topic',
    description: 'Ignore first level (e.g., root folder), then speaker and topic',
    levels: [
      { depth: 0, mapping: { type: 'skip' } },
      { depth: 1, mapping: { type: 'map_to_field', field: 'speaker' } },
      { depth: 2, mapping: { type: 'map_to_field', field: 'topic' } },
    ],
  },
];

// Server-side bulk import request
export interface BulkImportScanRequest {
  sourcePath?: string;  // Server path to scan
  sourceType: 'path' | 'zip';
}

export interface BulkImportPreviewResponse {
  structure: DetectedStructure;
  suggestedMapping: FolderStructureMapping;
}

export interface BulkImportExecuteRequest {
  sourcePath?: string;
  sourceType: 'path' | 'zip';
  mapping: FolderStructureMapping;
  files: MappedAudioFile[];  // With any user edits
}

export interface BulkImportJobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalFiles: number;
  processedFiles: number;
  successCount: number;
  errorCount: number;
  errors?: Array<{ file: string; error: string }>;
  startedAt?: string;
  completedAt?: string;
}

