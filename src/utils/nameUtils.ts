/**
 * Get initials from a full name (first and last name initials)
 * Examples:
 * - "Calvin Schofield" -> "CS"
 * - "Ammon Allan" -> "AA"
 * - "Isaiah castro" -> "IC"
 * - "John" -> "J"
 * - undefined/null -> "?"
 */
export function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  // First and last name initials
  const firstInitial = parts[0].charAt(0).toUpperCase();
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  
  return `${firstInitial}${lastInitial}`;
}
