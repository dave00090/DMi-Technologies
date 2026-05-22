import * as React from 'react';
import { localDb } from '../services/localDb';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallback?: React.ReactNode;
}

export function SafeImage({ src, fallback, ...props }: SafeImageProps) {
  const [displaySrc, setDisplaySrc] = React.useState<string | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      if (!src) {
        setLoading(false);
        return;
      }

      if (src.startsWith('idb://')) {
        try {
          const realSrc = await localDb.getImage(src);
          if (isMounted) {
            setDisplaySrc(realSrc);
            setLoading(false);
          }
        } catch (err) {
          console.error('Failed to load image from IndexedDB:', err);
          if (isMounted) {
            setError(true);
            setLoading(false);
          }
        }
      } else {
        setDisplaySrc(src);
        setLoading(false);
      }
    };

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [src]);

  if (loading) {
    return <div className={`animate-pulse bg-muted ${props.className}`} style={props.style} />;
  }

  if (error || !displaySrc) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <img
      {...props}
      src={displaySrc}
      onError={(e) => {
        setError(true);
        props.onError?.(e);
      }}
    />
  );
}
