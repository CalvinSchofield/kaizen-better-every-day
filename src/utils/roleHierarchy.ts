/**
 * Centralized role hierarchy and permission utilities.
 * 
 * Hierarchy (lowest to highest):
 * none → recruiter → assistant_manager → team_lead → manager → senior_manager →
 * mgmt_group_lead → area_director → regional → sr_regional → partner → divisional → corporate
 */

export type AccessLevel =
  | 'corporate'
  | 'divisional'
  | 'partner'
  | 'sr_regional'
  | 'regional'
  | 'area_director'
  | 'mgmt_group_lead'
  | 'senior_manager'
  | 'manager'
  | 'team_lead'
  | 'assistant_manager'
  | 'recruiter'
  | 'none';

export const ROLE_HIERARCHY: AccessLevel[] = [
  'none',
  'recruiter',
  'assistant_manager',
  'team_lead',
  'manager',
  'senior_manager',
  'mgmt_group_lead',
  'area_director',
  'regional',
  'sr_regional',
  'partner',
  'divisional',
  'corporate',
];

/** Check if actual access level meets or exceeds the required level */
export const hasMinAccess = (actual: AccessLevel, required: AccessLevel): boolean => {
  return ROLE_HIERARCHY.indexOf(actual) >= ROLE_HIERARCHY.indexOf(required);
};

/** Has any leadership access (assistant_manager+) */
export const isLeader = (level: AccessLevel): boolean => hasMinAccess(level, 'assistant_manager');

/** Can manage teams/groups formally (team_lead+) */
export const canManageTeam = (level: AccessLevel): boolean => hasMinAccess(level, 'team_lead');

/** Can manage blitzes (team_lead+) — assistant managers cannot */
export const canManageBlitzes = (level: AccessLevel): boolean => hasMinAccess(level, 'team_lead');

/** Can view team filter (area_director+ or mgmt_group_lead) */
export const canFilterByTeam = (level: AccessLevel): boolean => hasMinAccess(level, 'mgmt_group_lead');

/** Can see all offices (corporate level) */
export const isGlobalAccess = (level: AccessLevel): boolean => hasMinAccess(level, 'regional');

/** Gets a human-readable label for the access level */
export const getRoleLabel = (level: AccessLevel): string => {
  const labels: Record<AccessLevel, string> = {
    none: 'No Access',
    recruiter: 'Recruiter',
    assistant_manager: 'Assistant Manager',
    team_lead: 'Team Lead',
    manager: 'Manager',
    senior_manager: 'Senior Manager',
    mgmt_group_lead: 'MGMT Group Lead',
    area_director: 'Area Director',
    regional: 'Regional',
    sr_regional: 'Sr. Regional',
    partner: 'Partner',
    divisional: 'Divisional',
    corporate: 'Corporate',
  };
  return labels[level] || level;
};

/** All assignable roles for admin panel (excludes dynamic roles) */
export const ASSIGNABLE_ROLES: AccessLevel[] = [
  'assistant_manager',
  'manager',
  'senior_manager',
  'regional',
  'sr_regional',
  'partner',
  'divisional',
  'corporate',
];
