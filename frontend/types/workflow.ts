/**
 * TypeScript types for version-aware approval workflow system.
 * Matches the backend Pydantic models and database schema.
 */

export enum VersionStatus {
  DRAFT = "draft",           // Being edited by creator
  PUBLISHED = "published",   // Live and available to users
  ARCHIVED = "archived"      // Older version, kept for history
}

export enum WorkflowState {
  DRAFT = "draft",                                    // Creator is editing
  SUBMITTED_FOR_REVIEW = "submitted_for_review",      // Submitted to reviewers
  IN_REVIEW = "in_review",                           // Being reviewed
  REVISION_REQUESTED = "revision_requested",          // Needs changes
  APPROVED_PENDING_PUBLISH = "approved_pending_publish", // Approved, waiting to publish
  PUBLISHED = "published",                           // Live version
  REJECTED = "rejected",                             // Permanently rejected
  WITHDRAWN = "withdrawn"                            // Creator withdrew submission
}

export enum ReviewDecision {
  APPROVE = "approve",
  REQUEST_REVISION = "request_revision",
  REJECT = "reject"
}

// Content Version interfaces
export interface ContentVersion {
  id: string;
  content_id: string;
  version_number: number;
  version_status: VersionStatus;
  title: string;
  description?: string;
  change_summary?: string;
  created_by: string;
  created_at: string;
  published_at?: string;
  archived_at?: string;
  nlj_data?: any; // The full NLJ scenario data
}

// Approval Workflow interfaces  
export interface ApprovalWorkflow {
  id: string;
  content_version_id: string;
  current_state: WorkflowState;
  submitted_at?: string;
  approved_at?: string;
  published_at?: string;
  assigned_reviewer_id?: string;
  requires_approval: boolean;
  auto_publish: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowReview {
  id: string;
  workflow_id: string;
  reviewer_id: string;
  decision: ReviewDecision;
  comments?: string;
  feedback_areas?: Record<string, any>;
  previous_state: WorkflowState;
  new_state: WorkflowState;
  created_at: string;
}

export interface PendingReview {
  workflow: ApprovalWorkflow;
  content_title: string;
  content_description?: string;
  version_number: number;
  creator_name: string;
  submitted_at?: string;
}

// API Request/Response types
export interface CreateVersionRequest {
  content_id: string;
  nlj_data: any;
  title: string;
  description?: string;
  change_summary?: string;
}

export interface CreateWorkflowRequest {
  version_id: string;
  requires_approval?: boolean;
  auto_publish?: boolean;
  assigned_reviewer_id?: string;
}

export interface SubmitForReviewRequest {
  version_id: string;
  reviewer_id?: string;
}

export interface AssignReviewerRequest {
  reviewer_id: string;
}

export interface ReviewContentRequest {
  comments?: string;
  feedback_areas?: Record<string, any>;
}

export interface ApproveContentRequest extends ReviewContentRequest {
  auto_publish?: boolean;
}

export interface RequestRevisionRequest extends ReviewContentRequest {
  comments: string; // Required for revision requests
}

export interface RejectContentRequest extends ReviewContentRequest {
  comments: string; // Required for rejection
}

export interface WithdrawSubmissionRequest {
  reason?: string;
}

export interface PublishVersionRequest {
  version_id: string;
}

// Workflow state utilities
export const getWorkflowStateColor = (state: WorkflowState): string => {
  switch (state) {
    case WorkflowState.DRAFT:
      return "#9E9E9E"; // Grey
    case WorkflowState.SUBMITTED_FOR_REVIEW:
      return "#FF9800"; // Orange
    case WorkflowState.IN_REVIEW:
      return "#2196F3"; // Blue
    case WorkflowState.REVISION_REQUESTED:
      return "#FF5722"; // Deep Orange
    case WorkflowState.APPROVED_PENDING_PUBLISH:
      return "#4CAF50"; // Green
    case WorkflowState.PUBLISHED:
      return "#8BC34A"; // Light Green
    case WorkflowState.REJECTED:
      return "#F44336"; // Red
    case WorkflowState.WITHDRAWN:
      return "#795548"; // Brown
    default:
      return "#9E9E9E";
  }
};

export const getWorkflowStateLabel = (state: WorkflowState): string => {
  switch (state) {
    case WorkflowState.DRAFT:
      return "Draft";
    case WorkflowState.SUBMITTED_FOR_REVIEW:
      return "Submitted";
    case WorkflowState.IN_REVIEW:
      return "In Review";
    case WorkflowState.REVISION_REQUESTED:
      return "Revision Requested";
    case WorkflowState.APPROVED_PENDING_PUBLISH:
      return "Approved";
    case WorkflowState.PUBLISHED:
      return "Published";
    case WorkflowState.REJECTED:
      return "Rejected";
    case WorkflowState.WITHDRAWN:
      return "Withdrawn";
    default:
      return state;
  }
};

export const getVersionStatusColor = (status: VersionStatus): string => {
  switch (status) {
    case VersionStatus.DRAFT:
      return "#FF9800"; // Orange
    case VersionStatus.PUBLISHED:
      return "#4CAF50"; // Green
    case VersionStatus.ARCHIVED:
      return "#9E9E9E"; // Grey
    default:
      return "#9E9E9E";
  }
};

export const getVersionStatusLabel = (status: VersionStatus): string => {
  switch (status) {
    case VersionStatus.DRAFT:
      return "Draft";
    case VersionStatus.PUBLISHED:
      return "Published";
    case VersionStatus.ARCHIVED:
      return "Archived";
    default:
      return status;
  }
};

export const getReviewDecisionColor = (decision: ReviewDecision): string => {
  switch (decision) {
    case ReviewDecision.APPROVE:
      return "#4CAF50"; // Green
    case ReviewDecision.REQUEST_REVISION:
      return "#FF9800"; // Orange
    case ReviewDecision.REJECT:
      return "#F44336"; // Red
    default:
      return "#9E9E9E";
  }
};

export const getReviewDecisionLabel = (decision: ReviewDecision): string => {
  switch (decision) {
    case ReviewDecision.APPROVE:
      return "Approved";
    case ReviewDecision.REQUEST_REVISION:
      return "Revision Requested";
    case ReviewDecision.REJECT:
      return "Rejected";
    default:
      return decision;
  }
};

// Workflow action checks
export const canSubmitForReview = (state: WorkflowState): boolean => {
  return state === WorkflowState.DRAFT || state === WorkflowState.REVISION_REQUESTED;
};

export const canApprove = (state: WorkflowState): boolean => {
  return state === WorkflowState.IN_REVIEW;
};

export const canRequestRevision = (state: WorkflowState): boolean => {
  return state === WorkflowState.IN_REVIEW;
};

export const canReject = (state: WorkflowState): boolean => {
  return state === WorkflowState.IN_REVIEW;
};

export const canPublish = (state: WorkflowState): boolean => {
  return state === WorkflowState.APPROVED_PENDING_PUBLISH;
};

export const canWithdraw = (state: WorkflowState): boolean => {
  return state === WorkflowState.SUBMITTED_FOR_REVIEW || state === WorkflowState.IN_REVIEW;
};

export const isVersionEditable = (status: VersionStatus): boolean => {
  return status === VersionStatus.DRAFT;
};

export const isVersionPublished = (status: VersionStatus): boolean => {
  return status === VersionStatus.PUBLISHED;
};