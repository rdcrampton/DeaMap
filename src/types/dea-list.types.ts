/**
 * Types for DEA list components and API
 * Domain-specific types following DDD
 */

import { FilterConfig, PaginationConfig, PermissionContext } from './data-list.types';

export interface DeaListItem {
  id: string;
  name: string;
  code: string | null;
  address: string;
  city: string | null;
  district: string | null;
  postal_code: string | null;
  status: string;  // AED status (DRAFT, PUBLISHED, etc.)
  last_verified_at: Date | null;
  establishment_type: string | null;
  assignment_type: string;  // Assignment type (CIVIL_PROTECTION, etc.)
  assignment_status: string;  // Assignment status (ACTIVE, REVOKED, etc.)
  assigned_at: Date;
}

export interface DeasListConfig {
  filters?: FilterConfig[];
  pagination?: PaginationConfig;
  permissions: PermissionContext;
  organizationId?: string;  // Optional filter by organization
  emptyMessage?: string;
  onDeaClick?: (deaId: string) => void;
}

export interface DeasApiFilters {
  organization_id?: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'inactive';  // Assignment status filter
  aed_status?: string;  // AED status filter (DRAFT, PUBLISHED, etc.)
  assignment_type?: string;  // Assignment type filter
  sort_by?: 'name' | 'created_at' | 'assigned_at';
  sort_order?: 'asc' | 'desc';
}
