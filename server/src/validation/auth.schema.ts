/**
 * auth.schema.ts
 * Zod schema for the authentication endpoints.
 */

import { z } from 'zod';

const emailField = z.string().trim().toLowerCase().email().max(254);
// Upper bound only — full strength rules are enforced by passwordPolicy.service.
const newPasswordField = z.string().min(1).max(200);

export const loginSchema = z.object({
  email:    emailField,
  password: z.string().min(1).max(200),
}).strict();

export const forgotPasswordSchema = z.object({
  email: emailField,
}).strict();

export const resetPasswordSchema = z.object({
  token:       z.string().min(10).max(500),
  newPassword: newPasswordField,
}).strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword:     newPasswordField,
}).strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
