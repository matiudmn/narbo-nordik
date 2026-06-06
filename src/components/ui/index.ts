/**
 * Design system Narbo Nordik — primitives UI partagées.
 *
 * Import :
 *   import { Button, Card, Badge, StatusBadge, EmptyState, ConfirmDialog, useToast,
 *            MetricTile, RollingNumber, StreakFlame, ProgressRing,
 *            SessionTypeBadge, DateChip, HeroBlock, DataDivider, AvatarStack, AlluresBar
 *          } from '@/components/ui';
 */

export { Button } from './Button';
export type { ButtonVariant, ButtonSize } from './Button';

export { Card, CardHeader } from './Card';
export type { CardPadding } from './Card';

export { Badge, StatusBadge } from './Badge';
export type { BadgeTone, BadgeSize, SessionStatus } from './Badge';

export { EmptyState } from './EmptyState';

export { ConfirmDialog } from './ConfirmDialog';

export { ToastProvider, useToast } from './Toast';
export type { ToastTone } from './Toast';

// Visual components — sprint 3 polish
export { MetricTile } from './MetricTile';
export type { MetricTone } from './MetricTile';

export { RollingNumber } from './RollingNumber';

export { StreakFlame } from './StreakFlame';

export { ProgressRing } from './ProgressRing';

export { SessionTypeBadge } from './SessionTypeBadge';

export { DateChip } from './DateChip';

export { HeroBlock } from './HeroBlock';

export { DataDivider } from './DataDivider';

export { AvatarStack } from './AvatarStack';

export { AlluresBar } from './AlluresBar';

export { Glossary } from './Glossary';
export type { GlossaryTerm } from './Glossary';
