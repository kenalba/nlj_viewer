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
  workflow: ApprovalWorkflow | MultiStageWorkflow;
  content_id: string;
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

// Multi-stage workflow types
export enum WorkflowTemplateType {
  TRAINING = "training",
  ASSESSMENT = "assessment", 
  SURVEY = "survey",
  GAME = "game",
  DEFAULT = "default"
}

export enum StageType {
  PEER_REVIEW = "peer_review",
  EXPERT_REVIEW = "expert_review",
  MANAGER_APPROVAL = "manager_approval",
  FINAL_APPROVAL = "final_approval",
  COMPLIANCE_CHECK = "compliance_check",
  CUSTOM = "custom"
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  content_type: WorkflowTemplateType;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  auto_publish_on_completion: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  stages: WorkflowTemplateStage[];
}

export interface WorkflowTemplateStage {
  id: string;
  template_id: string;
  stage_order: number;
  stage_type: StageType;
  name: string;
  description?: string;
  required_approvals: number;
  allow_parallel_review: boolean;
  auto_assign_to_role?: string;
  reviewer_selection_criteria?: Record<string, any>;
  estimated_duration_hours?: number;
}

export interface StageReviewerAssignment {
  id: string;
  stage_instance_id: string;
  reviewer_id?: string;
  assigned_role?: string;
  assignment_type: string;
  is_active: boolean;
  has_reviewed: boolean;
  delegated_from_id?: string;
  delegation_reason?: string;
  assigned_by: string;
  assigned_at: string;
}

export interface WorkflowStageInstance {
  id: string;
  workflow_id: string;
  template_stage_id: string;
  current_state: WorkflowState;
  approvals_received: number;
  approvals_required: number;
  started_at?: string;
  completed_at?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  template_stage: WorkflowTemplateStage;
  reviewer_assignments: StageReviewerAssignment[];
}

export interface MultiStageWorkflow extends ApprovalWorkflow {
  template_id?: string;
  current_stage_order?: number;
  stage_instances: WorkflowStageInstance[];
}

// Multi-stage API request types
export interface CreateWorkflowTemplateRequest {
  name: string;
  content_type: WorkflowTemplateType;
  description?: string;
  is_default?: boolean;
  auto_publish_on_completion?: boolean;
  stages?: Array<Record<string, any>>;
}

export interface CreateMultiStageWorkflowRequest {
  version_id: string;
  template_id: string;
}

export interface AssignStageReviewersRequest {
  reviewer_ids: string[];
}

export interface DelegateReviewerRequest {
  assignment_id: string;
  new_reviewer_id: string;
  delegation_reason?: string;
}

export interface SubmitStageReviewRequest {
  decision: ReviewDecision;
  comments?: string;
  feedback_areas?: Record<string, any>;
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

// Multi-stage workflow utilities
export const getWorkflowTemplateTypeLabel = (type: WorkflowTemplateType): string => {
  switch (type) {
    case WorkflowTemplateType.TRAINING:
      return "Training";
    case WorkflowTemplateType.ASSESSMENT:
      return "Assessment";
    case WorkflowTemplateType.SURVEY:
      return "Survey";
    case WorkflowTemplateType.GAME:
      return "Game";
    case WorkflowTemplateType.DEFAULT:
      return "Default";
    default:
      return type;
  }
};

export const getStageTypeLabel = (type: StageType): string => {
  switch (type) {
    case StageType.PEER_REVIEW:
      return "Peer Review";
    case StageType.EXPERT_REVIEW:
      return "Expert Review";
    case StageType.MANAGER_APPROVAL:
      return "Manager Approval";
    case StageType.FINAL_APPROVAL:
      return "Final Approval";
    case StageType.COMPLIANCE_CHECK:
      return "Compliance Check";
    case StageType.CUSTOM:
      return "Custom";
    default:
      return type;
  }
};

export const getStageTypeColor = (type: StageType): string => {
  switch (type) {
    case StageType.PEER_REVIEW:
      return "#2196F3"; // Blue
    case StageType.EXPERT_REVIEW:
      return "#9C27B0"; // Purple
    case StageType.MANAGER_APPROVAL:
      return "#FF9800"; // Orange
    case StageType.FINAL_APPROVAL:
      return "#4CAF50"; // Green
    case StageType.COMPLIANCE_CHECK:
      return "#F44336"; // Red
    case StageType.CUSTOM:
      return "#607D8B"; // Blue Grey
    default:
      return "#9E9E9E";
  }
};

export const isMultiStageWorkflow = (workflow: ApprovalWorkflow | MultiStageWorkflow): workflow is MultiStageWorkflow => {
  return 'template_id' in workflow && workflow.template_id !== undefined;
};

export const getStageProgress = (stage: WorkflowStageInstance): number => {
  if (stage.approvals_required === 0) return 0;
  return (stage.approvals_received / stage.approvals_required) * 100;
};

export const isStageComplete = (stage: WorkflowStageInstance): boolean => {
  return stage.current_state === WorkflowState.APPROVED_PENDING_PUBLISH;
};

export const getActiveReviewers = (stage: WorkflowStageInstance): StageReviewerAssignment[] => {
  return stage.reviewer_assignments.filter(assignment => 
    assignment.is_active && !assignment.has_reviewed
  );
};