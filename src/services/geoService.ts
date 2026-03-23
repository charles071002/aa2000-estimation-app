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
  return {
    street: [addr.road, addr.house_number, addr.suburb].filter(Boolean).join(', ') || '',
    city: addr.city || addr.town || addr.village || addr.municipality || '',
    province: addr.state || addr.province || '',
    postcode: addr.postcode || '',
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
