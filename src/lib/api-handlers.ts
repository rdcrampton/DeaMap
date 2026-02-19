/**
 * API Route Handler Wrappers
 *
 * Higher-order functions that wrap API route handlers with common patterns:
 * - Authentication checks
 * - Admin authorization
 * - Standardized error responses
 *
 * Usage:
 *   export const GET = withAuth(async (request, user) => {
 *     // user is guaranteed to be authenticated
 *     return NextResponse.json({ data: ... });
 *   });
 *
 *   export const POST = withAdmin(async (request, admin) => {
 *     // admin is guaranteed to be an ADMIN user
 *     return NextResponse.json({ data: ... });
 *   });
 */

import { NextRequest, NextResponse } from "next/server";

import type { JWTPayload } from "@/types";

import { requireAuth, requireAdmin } from "./auth";

type AuthenticatedHandler = (
  request: NextRequest,
  user: JWTPayload,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

type AdminHandler = (
  request: NextRequest,
  admin: JWTPayload,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

/**
 * Wraps a route handler with authentication check.
 * Returns 401 if not authenticated, otherwise calls handler with verified user.
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    try {
      return await handler(request, user, context);
    } catch (error) {
      console.error(`[${request.method} ${request.nextUrl.pathname}]`, error);
      const isDev = process.env.NODE_ENV === "development";
      return NextResponse.json(
        {
          success: false,
          error: "Internal server error",
          ...(isDev && { details: error instanceof Error ? error.message : String(error) }),
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Wraps a route handler with admin authorization check.
 * Returns 403 if not admin, otherwise calls handler with verified admin user.
 */
export function withAdmin(handler: AdminHandler) {
  return async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    try {
      return await handler(request, admin, context);
    } catch (error) {
      console.error(`[${request.method} ${request.nextUrl.pathname}]`, error);
      const isDev = process.env.NODE_ENV === "development";
      return NextResponse.json(
        {
          success: false,
          error: "Internal server error",
          ...(isDev && { details: error instanceof Error ? error.message : String(error) }),
        },
        { status: 500 }
      );
    }
  };
}
