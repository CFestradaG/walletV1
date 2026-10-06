import { useEffect, useState, useRef, useCallback } from 'react';
import { getSecurityConfig } from './securityService';

export function useAppLock(userId?: string) {
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    if (!userId) return false;
    const cfg = getSecurityConfig(userId);
    return cfg.enabled;
  });

  const lastActiveRef = useRef<number>(Date.now());

  // Check and lock app immediately
  const lockNow = useCallback(() => {
    if (!userId) return;
    const cfg = getSecurityConfig(userId);
    if (cfg.enabled) {
      setIsLocked(true);
    }
  }, [userId]);

  // Unlock app
  const unlockApp = useCallback(() => {
    lastActiveRef.current = Date.now();
    setIsLocked(false);
  }, []);

  // Update lock state if config changes
  useEffect(() => {
    if (!userId) {
      setIsLocked(false);
      return;
    }
    const cfg = getSecurityConfig(userId);
    setIsLocked(cfg.enabled);
  }, [userId]);

  // Activity & visibility listener
  useEffect(() => {
    if (!userId) return;

    const handleSyncedSecurityChange = () => {
      setIsLocked(getSecurityConfig(userId).enabled);
    };
    window.addEventListener('wallet-security-preferences-changed', handleSyncedSecurityChange);
    return () => window.removeEventListener('wallet-security-preferences-changed', handleSyncedSecurityChange);
  }, [userId]);

  // Activity & visibility listener
  useEffect(() => {
    if (!userId) return;

    const handleVisibilityChange = () => {
      const cfg = getSecurityConfig(userId);
      if (!cfg.enabled) return;

      if (document.hidden) {
        // App is being minimized or backgrounded
        lastActiveRef.current = Date.now();
      } else {
        // App came back to foreground
        const elapsedMinutes = (Date.now() - lastActiveRef.current) / (1000 * 60);

        if (cfg.lockOnAppSwitch || (cfg.lockTimeoutMinutes > 0 && elapsedMinutes >= cfg.lockTimeoutMinutes)) {
          setIsLocked(true);
        }
      }
    };

    const handleUserActivity = () => {
      lastActiveRef.current = Date.now();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('touchstart', handleUserActivity, { passive: true });
    window.addEventListener('mousedown', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('mousedown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
    };
  }, [userId]);

  return {
    isLocked,
    lockNow,
    unlockApp,
  };
}
