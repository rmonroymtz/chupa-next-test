# Deploying the storefront on ECS Fargate

The storefront ships as one container image (`Dockerfile`, Next.js `output: 'standalone'`) that listens on port 3000, logs JSON lines and CloudWatch EMF metrics to stdout, and exposes a liveness probe at `/healthz`. Configuration is split into **build-time** values (baked into the image) and **runtime** values (task definition).

## Quick path

1. Build the image (needs network: `next/font` downloads Google fonts during the build):

   ```sh
   docker build -t chupa-storefront:<git-sha> \
     --build-arg IMAGE_REMOTE_HOSTS="chupaprecios.com.mx/media/**,i.ebayimg.com,m.media-amazon.com,target.scene7.com" \
     --build-arg SERVER_ACTIONS_ALLOWED_ORIGINS="" \
     .
   ```

2. Push it to ECR and register a task definition like the example below.
3. Run it as an ECS service behind the load balancer, with the target group health check on `/healthz`.
4. Verify: `curl -i https://<task-or-alb>/healthz` answers `200 ok`, and `curl https://<host>/robots.txt` shows `Sitemap: <PUBLIC_BASE_URL>/sitemap.xml`.

Then route traffic as described in [`docs/routing/phase-1.md`](../routing/phase-1.md), [`docs/routing/phase-2.md`](../routing/phase-2.md) and [`docs/routing/phase-3.md`](../routing/phase-3.md).

## Image

| Topic    | Decision                                                                                                                                                                                                  |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base     | `node:24-bookworm-slim` (glibc). `sharp` (the `next/image` optimizer) ships its best-tested prebuilt binaries for glibc; Alpine (musl) needs other packages and has had allocator and performance issues. |
| pnpm     | Corepack installs the exact `packageManager` version (`pnpm@11.5.3`); `pnpm install --frozen-lockfile`.                                                                                                   |
| Stages   | `deps` (install) → `build` (`pnpm build`) → `runner` (only `.next/standalone`, `.next/static` and `public`).                                                                                              |
| User     | `node` (uid 1000), not root.                                                                                                                                                                              |
| Defaults | `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`, `NEXT_TELEMETRY_DISABLED=1`.                                                                                                                      |
| Command  | `node server.js`                                                                                                                                                                                          |
| Secrets  | `.dockerignore` excludes every `.env*` file; no runtime value is read at build time.                                                                                                                      |

Runtime variables are validated (zod) on the **first request that needs them**, not at startup. A wrong value therefore does not fail `/healthz`: pages answer 5xx and the log shows `Invalid server environment` with every bad variable. Check the first page response after each deployment.

## Task definition (example)

Adapt the account, region, role, image and values. Sizes are a **starting point, not measured**: load-test before relying on them.

```json
{
  "family": "chupa-storefront",
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "1024",
  "memory": "2048",
  "runtimePlatform": { "cpuArchitecture": "X86_64", "operatingSystemFamily": "LINUX" },
  "executionRoleArn": "arn:aws:iam::<account>:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "storefront",
      "image": "<account>.dkr.ecr.<region>.amazonaws.com/chupa-storefront:<git-sha>",
      "essential": true,
      "portMappings": [{ "containerPort": 3000, "protocol": "tcp" }],
      "environment": [
        { "name": "MAGENTO_GRAPHQL_URL", "value": "https://<magento-host>/graphql" },
        { "name": "CHAPI_BASE_URL", "value": "https://<chapi-host>" },
        { "name": "PUBLIC_BASE_URL", "value": "https://chupaprecios.com.mx" },
        { "name": "METRICS_NAMESPACE", "value": "ChupaStorefront" },
        { "name": "LOG_LEVEL", "value": "info" }
      ],
      "healthCheck": {
        "command": [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 20
      },
      "stopTimeout": 45,
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/chupa-storefront",
          "awslogs-region": "<region>",
          "awslogs-stream-prefix": "storefront",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
```

Notes:

