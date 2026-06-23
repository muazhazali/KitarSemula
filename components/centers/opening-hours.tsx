import type { OpeningHours } from '@/lib/types';

const DAY_LABELS: { key: keyof OpeningHours; label: string }[] = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

interface OpeningHoursProps {
  hours: OpeningHours;
}

export function OpeningHoursTable({ hours }: OpeningHoursProps) {
  const today = new Date().getDay(); // 0=Sun
  const todayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
    today
  ] as keyof OpeningHours;

  return (
    <div className="flex flex-col gap-1">
      {DAY_LABELS.map(({ key, label }) => {
        const isToday = key === todayKey;
        const value = hours[key];
        return (
          <div
            key={key}
            className={`flex items-center justify-between py-1 text-sm ${
              isToday ? 'text-primary font-semibold' : 'text-foreground'
            }`}
          >
            <span className="w-10 shrink-0">{label}</span>
            <span className={value ? '' : 'text-muted-foreground'}>{value ?? 'Closed'}</span>
          </div>
        );
      })}
    </div>
  );
}
