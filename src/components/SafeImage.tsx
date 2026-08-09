import * as React from 'react';
import { Package } from 'lucide-react';
import { localDb } from '../services/localDb';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallback?: React.ReactNode;
}

// Global in-memory cache to eliminate flickering & blurring across DOM re-renders & tab navigation
const imageCache = new Map<string, string>();

export function SafeImage({ src, fallback, alt, className, style, ...props }: SafeImageProps) {
  // Check if image is already cached in memory for instant zero-flicker render
  const initialCached = src ? imageCache.get(src) : undefined;
  const isDirectSrc = src && !src.startsWith('idb://') ? src : undefined;
  const initialSrc = initialCached || isDirectSrc;

  const [displaySrc, setDisplaySrc] = React.useState<string | undefined>(initialSrc);
  const [loading, setLoading] = React.useState<boolean>(!initialSrc && Boolean(src));
  const [error, setError] = React.useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = React.useState<boolean>(Boolean(initialSrc));

  React.useEffect(() => {
    let isMounted = true;

    if (!src) {
      setDisplaySrc(undefined);
      setLoading(false);
      setError(false);
      setImageLoaded(false);
      return;
    }

    // Fast-path: Check memory cache first
    if (imageCache.has(src)) {
      const cached = imageCache.get(src)!;
      setDisplaySrc(cached);
      setLoading(false);
      setError(false);
      setImageLoaded(true);
      return;
    }

    if (!src.startsWith('idb://')) {
      imageCache.set(src, src);
      setDisplaySrc(src);
      setLoading(false);
      setError(false);
      setImageLoaded(true);
      return;
    }

    // Asynchronous resolution for idb:// keys
    const loadImage = async () => {
      try {
        const realSrc = await localDb.getImage(src);
        if (isMounted) {
          if (realSrc) {
            imageCache.set(src, realSrc);
            setDisplaySrc(realSrc);
            setError(false);
          } else {
            setError(true);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load image from IndexedDB:', err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    setLoading(true);
    loadImage();

    return () => {
      isMounted = false;
    };
  }, [src]);

  // High-resolution crisp vector placeholder strategy
  const defaultFallback = fallback || (
    <div className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-xl border border-border/50 ${className || 'w-12 h-12'}`} style={style}>
      <Package className="w-1/2 h-1/2 stroke-[1.5] text-slate-400 dark:text-slate-500" />
    </div>
  );

  if (error || (!loading && !displaySrc)) {
    return <>{defaultFallback}</>;
  }

  return (
    <div className={`relative overflow-hidden inline-block ${className || ''}`} style={style}>
      {/* High-resolution subtle skeleton shimmer shown ONLY before initial image decode */}
      {(!imageLoaded || loading) && (
        <div className="absolute inset-0 bg-slate-200/60 dark:bg-slate-800/60 animate-pulse rounded-inherit flex items-center justify-center z-10">
          <Package className="w-1/3 h-1/3 text-slate-400/50 animate-bounce" />
        </div>
      )}

      {displaySrc && (
        <img
          {...props}
          alt={alt || 'Product'}
          src={displaySrc}
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover transition-opacity duration-200 ease-out ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={(e) => {
            setImageLoaded(true);
            setLoading(false);
            props.onLoad?.(e);
          }}
          onError={(e) => {
            setError(true);
            setLoading(false);
            props.onError?.(e);
          }}
        />
      )}
    </div>
  );
}
