# Arabam.com API Discovery

## Selected source

- **Search pages:** `https://www.arabam.com/ikinci-el/otomobil?take=50&page=N`
- **Detail pages:** `https://www.arabam.com/ilan/<slug>/<id>`
- **Method:** `GET` with Impit (`browser: 'chrome'`) through a Turkish residential proxy.
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
| Arabam HTML search page | `GET /ikinci-el/otomobil?take=50&page=N` via Impit `chrome` + TR residential | `200`, `insiderArray` with 20-50 items per page, no Cloudflare | **Selected** |
| Arabam HTML detail page | `GET /ilan/<slug>/<id>` via Impit `chrome` + TR residential | `200`, `collectDataObject` + specs table + JSON-LD `Car` | **Selected** |
| `api.arabam.com/listing/v2/search` | `POST` JSON via Impit | `401 Authorization Required` (nginx) | Rejected |
| `sandbox.arabamd.com/api/v1/listing` | `GET` historical sandbox | `200` but returns a fixed static test dataset | Rejected |
| Browser rendering | Patchright Chrome | Not required once the raw HTML containers were confirmed | Rejected |

## Impit profile comparison (TR residential proxy)

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

The actor creates one shared `Impit` client for the whole run and reuses it. Search pages are read with `take`/`page` and parsed from the `insiderArray.push(...)` blocks. Each listing is then enriched by requesting its detail page and reading `collectDataObject`, the specs table, and the JSON-LD `Car` block. The `city` filter maps a Turkish location name to its numeric province code. When keyword or location is not supplied, the category URL is used unchanged.

Requests are paced by a shared adaptive rate limiter. Detail enrichment runs at low concurrency, and the interval between request starts widens when the site returns `429` and relaxes on success, so a run settles at a sustainable rate instead of bursting. Retries are bounded (`429`, `5xx`, network errors) with exponential backoff and jitter, and `Retry-After` is honored; permanent `4xx` responses are not retried. Every response is validated before nested access, and a listing whose detail fetch fails is still emitted with the data available from the search page. Missing values are removed recursively from each dataset item before `Actor.pushData()`.

A 200-record run against the main automobile category completed with no `429` responses and full detail enrichment for every record.

The source requires Turkish residential proxy access from the Apify platform. Direct requests from a non-Turkish workstation return Cloudflare `403`, which is an edge-access limitation rather than a valid response.
