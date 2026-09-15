import { useEffect, useRef } from 'react';

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  maxIntervalMs?: number;
  minLength?: number;
  enabled?: boolean;
}

/**
 * Hook global para interceptar lecturas de escáneres de código de barras (pistolas USB / Bluetooth HID).
 * Los escáneres envían caracteres en ráfagas ultrarrápidas (< 40ms por caracter) finalizando en 'Enter'.
 * Este hook captura el código incluso si el foco no está en el input de búsqueda, evitando pérdida de lecturas.
 */
export function useBarcodeScanner({
  onScan,
  maxIntervalMs = 50,
  minLength = 3,
  enabled = true,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar teclas modificadoras
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Si el usuario está escribiendo activamente en un campo de texto que NO es de escaneo
      const activeEl = document.activeElement;
      const isInput = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;
      const isSearchInput = isInput && (activeEl.id === 'barcode-search-input' || activeEl.getAttribute('data-barcode-input') === 'true');

      if (e.key === 'Enter') {
        const barcode = bufferRef.current.trim();
        bufferRef.current = '';

        if (barcode.length >= minLength) {
          // Si el buffer se llenó rápidamente o si el foco no estaba en un input ajeno
          if (!isInput || isSearchInput || timeDiff < maxIntervalMs * 2) {
            e.preventDefault();
            e.stopPropagation();
            onScanRef.current(barcode);
          }
        }
        return;
      }

      // Solo caracteres imprimibles individuales
      if (e.key.length === 1) {
        // Si el tiempo entre teclas supera el intervalo humano normal (> 150ms), reiniciar buffer
        if (timeDiff > 150) {
          bufferRef.current = e.key;
        } else {
          bufferRef.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, maxIntervalMs, minLength]);
}
