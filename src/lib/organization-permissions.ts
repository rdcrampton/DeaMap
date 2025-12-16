/**
 * Organization Permissions Helper
 *
 * Permission checking utilities for the organization system
 */

import { prisma } from "@/lib/db";

/**
 * Check if user can view an AED
 * - Owner can always view
 * - Members of assigned organizations can view
 * - Admins can view
 * - Public DEAs can be viewed by anyone
 */
export async function canUserViewAed(userId: string, aedId: string): Promise<boolean> {
  // Get AED with owner and assignments
  const aed = await prisma.aed.findUnique({
    where: { id: aedId },
    select: {
      owner_user_id: true,
      publication_mode: true,
      assignments: {
        where: { status: "ACTIVE" },
        select: { organization_id: true },
      },
    },
  });

  if (!aed) return false;

  // 1. Is owner?
  if (aed.owner_user_id === userId) return true;

  // 2. Is member of assigned organization?
  if (aed.assignments.length > 0) {
    const userOrgs = await prisma.organizationMember.findMany({
      where: {
        user_id: userId,
        organization_id: { in: aed.assignments.map((a) => a.organization_id) },
      },
    });

    if (userOrgs.length > 0) return true;
  }

  // 3. Is public (published)?
  if (aed.publication_mode !== "NONE") return true;

  return false;
}

/**
 * Check if user can edit an AED
 * - Owner can always edit
 * - Members with can_edit permission from assigned organizations
 * - Admins can edit
 */
export async function canUserEditAed(userId: string, aedId: string): Promise<boolean> {
  const aed = await prisma.aed.findUnique({
    where: { id: aedId },
    select: {
      owner_user_id: true,
      assignments: {
        where: { status: "ACTIVE" },
        select: { organization_id: true },
      },
    },
  });

  if (!aed) return false;

  // 1. Is owner?
  if (aed.owner_user_id === userId) return true;

  // 2. Is member with can_edit permission?
  if (aed.assignments.length > 0) {
    const userOrgs = await prisma.organizationMember.findMany({
      where: {
        user_id: userId,
        organization_id: { in: aed.assignments.map((a) => a.organization_id) },
        can_edit: true,
      },
    });

    if (userOrgs.length > 0) return true;
  }

  return false;
}

/**
 * Check if user can verify an AED
 * - Members with can_verify permission from assigned organizations
 */
export async function canUserVerifyAed(userId: string, aedId: string): Promise<boolean> {
  const assignments = await prisma.aedOrganizationAssignment.findMany({
    where: {
      aed_id: aedId,
      status: "ACTIVE",
    },
    select: { organization_id: true },
  });

  if (assignments.length === 0) return false;

  const userOrgs = await prisma.organizationMember.findMany({
    where: {
      user_id: userId,
      organization_id: { in: assignments.map((a) => a.organization_id) },
      can_verify: true,
    },
  });

  return userOrgs.length > 0;
}

/**
 * Check if user can approve publication for an AED
 * - Members with can_approve permission from assigned organizations
 */
export async function canUserApprovePublication(userId: string, aedId: string): Promise<boolean> {
  const assignments = await prisma.aedOrganizationAssignment.findMany({
    where: {
      aed_id: aedId,
      status: "ACTIVE",
    },
    select: { organization_id: true },
  });

  if (assignments.length === 0) return false;

  const userOrgs = await prisma.organizationMember.findMany({
    where: {
      user_id: userId,
      organization_id: { in: assignments.map((a) => a.organization_id) },
      can_approve: true,
    },
  });

  return userOrgs.length > 0;
}

/**
 * Check if user can manage an organization
 * - Owner or Admin role in the organization
 */
export async function canUserManageOrganization(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const member = await prisma.organizationMember.findUnique({
    where: {
      organization_id_user_id: {
        organization_id: organizationId,
        user_id: userId,
      },
    },
    select: { role: true },
  });

  return member?.role === "OWNER" || member?.role === "ADMIN";
}

