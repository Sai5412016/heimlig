// lib/gamification.ts — points & titles for the household scoreboard
import { Task } from './supabase';

// Points per task, derived from its effort level (priority). Falls back to stored points.
export function taskPoints(task: Pick<Task, 'points' | 'priority'>): number {
  if (typeof task.points === 'number' && task.points > 0) return task.points;
  return task.priority === 'high' ? 20 : task.priority === 'low' ? 5 : 10;
}

// Effort levels shown when creating a task
export const EFFORT_POINTS = { low: 5, normal: 10, high: 20 } as const;

// Fun titles based on a member's monthly points. First match from the top wins.
const TITLES: { min: number; title: string }[] = [
  { min: 250, title: 'Heimlig-Legende 👑' },
  { min: 150, title: 'Ordnungs-Guru 🧘' },
  { min: 90, title: 'Putz-Profi ✨' },
  { min: 40, title: 'Haushalts-Held 💪' },
  { min: 15, title: 'Fleißige Biene 🐝' },
  { min: 1, title: 'Putzhilfe 🧹' },
  { min: 0, title: 'Frischling 🐣' },
];

export function titleForPoints(points: number): string {
  return (TITLES.find(t => points >= t.min) ?? TITLES[TITLES.length - 1]).title;
}
