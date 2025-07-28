/**
 * API client for version-aware approval workflow operations
 */

import { apiClient } from './client';
import type {
  ContentVersion,
  ApprovalWorkflow,
  WorkflowReview,
  PendingReview,
  CreateVersionRequest,
  CreateWorkflowRequest,
  SubmitForReviewRequest,
  AssignReviewerRequest,
  ApproveContentRequest,
  RequestRevisionRequest,
  RejectContentRequest,
  WithdrawSubmissionRequest,
  PublishVersionRequest
} from '../types/workflow';

class WorkflowApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'WorkflowApiError';
  }
}

export class WorkflowApi {
  private async request<T>(
    endpoint: string,
    options: { method?: string; data?: any } = {}
  ): Promise<T> {
    try {
      const response = await apiClient.request({
        url: endpoint,
        method: options.method || 'GET',
        data: options.data,
      });
      
      return response.data;
    } catch (error: any) {
      const status = error.response?.status;
      const message = error.response?.data?.detail || error.message || 'Unknown error';
      
      if (status === 401) {
        throw new WorkflowApiError('Not authenticated', status);
      }
      
      console.error('Workflow API Error Details:', error.response?.data);
      if (error.response?.data?.detail && Array.isArray(error.response.data.detail)) {
        const validationErrors = error.response.data.detail.map((err: any) => 
          `${err.loc?.join('.') || 'field'}: ${err.msg}`
        ).join(', ');
        throw new WorkflowApiError(`Validation errors: ${validationErrors}`, status);
      }
      throw new WorkflowApiError(message, status);
    }
  }

  // Content Version operations
  async createVersion(request: CreateVersionRequest): Promise<ContentVersion> {
    return this.request<ContentVersion>('/api/workflow/versions', {
      method: 'POST',
      data: request,
    });
  }

  // Workflow operations
  async createWorkflow(request: CreateWorkflowRequest): Promise<ApprovalWorkflow> {
    return this.request<ApprovalWorkflow>('/api/workflow/workflows', {
      method: 'POST',
      data: request,
    });
  }

  async submitForReview(request: SubmitForReviewRequest): Promise<ApprovalWorkflow> {
    return this.request<ApprovalWorkflow>('/api/workflow/submit-for-review', {
      method: 'POST',
      data: request,
    });
  }

  async assignReviewer(
    workflowId: string,
    request: AssignReviewerRequest
  ): Promise<ApprovalWorkflow> {
    return this.request<ApprovalWorkflow>(
      `/api/workflow/workflows/${workflowId}/assign-reviewer`,
      {
        method: 'POST',
        data: request,
      }
    );
  }

  // Review operations
  async approveContent(
    workflowId: string,
    request: ApproveContentRequest = {}
  ): Promise<ApprovalWorkflow> {
    return this.request<ApprovalWorkflow>(
      `/api/workflow/workflows/${workflowId}/approve`,
      {
        method: 'POST',
        data: request,
      }
    );
  }

  async requestRevision(
    workflowId: string,
    request: RequestRevisionRequest
  ): Promise<ApprovalWorkflow> {
    return this.request<ApprovalWorkflow>(
      `/api/workflow/workflows/${workflowId}/request-revision`,
      {
        method: 'POST',
        data: request,
      }
    );
  }

  async rejectContent(
    workflowId: string,
    request: RejectContentRequest
  ): Promise<ApprovalWorkflow> {
    return this.request<ApprovalWorkflow>(
      `/api/workflow/workflows/${workflowId}/reject`,
      {
        method: 'POST',
        data: request,
      }
    );
  }

  async withdrawSubmission(
    workflowId: string,
    request: WithdrawSubmissionRequest = {}
  ): Promise<ApprovalWorkflow> {
    return this.request<ApprovalWorkflow>(
      `/api/workflow/workflows/${workflowId}/withdraw`,
      {
        method: 'POST',
        data: request,
      }
    );
  }

  // Publishing operations
  async publishVersion(request: PublishVersionRequest): Promise<ContentVersion> {
    return this.request<ContentVersion>('/api/workflow/publish', {
      method: 'POST',
      data: request,
    });
  }

  // Query operations
  async getPendingReviews(reviewerId?: string): Promise<PendingReview[]> {
    const params = new URLSearchParams();
    if (reviewerId) {
      params.append('reviewer_id', reviewerId);
    }
    
    const query = params.toString();
    const endpoint = `/api/workflow/pending-reviews${query ? `?${query}` : ''}`;
    
    return this.request<PendingReview[]>(endpoint);
  }

  async getWorkflowHistory(workflowId: string): Promise<WorkflowReview[]> {
    return this.request<WorkflowReview[]>(
      `/api/workflow/workflows/${workflowId}/history`
    );
  }

  async bulkChangeStatus(
    contentIds: string[],
    newStatus: string
  ): Promise<{
    updated_count: number;
    updated_ids: string[];
    skipped_count: number;
    new_status: string;
  }> {
    return this.request('/api/workflow/bulk-status-change', {
      method: 'POST',
      data: {
        content_ids: contentIds,
        new_status: newStatus,
      },
    });
  }

  // Combined operations for common workflows
  async createVersionWithWorkflow(
    versionRequest: CreateVersionRequest,
    workflowRequest?: Partial<CreateWorkflowRequest>
  ): Promise<{ version: ContentVersion; workflow: ApprovalWorkflow }> {
    // Create the version first
    const version = await this.createVersion(versionRequest);

    // Create workflow with defaults
    const workflow = await this.createWorkflow({
      version_id: version.id,
      requires_approval: true,
      auto_publish: false,
      ...workflowRequest,
    });

    return { version, workflow };
  }

  async quickApproveAndPublish(
    workflowId: string,
    comments?: string
  ): Promise<{ workflow: ApprovalWorkflow; version?: ContentVersion }> {
    // Approve with auto-publish
    const workflow = await this.approveContent(workflowId, {
      comments,
      auto_publish: true,
    });

    return { workflow };
  }
}

// Create and export a default instance
export const workflowApi = new WorkflowApi();

// Export the class for custom instances
export { WorkflowApiError };