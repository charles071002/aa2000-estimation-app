/**
 * Geo service using OpenStreetMap Nominatim (no API key required).
 * Used for reverse geocoding and place search in the project location map.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const HEADERS: HeadersInit = {
  'Accept': 'application/json',
  'User-Agent': 'AA2000-SiteSurvey/1.0',
};

export interface ReverseGeocodeResult {
  /** Full human-readable address from Nominatim (same as search results). */
  displayName: string;
  street: string;
  city: string;
  province: string;
  postcode: string;
}

export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult> {
  const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lon}&format=json`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error('Reverse geocode failed');
  const data = await res.json();
  const addr = data.address || {};
  const street = [addr.road, addr.house_number, addr.suburb].filter(Boolean).join(', ') || '';
  const city = addr.city || addr.town || addr.village || addr.municipality || '';
  const province = addr.state || addr.province || '';
  const postcode = addr.postcode || '';
  const pieces = [street, city, province, postcode].filter(Boolean);
  const displayName =
    typeof data.display_name === 'string' && data.display_name.trim()
      ? data.display_name.trim()
      : pieces.length
        ? pieces.join(', ')
        : `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  return {
    displayName,
    street,
    city,
    province,
    postcode,
  };
}

export interface PlaceResult {
  displayName: string;
  lat: number;
  lon: number;
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(q)}&format=json&limit=5`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error('Place search failed');
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((item: any) => ({
    displayName: item.display_name || `${item.lat}, ${item.lon}`,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
  }));
}
