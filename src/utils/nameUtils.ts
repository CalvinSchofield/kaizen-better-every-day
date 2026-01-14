/**
 * Strip emojis and special unicode characters from a string
 * Examples:
 * - "🔥 John Smith" -> "John Smith"
 * - "🚗 Ammon Allan" -> "Ammon Allan"
 * - "Calvin 💪" -> "Calvin"
 */
export function stripEmojis(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Modifier_Base}\p{Emoji_Component}]/gu, '')
    .trim();
}

/**
 * Get a clean name with emojis stripped
 * Examples:
 * - "🔥 John Smith" -> "John Smith"
 * - "🚗 Ammon Allan" -> "Ammon Allan"
 * - undefined/null -> ""
 */
export function getCleanName(name: string | undefined | null): string {
  return stripEmojis(name);
}

/**
 * Get first name only, with emojis stripped
 * Examples:
 * - "🔥 John Smith" -> "John"
 * - "🚗 Ammon Allan" -> "Ammon"
 */
export function getCleanFirstName(name: string | undefined | null): string {
  const clean = stripEmojis(name);
  if (!clean) return '';
  return clean.split(/\s+/)[0] || '';
}

/**
 * Get initials from a full name (first and last name initials)
 * Strips emojis and special characters before processing
 * Examples:
 * - "Calvin Schofield" -> "CS"
 * - "Ammon Allan" -> "AA"
 * - "Isaiah castro" -> "IC"
 * - "🔥 John Smith" -> "JS"
 * - "John" -> "J"
 * - undefined/null -> "?"
 */
export function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  
  const cleanName = stripEmojis(name);
  
  const parts = cleanName.split(/\s+/).filter(n => n.length > 0);
  if (parts.length === 0) return '?';
  
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  // First and last name initials
  const firstInitial = parts[0].charAt(0).toUpperCase();
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  
  return `${firstInitial}${lastInitial}`;
}
