/**
 * API Route: /api/aeds/nearby
 *
 * Find nearest AEDs to a specific location
 * Optimized for emergency situations
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { filterAedByPublicationMode } from "@/lib/publication-filter";
import type { AedFullData } from "@/lib/publication-filter";

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * GET /api/aeds/nearby
 * Find nearest AEDs to a location
 *
 * Query params:
 * - lat: latitude (required)
 * - lng: longitude (required)
 * - limit: max number of results (optional, default: 10, max: 50)
 * - radius: search radius in km (optional, default: 5, max: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate parameters
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);
    const radius = Math.min(parseFloat(searchParams.get("radius") || "5"), 50);

    // Validate coordinates
    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid parameters",
          message: "Both lat and lng are required and must be valid numbers",
        },
        { status: 400 }
      );
    }

    // Validate lat/lng ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid coordinates",
          message: "Latitude must be between -90 and 90, longitude between -180 and 180",
        },
        { status: 400 }
      );
    }

    // Calculate bounding box for initial filtering (rough square around point)
    // 1 degree of latitude ≈ 111 km
    const latDelta = radius / 111;
    // 1 degree of longitude varies by latitude, but this is a rough approximation
    const lngDelta = radius / (111 * Math.cos((lat * Math.PI) / 180));

    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLng = lng - lngDelta;
    const maxLng = lng + lngDelta;

    // Fetch AEDs within bounding box
    const aeds = await prisma.aed.findMany({
      where: {
        status: "PUBLISHED",
        publication_mode: {
          not: "NONE",
        },
        latitude: {
          gte: minLat,
          lte: maxLat,
        },
        longitude: {
          gte: minLng,
          lte: maxLng,
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
        establishment_type: true,
        latitude: true,
        longitude: true,
        published_at: true,
        publication_mode: true,
        location: {
          select: {
            street_type: true,
            street_name: true,
            street_number: true,
            postal_code: true,
            access_instructions: true,
            district_name: true,
            neighborhood_name: true,
            city_name: true,
            location_details: true,
          },
        },
        schedule: {
          select: {
            has_24h_surveillance: true,
            has_restricted_access: true,
            weekday_opening: true,
            weekday_closing: true,
            saturday_opening: true,
            saturday_closing: true,
            sunday_opening: true,
            sunday_closing: true,
          },
        },
        responsible: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        images: {
          select: {
            id: true,
            type: true,
            original_url: true,
            processed_url: true,
            thumbnail_url: true,
            order: true,
          },
          where: {
            is_verified: true,
          },
          orderBy: {
            order: "asc",
          },
          take: 5,
        },
      },
    });

    // Calculate distances and filter by radius
    const aedsWithDistance = aeds
      .map((aed) => {
        if (aed.latitude === null || aed.longitude === null) {
          return null;
        }

        const distance = calculateDistance(lat, lng, aed.latitude, aed.longitude);

        // Filter by radius
        if (distance > radius) {
          return null;
        }

        return {
          ...aed,
          distance,
        };
      })
      .filter((aed) => aed !== null);

    // Sort by distance and limit results
    const sortedAeds = aedsWithDistance
      .sort((a, b) => a!.distance - b!.distance)
      .slice(0, limit);

    // Filter each AED based on its publication_mode
    const filteredAeds = sortedAeds
      .map((aed) => filterAedByPublicationMode(aed as unknown as AedFullData))
      .filter((aed) => aed !== null)
      .map((aed, index) => ({
        ...aed,
        distance: sortedAeds[index]?.distance || 0,
      }));

    return NextResponse.json({
      success: true,
      data: filteredAeds,
      query: {
        lat,
        lng,
        radius,
        limit,
      },
      stats: {
        found: filteredAeds.length,
        searchRadius: radius,
      },
    });
  } catch (error) {
    console.error("Error fetching nearby AEDs:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch nearby AEDs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
