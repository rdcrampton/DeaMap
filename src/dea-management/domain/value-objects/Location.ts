/**
 * Value Object: Location
 * Representa una ubicación geográfica con coordenadas
 * Incluye validación y cálculo de distancias
 */
export class Location {
  private constructor(
    private readonly latitude: number,
    private readonly longitude: number
  ) {
    this.validateCoordinates();
  }

  private validateCoordinates(): void {
    if (this.latitude < -90 || this.latitude > 90) {
      throw new Error(`Latitud debe estar entre -90 y 90. Recibido: ${this.latitude}`);
    }
    if (this.longitude < -180 || this.longitude > 180) {
      throw new Error(`Longitud debe estar entre -180 y 180. Recibido: ${this.longitude}`);
    }
  }

  /**
   * Crea una Location desde coordenadas
   * @param lat - Latitud (-90 a 90)
   * @param lon - Longitud (-180 a 180)
   */
  static fromCoordinates(lat: number, lon: number): Location {
    return new Location(lat, lon);
  }

  /**
   * Retorna la latitud
   */
  getLatitude(): number {
    return this.latitude;
  }

  /**
   * Retorna la longitud
   */
  getLongitude(): number {
    return this.longitude;
  }

  /**
   * Calcula la distancia a otra ubicación usando la fórmula de Haversine
   * @param other - Otra ubicación
   * @returns Distancia en kilómetros
   */
  distanceTo(other: Location): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRad(other.latitude - this.latitude);
    const dLon = this.toRad(other.longitude - this.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(this.latitude)) * 
              Math.cos(this.toRad(other.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Verifica si esta ubicación está dentro de un radio dado respecto a otra
   * @param other - Ubicación de referencia
   * @param radiusKm - Radio en kilómetros
   */
  isWithinRadius(other: Location, radiusKm: number): boolean {
    return this.distanceTo(other) <= radiusKm;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Compara dos ubicaciones por igualdad
   */
  equals(other: Location): boolean {
    return this.latitude === other.latitude && 
           this.longitude === other.longitude;
  }

  /**
   * Representación en string de la ubicación
   */
  toString(): string {
    return `Location(${this.latitude}, ${this.longitude})`;
  }

  /**
   * Retorna un objeto plano con las coordenadas
   */
  toJSON(): { latitude: number; longitude: number } {
    return {
      latitude: this.latitude,
      longitude: this.longitude
    };
  }
}
