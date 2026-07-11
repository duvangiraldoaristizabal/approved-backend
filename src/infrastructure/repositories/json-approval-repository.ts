import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ApprovalRequest, RequestFilters } from "../../domain/approval-request.js";
import { InMemoryApprovalRepository } from "./in-memory-approval-repository.js";

export class JsonApprovalRepository extends InMemoryApprovalRepository {
  private writeQueue = Promise.resolve();

  private constructor(private readonly filePath: string) {
    super();
  }

  static async open(filePath: string): Promise<JsonApprovalRepository> {
    const repository = new JsonApprovalRepository(filePath);
    try {
      const stored = JSON.parse(await readFile(filePath, "utf8")) as ApprovalRequest[];
      stored.forEach((request) => repository.requests.set(request.id, request));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return repository;
  }

  override async create(request: ApprovalRequest): Promise<ApprovalRequest> {
    const created = await super.create(request);
    await this.persist();
    return created;
  }

  override async update(request: ApprovalRequest): Promise<ApprovalRequest> {
    const updated = await super.update(request);
    await this.persist();
    return updated;
  }

  override findAll(filters: RequestFilters): Promise<ApprovalRequest[]> {
    return super.findAll(filters);
  }

  private async persist(): Promise<void> {
    const data = JSON.stringify([...this.requests.values()], null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.tmp`;
      await writeFile(temporary, data, "utf8");
      await rename(temporary, this.filePath);
    });
    await this.writeQueue;
  }
}
