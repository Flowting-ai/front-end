// @hugeicons/core-free-icons ships a per-icon file for every icon (e.g.
// dist/esm/AbacusIcon.js) and its package.json "exports" map advertises a
// matching ./*  ->  ./dist/types/*.d.ts type path — but those per-icon .d.ts
// files were never actually published (only index.d.ts/loader.*.d.ts exist
// under dist/types/). Deep-importing an icon by its own path (instead of the
// barrel `@hugeicons/core-free-icons` export, which pulls every icon into a
// single ~5MB chunk) is how the package intends tree-shaking to work, so
// this declares the missing per-file types locally rather than working
// around the barrel import. Shape matches @hugeicons/react's own
// `IconSvgElement` type exactly, so it type-checks against HugeiconsIcon's
// `icon` prop with no `any`.
declare module "@hugeicons/core-free-icons/*" {
  const icon: readonly (readonly [
    string,
    { readonly [key: string]: string | number },
  ])[];
  export default icon;
}
