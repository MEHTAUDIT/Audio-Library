/**
 * Bulk Import Utilities
 * 
 * Shared logic for parsing folder structures and extracting metadata.
 * This logic is mirrored on the backend for server-side imports.
 */

import type {
  DetectedStructure,
  DetectedLevel,
  FolderStructureMapping,
  LevelConfig,
  LevelMappingType,
  MappedAudioFile,
  AudioField,
} from '../types/bulkImport';

// Supported audio file extensions
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.wma'];

/**
 * Check if a file is an audio file based on extension
 */
export function isAudioFile(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return AUDIO_EXTENSIONS.includes(ext);
}

/**
 * Analyze folder structure from a list of files with relative paths
 * Works with browser File API (webkitRelativePath) or path strings
 */
export function analyzeStructure(
  files: Array<{ relativePath: string; name: string; size?: number }>
): DetectedStructure {
  const audioFiles = files.filter(f => isAudioFile(f.name));
  
  if (audioFiles.length === 0) {
    return {
      rootPath: '',
      levels: [],
      totalFiles: 0,
      sampleFiles: [],
    };
  }

  // Parse all paths to find structure
  const pathParts = audioFiles.map(f => {
    const parts = f.relativePath.split(/[/\\]/).filter(Boolean);
    return parts;
  });

  // Find the maximum depth
  const maxDepth = Math.max(...pathParts.map(p => p.length));
  
  // Extract root folder name
  const rootPath = pathParts[0]?.[0] || '';

  // Collect unique values at each level
  const levelMap = new Map<number, Set<string>>();
  
  for (const parts of pathParts) {
    // Skip the filename (last element) when counting levels
    for (let i = 0; i < parts.length - 1; i++) {
      if (!levelMap.has(i)) {
        levelMap.set(i, new Set());
      }
      levelMap.get(i)!.add(parts[i]);
    }
  }

  // Build levels array
  const levels: DetectedLevel[] = [];
  for (let i = 0; i < maxDepth - 1; i++) {
    const values = levelMap.get(i);
    if (values) {
      levels.push({
        depth: i,
        sampleValues: Array.from(values).slice(0, 10),
        totalFolders: values.size,
      });
    }
  }

  return {
    rootPath,
    levels,
    totalFiles: audioFiles.length,
    sampleFiles: audioFiles.slice(0, 10).map(f => f.relativePath),
  };
}

/**
 * Suggest mapping based on heuristics from folder names
 */
export function suggestMappingForLevel(
  sampleValues: string[],
  depth: number,
  totalLevels: number
): { mapping: LevelMappingType; confidence: number; hint?: string } {
  // Last level is always files
  if (depth === totalLevels - 1) {
    return { mapping: { type: 'filename' }, confidence: 1.0 };
  }

  // Check for speaker-like names (honorifics, two-word names)
  const speakerPatterns = [
    /^(Rabbi|Rav|Dr\.?|Rev\.?|Pastor|Imam|Sheikh|Harav|Reb|Mr\.?|Mrs\.?|Ms\.?)\s/i,
    /^[A-Z][a-z]+\s+[A-Z][a-z]+$/,  // "First Last" pattern
    /^[A-Z][a-z]+\s+[A-Z]\.\s+[A-Z][a-z]+$/,  // "First M. Last" pattern
  ];
  
  const speakerMatches = sampleValues.filter(v => 
    speakerPatterns.some(p => p.test(v))
  ).length;
  
  if (speakerMatches >= sampleValues.length * 0.5) {
    return {
      mapping: { type: 'map_to_field', field: 'speaker' },
      confidence: 0.85,
      hint: 'Looks like speaker names',
    };
  }

  // Check for year-like values
  if (sampleValues.every(v => /^(19|20)\d{2}$/.test(v))) {
    return {
      mapping: { type: 'skip' },
      confidence: 0.9,
      hint: 'Looks like years - consider skipping',
    };
  }

  // Check for language codes
  const languageCodes = ['en', 'he', 'yi', 'es', 'fr', 'de', 'english', 'hebrew', 'yiddish', 'spanish', 'french', 'german'];
  if (sampleValues.every(v => languageCodes.includes(v.toLowerCase()))) {
    return {
      mapping: { type: 'map_to_field', field: 'language' },
      confidence: 0.95,
      hint: 'Looks like language codes',
    };
  }

  // Check for generic organizational folders
  const skipPatterns = ['audio', 'files', 'uploads', 'library', 'content', 'media'];
  if (sampleValues.length === 1 && skipPatterns.some(p => 
    sampleValues[0].toLowerCase().includes(p)
  )) {
    return {
      mapping: { type: 'skip' },
      confidence: 0.7,
      hint: 'Looks like a root folder - consider skipping',
    };
  }

  // Default: first non-skip level is usually speaker, next is topic
  // Count how many non-skip levels we've seen
  if (depth === 0) {
    return {
      mapping: { type: 'map_to_field', field: 'speaker' },
      confidence: 0.5,
      hint: 'First level - typically speaker',
    };
  }

  return {
    mapping: { type: 'map_to_field', field: 'topic' },
    confidence: 0.5,
    hint: 'Deeper level - typically topic or category',
  };
}

