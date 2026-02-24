'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, Trash2, CheckCircle, Loader2, MapPin, Waves, Bike, Activity } from 'lucide-react';

type Segment = 'swim' | 'bike' | 'run';

const SEGMENTS: { key: Segment; label: string; icon: typeof Waves; color: string; dragColor: string }[] = [
  { key: 'swim', label: 'Natation', icon: Waves, color: 'text-cyan-600', dragColor: 'border-cyan-400 bg-cyan-50' },
  { key: 'bike', label: 'Vélo', icon: Bike, color: 'text-red-600', dragColor: 'border-red-400 bg-red-50' },
  { key: 'run', label: 'Course à pied', icon: Activity, color: 'text-amber-600', dragColor: 'border-amber-400 bg-amber-50' },
];

interface GpxUploadProps {
  raceId: number;
  existingSegments?: { swim?: boolean; bike?: boolean; run?: boolean };
  /** @deprecated Use existingSegments instead */
  hasTrack?: boolean;
  onUploaded?: () => void;
}

export default function GpxUpload({ raceId, existingSegments, hasTrack, onUploaded }: GpxUploadProps) {
  // Backwards compat: if existingSegments not provided, derive from hasTrack
  const initialSegments = existingSegments ?? (hasTrack ? { swim: false, bike: true, run: false } : {});

  const [segments, setSegments] = useState<Record<Segment, boolean>>({
    swim: !!initialSegments.swim,
    bike: !!initialSegments.bike,
    run: !!initialSegments.run,
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 mb-6">
      <div className="px-5 py-3 bg-gray-50 rounded-t-2xl border-b border-gray-200">
        <h2 className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
          <MapPin size={14} />
          Parcours GPX
        </h2>
      </div>

      <div className="p-5 space-y-4">
        {SEGMENTS.map((seg) => (
          <SegmentUploadZone
            key={seg.key}
            raceId={raceId}
            segment={seg.key}
            label={seg.label}
            Icon={seg.icon}
            color={seg.color}
            dragColor={seg.dragColor}
            hasData={segments[seg.key]}
            onUploaded={() => {
              setSegments((prev) => ({ ...prev, [seg.key]: true }));
              onUploaded?.();
            }}
            onDeleted={() => {
              setSegments((prev) => ({ ...prev, [seg.key]: false }));
              onUploaded?.();
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface SegmentUploadZoneProps {
  raceId: number;
  segment: Segment;
  label: string;
  Icon: typeof Waves;
  color: string;
  dragColor: string;
  hasData: boolean;
  onUploaded: () => void;
  onDeleted: () => void;
}

function SegmentUploadZone({
  raceId,
  segment,
  label,
  Icon,
  color,
  dragColor,
  hasData,
  onUploaded,
  onDeleted,
}: SegmentUploadZoneProps) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.gpx')) {
        setStatus('error');
        setMessage('Seuls les fichiers .gpx sont acceptes.');
        return;
      }

      setStatus('uploading');
      setMessage('');

      const form = new FormData();
      form.append('gpx', file);
      form.append('segment', segment);

      try {
        const res = await fetch(`/api/admin/races/${raceId}/gpx`, {
          method: 'POST',
          body: form,
        });

        const json = await res.json();

        if (!res.ok) {
          setStatus('error');
          setMessage(json.error || 'Erreur inconnue.');
          return;
        }

        setStatus('success');
        setMessage(`${json.trackPointCount} points carte, ${json.elevationPointCount} points elevation.`);
        onUploaded();
      } catch {
        setStatus('error');
        setMessage('Erreur reseau.');
      }
    },
    [raceId, segment, onUploaded],
  );

  async function handleDelete() {
    if (!confirm(`Supprimer le trace GPX ${label} ?`)) return;
    setStatus('uploading');
    setMessage('');

    try {
      const res = await fetch(`/api/admin/races/${raceId}/gpx?segment=${segment}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        setStatus('error');
        setMessage(json.error || 'Erreur.');
        return;
      }
      setStatus('idle');
      setMessage('');
      onDeleted();
    } catch {
      setStatus('error');
      setMessage('Erreur reseau.');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="border border-gray-100 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center gap-2 text-sm font-semibold ${color}`}>
          <Icon size={15} />
          {label}
          {hasData && status !== 'uploading' && (
            <CheckCircle size={14} className="text-green-500" />
          )}
        </div>
        {hasData && (
          <button
            onClick={handleDelete}
            disabled={status === 'uploading'}
            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
          >
            <Trash2 size={12} />
            Supprimer
          </button>
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
          ${dragOver ? dragColor : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
          ${status === 'uploading' ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".gpx"
          onChange={handleFileChange}
          className="hidden"
        />

        {status === 'uploading' ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 size={16} className="text-zinc-400 animate-spin" />
            <span className="text-xs text-zinc-500">Traitement...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Upload size={16} className="text-zinc-400" />
            <span className="text-xs text-zinc-500">
              {hasData ? 'Remplacer le fichier .gpx' : 'Glissez un .gpx ici ou cliquez'}
            </span>
          </div>
        )}
      </div>

      {message && (
        <p className={`text-xs mt-2 ${status === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
