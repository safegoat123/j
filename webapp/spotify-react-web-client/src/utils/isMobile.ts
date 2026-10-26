import { useLayoutEffect, useState } from 'react';
import debounce from 'lodash/debounce';

export const MOBILE_BREAKPOINT = 768;

/** Subscribes to window resize with a *single* debounced handler reference, so cleanup works. */
export const useWindowWidth = (wait = 150): number => {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1024 : window.innerWidth));

  useLayoutEffect(() => {
    const handler = debounce(() => setWidth(window.innerWidth), wait);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('resize', handler);
      handler.cancel();
    };
  }, [wait]);

  return width;
};

const useIsMobile = (): boolean => useWindowWidth() < MOBILE_BREAKPOINT;

export default useIsMobile;
