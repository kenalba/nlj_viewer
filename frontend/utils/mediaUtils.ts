/**
 * Media URL utilities for handling CORS proxying and URL transformations
 */

/**
 * Transform external media URLs to use local proxy to bypass CORS restrictions
 * @param originalUrl - The original media URL
 * @returns Proxied URL if external, original URL if local
 */
export function getProxiedMediaUrl(originalUrl: string): string {
  // Only proxy external URLs that might have CORS issues
  if (originalUrl.includes('static.qa.ander.ai') || originalUrl.includes('static.prod.ander.ai')) {
    // Transform: https://static.qa.ander.ai/video/converted/xyz.m3u8
    // To: https://callcoach.training/proxy/video/video/converted/xyz.m3u8
    
    const url = new URL(originalUrl);
    const pathWithoutLeadingSlash = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
    
    return `/proxy/video/${pathWithoutLeadingSlash}`;
  }
  
  // Return original URL for local or non-problematic external URLs
  return originalUrl;
}

/**
 * Check if a media URL needs CORS proxying
 * @param url - Media URL to check
 * @returns true if URL needs proxying
 */
export function needsCorsProxy(url: string): boolean {
  return url.includes('static.qa.ander.ai') || url.includes('static.prod.ander.ai');
}

/**
 * Get display name for media source
 * @param url - Media URL
 * @returns Human-readable source name
 */
export function getMediaSource(url: string): string {
  if (url.includes('static.qa.ander.ai')) return 'QA Server';
  if (url.includes('static.prod.ander.ai')) return 'Production Server';
  if (url.startsWith('/') || url.includes(window.location.hostname)) return 'Local Server';
  return 'External Source';
}