/**
 * Get user's permissions for a specific AED
 */
export async function getUserPermissionsForAed(userId: string, aedId: string) {
  const [canView, canEdit, canVerify, canApprove] = await Promise.all([
    canUserViewAed(userId, aedId),
    canUserEditAed(userId, aedId),
    canUserVerifyAed(userId, aedId),
    canUserApprovePublication(userId, aedId),
  ]);

  return {
    can_view: canView,
    can_edit: canEdit,
    can_verify: canVerify,
    can_approve: canApprove,
  };
}

/**
 * Get all organizations where user is a member
 */
export async function getUserOrganizations(userId: string) {
  return await prisma.organizationMember.findMany({
    where: { user_id: userId },
    include: {
      organization: true,
    },
  });
}

/**
 * Get AEDs assigned to user's organizations
 */
export async function getAedsForUserOrganizations(
  userId: string,
  filters?: {
    status?: string[];
    organization_id?: string;
  }
) {
  // Get user's organizations
  const userOrgs = await prisma.organizationMember.findMany({
    where: { user_id: userId },
    select: { organization_id: true },
  });

  if (userOrgs.length === 0) return [];

  const orgIds = filters?.organization_id
    ? [filters.organization_id]
    : userOrgs.map((o) => o.organization_id);

  // Get AEDs assigned to these organizations
  const assignments = await prisma.aedOrganizationAssignment.findMany({
    where: {
      organization_id: { in: orgIds },
      status: filters?.status ? { in: filters.status as any } : undefined,
    },
    include: {
      aed: {
        include: {
          location: true,
        },
      },
      organization: true,
    },
  });

  return assignments;
}

/**
 * Check if an assignment would conflict with existing assignments
 * Only ONE active CIVIL_PROTECTION assignment per AED
 */
export async function checkAssignmentConflict(
  aedId: string,
  assignmentType: string,
  organizationId: string
): Promise<{
  hasConflict: boolean;
  conflictMessage?: string;
}> {
  // Check for existing active assignment of the same type
  if (assignmentType === "CIVIL_PROTECTION") {
    const existing = await prisma.aedOrganizationAssignment.findFirst({
      where: {
        aed_id: aedId,
        assignment_type: "CIVIL_PROTECTION",
        status: "ACTIVE",
      },
      include: {
        organization: true,
      },
    });

    if (existing && existing.organization_id !== organizationId) {
      return {
        hasConflict: true,
        conflictMessage: `Este DEA ya está asignado a ${existing.organization.name} como Protección Civil. Debe revocarse esa asignación primero.`,
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Get effective publication mode for an AED based on all active assignments
 * Most permissive mode wins (FULL > BASIC_INFO > LOCATION_ONLY > NONE)
 */
export async function getEffectivePublicationMode(aedId: string) {
  const assignments = await prisma.aedOrganizationAssignment.findMany({
    where: {
      aed_id: aedId,
      status: "ACTIVE",
    },
    select: {
      publication_mode: true,
      approved_for_full: true,
      approved_by_authority: true,
    },
  });

  if (assignments.length === 0) {
    // No assignments, use AED's own publication_mode
    const aed = await prisma.aed.findUnique({
      where: { id: aedId },
      select: { publication_mode: true },
    });
    return aed?.publication_mode || "NONE";
  }

  // Check for FULL (highest priority)
  const hasFull = assignments.some(
    (a) => a.publication_mode === "FULL" && a.approved_for_full && a.approved_by_authority
  );
  if (hasFull) return "FULL";

  // Check for BASIC_INFO
  const hasBasic = assignments.some(
    (a) => a.publication_mode === "BASIC_INFO" && a.approved_for_full
  );
  if (hasBasic) return "BASIC_INFO";

  // Check for LOCATION_ONLY
  const hasLocation = assignments.some((a) => a.publication_mode === "LOCATION_ONLY");
  if (hasLocation) return "LOCATION_ONLY";

  return "NONE";
}
