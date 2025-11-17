import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'), // Assuming you'll have an index.html
        dashboard: resolve(__dirname, 'dashboard.html'),
        buyCrypto: resolve(__dirname, 'buy-crypto.html'),
        deposit: resolve(__dirname, 'deposit.html'),
        lockedSavings: resolve(__dirname, 'locked-savings.html'),
        profile: resolve(__dirname, 'profile.html'),
        transactionHistory: resolve(__dirname, 'transaction-history.html'),
        withdrawal: resolve(__dirname, 'withdrawal.html'),
        login: resolve(__dirname, 'login.html'),
        register: resolve(__dirname, 'register.html'),
        forgotPassword: resolve(__dirname, 'forgot-password.html'),
        advancedVerification: resolve(__dirname, 'advanced-verification.html'),
      },
    },
  },
}); 