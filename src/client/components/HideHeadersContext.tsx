import { createContext } from 'react';

/** Page-level hide-headers flag. PageView provides it; WidgetChrome consumes it. */
export const HideHeadersContext = createContext(false);
