import { z } from "zod";
import { REQUEST_STATUSES, REQUEST_TYPES } from "../../domain/approval-request.js";

const networkUser = z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._@-]+$/, "Usuario de red invalido");

export const createRequestSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  requester: networkUser,
  approver: networkUser,
  type: z.enum(REQUEST_TYPES),
}).refine((value) => value.requester !== value.approver, {
  message: "El solicitante y el responsable deben ser diferentes",
  path: ["approver"],
});

export const decisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  user: networkUser,
  comment: z.string().trim().min(3).max(1000),
});

export const filtersSchema = z.object({
  approver: networkUser.optional(),
  requester: networkUser.optional(),
  status: z.enum(REQUEST_STATUSES).optional(),
  type: z.enum(REQUEST_TYPES).optional(),
});
