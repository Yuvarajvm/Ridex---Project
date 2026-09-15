import React from 'react'
import { MapPin, Navigation, ExternalLink, ArrowRight } from 'lucide-react'
import { mapService } from '../../services/mapService'

export interface RidexMapProps {
  origin: string
  destination: string
  height?: string
  className?: string
}

export const RidexMap: React.FC<RidexMapProps> = ({
  origin,
  destination,
  height = '280px',
  className = '',
}) => {
  if (!origin || !destination) {
    return (
      <div
        style={{ height }}
        className={`bg-slate-50 rounded-2xl flex flex-col items-center justify-center text-slate-400 p-4 border border-dashed border-slate-200 ${className}`}
      >
        <MapPin size={28} className="mb-2 text-slate-400" />
        <span className="text-xs font-semibold text-slate-500">Select route to view map</span>
      </div>
    )
  }

  const directionsUrl = mapService.getDirectionsUrl(origin, destination)
  const embedUrl = mapService.getEmbedUrl(origin, destination)
  const providerName = mapService.getProviderName() === 'apple' ? 'Apple Maps' : 'Google Maps'

  return (
    <div className={`rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative group bg-white ${className}`}>
      {embedUrl ? (
        <iframe
          title={`Map route from ${origin} to ${destination}`}
          src={embedUrl}
          style={{ height, width: '100%', border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div
          style={{ height }}
          className="bg-slate-50 flex flex-col items-center justify-center p-6 text-center"
        >
          <Navigation size={32} className="mb-2 text-emerald-600" />
          <strong className="text-sm text-slate-800 font-bold flex items-center justify-center gap-1.5">
            <span>{origin}</span>
            <ArrowRight size={14} className="text-slate-400" />
            <span>{destination}</span>
          </strong>
          <span className="text-xs text-slate-500 mt-1">Route navigation ready</span>
        </div>
      )}

      {/* Floating Directions Action Button */}
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm text-slate-800 hover:text-emerald-700 px-3 py-1.5 rounded-xl shadow-md border border-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 hover:shadow-lg"
      >
        <span>Open in {providerName}</span>
        <ExternalLink size={12} />
      </a>
    </div>
  )
}
