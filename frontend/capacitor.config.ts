import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.fincouple.app',
  appName: 'FinCouple',
  webDir: 'dist',
  server: {
    // Permite chamadas https ao backend a partir do app nativo
    androidScheme: 'https',
  },
  plugins: {
    Keyboard: {
      resize: 'body',
    },
  },
}

export default config
