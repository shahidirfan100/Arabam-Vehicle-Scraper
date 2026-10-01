import { Actor, log } from 'apify';
import { Impit } from 'impit';

import {
    buildRecord,
    buildSearchUrl,
    cityIdFromLocation,
    cleanRecord,
    DEFAULT_SEARCH_URL,
    getListingId,
    parseSearchItems,
    sourceUrlsFromInput,
    trimString,
} from './parser.js';

const MAX_ATTEMPTS = 5;
const PAGE_SIZE = 50;
const DETAIL_CONCURRENCY = 2;
const REQUEST_BASE_INTERVAL_MS = 600;
const REQUEST_MAX_INTERVAL_MS = 10_000;
const MAX_RETRY_DELAY_MS = 30_000;
const REQUEST_HEADERS = { 'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8' };

await Actor.init();

class HttpStatusError extends Error {
    constructor(url, status) {
        super(`HTTP ${status} from ${url}`);
        this.name = 'HttpStatusError';
        this.status = status;
        this.url = url;
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function asPositiveInteger(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function retryDelay(attempt, baseMs = 1000) {
    const exponential = Math.min(MAX_RETRY_DELAY_MS, baseMs * 2 ** (attempt - 1));
    return exponential + Math.floor(Math.random() * 500);
}

function createAdaptiveRateLimiter(baseIntervalMs, maxIntervalMs) {
    let interval = baseIntervalMs;
    let nextAllowed = 0;
    return {
        acquire: async () => {
            const now = Date.now();
            const waitMs = Math.max(0, nextAllowed - now);
            nextAllowed = Math.max(now, nextAllowed) + interval;
            if (waitMs > 0) await sleep(waitMs);
        },
        onRateLimit: () => {
            interval = Math.min(maxIntervalMs, Math.round(interval * 1.5));
        },
        onSuccess: () => {
            interval = Math.max(baseIntervalMs, Math.round(interval * 0.98));
        },
        getInterval: () => interval,
    };
}

async function fetchText(client, url, rateLimit) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (rateLimit) await rateLimit.acquire();
        let response;
        try {
            response = await client.fetch(url, { headers: REQUEST_HEADERS });
        } catch (error) {
            if (attempt === MAX_ATTEMPTS) throw error;
            const wait = retryDelay(attempt);
            log.warning(`Request error for ${url}: ${error.message}; retrying in ${wait}ms`);
            await sleep(wait);
            continue;
        }
        if (response.status === 429) {
            if (attempt === MAX_ATTEMPTS) throw new HttpStatusError(url, 429);
            if (rateLimit) rateLimit.onRateLimit();
            const retryAfter = Number(response.headers?.get?.('retry-after'));
            const wait =
                Number.isFinite(retryAfter) && retryAfter > 0
                    ? Math.min(retryAfter * 1000, MAX_RETRY_DELAY_MS)
                    : retryDelay(attempt, 2000);
            log.warning(
                `Rate limited (429) on ${url}; waiting ${wait}ms (attempt ${attempt}/${MAX_ATTEMPTS}, interval ${rateLimit?.getInterval?.()}ms)`,
            );
            await sleep(wait);
            continue;
        }
        if (response.status >= 500) {
            if (attempt === MAX_ATTEMPTS) throw new HttpStatusError(url, response.status);
            const wait = retryDelay(attempt);
            log.warning(`Server error ${response.status} on ${url}; retrying in ${wait}ms`);
            await sleep(wait);
            continue;
        }
        if (!response.ok) throw new HttpStatusError(url, response.status);
        const text = await response.text();
        if (!text || text.length < 200) throw new Error(`Empty response from ${url}`);
        if (rateLimit) rateLimit.onSuccess();
        return text;
    }
    throw new Error(`Request failed after ${MAX_ATTEMPTS} attempts: ${url}`);
}

function dedupe(items) {
    const seen = new Set();
    return items.filter((item) => {
        const key = item.listingId || item.url || JSON.stringify(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function mapWithConcurrency(items, limit, mapper) {
    const results = new Array(items.length);
    let index = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (index < items.length) {
            const current = index++;
            results[current] = await mapper(items[current]);
        }
    });
    await Promise.all(workers);
    return results;
}

const input = (await Actor.getInput()) || {};
const resultsWanted = asPositiveInteger(input.results_wanted, 20);
const maxPages = asPositiveInteger(input.max_pages, 10);
const take = PAGE_SIZE;
const keyword = trimString(input.keyword);
const location = trimString(input.location);
const urls = sourceUrlsFromInput(input);
const sources = urls.length ? urls : [DEFAULT_SEARCH_URL];
const useSearchFields = urls.length === 0;
const activeKeyword = useSearchFields ? keyword : undefined;
const activeLocation = useSearchFields ? location : undefined;

if (activeLocation && !cityIdFromLocation(activeLocation)) {
    log.warning(`Unrecognized location "${activeLocation}"; running without a city filter.`);
}

const proxyConfig = input.proxyConfiguration;
const isApifyCloud = Actor.isAtHome();
const useApifyProxy = Boolean(proxyConfig?.useApifyProxy);
const hasCustomProxy = Array.isArray(proxyConfig?.proxyUrls) && proxyConfig.proxyUrls.length > 0;
const proxyConfiguration =
    (isApifyCloud && useApifyProxy) || hasCustomProxy
        ? await Actor.createProxyConfiguration(proxyConfig)
        : undefined;
const proxyUrl = proxyConfiguration ? await proxyConfiguration.newUrl(`arabam_${Date.now()}`) : undefined;
const client = new Impit({ browser: 'chrome', ...(proxyUrl && { proxyUrl }) });
const rateLimit = createAdaptiveRateLimiter(REQUEST_BASE_INTERVAL_MS, REQUEST_MAX_INTERVAL_MS);

log.info(
    `Starting Arabam.com HTML extraction | sources=${sources.length} | results=${resultsWanted} | maxPages=${maxPages}`,
);

let saved = 0;
let pagesProcessed = 0;
const seen = new Set();

for (const sourceUrl of sources) {
    if (saved >= resultsWanted) break;
    const detailId = getListingId(sourceUrl);

    if (detailId && /\/ilan\//i.test(sourceUrl)) {
        try {
            const html = await fetchText(client, sourceUrl, rateLimit);
            const record = buildRecord(html, { listingId: detailId, url: sourceUrl }, sourceUrl);
            await Actor.pushData(record);
            saved++;
            log.info(`Saved 1 detail record. Total ${saved}/${resultsWanted}`);
        } catch (error) {
            log.error(`Detail request failed for ${sourceUrl}: ${error.message}`);
        }
        continue;
    }

    for (let page = 1; page <= maxPages && saved < resultsWanted; page++) {
        const searchUrl = buildSearchUrl(sourceUrl, {
            keyword: activeKeyword,
            location: activeLocation,
            take,
            page,
        });
        let items;
        try {
            const html = await fetchText(client, searchUrl, rateLimit);
            items = parseSearchItems(html);
            pagesProcessed++;
        } catch (error) {
            log.error(`Search request failed (${searchUrl}): ${error.message}`);
            break;
        }

        if (!items.length) {
            log.info(`No listings found on page ${page}; stopping pagination.`);
            break;
        }

        const wanted = items.slice(0, resultsWanted - saved);
        const records = await mapWithConcurrency(wanted, DETAIL_CONCURRENCY, async (item) => {
            if (!item.url) return item;
            try {
                const html = await fetchText(client, item.url, rateLimit);
                return buildRecord(html, item, sourceUrl);
            } catch (error) {
                log.warning(`Detail enrichment failed for ${item.url}: ${error.message}`);
                return cleanRecord({ ...item, scrapedAt: new Date().toISOString(), sourceUrl });
            }
        });

        const batch = dedupe(records)
            .filter((item) => {
                const key = item.listingId || item.url;
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, resultsWanted - saved);

        if (batch.length) {
            await Actor.pushData(batch);
            saved += batch.length;
            log.info(`Saved ${batch.length} records from page ${page}. Total ${saved}/${resultsWanted}`);
        }

        if (items.length < take) break;
    }
}

log.info(`Finished | saved=${saved} | pages=${pagesProcessed} | finalInterval=${rateLimit.getInterval()}ms`);
if (saved === 0) {
    throw new Error('No records were saved. Check the Arabam URL, filters, and Turkish proxy access.');
}
await Actor.exit();
