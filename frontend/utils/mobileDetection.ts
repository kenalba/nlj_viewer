/**
 * Mobile detection utility for hiding keyboard helper text on mobile devices
 */

import { useEffect, useState } from 'react';

/**
 * Hook to detect if the user is on a mobile device
 * Uses a combination of user agent detection and screen size
 */
export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Check user agent for mobile devices
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileUserAgents = [
        'android',
        'iphone',
        'ipad',
        'ipod',
        'blackberry',
        'windows phone',
        'mobile'
      ];
      
      const isUserAgentMobile = mobileUserAgents.some(agent => 
        userAgent.includes(agent)
      );
      
      // Check screen size (mobile-like dimensions)
      const isSmallScreen = window.innerWidth <= 768;
      
      // Check for touch support
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Consider it mobile if any of these conditions are met
      setIsMobile(isUserAgentMobile || (isSmallScreen && isTouchDevice));
    };

    // Initial check
    checkMobile();

    // Listen for window resize to handle device rotation
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

/**
 * Simple function to detect mobile devices (for use outside of React components)
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileUserAgents = [
    'android',
    'iphone',
    'ipad',
    'ipod',
    'blackberry',
    'windows phone',
    'mobile'
  ];
  
  const isUserAgentMobile = mobileUserAgents.some(agent => 
    userAgent.includes(agent)
  );
  
  const isSmallScreen = window.innerWidth <= 768;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  return isUserAgentMobile || (isSmallScreen && isTouchDevice);
};