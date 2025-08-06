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
  PublishVersionRequest,
  // Multi-stage workflow types
  WorkflowTemplate,
  WorkflowTemplateType,
  WorkflowStageInstance,
  StageReviewerAssignment,
  MultiStageWorkflow,
  CreateWorkflowTemplateRequest,
  CreateMultiStageWorkflowRequest,
  AssignStageReviewersRequest,
  DelegateReviewerRequest,
  SubmitStageReviewRequest
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

  // ===== MULTI-STAGE WORKFLOW METHODS =====

  // Workflow Template operations
  async createWorkflowTemplate(request: CreateWorkflowTemplateRequest): Promise<WorkflowTemplate> {
    return this.request<WorkflowTemplate>('/api/workflow/templates', {
      method: 'POST',
      data: request,
    });
  }

  async getWorkflowTemplates(
    filters?: { content_type?: WorkflowTemplateType; is_active?: boolean }
  ): Promise<WorkflowTemplate[]> {
    const params = new URLSearchParams();
    if (filters?.content_type) {
      params.append('content_type', filters.content_type);
    }
    if (filters?.is_active !== undefined) {
      params.append('is_active', filters.is_active.toString());
    } else {
      params.append('is_active', 'true'); // Default to active templates
    }
    
    const query = params.toString();
    const endpoint = `/api/workflow/templates${query ? `?${query}` : ''}`;
    
    return this.request<WorkflowTemplate[]>(endpoint);
  }

  async getDefaultTemplate(contentType: WorkflowTemplateType): Promise<WorkflowTemplate | null> {
    return this.request<WorkflowTemplate | null>(
      `/api/workflow/templates/default/${contentType}`
    );
  }

  // Multi-stage workflow operations
  async createMultiStageWorkflow(request: CreateMultiStageWorkflowRequest): Promise<MultiStageWorkflow> {
    return this.request<MultiStageWorkflow>('/api/workflow/multi-stage', {
      method: 'POST',
      data: request,
    });
  }

  async assignStageReviewers(
    stageInstanceId: string,
    request: AssignStageReviewersRequest
  ): Promise<StageReviewerAssignment[]> {
    return this.request<StageReviewerAssignment[]>(
      `/api/workflow/stages/${stageInstanceId}/reviewers`,
      {
        method: 'POST',
        data: request,
      }
    );
  }

  async delegateReviewerAssignment(request: DelegateReviewerRequest): Promise<StageReviewerAssignment> {
    return this.request<StageReviewerAssignment>('/api/workflow/assignments/delegate', {
      method: 'POST',
      data: request,
    });
  }

  async submitStageReview(
    stageInstanceId: string,
    request: SubmitStageReviewRequest
  ): Promise<WorkflowReview> {
    return this.request<WorkflowReview>(
      `/api/workflow/stages/${stageInstanceId}/review`,
      {
        method: 'POST',
        data: request,
      }
    );
  }

  async getMyStageReviews(states?: string[]): Promise<WorkflowStageInstance[]> {
    const params = new URLSearchParams();
    if (states && states.length > 0) {
      states.forEach(state => params.append('states', state));
    }
    
    const query = params.toString();
    const endpoint = `/api/workflow/stages/my-reviews${query ? `?${query}` : ''}`;
    
    return this.request<WorkflowStageInstance[]>(endpoint);
  }

  // Combined operations for multi-stage workflows
  async createVersionWithMultiStageWorkflow(
    versionRequest: CreateVersionRequest,
    templateId: string
  ): Promise<{ version: ContentVersion; workflow: MultiStageWorkflow }> {
    // Create the version first
    const version = await this.createVersion(versionRequest);

    // Create multi-stage workflow
    const workflow = await this.createMultiStageWorkflow({
      version_id: version.id,
      template_id: templateId,
    });

    return { version, workflow };
  }

  async submitForMultiStageReview(request: {
    version_id: string;
    template_id: string;
    initial_comments?: string;
  }): Promise<MultiStageWorkflow> {
    // Create multi-stage workflow
    return this.request<MultiStageWorkflow>('/api/workflow/multi-stage/submit', {
      method: 'POST',
      data: request,
    });
  }

  // ===== VERSION MANAGEMENT METHODS =====

  // Get all versions for a content item
  async getContentVersions(contentId: string): Promise<ContentVersion[]> {
    return this.request<ContentVersion[]>(`/api/workflow/content/${contentId}/versions`);
  }

  // Get a specific version
  async getVersion(versionId: string): Promise<ContentVersion> {
    return this.request<ContentVersion>(`/api/workflow/versions/${versionId}`);
  }

  // Create a new version based on an existing version (restore/rollback)
  async restoreVersion(
    contentId: string, 
    sourceVersionId: string, 
    changeSummary?: string
  ): Promise<ContentVersion> {
    return this.request<ContentVersion>(`/api/workflow/content/${contentId}/restore`, {
      method: 'POST',
      data: {
        source_version_id: sourceVersionId,
        change_summary: changeSummary || `Restored from version ${sourceVersionId}`
      }
    });
  }

  // Update version metadata (title, description, change summary)
  async updateVersionMetadata(
    versionId: string, 
    updates: {
      title?: string;
      description?: string;
      change_summary?: string;
    }
  ): Promise<ContentVersion> {
    return this.request<ContentVersion>(`/api/workflow/versions/${versionId}/metadata`, {
      method: 'PATCH',
      data: updates
    });
  }

  // Archive a version (mark as archived)
  async archiveVersion(versionId: string): Promise<ContentVersion> {
    return this.request<ContentVersion>(`/api/workflow/versions/${versionId}/archive`, {
      method: 'POST'
    });
  }

  // Get version comparison data
  async compareVersions(version1Id: string, version2Id: string): Promise<{
    version1: ContentVersion;
    version2: ContentVersion;
    differences: {
      field: string;
      version1_value: any;
      version2_value: any;
    }[];
  }> {
    return this.request(`/api/workflow/versions/compare`, {
      method: 'POST',
      data: {
        version1_id: version1Id,
        version2_id: version2Id
      }
    });
  }
}

// Create and export a default instance
export const workflowApi = new WorkflowApi();

// Export the class for custom instances
export { WorkflowApiError };