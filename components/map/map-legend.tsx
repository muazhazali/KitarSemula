export function MapLegend() {
  const items = [
    { color: 'bg-green-600', label: 'Open Now' },
    { color: 'bg-red-600', label: 'Closed' },
    { color: 'bg-orange-600', label: 'Unverified' },
    { color: 'bg-gray-500', label: 'Unknown Hours' },
  ];

  return (
    <div className="bg-background/95 border-border absolute bottom-8 left-3 z-[500] rounded-lg border px-3 py-2 shadow-sm backdrop-blur-sm">
      <p className="text-foreground mb-1.5 text-xs font-semibold">Legend</p>
      <div className="flex flex-col gap-1">
        {items.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`inline-block size-2.5 rounded-full ${color}`} aria-hidden="true" />
            <span className="text-muted-foreground text-xs">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
