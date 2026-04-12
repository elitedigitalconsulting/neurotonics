import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { api, getAccessToken } from '../api';
import { toast } from '../components/Toast';

interface ImageFile {
  filename: string;
  url: string;
  size: number;
  modified: string;
}

export default function MediaPage() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery<{ images: ImageFile[] }>({
    queryKey: ['images'],
    queryFn: () => api.get('/cms/images'),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/cms/images/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Upload failed');
      }
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      qc.invalidateQueries({ queryKey: ['images'] });
      toast(`Image uploaded: ${data.url}`);
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (filename: string) => api.delete(`/cms/images/${encodeURIComponent(filename)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['images'] });
      toast('Image deleted');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((f) => uploadMutation.mutate(f));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Media Library</h1>

      {/* Upload drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mb-6 hover:border-blue-400 transition-colors cursor-pointer"
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={24} className="mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-500">
          {uploadMutation.isPending ? 'Uploading…' : 'Drop images here or click to upload'}
        </p>
        <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP, GIF, AVIF — max 5 MB — converted to WebP</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Image grid */}
      {isLoading && <p className="text-gray-400 text-sm">Loading…</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {data?.images?.map((img) => (
          <div key={img.filename} className="group relative bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <img
              src={img.url}
              alt={img.filename}
              className="w-full h-32 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="p-2">
              <p className="text-xs text-gray-600 truncate">{img.filename}</p>
              <p className="text-xs text-gray-400">{(img.size / 1024).toFixed(1)} KB</p>
            </div>
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(img.url);
                  toast('URL copied to clipboard');
                }}
                className="px-3 py-1.5 bg-white text-gray-800 text-xs rounded-lg font-medium"
              >
                Copy URL
              </button>
              <button
                onClick={() => { if (confirm(`Delete ${img.filename}?`)) deleteMutation.mutate(img.filename); }}
                className="p-1.5 bg-red-600 text-white rounded-lg"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {!isLoading && !data?.images?.length && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
            <ImageIcon size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No images uploaded yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
