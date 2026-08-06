/**
 * Best-time suggestions. When we have an `online_followers` heatmap
 * (24 values per weekday, from Instagram insights) pick the hottest hours;
 * otherwise fall back to proven defaults (11:00 and 18:00 local).
 */

export type Heatmap = number[][]; // [7][24] — Monday-first weekday × hour

const DEFAULT_HOURS = [11, 18];

export function nextBestSlots(heat: Heatmap | null, days: number, from: Date = new Date()): Date[] {
  const slots: Date[] = [];
  for (let d = 0; d < days; d++) {
    const date = new Date(from);
    date.setDate(date.getDate() + d);
    const weekday = (date.getDay() + 6) % 7; // Monday-first

    let hour: number;
    if (heat && heat[weekday] && heat[weekday].some((v) => v > 0)) {
      const row = heat[weekday];
      hour = row.indexOf(Math.max(...row));
    } else {
      hour = DEFAULT_HOURS[d % DEFAULT_HOURS.length];
    }

    const slot = new Date(date);
    slot.setHours(hour, 0, 0, 0);
    if (slot <= from) slot.setDate(slot.getDate() + 1);
    slots.push(slot);
  }
  return slots;
}
