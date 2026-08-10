import { iframeSchema, htmlSchema } from '../../../shared/widgets/iframe';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './iframe.module.css';

function Iframe({ config }: WidgetComponentProps) {
  const cfg = iframeSchema.parse(config);
  return (
    <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']}>
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
    <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']}>
      <div
        className={styles.html}
        dangerouslySetInnerHTML={{ __html: cfg.source }}
      />
    </WidgetChrome>
  );
}

registerWidgetComponent('iframe', Iframe);
registerWidgetComponent('html', Html);
