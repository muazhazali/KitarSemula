import type { RecyclingCenter, CenterStatus } from '../types';

/**
 * Haversine formula to calculate distance between two coordinates (in km)
 */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/**
 * Very simple "open now" check based on day-of-week hours string.
 */
export function isOpenNow(center: RecyclingCenter): boolean {
  if (center.status !== 'ACTIVE') return false;
  const days: (keyof typeof center.opening_hours)[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const now = new Date();
  const dayKey = days[now.getDay()];
  const hoursStr = center.opening_hours[dayKey];
  if (!hoursStr) return false;

  try {
    const [openStr, closeStr] = hoursStr.split('–').map((s) => s.trim());
    const parseTime = (t: string) => {
      const [time, period] = t.split(' ');
      const [h, m] = time.split(':').map(Number);
      let hour = h;
      if (period === 'PM' && h !== 12) hour += 12;
      if (period === 'AM' && h === 12) hour = 0;
      return hour * 60 + (m || 0);
    };
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return nowMinutes >= parseTime(openStr) && nowMinutes < parseTime(closeStr);
  } catch {
    return false;
  }
}

export function getMarkerColor(center: RecyclingCenter): 'green' | 'red' | 'grey' | 'orange' {
  if (center.verification_status === 'UNVERIFIED') return 'orange';
  if (center.status === 'CLOSED' || center.status === 'TEMPORARILY_CLOSED') return 'red';
  if (center.status === 'ACTIVE' && isOpenNow(center)) return 'green';
  if (center.status === 'ACTIVE') return 'red';
  return 'grey';
}

export function getStatusLabel(status: CenterStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'CLOSED':
      return 'Closed';
    case 'TEMPORARILY_CLOSED':
      return 'Temporarily Closed';
    case 'UNKNOWN':
      return 'Unknown';
  }
}

export function getTodayHours(center: RecyclingCenter): string {
  const days: (keyof typeof center.opening_hours)[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const now = new Date();
  const dayKey = days[now.getDay()];
  return center.opening_hours[dayKey] ?? 'Closed today';
}
