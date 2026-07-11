import type { ApprovalRequest, RequestFilters } from "../../domain/approval-request.js";

export interface ApprovalRequestRepository {
  create(request: ApprovalRequest): Promise<ApprovalRequest>;
  findAll(filters: RequestFilters): Promise<ApprovalRequest[]>;
  findById(id: string): Promise<ApprovalRequest | null>;
  update(request: ApprovalRequest): Promise<ApprovalRequest>;
}
