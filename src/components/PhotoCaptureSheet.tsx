import { useCallback, useEffect, useRef, useState } from 'react';
import { canvasToDataUrl, fileToDataUrl } from '../lib/imageFile';

interface Props {
  open: boolean;
  onClose: () => void;
  onPhotos: (dataUrls: string[]) => void;
  busy?: boolean;
}

export function PhotoCaptureSheet({ open, onClose, onPhotos, busy }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setCameraError(null);
      return;
    }

    let cancelled = false;
    setCameraError(null);
    setReady(false);

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setCameraError(
            'Caméra indisponible sur cet appareil. Tu peux encore choisir depuis la galerie.',
          );
        }
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {
            /* autoplay may need muted — already muted */
          });
        }
        setReady(true);
      } catch {
        if (!cancelled) {
          setCameraError(
            'Autorise la caméra pour prendre une photo, ou utilise la galerie.',
          );
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, stopStream]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleClose = () => {
    stopStream();
    onClose();
  };

  const openGallery = () => {
    galleryInputRef.current?.click();
  };

  const onGalleryPicked = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
          continue;
        }
        urls.push(await fileToDataUrl(file));
      }
      if (urls.length) {
        onPhotos(urls);
        handleClose();
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !ready || capturing || busy) return;
    setCapturing(true);
    try {
      const dataUrl = canvasToDataUrl(video);
      onPhotos([dataUrl]);
      handleClose();
    } catch (e) {
      console.error(e);
    } finally {
      setCapturing(false);
    }
  };

  if (!open) return null;

  const disabled = !!busy || capturing;

  return (
    <div className="photo-sheet" role="dialog" aria-modal="true" aria-label="Prendre une photo">
      <button
        type="button"
        className="photo-sheet-close"
        onClick={handleClose}
        aria-label="Fermer"
      >
        ✕
      </button>

      <div className="photo-sheet-stage">
        {cameraError ? (
          <div className="photo-sheet-fallback">
            <p>{cameraError}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="photo-sheet-video"
            playsInline
            autoPlay
            muted
          />
        )}
      </div>

      <div className="photo-sheet-controls">
        <button
          type="button"
          className="photo-sheet-gallery"
          onClick={openGallery}
          disabled={disabled}
        >
          Galerie
        </button>

        <button
          type="button"
          className="photo-sheet-shutter"
          onClick={takePhoto}
          disabled={disabled || !ready || !!cameraError}
          aria-label="Prendre"
          title="Prendre"
        />

        <span className="photo-sheet-spacer" aria-hidden="true" />
      </div>

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
        multiple
        hidden
        onChange={(e) => void onGalleryPicked(e.target.files)}
      />
    </div>
  );
}
