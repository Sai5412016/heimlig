// lib/gamification.ts — points & titles for the household scoreboard
import type { TFunction } from 'i18next';
import { Task } from './supabase';

// Points per task, derived from its effort level (priority). Falls back to stored points.
export function taskPoints(task: Pick<Task, 'points' | 'priority'>): number {
  if (typeof task.points === 'number' && task.points > 0) return task.points;
  return task.priority === 'high' ? 20 : task.priority === 'low' ? 5 : 10;
}

// Effort levels shown when creating a task
export const EFFORT_POINTS = { low: 5, normal: 10, high: 20 } as const;

// Fun titles based on a member's monthly points. First match from the top wins.
function titles(t: TFunction): { min: number; title: string }[] {
  return [
    { min: 250, title: t('gamification.titleLegend') },
    { min: 150, title: t('gamification.titleGuru') },
    { min: 90, title: t('gamification.titlePro') },
    { min: 40, title: t('gamification.titleHero') },
    { min: 15, title: t('gamification.titleBee') },
    { min: 1, title: t('gamification.titleHelper') },
    { min: 0, title: t('gamification.titleNewbie') },
  ];
}

export function titleForPoints(points: number, t: TFunction): string {
  const list = titles(t);
  return (list.find(x => points >= x.min) ?? list[list.length - 1]).title;
}
