import React from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Folder,
  Globe,
  Library,
  Tags,
  Shapes,
  SkipForward,
  FileAudio,
  Lightbulb,
  ChevronRight,
  Plus,
} from 'lucide-react';
import type {
  DetectedStructure,
  FolderStructureMapping,
  LevelConfig,
  LevelMappingType,
  AudioField,
  MappingPreset,
} from '../../types/bulkImport';
import { MAPPING_PRESETS } from '../../types/bulkImport';
import { Badge } from '../ui/Badge';

interface FolderMappingConfigProps {
  structure: DetectedStructure;
  mapping: FolderStructureMapping;
  onMappingChange: (mapping: FolderStructureMapping) => void;
}

// Field options for the dropdown
const FIELD_OPTIONS: Array<{
  value: LevelMappingType;
  label: string;
  icon: React.ElementType;
  description: string;
}> = [
  {
    value: { type: 'map_to_field', field: 'speaker' },
    label: 'Speaker',
    icon: User,
    description: 'Maps to the speaker field',
  },
  {
    value: { type: 'map_to_field', field: 'topic' },
    label: 'Topic / Category',
    icon: Folder,
    description: 'Maps to the topic field',
  },
  {
    value: { type: 'append_to_field', field: 'topic', separator: ' > ' },
    label: 'Append to Topic',
    icon: Plus,
    description: 'Combines with topic (e.g., "Category > Subcategory")',
  },
  {
    value: { type: 'map_to_field', field: 'language' },
    label: 'Language',
    icon: Globe,
    description: 'Maps to the language field',
  },
  {
    value: { type: 'map_to_field', field: 'series' },
    label: 'Series',
    icon: Library,
    description: 'Creates or assigns to a series collection', // CHANGED: was "stored in description"
  },
  {
    value: { type: 'map_to_field', field: 'genres' },
    label: 'Genre / Category',
    icon: Shapes,
    description: 'Creates or assigns a genre/category',
  },
  {
    value: { type: 'map_to_field', field: 'tags' },
    label: 'Tag',
    icon: Tags,
    description: 'Creates or assigns a searchable tag',
  },
  {
    value: { type: 'skip' },
    label: 'Skip (ignore)',
    icon: SkipForward,
    description: 'Ignore this folder level',
  },
];

function getMappingKey(mapping: LevelMappingType): string {
  if (mapping.type === 'skip') return 'skip';
  if (mapping.type === 'filename') return 'filename';
  if (mapping.type === 'append_to_field') return `append_${mapping.field}`;
  if (mapping.type === 'map_to_field') return mapping.field;
  return 'unknown';
}

function getMappingLabel(mapping: LevelMappingType): string {
  const option = FIELD_OPTIONS.find(o => getMappingKey(o.value) === getMappingKey(mapping));
  return option?.label || 'Unknown';
}

function getMappingIcon(mapping: LevelMappingType): React.ElementType {
  const option = FIELD_OPTIONS.find(o => getMappingKey(o.value) === getMappingKey(mapping));
  return option?.icon || Folder;
}

