import { readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { describe, expect, it } from "vitest"
import { ROUTE_INVENTORY } from "./route-inventory"
import { routePolicy } from "@/lib/auth/route-policy"

const APP_DIR = join(__dirname, "..", "..", "app")

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return routeFiles(path)
    return name === "route.ts" ? [relative(APP_DIR, dir).split(sep).join("/")] : []
  })
}

describe("route inventory", () => {
  const routes = routeFiles(APP_DIR)

  it("lists every route handler", () => {
    expect(routes.filter((route) => !(route in ROUTE_INVENTORY))).toEqual([])
  })

  it("has no stale entries", () => {
    expect(Object.keys(ROUTE_INVENTORY).filter((route) => !routes.includes(route))).toEqual([])
  })

  // The only /api route allowed without a session; adding one is a deliberate edit here.
  const PUBLIC_API = ["api/health"]

  it("keeps every /api route behind a session", () => {
    const open = routes.filter((route) => route.startsWith("api/") && !PUBLIC_API.includes(route) && ROUTE_INVENTORY[route]?.access !== "session")
    expect(open).toEqual([])
  })

  it("agrees with proxy.ts on which /api routes are public", () => {
    for (const route of PUBLIC_API) expect(routePolicy(`/${route}`, true)).toBe("public")
    expect(routePolicy("/api/chat", true)).toBe("api")
  })
})
