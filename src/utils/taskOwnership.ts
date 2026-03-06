/**
 * Determines if an activity/task belongs to the current user.
 * 
 * Ownership rules:
 * - assigned_to_user_id === me → MY task
 * - assigned_to_user_id === someone else → NOT my task
 * - assigned_to_user_id is null AND logged_by_user_id === me → MY task
 * - assigned_to_user_id is null AND logged_by_user_id !== me → NOT my task
 */
export const isMyTask = (
  activity: { logged_by_user_id: string; assigned_to_user_id: string | null },
  currentUserId: string | null
): boolean => {
  if (!currentUserId) return true; // If no userId yet, show all (fallback)
  
  if (activity.assigned_to_user_id) {
    return activity.assigned_to_user_id === currentUserId;
  }
  
  return activity.logged_by_user_id === currentUserId;
};
