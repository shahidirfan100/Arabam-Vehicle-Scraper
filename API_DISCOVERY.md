# Arabam.com API Discovery

## Selected source

- **Search pages:** `https://www.arabam.com/ikinci-el/otomobil?take=50&page=N`
- **Detail pages:** `https://www.arabam.com/ilan/<slug>/<id>`
- **Method:** `GET` with Impit (`browser: 'chrome'`) through Apify residential proxies.
- **Auth:** None. The JSON is embedded in the server-rendered HTML of public pages.
- **Pagination:** `take` (1-50) plus `page` (1-based). The `skip` parameter is accepted by the URL but ignored by the site.
- **Search filters:** `searchText` for keyword, `city` for location (numeric Turkish province/plate code, e.g. `city=34` is İstanbul).
- **Structured data containers:**
  - Search page: `insiderArray.push({...})` script blocks with `id`, `name`, `taxonomy` (vehicle type, make, model, variant), `currency`, `unit_price`, `url`, `product_image_url`.
  - Detail page: `var collectDataObject = {...}` with `City`, `Brand`, `Model`, `Serial`, `Year`, `Gear`, `Fuel`, `Km`, `Price`, `Color`, `BodyType`, plus a `.property-item` specs table (engine size, horsepower, listing date, seller type) and `googletag.pubads().setTargeting(...)` values.
- **Fields available:** listing ID, title, URL, make, model, variant, year, mileage, fuel, transmission, body type, engine size, horsepower, colour, price, currency, city, district, seller type/name, images, and source metadata.

## Candidate matrix

| Candidate | Probe | Result | Decision |
| --- | --- | --- | --- |
| Arabam HTML search page | `GET /ikinci-el/otomobil?take=50&page=N` via Impit `chrome` + residential | `200`, `insiderArray` + JSON-LD `Vehicle[]` with per-listing year/mileage/price, no Cloudflare | **Selected** |
| Arabam HTML detail page | `GET /ilan/<slug>/<id>` via Impit `chrome` + residential | `200`, `collectDataObject` + specs table + JSON-LD `Car` | **Selected** |
| `api.arabam.com/listing/v2/search` | `POST` JSON via Impit | `401 Authorization Required` (nginx) | Rejected |
| `sandbox.arabamd.com/api/v1/listing` | `GET` historical sandbox | `200` but returns a fixed static test dataset | Rejected |
| Browser rendering | Patchright Chrome | Not required once the raw HTML containers were confirmed | Rejected |

## Impit profile comparison (residential proxy)

| Browser profile | Search page result |
| --- | --- |
| `chrome` | `200`, 20 items, no challenge |
| `chrome136` | `200`, 20 items |
| `chrome142` | `200`, 20 items |
| `firefox` | `200`, 20 items |
| `firefox135` | `200`, 20 items |
| `okhttp4` | `200`, 20 items |
| `ios18` | TLS `DecodeError` through the proxy |

The default Impit `chrome` profile returns the page consistently, so the actor uses `browser: 'chrome'`. Fingerprint headers are not overridden.

## Implementation notes

The actor creates a small pool of `Impit` clients, each bound to a separate residential proxy session (distinct exit IP), and rotates them across requests. Search pages are read with `take`/`page` and parsed from the `insiderArray.push(...)` blocks, merged with the page's JSON-LD `Vehicle[]` array (listing ID, title, year, mileage, price, image, drivetrain). Each listing is then enriched by requesting its detail page and reading `collectDataObject`, the specs table, and the JSON-LD `Car` block; if a detail request fails, the search-page values are retained. The `city` filter maps a Turkish location name to its numeric province code. When keyword or location is not supplied, the category URL is used unchanged.

Per-session request rotation keeps each exit IP below the site's threshold, which removed the `429` throttling seen with a single session. A 40-detail probe across six residential sessions completed with zero `429` responses at roughly four requests per second.

Requests are paced by a shared adaptive rate limiter. Detail enrichment runs at low concurrency, and the interval between request starts widens when the site returns `429` and relaxes on success, so a run settles at a sustainable rate instead of bursting. Retries are bounded (`429`, `5xx`, network errors) with exponential backoff and jitter, and `Retry-After` is honored; permanent `4xx` responses are not retried. Every response is validated before nested access, and a listing whose detail fetch fails is still emitted with the data available from the search page. Missing values are removed recursively from each dataset item before `Actor.pushData()`.

A 200-record run against the main automobile category completed with no `429` responses and full detail enrichment for every record.

The source requires residential proxy access from the Apify platform. Direct requests from a non-residential workstation can return Cloudflare `403`, which is an edge-access limitation rather than a valid response.