export function FolderMappingConfig({
  structure,
  mapping,
  onMappingChange,
}: FolderMappingConfigProps) {
  // Update a specific level's mapping
  const updateLevelMapping = (depth: number, newMapping: LevelMappingType) => {
    const updatedLevels = mapping.levels.map(level =>
      level.depth === depth ? { ...level, mapping: newMapping } : level
    );
    onMappingChange({ ...mapping, levels: updatedLevels });
  };

  // Apply a preset
  const applyPreset = (preset: MappingPreset) => {
    const updatedLevels = mapping.levels.map(level => {
      const presetLevel = preset.levels.find(p => p.depth === level.depth);
      if (presetLevel) {
        return { ...level, mapping: presetLevel.mapping };
      }
      // Default remaining levels to skip or topic
      return {
        ...level,
        mapping: level.depth > preset.levels.length - 1
          ? { type: 'skip' as const }
          : level.mapping,
      };
    });
    onMappingChange({ ...mapping, levels: updatedLevels });
  };

  // Update separator
  const updateSeparator = (separator: string) => {
    onMappingChange({ ...mapping, combineSeparator: separator });
  };

  if (structure.levels.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Folder className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p>No folder structure detected.</p>
        <p className="text-sm">All files appear to be in the root folder.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preset buttons */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          Quick presets
        </label>
        <div className="flex flex-wrap gap-2">
          {MAPPING_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 
                         hover:border-violet-300 hover:bg-violet-50 
                         transition-colors text-slate-700"
              title={preset.description}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Level mapping interface */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
          <h3 className="font-medium text-slate-900">Folder Structure Mapping</h3>
          <p className="text-sm text-slate-500">
            Assign meaning to each folder level in your structure
          </p>
        </div>
        
        <div className="divide-y divide-slate-100">
          {mapping.levels.map((level, index) => (
            <LevelMappingRow
              key={level.depth}
              level={level}
              isLast={index === mapping.levels.length - 1}
              onMappingChange={(newMapping) => updateLevelMapping(level.depth, newMapping)}
            />
          ))}
          
          {/* Filename level (always last) */}
          <div className="p-4 flex items-center gap-4 bg-slate-50/50">
            <div className="w-24 shrink-0">
              <span className="text-sm font-medium text-slate-400">
                Files
              </span>
            </div>
            
            <div className="flex items-center gap-1 text-slate-400">
              <ChevronRight className="w-4 h-4" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1.5">
                {structure.sampleFiles.slice(0, 3).map((file, i) => {
                  const filename = file.split(/[/\\]/).pop() || file;
                  return (
                    <Badge key={i} variant="default" className="font-mono text-xs">
                      <FileAudio className="w-3 h-3 mr-1" />
                      {filename.length > 25 ? filename.slice(0, 25) + '...' : filename}
                    </Badge>
                  );
                })}
                {structure.totalFiles > 3 && (
                  <Badge variant="outline">
                    +{structure.totalFiles - 3} more files
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="shrink-0 text-sm text-slate-500 flex items-center gap-2">
              <FileAudio className="w-4 h-4" />
              Title (from filename)
            </div>
          </div>
        </div>
      </div>

      {/* Separator configuration */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-slate-700">
          When combining levels, use separator:
        </label>
        <select
          value={mapping.combineSeparator}
          onChange={(e) => updateSeparator(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 
                     focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
        >
          <option value=" > ">" › " (arrow)</option>
          <option value=" - ">" - " (dash)</option>
          <option value=" / ">" / " (slash)</option>
          <option value=": ">": " (colon)</option>
        </select>
      </div>
    </div>
  );
}

interface LevelMappingRowProps {
  level: LevelConfig;
  isLast: boolean;
  onMappingChange: (mapping: LevelMappingType) => void;
}

function LevelMappingRow({ level, isLast, onMappingChange }: LevelMappingRowProps) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentMapping = level.mapping;
  const Icon = getMappingIcon(currentMapping);
  const hasConfidence = level.confidence !== undefined && level.confidence > 0.6;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: level.depth * 0.1 }}
      className="p-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors"
    >
      {/* Level indicator */}
      <div className="w-24 shrink-0">
        <span className="text-sm font-medium text-slate-500">
          Level {level.depth + 1}
        </span>
      </div>
      
      {/* Arrow */}
      <div className="flex items-center gap-1 text-slate-300">
        <ChevronRight className="w-4 h-4" />
      </div>
      
      {/* Sample values */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-1.5">
          {level.sampleValues.slice(0, 4).map((value, i) => (
            <Badge key={i} variant="default">
              {value}
            </Badge>
          ))}
          {level.sampleValues.length > 4 && (
            <Badge variant="outline">
              +{level.sampleValues.length - 4} more
            </Badge>
          )}
        </div>
        
        {/* Suggestion hint */}
        {hasConfidence && level.suggestedMapping && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-amber-600">
            <Lightbulb className="w-3 h-3" />
            <span>Suggested: {getMappingLabel(level.suggestedMapping)}</span>
          </div>
        )}
      </div>
      
      {/* Arrow to mapping */}
      <div className="flex items-center gap-1 text-slate-300">
        <ChevronRight className="w-4 h-4" />
      </div>
      
      {/* Mapping dropdown */}
      <div className="relative shrink-0" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg border transition-all
            ${currentMapping.type === 'skip' 
              ? 'border-slate-200 bg-slate-50 text-slate-500' 
              : 'border-violet-200 bg-violet-50 text-violet-700'}
            hover:border-violet-300 hover:bg-violet-100
          `}
        >
          <Icon className="w-4 h-4" />
          <span className="font-medium text-sm">{getMappingLabel(currentMapping)}</span>
          <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute right-0 top-full mt-1 z-50 w-64 py-1 bg-white rounded-lg 
                       shadow-lg border border-slate-200 overflow-hidden"
          >
            {FIELD_OPTIONS.map((option) => {
              const isSelected = getMappingKey(option.value) === getMappingKey(currentMapping);
              const OptionIcon = option.icon;
              
              return (
                <button
                  key={getMappingKey(option.value)}
                  onClick={() => {
                    onMappingChange(option.value);
                    setIsDropdownOpen(false);
                  }}
                  className={`
                    w-full px-4 py-2.5 flex items-start gap-3 text-left transition-colors
                    ${isSelected 
                      ? 'bg-violet-50 text-violet-700' 
                      : 'hover:bg-slate-50 text-slate-700'}
                  `}
                >
                  <OptionIcon className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{option.label}</div>
                    <div className="text-xs text-slate-500">{option.description}</div>
                  </div>
                  {isSelected && (
                    <svg className="w-4 h-4 mt-0.5 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default FolderMappingConfig;
