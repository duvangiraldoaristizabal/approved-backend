BEGIN;

CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  requester VARCHAR(80) NOT NULL,
  approver VARCHAR(80) NOT NULL,
  type VARCHAR(30) NOT NULL
    CHECK (type IN (
      'DEPLOYMENT',
      'ACCESS',
      'TECHNICAL_CHANGE',
      'TOOL_ONBOARDING',
      'OTHER'
    )),
  status VARCHAR(10) NOT NULL
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (requester <> approver),
  CHECK (requester = LOWER(requester)),
  CHECK (approver = LOWER(approver)),
  CHECK (requester ~ '^[a-z0-9._-]+@bancobogota\.com$'),
  CHECK (approver ~ '^[a-z0-9._-]+@bancobogota\.com$')
);

CREATE TABLE IF NOT EXISTS approval_history (
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL
    REFERENCES approval_requests(id)
    ON DELETE CASCADE,
  status VARCHAR(10) NOT NULL
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  changed_at TIMESTAMPTZ NOT NULL,
  changed_by VARCHAR(80) NOT NULL,
  comment VARCHAR(1000),
  CHECK (changed_by = LOWER(changed_by)),
  CHECK (changed_by ~ '^[a-z0-9._-]+@bancobogota\.com$')
);

CREATE INDEX IF NOT EXISTS idx_requests_approver_status
  ON approval_requests (approver, status);

CREATE INDEX IF NOT EXISTS idx_requests_requester
  ON approval_requests (requester);

CREATE INDEX IF NOT EXISTS idx_history_request_changed
  ON approval_history (request_id, changed_at);

COMMIT;
