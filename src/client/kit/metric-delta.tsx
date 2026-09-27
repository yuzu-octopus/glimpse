// Vendored from astryx-dracula@0.2.1 `shared/metric-delta.tsx` (MIT) — re-sync this file on any kit version bump.

// The one KPI-delta pattern: semibold body text tinted positive/negative with
// the direction arrow carrying the same tone. The sign and the arrow carry the
// direction; the tone only reinforces it — never rely on color alone.

import {HStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Icon} from '@astryxdesign/core/Icon';
import {ArrowUp, ArrowDown} from 'lucide-react';

export function MetricDelta({
  value,
  positive,
}: {
  /** Signed figure, e.g. "+12.4%" or "-3.1%". */
  value: string;
  positive: boolean;
}) {
  return (
    <HStack gap={1} vAlign="center">
      <Icon
        icon={positive ? ArrowUp : ArrowDown}
        size="xsm"
        color={positive ? 'success' : 'error'}
      />
      <Text
        type="body"
        weight="semibold"
        hasTabularNumbers
        style={{
          color: positive ? 'var(--color-positive)' : 'var(--color-negative)',
        }}>
        {value}
      </Text>
    </HStack>
  );
}
