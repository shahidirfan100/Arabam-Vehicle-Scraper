## What does Arabam.com Vehicle Scraper do?

Arabam.com Vehicle Scraper collects structured used vehicle listings from Arabam.com for Turkish automotive market research, price monitoring, inventory analysis, and vehicle sourcing. Provide one Arabam.com search, category, or listing URL, or use keyword and location when building a search from scratch.

Unavailable source values are omitted from each dataset item instead of being stored as `null`, making the output cleaner for JSON, CSV, Excel, and downstream data pipelines.

## Why use Arabam.com Vehicle Scraper?

- **Vehicle market research** - Gather listing titles, makes, models, years, mileage, prices, fuel types, transmissions, and locations.
- **Price monitoring** - Repeat a saved search and compare advertised prices over time.
- **Inventory analysis** - Study supply by make, model, city, year, seller type, or price range.
- **Flexible collection** - Start with an existing Arabam.com URL or combine keyword and location.
- **Controlled runs** - Limit total results and pages for predictable costs.
- **Automation-ready output** - Download datasets or connect them to APIs, schedules, webhooks, spreadsheets, and no-code workflows.

## What data can you extract from Arabam.com?

| Field          | Type             | Description                             |
| -------------- | ---------------- | --------------------------------------- |
| `listingId`    | String           | Arabam listing identifier when provided |
| `title`        | String           | Listing title                           |
| `url`          | String           | Direct listing URL or source URL        |
| `make`         | String           | Vehicle manufacturer                    |
| `model`        | String           | Vehicle model                           |
| `variant`      | String           | Trim, package, or version               |
| `year`         | Number           | Model or production year                |
| `mileage`      | Number           | Mileage in kilometres                   |
| `fuelType`     | String           | Fuel type                               |
| `transmission` | String           | Gear or transmission type               |
| `bodyType`     | String           | Body style                              |
| `engineSize`   | Number           | Engine size when published              |
| `horsePower`   | Number           | Engine power when published             |
| `color`        | String           | Vehicle colour                          |
| `price`        | Number or Object | Advertised price or source price object |
| `currency`     | String           | Currency, normally `TRY`                |
| `city`         | String           | City or source location                 |
| `district`     | String           | District when published                 |
| `sellerType`   | String           | Seller category when published          |
| `sellerName`   | String           | Seller or dealer name                   |
| `imageUrls`    | Array            | Available vehicle image URLs            |
| `scrapedAt`    | String           | Collection timestamp in ISO format      |
| `sourceUrl`    | String           | URL used to define the collection scope |

The source may provide additional fields. Those non-empty fields are retained in the dataset item so useful marketplace additions are not discarded.

## How to use Arabam.com Vehicle Scraper

1. Open the Actor in Apify Console.
2. Add an Arabam.com URL, or enter a keyword and location.
3. Set `results_wanted` and `max_pages`.
4. Use Turkish residential Apify Proxy settings when the target requires them.
5. Run the Actor and review the dataset preview.
6. Export the data or connect the dataset to your workflow.

When both a URL and search fields are supplied, the URL is used as the primary search scope. URL query parameters are preserved and take priority over the free-text fields.

The Actor reads Arabam's public search and listing pages directly with one stable connection and enriches each listing with its published specifications. No browser session is required, so runs start quickly and stay lightweight. Turkish residential proxy access is recommended so results reflect the live catalogue.

## Input Parameters

| Parameter            | Type    | Required | Default                                  | Description                                        |
| -------------------- | ------- | -------- | ---------------------------------------- | -------------------------------------------------- |
| `url`                | String  | No       | Arabam automobile category in the schema | One Arabam.com search, category, or detail URL     |
| `keyword`            | String  | No       | None                                     | Vehicle, make, or model search text                |
| `location`           | String  | No       | None                                     | City or location filter                            |
| `results_wanted`     | Integer | No       | `20`                                     | Maximum records to save                            |
| `max_pages`          | Integer | No       | `10`                                     | Maximum pages per search URL                       |
| `proxyConfiguration` | Object  | No       | Turkish residential proxy in schema      | Apify Proxy settings, including groups and country |

## Usage Examples

### Basic category collection

Collect 20 current automobile listings from the main used automobile category:

```json
{
    "url": "https://www.arabam.com/ikinci-el/otomobil",
    "results_wanted": 20,
    "max_pages": 2
}
```

### Keyword and location collection

