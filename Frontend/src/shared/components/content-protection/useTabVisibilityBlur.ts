import { useEffect, useState } from 'react';

export function useTabVisibilityBlur(): boolean {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsHidden(document.visibilityState === 'hidden');
    };

    const handleBlur = () => {
      setIsHidden(true);
    };

    const handleFocus = () => {
      setIsHidden(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return isHidden;
}
