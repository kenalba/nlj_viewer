// Debug utilities for NLJ Viewer
// Automatically enabled in development mode (npm run dev)
// Disable with: localStorage.setItem('nlj_debug', 'false') or nlj_debug.disable()
// Enable in production: localStorage.setItem('nlj_debug', 'true') or nlj_debug.enable()

const DEBUG_KEY = 'nlj_debug';

export const isDebugEnabled = (): boolean => {
  // Check if explicitly disabled first
  if (localStorage.getItem(DEBUG_KEY) === 'false') {
    return false;
  }
  
  // Check if explicitly enabled
  if (localStorage.getItem(DEBUG_KEY) === 'true') {
    return true;
  }
  
  // Default to enabled in development mode
  return import.meta.env.DEV;
};

export const enableDebug = (): void => {
  localStorage.setItem(DEBUG_KEY, 'true');
  console.log('🐛 NLJ Debug mode enabled');
  console.log('💡 To disable: localStorage.removeItem("nlj_debug")');
};

export const disableDebug = (): void => {
  localStorage.setItem(DEBUG_KEY, 'false');
  console.log('🐛 NLJ Debug mode disabled');
  console.log('💡 To re-enable: localStorage.setItem("nlj_debug", "true") or use nlj_debug.enable()');
};

export const debugLog = (category: string, message: string, data?: any): void => {
  if (!isDebugEnabled()) return;
  
  const timestamp = new Date().toLocaleTimeString();
  console.group(`🐛 [${timestamp}] ${category}`);
  console.log(message);
  if (data !== undefined) {
    console.log('Data:', data);
  }
  console.groupEnd();
};

export const debugState = (action: string, prevState: any, newState: any): void => {
  if (!isDebugEnabled()) return;
  
  const timestamp = new Date().toLocaleTimeString();
  console.group(`🔄 [${timestamp}] State Change: ${action}`);
  console.log('Previous State:', prevState);
  console.log('New State:', newState);
  console.log('Changed:', getChangedFields(prevState, newState));
  console.groupEnd();
};

const getChangedFields = (prev: any, next: any): Record<string, { from: any; to: any }> => {
  const changes: Record<string, { from: any; to: any }> = {};
  
  for (const key in next) {
    if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
      changes[key] = { from: prev[key], to: next[key] };
    }
  }
  
  return changes;
};

// Make debug functions available globally in development
if (typeof window !== 'undefined') {
  (window as any).nlj_debug = {
    enable: enableDebug,
    disable: disableDebug,
    isEnabled: isDebugEnabled,
  };
}