- **Logs and metrics.** The `awslogs` driver sends stdout to the log group `/ecs/chupa-storefront`. Metrics are CloudWatch Embedded Metric Format lines on the same stdout; CloudWatch Logs extracts them automatically into the namespace set by `METRICS_NAMESPACE` (default `ChupaStorefront`). No agent or sidecar is needed. `awslogs-create-group` needs `logs:CreateLogGroup` on the execution role; otherwise create the group beforehand and drop the option.
- **Health check.** The slim image has no `curl`, so the container check uses Node's `fetch`. The load balancer target group should also check `GET /healthz` (matcher `200`).
- **CPU and memory.** 1 vCPU / 2 GB is a conservative first size for server rendering with Page Builder parsing and image optimization. Image optimization (`sharp`) is the most CPU and memory hungry part; watch `CPUUtilization`/`MemoryUtilization` and the p95 page latency under load before scaling down.
- **Secrets.** None of the current variables is a secret. If one is added later, use `secrets` with SSM Parameter Store or Secrets Manager instead of `environment`.

## Liveness, not readiness

`/healthz` answers `200 ok` (`Cache-Control: no-store`) as long as the Node process serves requests. It deliberately checks **no dependency**:

- If it checked Magento or the scraper API, a slow Magento would mark every task unhealthy at once; ECS would replace healthy containers in a loop and turn a partial outage into a full one.
- Pages already report dependency failures correctly: a Magento failure is a 5xx, never a 404 or an empty 200.
- Watch dependency health through the `MagentoError`, `MagentoLatency` and scraper metrics instead.

`/healthz` is for the load balancer and ECS only. Do not route it publicly (see the routing doc).

## Graceful shutdown

On `SIGTERM` the Next.js standalone server stops accepting connections, waits for in-flight requests to finish, then waits for pending `after()` work (the Magento copy mutation) before exiting.

- `stopTimeout` must cover the slowest request plus the copy mutation: scraper timeout (`CHAPI_TIMEOUT_MS`, 15 s) + `COPY_MUTATION_TIMEOUT_MS` (10 s) + margin. The example uses 45 s (Fargate maximum is 120 s).
- Keep the target group deregistration delay at or below `stopTimeout` so the load balancer stops sending requests before the task is killed.
- `node` runs as PID 1 and Next registers its own `SIGTERM` handler, so no init process is needed. Do not set `NEXT_MANUAL_SIG_HANDLE`.

## Environment variables

**Build-time** values are fixed when the image is built (`--build-arg`); changing them needs a new image. Everything else is **runtime** (task definition). Runtime values are documented in `src/shared/config/env.ts`.

