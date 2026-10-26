import { useLayoutEffect, useState } from 'react';
import debounce from 'lodash/debounce';

const useIsMobile = (breakpoint = 768): boolean => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
  useLayoutEffect(() => {
    const handler = debounce(() => setIsMobile(window.innerWidth < breakpoint), 100);
    window.addEventListener('resize', handler);
    return () => { window.removeEventListener('resize', handler); handler.cancel(); }; // 같은 참조로 해제
  }, [breakpoint]);
  return isMobile;
};
export default useIsMobile;
