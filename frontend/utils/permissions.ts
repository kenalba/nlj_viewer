/**
 * Centralized permissions system for role-based access control
 * Handles case-insensitive role checking and provides a clean API
 */

import type { User } from '../api/auth';

export type UserRole = 'PLAYER' | 'LEARNER' | 'CREATOR' | 'REVIEWER' | 'APPROVER' | 'ADMIN';

/**
 * Normalize role to lowercase for consistent checking
 */
export const normalizeRole = (role: string | undefined | null): string => {
  return role?.toLowerCase() || '';
};

/**
 * Check if user has a specific role
 */
export const hasRole = (user: User | null | undefined, role: UserRole): boolean => {
  if (!user?.role) return false;
  return normalizeRole(user.role) === normalizeRole(role);
};

/**
 * Check if user has any of the specified roles
 */
export const hasAnyRole = (user: User | null | undefined, roles: UserRole[]): boolean => {
  if (!user?.role) return false;
  const userRole = normalizeRole(user.role);
  return roles.some(role => normalizeRole(role) === userRole);
};

/**
 * Content management permissions
 */
export const canEditContent = (user: User | null | undefined): boolean => {
  return hasAnyRole(user, ['CREATOR', 'REVIEWER', 'APPROVER', 'ADMIN']);
};

export const canReviewContent = (user: User | null | undefined): boolean => {
  return hasAnyRole(user, ['REVIEWER', 'APPROVER', 'ADMIN']);
};

export const canApproveContent = (user: User | null | undefined): boolean => {
  return hasAnyRole(user, ['APPROVER', 'ADMIN']);
};

export const canDeleteContent = (user: User | null | undefined): boolean => {
  return hasAnyRole(user, ['CREATOR', 'ADMIN']);
};

export const canViewAnalytics = (user: User | null | undefined): boolean => {
  return hasAnyRole(user, ['CREATOR', 'REVIEWER', 'APPROVER', 'ADMIN']);
};

/**
 * User management permissions
 */
export const canManageUsers = (user: User | null | undefined): boolean => {
  return hasRole(user, 'ADMIN');
};

export const canEditUser = (currentUser: User | null | undefined, targetUser: User | null | undefined): boolean => {
  if (!currentUser || !targetUser) return false;
  return hasRole(currentUser, 'ADMIN') || currentUser.id === targetUser.id;
};

export const canDeleteUser = (currentUser: User | null | undefined, targetUser: User | null | undefined): boolean => {
  if (!currentUser || !targetUser) return false;
  return hasRole(currentUser, 'ADMIN') && !hasRole(targetUser, 'ADMIN');
};

/**
 * Content-specific permissions based on ownership and state
 */
export interface ContentItem {
  id: string;
  created_by: string;
  state: 'draft' | 'submitted' | 'in_review' | 'approved' | 'published' | 'rejected';
  [key: string]: any;
}

export const canEditContentItem = (user: User | null | undefined, item: ContentItem): boolean => {
  if (!user) return false;
  
  // Admin can edit anything
  if (hasRole(user, 'ADMIN')) return true;
  
  // Owner can edit their own content
  if (item.created_by === user.username) return true;
  
  // Reviewers and approvers can edit content in review
  if (hasAnyRole(user, ['REVIEWER', 'APPROVER']) && ['submitted', 'in_review'].includes(item.state)) {
    return true;
  }
  
  return false;
};

export const canReviewContentItem = (user: User | null | undefined, item: ContentItem): boolean => {
  if (!user) return false;
  
  // Admin can review anything
  if (hasRole(user, 'ADMIN')) return true;
  
  // State-based review permissions
  switch (item.state) {
    case 'submitted':
    case 'in_review':
      return hasAnyRole(user, ['REVIEWER', 'APPROVER']);
    default:
      return false;
  }
};

/**
 * Bulk action permissions
 */
export const canPerformBulkActions = (user: User | null | undefined): boolean => {
  return hasAnyRole(user, ['CREATOR', 'REVIEWER', 'APPROVER', 'ADMIN']);
};

export const canBulkPublish = (user: User | null | undefined): boolean => {
  return hasAnyRole(user, ['CREATOR', 'REVIEWER', 'APPROVER', 'ADMIN']);
};

export const canBulkReject = (user: User | null | undefined): boolean => {
  return hasAnyRole(user, ['REVIEWER', 'APPROVER', 'ADMIN']);
};

/**
 * UI mode determination
 */
export const getAppMode = (user: User | null | undefined): 'editor' | 'player' => {
  return canEditContent(user) ? 'editor' : 'player';
};

/**
 * Content state filtering based on user role
 */
export const getAllowedContentStates = (user: User | null | undefined): string[] => {
  if (!user) return ['published'];
  
  if (hasRole(user, 'ADMIN')) {
    return ['published', 'approved', 'rejected', 'in_review', 'submitted', 'draft'];
  }
  
  if (hasRole(user, 'APPROVER')) {
    return ['published', 'approved', 'rejected', 'in_review', 'submitted'];
  }
  
  if (hasRole(user, 'REVIEWER')) {
    return ['published', 'rejected', 'in_review', 'submitted'];
  }
  
  if (hasRole(user, 'CREATOR')) {
    return ['published', 'approved', 'rejected', 'in_review', 'submitted', 'draft'];
  }
  
  return ['published'];
};

/**
 * Helper to check if user can create content
 */
export const canCreateContent = (user: User | null | undefined): boolean => {
  return hasAnyRole(user, ['CREATOR', 'ADMIN']);
};

/**
 * Version management permissions
 */
export const canManageVersions = (user: User | null | undefined, contentItem?: ContentItem): boolean => {
  if (!user || !contentItem) return false;
  return canEditContentItem(user, contentItem);
};