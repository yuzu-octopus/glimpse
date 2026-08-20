/** Shared loading derivation: WidgetChrome isLoading when data is null and no error. */
export function isWidgetLoading(data: unknown, error: string | undefined, isLoading: boolean | undefined): boolean {
  if (typeof isLoading === 'boolean') return isLoading;
  return (data as unknown) == null && !error;
}
