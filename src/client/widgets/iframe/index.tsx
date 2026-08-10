import { iframeSchema, htmlSchema } from '../../../shared/widgets/iframe';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './iframe.module.css';

function Iframe({ config }: WidgetComponentProps) {
  const cfg = iframeSchema.parse(config);
  return (
    <WidgetChrome title={cfg.title} hideHeader={cfg['hide-header']}>
      <iframe
        src={cfg.source}
        height={cfg.height ?? 300}
        className={styles.frame}
        title={cfg.title ?? 'Embedded content'}
      />
    </WidgetChrome>
  );
}

function Html({ config }: WidgetComponentProps) {
  const cfg = htmlSchema.parse(config);
  return (
    <WidgetChrome title={cfg.title} hideHeader={cfg['hide-header']}>
      <div
        className={styles.html}
        dangerouslySetInnerHTML={{ __html: cfg.source }}
      />
    </WidgetChrome>
  );
}

registerWidgetComponent('iframe', Iframe);
registerWidgetComponent('html', Html);
