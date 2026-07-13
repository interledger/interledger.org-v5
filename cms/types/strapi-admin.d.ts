// @strapi/admin publishes types only under its package.json "exports" map,
// which "moduleResolution": "node" (classic) can't follow. This declares just
// the pieces used in this project; see @strapi/admin/dist/admin/src/components/Form.d.ts
// for the full shape.
declare module '@strapi/admin/strapi-admin' {
  interface FormContextValue {
    onChange: (eventOrPath: unknown, value?: unknown) => void
  }

  export function useForm<Selected>(
    consumerName: string,
    selector: (value: FormContextValue) => Selected
  ): Selected
}
