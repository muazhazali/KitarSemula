export interface MapView {
  lat: number;
  lng: number;
  zoom: number;
}

const MAP_VIEW_KEY = 'kitarsemula.map-view';
const SELECTED_CENTER_KEY = 'kitarsemula.selected-center';

function read(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    return;
  }
}

export function loadMapView(): MapView | null {
  const raw = read(MAP_VIEW_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<MapView>;
    if (
      typeof parsed.lat === 'number' &&
      Number.isFinite(parsed.lat) &&
      typeof parsed.lng === 'number' &&
      Number.isFinite(parsed.lng) &&
      typeof parsed.zoom === 'number' &&
      Number.isFinite(parsed.zoom)
    ) {
      return { lat: parsed.lat, lng: parsed.lng, zoom: parsed.zoom };
    }
  } catch {
    return null;
  }
  return null;
}

export function saveMapView(view: MapView) {
  write(MAP_VIEW_KEY, JSON.stringify(view));
}

export function loadSelectedCenterSlug(): string | null {
  return read(SELECTED_CENTER_KEY);
}

export function saveSelectedCenterSlug(slug: string) {
  write(SELECTED_CENTER_KEY, slug);
}
