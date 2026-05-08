import React, { useEffect, useMemo, useRef } from 'react';

/**
 * ScrollFrameSequence
 *
 * Canvas-based image-sequence player driven by scroll position. The component
 * occupies `scrollHeight` of vertical space; while the user scrolls through
 * that span, an inner sticky stage paints a frame whose index is derived
 * from scroll progress (0 → 1 across the section).
 *
 * Two modes:
 *   - SINGLE-SEQUENCE: pass folderPath + lastFrame (back-compat).
 *   - MULTI-SEQUENCE: pass `sequences=[{folderPath, lastFrame, ...}, ...]`.
 *     All sequences play in one continuous sticky stage — the canvas never
 *     unsticks between them, so seq1 → seq2 transitions are seamless.
 *
 * URL pattern per sequence:
 *   `${folderPath}/${framePrefix}${zeroPad(i, padLength)}${extension}`
 *
 * `overlayContent` may be a ReactNode OR a render-prop `({progress, frameIdx, totalFrames}) => ReactNode`,
 * useful for fading hero text in/out based on scroll.
 */
export default function ScrollFrameSequence({
  // Single-sequence props (back-compat) — used if `sequences` is not provided.
  folderPath,
  lastFrame,
  firstFrame = 1,
  framePrefix = 'ezgif-frame-',
  extension = '.jpg',
  padLength = 3,
  // Multi-sequence — overrides single-sequence props when provided.
  sequences,
  // Shared.
  scrollHeight = '300vh',
  overlayContent = null,
  className = '',
}) {
  const sectionRef = useRef(null);
  const stickyRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);

  const imagesRef = useRef([]);          // flat array of preloaded <img> objects
  const currentIdxRef = useRef(-1);
  const rafScheduledRef = useRef(false);

  // Normalize to a sequences array regardless of which mode the caller used.
  const seqs = useMemo(() => {
    if (sequences && sequences.length) {
      return sequences.map((s) => ({
        folderPath: s.folderPath,
        firstFrame: s.firstFrame ?? 1,
        lastFrame: s.lastFrame,
        framePrefix: s.framePrefix ?? 'ezgif-frame-',
        extension: s.extension ?? '.jpg',
        padLength: s.padLength ?? 3,
      }));
    }
    return [{ folderPath, firstFrame, lastFrame, framePrefix, extension, padLength }];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(sequences || [{ folderPath, firstFrame, lastFrame, framePrefix, extension, padLength }])]);

  // Flat list of frame URLs across all sequences (preserves sequence order).
  const flatUrls = useMemo(() => {
    const urls = [];
    for (const q of seqs) {
      for (let i = q.firstFrame; i <= q.lastFrame; i++) {
        urls.push(
          `${q.folderPath}/${q.framePrefix}${String(i).padStart(q.padLength, '0')}${q.extension}`
        );
      }
    }
    return urls;
  }, [seqs]);

  const totalFrames = flatUrls.length;

  // Find the nearest already-loaded frame to `idx`, preferring earlier-or-equal.
  // Prevents blank canvas while exact target frame is still loading.
  const pickBestImage = (idx) => {
    const arr = imagesRef.current;
    if (!arr || arr.length === 0) return null;
    if (arr[idx] && arr[idx].complete && arr[idx].naturalWidth > 0) return arr[idx];
    for (let off = 1; off < arr.length; off++) {
      const lo = idx - off;
      const hi = idx + off;
      if (lo >= 0 && arr[lo] && arr[lo].complete && arr[lo].naturalWidth > 0) return arr[lo];
      if (hi < arr.length && arr[hi] && arr[hi].complete && arr[hi].naturalWidth > 0) return arr[hi];
    }
    return null;
  };

  // Draw the frame at `idx`, respecting devicePixelRatio + cover fit.
  const drawFrame = (idx) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width === 0 || canvas.height === 0) return;
    const img = pickBestImage(idx);
    if (!img) return;

    const ctx = canvas.getContext('2d');
    const cw = canvas.width;
    const ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    // object-fit: cover — scale to fill, crop the long axis.
    const ar = img.naturalWidth / img.naturalHeight;
    const car = cw / ch;
    let dw, dh, dx, dy;
    if (ar > car) {
      dh = ch;
      dw = ch * ar;
      dx = (cw - dw) / 2;
      dy = 0;
    } else {
      dw = cw;
      dh = cw / ar;
      dx = 0;
      dy = (ch - dh) / 2;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
  };

  // Resize canvas backing-store to match its CSS size × DPR.
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const stage = stickyRef.current;
    if (!canvas || !stage) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    if (currentIdxRef.current >= 0) drawFrame(currentIdxRef.current);
  };

  // Compute scroll progress 0..1 over the section's tall span.
  const computeProgress = () => {
    const section = sectionRef.current;
    if (!section || totalFrames <= 0) return 0;
    const rect = section.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    if (total <= 0) return 0;
    return Math.min(1, Math.max(0, -rect.top / total));
  };

  // Apply overlay style if it's a render-prop (function). The render-prop is
  // also called once on mount with progress=0; from then on, we update the
  // overlay's data-progress attribute and let the consumer animate via CSS
  // OR re-call the render-prop at each scroll tick. We do the latter for
  // simplicity — React only re-runs the function, no re-renders of parents.
  // To keep this cheap, we mutate a CSS variable on the overlay container.
  // Render-prop consumers should use `style={{ opacity: ... }}` directly with
  // the `progress` they receive.
  // Implementation note: we store progress in a ref and call setOverlay() each
  // rAF tick, which itself updates a small piece of state if overlayContent is
  // a function.
  const overlayIsRenderProp = typeof overlayContent === 'function';

  const onScrollOrResize = () => {
    if (rafScheduledRef.current) return;
    rafScheduledRef.current = true;
    requestAnimationFrame(() => {
      rafScheduledRef.current = false;
      const progress = computeProgress();
      const idx = Math.round(progress * (totalFrames - 1));
      if (idx !== currentIdxRef.current) {
        currentIdxRef.current = idx;
        drawFrame(idx);
      }
      // Update overlay if render-prop. Use direct DOM mutation to avoid React
      // re-render churn at scroll cadence.
      if (overlayIsRenderProp && overlayRef.current) {
        // eslint-disable-next-line no-underscore-dangle
        overlayRef.current.__progressUpdate?.(progress, idx);
      }
    });
  };

  // Preload all frames in flat order. First frame paints ASAP; later frames
  // upgrade the displayed frame as they arrive (via pickBestImage).
  useEffect(() => {
    let cancelled = false;
    const images = new Array(totalFrames);

    for (let i = 0; i < totalFrames; i++) {
      const img = new Image();
      img.src = flatUrls[i];
      img.decoding = 'async';
      img.onload = () => {
        if (cancelled) return;
        const target = currentIdxRef.current < 0 ? 0 : currentIdxRef.current;
        if (currentIdxRef.current < 0) currentIdxRef.current = 0;
        drawFrame(target);
      };
      img.onerror = () => {
        // Graceful: leave dark canvas; overlay text remains interactive.
      };
      images[i] = img;
    }
    imagesRef.current = images;

    return () => {
      cancelled = true;
      imagesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatUrls.join('|')]);

  // Mount: size the canvas, hook scroll/resize, paint initial state.
  useEffect(() => {
    resizeCanvas();
    onScrollOrResize();

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', resizeCanvas, { passive: true });

    let ro;
    if (typeof ResizeObserver !== 'undefined' && stickyRef.current) {
      ro = new ResizeObserver(resizeCanvas);
      ro.observe(stickyRef.current);
    }

    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', resizeCanvas);
      if (ro) ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`relative w-full bg-[#0B132B] ${className}`}
      style={{ height: scrollHeight }}
    >
      <div ref={stickyRef} className="sticky top-0 h-screen w-full overflow-hidden bg-[#0B132B]">
        <canvas ref={canvasRef} className="block w-full h-full" />
        {overlayContent && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            {overlayIsRenderProp ? (
              <OverlayRenderProp render={overlayContent} attachRef={overlayRef} totalFrames={totalFrames} />
            ) : (
              overlayContent
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Helper that renders an overlay from a render-prop and exposes a progress-update
 * channel via the parent's overlayRef. The parent's rAF tick calls
 * `overlayRef.current.__progressUpdate(progress, idx)` and we re-render with
 * those values. Re-renders are throttled to the rAF cadence and only this small
 * subtree re-renders, not the canvas or its parent.
 */
function OverlayRenderProp({ render, attachRef, totalFrames }) {
  const [state, setState] = React.useState({ progress: 0, frameIdx: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    if (!attachRef) return;
    const obj = {
      __progressUpdate: (progress, frameIdx) => {
        setState((prev) =>
          prev.frameIdx === frameIdx && prev.progress === progress ? prev : { progress, frameIdx }
        );
      },
    };
    attachRef.current = obj;
    return () => {
      if (attachRef.current === obj) attachRef.current = null;
    };
  }, [attachRef]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full">
      {render({ progress: state.progress, frameIdx: state.frameIdx, totalFrames })}
    </div>
  );
}
