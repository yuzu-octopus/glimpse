// Registers the astryx-dracula icon set into Astryx's global icon registry.
// Import this exactly once, before the first render (see src/main.tsx): every
// Astryx component then resolves its semantic icons (close, chevrons, check, …)
// from the brand kit instead of core's built-in defaults. Registration is
// module-level state, so a later call would leave the first painted tree
// rendering core's icons.

import { registerIcons } from "@astryxdesign/core";
import { draculaIconRegistry } from "astryx-dracula";

registerIcons(draculaIconRegistry);
