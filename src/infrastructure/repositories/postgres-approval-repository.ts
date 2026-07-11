import { Pool, type PoolClient, type QueryResultRow } from "pg";
import type { ApprovalRequestRepository } from "../../application/ports/approval-request-repository.js";
import type { ApprovalRequest, HistoryEntry, RequestFilters, RequestStatus, RequestType } from "../../domain/approval-request.js";
import { POSTGRES_SCHEMA } from "./postgres-schema.js";

interface RequestRow extends QueryResultRow {
  id: string; title: string; description: string; requester: string; approver: string;
  type: RequestType; status: RequestStatus; created_at: Date; updated_at: Date;
}
interface HistoryRow extends QueryResultRow {
  id: string; request_id: string; status: RequestStatus; changed_at: Date; changed_by: string; comment: string | null;
}

export class PostgresApprovalRepository implements ApprovalRequestRepository {
  constructor(private readonly pool: Pool) {}

  static async open(connectionString: string): Promise<PostgresApprovalRepository> {
    const pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
    await pool.query(POSTGRES_SCHEMA);
    return new PostgresApprovalRepository(pool);
  }

  async create(request: ApprovalRequest): Promise<ApprovalRequest> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO approval_requests (id, title, description, requester, approver, type, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [request.id, request.title, request.description, request.requester, request.approver, request.type, request.status, request.createdAt, request.updatedAt],
      );
      await this.insertHistory(client, request.id, request.history[0]!);
      await client.query("COMMIT");
      return structuredClone(request);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findAll(filters: RequestFilters): Promise<ApprovalRequest[]> {
    const conditions: string[] = [];
    const values: string[] = [];
    for (const [column, value] of Object.entries(filters)) {
      if (value) { values.push(value); conditions.push(`${column} = $${values.length}`); }
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await this.pool.query<RequestRow>(`SELECT * FROM approval_requests ${where} ORDER BY created_at DESC`, values);
    return Promise.all(rows.rows.map((row) => this.hydrate(row)));
  }

  async findById(id: string): Promise<ApprovalRequest | null> {
    const result = await this.pool.query<RequestRow>("SELECT * FROM approval_requests WHERE id = $1", [id]);
    return result.rows[0] ? this.hydrate(result.rows[0]) : null;
  }

  async update(request: ApprovalRequest): Promise<ApprovalRequest> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE approval_requests SET status = $2, updated_at = $3
         WHERE id = $1 AND status = 'PENDING'`,
        [request.id, request.status, request.updatedAt],
      );
      if (result.rowCount !== 1) throw new Error("La solicitud fue modificada concurrentemente");
      await this.insertHistory(client, request.id, request.history.at(-1)!);
      await client.query("COMMIT");
      return structuredClone(request);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async hydrate(row: RequestRow): Promise<ApprovalRequest> {
    const history = await this.pool.query<HistoryRow>("SELECT * FROM approval_history WHERE request_id = $1 ORDER BY changed_at", [row.id]);
    return {
      id: row.id, title: row.title, description: row.description, requester: row.requester, approver: row.approver,
      type: row.type, status: row.status, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
      history: history.rows.map((entry): HistoryEntry => ({ id: entry.id, status: entry.status, changedAt: entry.changed_at.toISOString(), changedBy: entry.changed_by, comment: entry.comment })),
    };
  }

  private async insertHistory(client: PoolClient, requestId: string, entry: HistoryEntry): Promise<void> {
    await client.query(
      `INSERT INTO approval_history (id, request_id, status, changed_at, changed_by, comment) VALUES ($1, $2, $3, $4, $5, $6)`,
      [entry.id, requestId, entry.status, entry.changedAt, entry.changedBy, entry.comment],
    );
  }
}
