import { useRef, useCallback } from 'react';

/**
 * Decoupled streaming display pipeline.
 * Buffers incoming SSE chunks and drains them smoothly via requestAnimationFrame.
 *
 * @param {function} onChar - Called with batched characters to display
 * @returns {{ enqueue: function, flush: function, setSpeed: function }}
 */
export function useStreamBuffer(onChar) {
  const queue = useRef([]);
  const animating = useRef(false);
  const speed = useRef(4); // chars per animation frame (~240 chars/sec at 60fps)

  const drain = useCallback(() => {
    if (queue.current.length === 0) {
      animating.current = false;
      return;
    }
    const batch = queue.current.splice(0, speed.current).join('');
    onChar(batch);
    requestAnimationFrame(drain);
  }, [onChar]);

  const enqueue = useCallback((text) => {
    queue.current.push(...text);
    if (!animating.current) {
      animating.current = true;
      requestAnimationFrame(drain);
    }
  }, [drain]);

  const flush = useCallback(() => {
    // Called on stream end — drain remaining instantly
    if (queue.current.length > 0) {
      onChar(queue.current.splice(0).join(''));
    }
    animating.current = false;
  }, [onChar]);

  const setSpeed = useCallback((n) => {
    speed.current = n;
  }, []);

  return { enqueue, flush, setSpeed };
}
