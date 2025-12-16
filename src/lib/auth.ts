import { UserRole } from "@/generated/client/enums";
import { NextRequest } from "next/server";

import type { JWTPayload } from "@/types";

import { getCurrentUser } from "./jwt";

/**
 * Get the current user from the request without requiring authentication
 * Returns null if not authenticated, making it suitable for optional auth checks
 */
export async function getUserFromRequest(_request: NextRequest): Promise<JWTPayload | null> {
  return getCurrentUser();
}

/**
 * Middleware to check if user is authenticated
 */
export async function requireAuth(_request: NextRequest): Promise<JWTPayload | null> {
  const user = await getCurrentUser();
  return user;
}

/**
 * Middleware to check if user has specific role
 */
export async function requireRole(
  _request: NextRequest,
  allowedRoles: UserRole[]
): Promise<JWTPayload | null> {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  if (!allowedRoles.includes(user.role)) {
    return null;
  }

  return user;
}

/**
 * Middleware to check if user is admin
 */
export async function requireAdmin(_request: NextRequest): Promise<JWTPayload | null> {
  return requireRole(_request, [UserRole.ADMIN]);
}
