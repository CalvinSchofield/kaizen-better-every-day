// Centralized Notion API rate limiter for edge functions
// Notion's rate limit is ~3 requests/second on average

const RATE_LIMIT_DELAY_MS = 350; // ~2.8 req/sec to stay under limit
const MAX_RETRIES = 8;
const MAX_BACKOFF_MS = 90000;

/**
 * Fetch with rate limiting and exponential backoff for Notion API
 */
export async function fetchNotionWithRateLimit(
  url: string, 
  options: RequestInit,
  maxRetries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add small delay between requests to respect rate limits
      if (attempt > 0) {
        const baseDelay = Math.min(2000 * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
        const jitter = Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
      } else {
        // Small delay even on first attempt to spread out requests
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      }
      
      const response = await fetch(url, options);
      
      // If rate limited (429), retry with exponential backoff + jitter
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        let delay: number;
        
        if (retryAfter) {
          // Retry-After from Notion is in seconds, convert to ms
          // Cap at MAX_BACKOFF_MS to prevent extremely long waits
          const retryAfterMs = parseInt(retryAfter, 10) * 1000;
          delay = Math.min(retryAfterMs, MAX_BACKOFF_MS) || MAX_BACKOFF_MS;
        } else {
          const baseDelay = Math.min(2000 * Math.pow(2, attempt), MAX_BACKOFF_MS);
          const jitter = Math.random() * 1000;
          delay = baseDelay + jitter;
        }
        
        console.log(`Rate limited (429). Retrying in ${Math.round(delay)}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Handle server errors with retry
      if (response.status >= 500) {
        console.log(`Server error (${response.status}). Retrying... (attempt ${attempt + 1}/${maxRetries})`);
        continue;
      }
      
      return response;
    } catch (error: any) {
      lastError = error;
      console.error(`Fetch attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt < maxRetries - 1) {
        const delay = Math.min(2000 * Math.pow(2, attempt), MAX_BACKOFF_MS) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error(`Failed after ${maxRetries} attempts`);
}

/**
 * Standard Notion API headers
 */
export function getNotionHeaders(apiKey: string): HeadersInit {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };
}
