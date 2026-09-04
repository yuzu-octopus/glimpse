import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';

export const TWITCH_CHANNELS_DEFAULTS = { 'collapse-after': 5, 'sort-by': 'viewers' as const };
export const TWITCH_CHANNELS_PREF: Pref = { cols: 3, rows: 3, resizable: true, priority: 7, zone: 'main', preferredWidth: 340, preferredHeight: 360 };
export const TWITCH_CHANNELS_SKELETON: SkeletonShape = 'list';

export const TWITCH_TOP_GAMES_DEFAULTS = { limit: 10, 'collapse-after': 5 };
export const TWITCH_TOP_GAMES_PREF: Pref = { cols: 3, rows: 3, resizable: true, priority: 6, zone: 'main', preferredWidth: 340, preferredHeight: 360 };
export const TWITCH_TOP_GAMES_SKELETON: SkeletonShape = 'list';

export const twitchChannelsSchema = z
  .object({
    type: z.literal('twitch-channels'),
    ...sharedWidgetFields,
    channels: z.array(z.string()).min(1),
    'collapse-after': z.number().int().min(-1).optional(),
    'sort-by': z.enum(['viewers', 'live']).optional(),
  })
  .loose();
export type TwitchChannelsConfig = z.infer<typeof twitchChannelsSchema>;

export const twitchTopGamesSchema = z
  .object({
    type: z.literal('twitch-top-games'),
    ...sharedWidgetFields,
    limit: z.number().int().min(1).max(25).optional(),
    'collapse-after': z.number().int().min(-1).optional(),
    exclude: z.array(z.string()).optional(),
  })
  .loose();
export type TwitchTopGamesConfig = z.infer<typeof twitchTopGamesSchema>;
