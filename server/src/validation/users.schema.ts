/**
 * users.schema.ts
 * Zod schemas for admin user-management endpoints.
 */

import { z } from 'zod';

export const ASSIGNABLE_ROLES = ['admin', 'operator', 'viewer', 'agency_partner'] as const;
export const roleEnum = z.enum(ASSIGNABLE_ROLES);

export const createUserSchema = z.object({
  email:                 z.string().trim().toLowerCase().email().max(254),
  name:                  z.string().trim().max(120).optional(),
  role:                  roleEnum,
  temporaryPassword:     z.string().min(1).max(200).optional(),
  requirePasswordChange: z.boolean().optional().default(true),
}).strict();

export const updateUserSchema = z.object({
  name:     z.string().trim().max(120).optional(),
  role:     roleEnum.optional(),
  isActive: z.boolean().optional(),
}).strict().refine(
  (data) => data.name !== undefined || data.role !== undefined || data.isActive !== undefined,
  { message: 'Provide at least one field to update (name, role, or isActive).' },
);

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
