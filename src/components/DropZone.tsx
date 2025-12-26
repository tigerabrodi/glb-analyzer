import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react';
import { Upload, Link, Loader2, AlertCircle } from 'lucide-react';

export interface DropZoneProps {
  onFile: (file: File) => void;
  onUrl: (url: string) => void;
  isLoading: boolean;
  error: string | null;
}

export function DropZone({ onFile, onUrl, isLoading, error }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.name.toLowerCase().endsWith('.glb')) {
          onFile(file);
        }
      }
    },
    [onFile]
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFile(files[0]);
      }
    },
    [onFile]
  );

  const handleUrlSubmit = useCallback(() => {
    const trimmed = urlInput.trim();
    if (trimmed) {
      onUrl(trimmed);
      setUrlInput('');
    }
  }, [urlInput, onUrl]);

  const handleUrlKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleUrlSubmit();
      }
    },
    [handleUrlSubmit]
  );

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center
          w-full h-64 p-8
          border-2 border-dashed rounded-xl
          transition-all duration-200 cursor-pointer
          ${isDragging
            ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
            : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900'
          }
          ${isLoading ? 'pointer-events-none opacity-75' : ''}
        `}
        onClick={() => !isLoading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".glb"
          onChange={handleFileChange}
          className="hidden"
          disabled={isLoading}
        />

        {isLoading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <p className="text-zinc-400">Loading file...</p>
          </div>
        ) : (
          <>
            <div className={`
              p-4 rounded-full mb-4 transition-colors
              ${isDragging ? 'bg-blue-500/20' : 'bg-zinc-800'}
            `}>
              <Upload className={`w-8 h-8 ${isDragging ? 'text-blue-400' : 'text-zinc-400'}`} />
            </div>
            <p className="text-zinc-300 text-lg font-medium mb-2">
              Drop your GLB file here
            </p>
            <p className="text-zinc-500 text-sm">
              or click to browse
            </p>
          </>
        )}
      </div>

      {/* URL Input */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-zinc-500 text-xs uppercase tracking-wider">or paste a URL</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={handleUrlKeyDown}
              placeholder="https://example.com/model.glb"
              disabled={isLoading}
              className="
                w-full pl-10 pr-4 py-2.5
                bg-zinc-900 border border-zinc-700 rounded-lg
                text-zinc-100 placeholder:text-zinc-600
                focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
            />
          </div>
          <button
            onClick={handleUrlSubmit}
            disabled={isLoading || !urlInput.trim()}
            className="
              px-4 py-2.5
              bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700
              text-white disabled:text-zinc-500
              rounded-lg font-medium
              transition-colors
              disabled:cursor-not-allowed
            "
          >
            Load
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium">Error</p>
            <p className="text-red-300/80 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
