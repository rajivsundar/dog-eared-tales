// Stands in for the virtual module "virtual:pwa-register/react" in unit tests (vite.config.ts),
// where there is no service worker. It never reports an update.
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as [boolean, (value: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (value: boolean) => void],
    updateServiceWorker: async () => {},
  }
}
