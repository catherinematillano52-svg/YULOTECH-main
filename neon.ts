import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  preview: {
    // Browser origins allowed to open live queries: Vite dev server, XAMPP Apache, php -S
    realtime: { allowedOrigins: ["http://localhost:5173", "http://localhost", "http://127.0.0.1:8000"] },
  },
  auth: false,
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
