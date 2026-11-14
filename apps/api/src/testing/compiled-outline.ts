import {
  courseContextFor,
  type CourseContext,
} from '../authoring/course-context';
import {
  compile,
  loadOutlineSpec,
  outlineItemIds,
  type OutlineItemRow,
} from '../authoring/outline-compiler';
import type { Skeleton } from '../authoring/skeleton-schema';

/**
 * The outline compiled as the specs see it: no database, so each item's row is
 * made from the spec's own surface, and a grammar item has no reading. One
 * definition, so every spec that reasons about lesson N tests the same
 * skeleton.
 */
export function compiledOutline() {
  const spec = loadOutlineSpec();
  const rows: OutlineItemRow[] = outlineItemIds(spec).map((id) => {
    const kind = id.split(':')[1];
    const surface = spec.surfaces[id] ?? id.split(':')[2];
    return {
      id,
      type: kind.toUpperCase() as OutlineItemRow['type'],
      display: surface,
      reading: kind === 'grammar' ? null : surface,
    };
  });
  const skeleton: Skeleton = compile(spec, rows);
  const lessons = skeleton.module.chapters.flatMap((c) => c.lessons);
  /** The course context of lesson n, counted from 1. */
  const ctxAt = (n: number): CourseContext =>
    courseContextFor(skeleton, lessons[n - 1].id)!;
  return { spec, skeleton, lessons, ctxAt };
}