Build a focused search for newer automatic vehicles in Istanbul:

```json
{
    "keyword": "Volkswagen Passat",
    "location": "İstanbul",
    "results_wanted": 50,
    "max_pages": 5,
    "proxyConfiguration": {
        "useApifyProxy": true,
        "apifyProxyGroups": ["RESIDENTIAL"],
        "countryCode": "TR"
    }
}
```

### Direct listing URL

Provide a public `/ilan/` URL when you need a single listing lookup. The Actor reads that listing page and saves its full published specification set as one record.

## Sample Output

```json
{
    "listingId": "44522709",
    "title": "Hyundai i20 1.4 MPI Elite",
    "url": "https://www.arabam.com/ilan/galeriden-satilik-hyundai-i20-1-4-mpi-elite/2021-i20-1-4-elite-hatasiz-ilk-el-otomatik-sunrof-18-ay-taksit/44522709",
    "make": "Hyundai",
    "model": "i20",
    "variant": "1.4 MPI Elite",
    "year": 2021,
    "mileage": 100000,
    "fuelType": "Benzin",
    "transmission": "Otomatik",
    "bodyType": "Hatchback/5",
    "engineSize": 1368,
    "horsePower": 100,
    "color": "Kırmızı",
    "price": 1364750,
    "currency": "TRY",
    "city": "Bolu",
    "district": "Merkez",
    "sellerType": "galeri",
    "sellerName": "ÇAMLIOĞLU OTOMOTİV BOLU",
    "imageUrls": ["https://arbstorage.mncdn.com/ilanfotograflari/2026/10/01/44522709/example_1920x1080.jpg"],
    "scrapedAt": "2026-10-01T15:54:00.000Z",
    "sourceUrl": "https://www.arabam.com/ikinci-el/otomobil"
}
```

## Tips for Best Results

- Start with `results_wanted: 20` and `max_pages: 2` to check the dataset shape.
- Use a complete public Arabam.com URL after applying the filters you want on the site; its query parameters are preserved.
- Page size is handled internally for efficient collection; use `max_pages` and `results_wanted` to control run size.
- Use a Turkish residential proxy when direct requests are challenged or rate limited.
- Repeat the same input on a schedule to monitor price and inventory changes.
- Optional fields differ by listing. The Actor omits unavailable values rather than filling records with empty placeholders.

## Integrations and Export Formats

- **Apify Dataset** - Download JSON, CSV, Excel, XML, and other formats.
- **Apify API** - Start runs and retrieve dataset items programmatically.
- **Google Sheets** - Send vehicle records for review and comparison.
- **Webhooks** - Notify downstream services after a run completes.
- **Make or Zapier** - Connect vehicle data to reports, CRM systems, and alerts.

## Frequently Asked Questions

### Do I need an Arabam.com account?

No. The Actor is intended for public Arabam.com search, category, and listing URLs. Access and availability still depend on the source website and its policies.

### Can I use any Arabam.com URL?

Use public search, category, and `/ilan/` detail URLs on `arabam.com` or `www.arabam.com`. URLs with filters are supported; the Actor also accepts direct URL query parameters.

### Why is a field missing?

The source does not publish every specification for every vehicle. Missing values are omitted from that item, so this is expected when a listing has incomplete public information.

### Can I collect more than 20 listings?

Yes. Increase `results_wanted` and `max_pages` gradually. A run is still limited by the number of listings available for the selected search.

### Can I export Arabam.com data to CSV or Excel?

Yes. Apify datasets support CSV, Excel, JSON, XML, and other export formats.

### Is it legal to collect Arabam.com data?

Public data collection can be subject to website terms, laws, and privacy requirements. You are responsible for using the Actor lawfully and respecting Arabam.com policies.

## Related Actors

- [Cinch.co.uk Vehicle Scraper](https://apify.com/shahidirfan/cinch-co-uk-vehicle-scraper) - Collect used car inventory and pricing data from Cinch.co.uk.
- [IAAI Vehicles Scraper](https://apify.com/shahidirfan/iaai-vehicles-scraper) - Collect vehicle auction and lot data from IAAI.

## Support

For issues or feature requests, use the Issues tab on the Actor page or contact the developer through Apify.

## Legal Notice

This Actor is designed for legitimate collection of publicly available vehicle listing data. Users are responsible for complying with applicable laws, website terms, privacy rules, and any restrictions on storing or redistributing collected data.
