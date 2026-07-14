import { z } from "zod";
import { REQUEST_STATUSES, REQUEST_TYPES } from "../../domain/approval-request.js";

const corporateEmail = z.string().trim().toLowerCase().email("Correo corporativo invalido")
  .regex(/^[a-zA-Z0-9._-]+@bancobogota\.com$/, "El correo debe pertenecer al dominio bancobogota.com");

export const createRequestSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  requester: corporateEmail,
  approver: corporateEmail,
  type: z.enum(REQUEST_TYPES),
}).refine((value) => value.requester !== value.approver, {
  message: "El solicitante y el responsable deben ser diferentes",
  path: ["approver"],
});

export const decisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  user: corporateEmail,
  comment: z.string().trim().min(3).max(1000),
});

export const filtersSchema = z.object({
  approver: corporateEmail.optional(),
  requester: corporateEmail.optional(),
  status: z.enum(REQUEST_STATUSES).optional(),
  type: z.enum(REQUEST_TYPES).optional(),
});
