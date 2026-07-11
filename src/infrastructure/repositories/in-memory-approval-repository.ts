import type { ApprovalRequest, RequestFilters } from "../../domain/approval-request.js";
import type { ApprovalRequestRepository } from "../../application/ports/approval-request-repository.js";

export class InMemoryApprovalRepository implements ApprovalRequestRepository {
  protected requests = new Map<string, ApprovalRequest>();

  async create(request: ApprovalRequest): Promise<ApprovalRequest> {
    this.requests.set(request.id, structuredClone(request));
    return structuredClone(request);
  }

  async findAll(filters: RequestFilters): Promise<ApprovalRequest[]> {
    return [...this.requests.values()]
      .filter((request) => !filters.approver || request.approver === filters.approver)
      .filter((request) => !filters.requester || request.requester === filters.requester)
      .filter((request) => !filters.status || request.status === filters.status)
      .filter((request) => !filters.type || request.type === filters.type)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((request) => structuredClone(request));
  }

  async findById(id: string): Promise<ApprovalRequest | null> {
    const request = this.requests.get(id);
    return request ? structuredClone(request) : null;
  }

  async update(request: ApprovalRequest): Promise<ApprovalRequest> {
    this.requests.set(request.id, structuredClone(request));
    return structuredClone(request);
  }
}
