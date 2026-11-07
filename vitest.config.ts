import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  return {
    test: {
      projects: [
        {
          test: {
            name: "unit",
            environment: "node",
            include: ["tests/unit/**/*.test.ts"],
          },
        },
        {
          plugins: [
            cloudflareTest({
              main: "./worker/index.ts",
              miniflare: {
                compatibilityDate: "2026-11-01",
                d1Databases: ["DB"],
                ratelimits: { HIT_LIMITER: { namespace_id: "1001", simple: { limit: 1000, period: 60 } } },
                bindings: { COUNT_HOST: "blog.example.test", TEST_MIGRATIONS: migrations },
                serviceBindings: {
                  ASSETS: () => new Response("static asset", { status: 200 }),
                },
              },
            }),
          ],
          test: {
            name: "worker",
            include: ["tests/worker/**/*.test.ts"],
            setupFiles: ["./tests/worker/apply-migrations.ts"],
          },
        },
      ],
    },
  };
});