| Name                                 | Required | Default                                          | When            | Purpose                                                                                                                                           |
| ------------------------------------ | -------- | ------------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MAGENTO_GRAPHQL_URL`                | yes      | none                                             | runtime         | Magento GraphQL endpoint (http/https url).                                                                                                        |
| `PUBLIC_BASE_URL`                    | yes      | none                                             | runtime         | Public site origin; canonical urls, Open Graph, `metadataBase`, robots.txt `Sitemap`.                                                             |
| `CHAPI_BASE_URL`                     | yes      | none                                             | runtime         | Scraper API (CHAPI) base url, server-side only.                                                                                                   |
| `MAGENTO_TIMEOUT_MS`                 | no       | `5000`                                           | runtime         | Timeout per Magento GraphQL request.                                                                                                              |
| `MAGENTO_MENU_TIMEOUT_MS`            | no       | `1500`                                           | runtime         | Timeout of the header category menu query; the header renders without categories after it.                                                        |
| `MAGENTO_RECOMMENDATIONS_TIMEOUT_MS` | no       | `3000`                                           | runtime         | Timeout of the recommendation sliders query (`randomProducts`) under the search results; the sliders are hidden after it.                         |
| `CHAPI_TIMEOUT_MS`                   | no       | `15000`                                          | runtime         | Timeout per scraper API request.                                                                                                                  |
| `CHAPI_SEARCH_TIMEOUT_MS`            | no       | `8000`                                           | runtime         | Timeout per CHAPI search request (search page and its sort options); on timeout the page answers 200 with an error and a retry link.              |
| `COPY_MUTATION_TIMEOUT_MS`           | no       | `10000`                                          | runtime         | Timeout of the Magento copy mutation run after the response.                                                                                      |
| `MAGENTO_STORE_CODE`                 | no       | `default`                                        | runtime         | `Store` header on every Magento request.                                                                                                          |
| `MAGENTO_CURRENCY`                   | no       | `MXN`                                            | runtime         | `Content-Currency` header (ISO 4217).                                                                                                             |
| `PRODUCT_VENDORS`                    | no       | `amazon,ebay,target,acme`                        | runtime         | Vendors whose `/{vendor}-{sku}-{slug}.html` urls are product urls. Keep in sync with the routing rules.                                           |
| `BOT_USER_AGENTS`                    | no       | built-in list                                    | runtime         | Comma or newline separated User-Agent substrings (or regex sources) treated as bots.                                                              |
| `LOG_LEVEL`                          | no       | `info`                                           | runtime         | pino level (`fatal` … `trace`, `silent`).                                                                                                         |
| `METRICS_NAMESPACE`                  | no       | `ChupaStorefront`                                | runtime         | CloudWatch namespace of the EMF metrics.                                                                                                          |
| `ORGANIZATION_LOGO_URL`              | no       | none                                             | runtime         | Organization logo in JSON-LD.                                                                                                                     |
| `ORGANIZATION_SAME_AS`               | no       | none                                             | runtime         | Comma-separated social profile urls for JSON-LD `sameAs`.                                                                                         |
| `GTM_ID`                             | no       | none                                             | runtime         | Google Tag Manager container (`GTM-…`); GTM and the `dataLayer` events load only when set. Read per request, so no rebuild is needed.             |
| `PORT`                               | no       | `3000`                                           | runtime (image) | Listening port.                                                                                                                                   |
| `HOSTNAME`                           | no       | `0.0.0.0`                                        | runtime (image) | Listening address. Keep `0.0.0.0` in containers.                                                                                                  |
| `IMAGE_REMOTE_HOSTS`                 | no       | Magento media + eBay, Amazon, Target image hosts | **build**       | Hosts (`host` or `host/path/**`) `next/image` may optimize.                                                                                       |
| `SERVER_ACTIONS_ALLOWED_ORIGINS`     | no       | empty                                            | **build**       | Extra hosts (`www.example.com`, `*.example.com`) accepted by the Server Action origin check. Leave empty when the proxy forwards the public host. |

## Server Actions behind a proxy

Add to cart and the mini cart use Server Actions: a `POST` to the page url itself (a product or CMS path). Next rejects an action unless the browser `Origin` host equals `X-Forwarded-Host` (or, without it, `Host`).

- **Preferred:** the proxy forwards the public host. nginx: `proxy_set_header X-Forwarded-Host $host;`. CloudFront: forward the viewer `Host` header in the origin request policy, or set `X-Forwarded-Host` from the viewer `Host` in a viewer-request CloudFront Function and allow that header in the origin request policy. A fixed custom origin header does not work: it must equal the host the browser used.
- **Fallback:** when the proxy cannot do that, build the image with `SERVER_ACTIONS_ALLOWED_ORIGINS=chupaprecios.com.mx,www.chupaprecios.com.mx`.
- Symptom when wrong: add to cart fails and the log shows `x-forwarded-host header with value ... does not match origin header`.

## Run the image locally

```sh
docker run --rm -p 3000:3000 \
  -e MAGENTO_GRAPHQL_URL=https://magento.example/graphql \
  -e CHAPI_BASE_URL=https://chapi.example \
  -e PUBLIC_BASE_URL=https://chupaprecios.com.mx \
  chupa-storefront:test
curl -i http://localhost:3000/healthz      # 200 ok
curl http://localhost:3000/robots.txt      # rules + Sitemap line
```

## Checklist

- [ ] Image built with the intended `IMAGE_REMOTE_HOSTS` and `SERVER_ACTIONS_ALLOWED_ORIGINS`.
- [ ] `MAGENTO_GRAPHQL_URL`, `CHAPI_BASE_URL`, `PUBLIC_BASE_URL` set in the task definition.
- [ ] Target group health check on `/healthz`, deregistration delay ≤ `stopTimeout`.
- [ ] The proxy forwards the public host (Server Actions).
- [ ] First product page after deploy answers 200 (runtime env validated).
- [ ] EMF metrics visible under the `METRICS_NAMESPACE` namespace.
