import type { TransmissionConfig } from '../../../shared/widgets/media';
import type { TorrentData } from '../../../shared/widgets/payloads';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { TorrentList } from '../_media/media';
import sharedStyles from '../_media/media.module.css';

function Transmission({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as TransmissionConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const torrents = ((data as TorrentData | null)?.torrents ?? []) as TorrentData['torrents'];
  if (loading) {
    return (
      <WidgetChrome
        title={cfg.title ?? 'Transmission'}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        isLoading
      />
    );
  }
  if (torrents.length === 0 && !error) {
    return (
      <WidgetChrome
        title={cfg.title ?? 'Transmission'}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
      >
        <div className={sharedStyles.placeholder}>No torrents</div>
      </WidgetChrome>
    );
  }
  return (
    <WidgetChrome
      title={cfg.title ?? 'Transmission'}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      error={error}
    >
      <TorrentList torrents={torrents} />
    </WidgetChrome>
  );
}

registerWidgetComponent('transmission', Transmission);

export default Transmission;
