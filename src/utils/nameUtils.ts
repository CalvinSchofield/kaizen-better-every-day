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
  
  // Strip emojis and special unicode characters first
  const cleanName = name
    .replace(/[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Modifier_Base}\p{Emoji_Component}]/gu, '')
    .trim();
  
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
