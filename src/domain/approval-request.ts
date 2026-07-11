export const REQUEST_TYPES = ["DEPLOYMENT", "ACCESS", "TECHNICAL_CHANGE", "TOOL_ONBOARDING", "OTHER"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface HistoryEntry {
  id: string;
  status: RequestStatus;
  changedAt: string;
  changedBy: string;
  comment: string | null;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  description: string;
  requester: string;
  approver: string;
  type: RequestType;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  history: HistoryEntry[];
}

export interface CreateApprovalRequest {
  title: string;
  description: string;
  requester: string;
  approver: string;
  type: RequestType;
}

export interface RequestFilters {
  approver?: string;
  requester?: string;
  status?: RequestStatus;
  type?: RequestType;
}