/**
 * Build suggested mapping configuration from detected structure
 */
export function buildSuggestedMapping(structure: DetectedStructure): FolderStructureMapping {
  const levels: LevelConfig[] = structure.levels.map((level, index) => {
    const suggestion = suggestMappingForLevel(
      level.sampleValues,
      level.depth,
      structure.levels.length
    );
    
    return {
      depth: level.depth,
      sampleValues: level.sampleValues,
      mapping: suggestion.mapping,
      suggestedMapping: suggestion.mapping,
      confidence: suggestion.confidence,
    };
  });

  return {
    levels,
    combineSeparator: ' > ',
  };
}

/**
 * Extract title from filename
 */
export function extractTitleFromFilename(filename: string): string {
  // Remove extension
  let title = filename.replace(/\.[^/.]+$/, '');
  
  // Replace common separators with spaces
  title = title.replace(/[-_]/g, ' ');
  
  // Remove leading numbers/track numbers like "01 - ", "1. ", "Track 1 "
  title = title.replace(/^(\d+[\s.\-_]+)/, '');
  
  // Clean up multiple spaces
  title = title.replace(/\s+/g, ' ').trim();
  
  return title;
}

/**
 * Apply mapping configuration to extract metadata from a file path
 */
export function applyMappingToFile(
  relativePath: string,
  filename: string,
  mapping: FolderStructureMapping,
  sizeBytes?: number
): MappedAudioFile {
  const parts = relativePath.split(/[/\\]/).filter(Boolean);
  
  // Initialize result
  const result: MappedAudioFile = {
    originalPath: relativePath,
    relativePath,
    filename,
    title: extractTitleFromFilename(filename),
    sizeBytes,
  };

  // Track accumulated values for append operations
  const accumulated: Record<AudioField, string[]> = {
    speaker: [],
    topic: [],
    language: [],
    series: [],
    title: [],
  };

  // Apply each level's mapping
  for (const levelConfig of mapping.levels) {
    const value = parts[levelConfig.depth];
    if (!value) continue;

    const { mapping: levelMapping } = levelConfig;

    switch (levelMapping.type) {
      case 'map_to_field':
        accumulated[levelMapping.field] = [value];
        break;
        
      case 'append_to_field':
        accumulated[levelMapping.field].push(value);
        break;
        
      case 'skip':
        // Do nothing
        break;
        
      case 'filename':
        // Title already extracted above
        break;
    }
  }

  // Apply accumulated values
  if (accumulated.speaker.length > 0) {
    result.speaker = accumulated.speaker.join(mapping.combineSeparator);
  }
  if (accumulated.topic.length > 0) {
    result.topic = accumulated.topic.join(mapping.combineSeparator);
  }
  if (accumulated.language.length > 0) {
    result.language = accumulated.language[0];  // Language doesn't combine
  }
  if (accumulated.series.length > 0) {
    result.series = accumulated.series.join(mapping.combineSeparator);
  }

  return result;
}

/**
 * Apply mapping to all files and return mapped results
 */
export function applyMappingToFiles(
  files: Array<{ relativePath: string; name: string; size?: number }>,
  mapping: FolderStructureMapping
): MappedAudioFile[] {
  return files
    .filter(f => isAudioFile(f.name))
    .map(f => applyMappingToFile(f.relativePath, f.name, mapping, f.size));
}

/**
 * Validate a mapped file for required fields
 */
export function validateMappedFile(file: MappedAudioFile): string[] {
  const errors: string[] = [];
  
  if (!file.title || file.title.trim() === '') {
    errors.push('Title is required');
  }
  
  if (file.title && file.title.length > 255) {
    errors.push('Title must be less than 255 characters');
  }
  
  return errors;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Calculate total size of files
 */
export function calculateTotalSize(files: MappedAudioFile[]): number {
  return files.reduce((sum, f) => sum + (f.sizeBytes || 0), 0);
}

