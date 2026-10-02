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
const PROXY_SESSION_COUNT = 16;
const REQUEST_TIMEOUT_MS = 30_000;
const VALIDATION_TIMEOUT_MS = 12_000;
const MAX_RETRY_DELAY_MS = 20_000;
const NON_RETRYABLE_STATUS = new Set([400, 401, 404, 410, 422]);
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

async function fetchText(clients, baseIndex, url) {
    let lastError;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const client = clients[(baseIndex + attempt) % clients.length];
        try {
            const response = await client.fetch(url, {
                headers: REQUEST_HEADERS,
                timeout: REQUEST_TIMEOUT_MS,
            });
            if (response.status === 429 || response.status >= 500) {
                const retryAfter = Number(response.headers?.get?.('retry-after'));
                const wait =
                    Number.isFinite(retryAfter) && retryAfter > 0
                        ? Math.min(retryAfter * 1000, MAX_RETRY_DELAY_MS)
                        : retryDelay(attempt + 1);
                if (attempt === MAX_ATTEMPTS - 1) throw new HttpStatusError(url, response.status);
                log.debug(`HTTP ${response.status} on ${url}; retrying in ${wait}ms`);
                await sleep(wait);
                continue;
            }
            if (!response.ok) throw new HttpStatusError(url, response.status);
            const text = await response.text();
            if (!text || text.length < 200) throw new Error(`Empty response from ${url}`);
            return text;
        } catch (error) {
            lastError = error;
            if (error instanceof HttpStatusError && NON_RETRYABLE_STATUS.has(error.status)) throw error;
            if (attempt === MAX_ATTEMPTS - 1) throw error;
            const wait = retryDelay(attempt + 1);
            log.debug(`Request error for ${url}: ${error.message}; retrying in ${wait}ms`);
            await sleep(wait);
        }
    }
    throw lastError || new Error(`Request failed after ${MAX_ATTEMPTS} attempts: ${url}`);
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

async function enrichWithClients(items, clients, mapper) {
    const results = new Array(items.length);
    let index = 0;
    const workerCount = Math.min(clients.length, items.length) || 1;
    const workers = Array.from({ length: workerCount }, (_, workerId) =>
        (async () => {
            while (index < items.length) {
                const current = index++;
                results[current] = await mapper(items[current], workerId);
            }
        })(),
    );
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
    log.info(`Unrecognized location "${activeLocation}"; running without a city filter.`);
}

const proxyConfig = input.proxyConfiguration;
const isApifyCloud = Actor.isAtHome();
const useApifyProxy = Boolean(proxyConfig?.useApifyProxy);
const hasCustomProxy = Array.isArray(proxyConfig?.proxyUrls) && proxyConfig.proxyUrls.length > 0;
const proxyConfiguration =
    (isApifyCloud && useApifyProxy) || hasCustomProxy
        ? await Actor.createProxyConfiguration(proxyConfig)
        : undefined;

let sessionUrls = [undefined];
if (proxyConfiguration) {
    sessionUrls = await Promise.all(
        Array.from({ length: PROXY_SESSION_COUNT }, (_, index) =>
            proxyConfiguration.newUrl(`arabam_${Date.now()}_${index}`),
        ),
    );
}
const allClients = sessionUrls.map((url) => new Impit({ browser: 'chrome', ...(url && { proxyUrl: url }) }));

async function isClientHealthy(client) {
    try {
        const response = await client.fetch(`${DEFAULT_SEARCH_URL}?take=1&page=1`, {
            headers: REQUEST_HEADERS,
            timeout: VALIDATION_TIMEOUT_MS,
        });
        return response.status === 200;
    } catch {
        return false;
    }
}

let clients = allClients;
if (allClients.length > 1) {
    const health = await Promise.all(allClients.map(isClientHealthy));
    const healthy = allClients.filter((_, index) => health[index]);
    if (healthy.length) clients = healthy;
    log.info(`Healthy proxy sessions: ${clients.length}/${allClients.length}`);
}

log.info(
    `Starting Arabam.com HTML extraction | sources=${sources.length} | results=${resultsWanted} | maxPages=${maxPages} | clients=${clients.length}`,
);

let saved = 0;
let pagesProcessed = 0;
const seen = new Set();

for (const sourceUrl of sources) {
    if (saved >= resultsWanted) break;
    const detailId = getListingId(sourceUrl);

    if (detailId && /\/ilan\//i.test(sourceUrl)) {
        try {
            const html = await fetchText(clients, 0, sourceUrl);
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
            const html = await fetchText(clients, 0, searchUrl);
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
        const records = await enrichWithClients(wanted, clients, async (item, workerId) => {
            if (!item.url) return item;
            try {
                const html = await fetchText(clients, workerId, item.url);
                return buildRecord(html, item, sourceUrl);
            } catch (error) {
                log.debug(`Detail enrichment skipped for ${item.url}: ${error.message}`);
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

log.info(`Finished | saved=${saved} | pages=${pagesProcessed}`);
if (saved === 0) {
    throw new Error('No records were saved. Check the Arabam URL, filters, and Turkish proxy access.');
}
await Actor.exit();
