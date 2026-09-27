// Registers the astryx-dracula integration pack so `bunx astryx template <id>
// --package astryx-dracula` discovers the kit's themed pages/blocks instead of
// erroring on the unknown package. Shape from @astryxdesign/cli@0.3.0 README →
// Configuration; the loader uses a strict schema, so unknown keys hard-error.
// Verify: `bunx astryx doctor` (config check) · `bunx astryx template --list`.
export default {
  integrations: ['astryx-dracula'],
};
