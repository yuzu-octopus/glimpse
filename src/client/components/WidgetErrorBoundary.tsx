import { Component, type ErrorInfo, type ReactNode } from 'react';
import { WidgetChrome } from './WidgetChrome';

interface WidgetErrorBoundaryProps {
  /** The widget's payload object. A new payload means a new `identity` here,
   * which is how a widget that recovers stops being stuck on the degraded
   * card. */
  identity: unknown;
  title?: string;
  children: ReactNode;
}

interface WidgetErrorBoundaryState {
  error: Error | null;
}

/** One boundary per widget, not one around the app.
 *
 * A widget's payload is unvalidated network data rendered by a third-party
 * component, so a render throw is a real possibility — and before this
 * existed, one of them unmounted every widget on the page. The page went
 * blank, and a throw inside a poll looked indistinguishable from the app
 * being broken. A boundary at the app shell would catch the same error and
 * take the same page with it, so it belongs here: the offending widget
 * degrades to a card, the rest of the dashboard keeps rendering.
 *
 * The degraded card is the app's own error card, so a crash reads exactly
 * like any other widget failure rather than inventing a second vocabulary.
 */
export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  state: WidgetErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // React swallows the error otherwise, and a swallowed render error in a
    // poll is indistinguishable from a widget that simply has no data.
    console.error(
      `[glimpse] widget "${this.props.title ?? 'untitled'}" failed to render`,
      error,
      info.componentStack,
    );
  }

  componentDidUpdate(prev: WidgetErrorBoundaryProps): void {
    if (this.state.error && prev.identity !== this.props.identity) {
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <WidgetChrome
          title={this.props.title}
          error={`${this.props.title ?? 'This widget'} failed to render`}
        />
      );
    }
    return this.props.children;
  }
}
