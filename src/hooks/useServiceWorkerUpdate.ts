import { useCallback, useEffect, useRef, useState } from 'react';

const SW_URL = `${import.meta.env.BASE_URL}sw.js`;

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;

function registerWorker(): Promise<ServiceWorkerRegistration> {
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker.register(SW_URL);
  }
  return registrationPromise;
}

function isUpdateWorker(sw: ServiceWorker | null | undefined): sw is ServiceWorker {
  return !!sw && !!navigator.serviceWorker.controller;
}

export function useServiceWorkerUpdate() {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const applyingRef = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const hadController = !!navigator.serviceWorker.controller;

    const markWaiting = (sw: ServiceWorker | null | undefined) => {
      if (!isUpdateWorker(sw)) return;
      waitingRef.current = sw;
      setAvailable(true);
    };

    const watch = (sw: ServiceWorker | null | undefined) => {
      if (!sw) return;
      if (sw.state === 'installed') markWaiting(sw);
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed') markWaiting(sw);
      });
    };

    const attach = (reg: ServiceWorkerRegistration) => {
      registrationRef.current = reg;
      watch(reg.waiting);
      watch(reg.installing);
      reg.addEventListener('updatefound', () => watch(reg.installing));
    };

    const start = () => {
      void registerWorker()
        .then((reg) => {
          attach(reg);
          return reg.update();
        })
        .catch(() => {});
    };

    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start);

    const checkForUpdate = () => {
      void registrationRef.current?.update().catch(() => {});
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) checkForUpdate();
    };

    const onControllerChange = () => {
      if (applyingRef.current) {
        window.location.reload();
        return;
      }
      // New worker took control (another tab, or an older auto-skipWaiting SW).
      if (hadController) setAvailable(true);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', checkForUpdate);
    window.addEventListener('pageshow', onPageShow);
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      window.removeEventListener('load', start);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', checkForUpdate);
      window.removeEventListener('pageshow', onPageShow);
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange,
      );
    };
  }, []);

  const applyUpdate = useCallback(() => {
    const waiting = waitingRef.current;
    applyingRef.current = true;

    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
      window.setTimeout(() => {
        window.location.reload();
      }, 900);
      return;
    }

    window.location.reload();
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  return {
    updateAvailable: available && !dismissed,
    applyUpdate,
    dismiss,
  };
}
