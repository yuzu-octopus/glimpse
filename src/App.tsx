import { Card, Heading, Text } from '@astryxdesign/core';

export default function App() {
  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <Card>
        <Heading level={1}>Glimpse</Heading>
        <Text type="supporting">
          Dashboard scaffold — config engine, widgets, and theming land in
          subsequent commits.
        </Text>
      </Card>
    </main>
  );
}
