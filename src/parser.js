export const BASE_URL = 'https://www.arabam.com';
export const DEFAULT_SEARCH_URL = `${BASE_URL}/ikinci-el/otomobil`;

const CITY_CODES = {
    adana: 1,
    adiyaman: 2,
    afyonkarahisar: 3,
    afyon: 3,
    agri: 4,
    amasya: 5,
    ankara: 6,
    antalya: 7,
    artvin: 8,
    aydin: 9,
    balikesir: 10,
    bilecik: 11,
    bingol: 12,
    bitlis: 13,
    bolu: 14,
    burdur: 15,
    bursa: 16,
    canakkale: 17,
    cankiri: 18,
    corum: 19,
    denizli: 20,
    diyarbakir: 21,
    edirne: 22,
    elazig: 23,
    erzincan: 24,
    erzurum: 25,
    eskisehir: 26,
    gaziantep: 27,
    giresun: 28,
    gumushane: 29,
    hakkari: 30,
    hatay: 31,
    isparta: 32,
    mersin: 33,
    icel: 33,
    istanbul: 34,
    izmir: 35,
    kars: 36,
    kastamonu: 37,
    kayseri: 38,
    kirklareli: 39,
    kirsehir: 40,
    kocaeli: 41,
    konya: 42,
    kutahya: 43,
    malatya: 44,
    manisa: 45,
    kahramanmaras: 46,
    maras: 46,
    mardin: 47,
    mugla: 48,
    mus: 49,
    nevsehir: 50,
    nigde: 51,
    ordu: 52,
    rize: 53,
    sakarya: 54,
    samsun: 55,
    siirt: 56,
    sinop: 57,
    sivas: 58,
    tekirdag: 59,
    tokat: 60,
    trabzon: 61,
    tunceli: 62,
    sanliurfa: 63,
    urfa: 63,
    usak: 64,
    van: 65,
    yozgat: 66,
    zonguldak: 67,
    aksaray: 68,
    bayburt: 69,
    karaman: 70,
    kirikkale: 71,
    batman: 72,
    sirnak: 73,
    bartin: 74,
    ardahan: 75,
    igdir: 76,
    yalova: 77,
    karabuk: 78,
    kilis: 79,
    osmaniye: 80,
    duzce: 81,
};

export function trimString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function numberFrom(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return undefined;
    const digits = value.replace(/[^\d-]/g, '');
    const number = Number(digits);
    return Number.isFinite(number) ? number : undefined;
}

export function firstDefined(...values) {
    for (const value of values) {
        if (value !== null && value !== undefined && value !== '') return value;
    }
    return undefined;
}

export function decodeHtmlEntities(text) {
    return String(text)
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

export function cleanText(value) {
    if (typeof value !== 'string') return undefined;
    const text = decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    return text || undefined;
}

export function cleanValue(value) {
    if (value === null || value === undefined || value === '') return undefined;
    if (Array.isArray(value)) {
        const cleaned = value.map(cleanValue).filter((item) => item !== undefined);
        return cleaned.length ? cleaned : undefined;
    }
    if (typeof value === 'object') {
        const cleaned = Object.fromEntries(
            Object.entries(value)
                .map(([key, item]) => [key, cleanValue(item)])
                .filter(([, item]) => item !== undefined),
        );
        return Object.keys(cleaned).length ? cleaned : undefined;
    }
    return value;
}

export function cleanRecord(record) {
    return cleanValue(record) || {};
}

export function getListingId(url) {
    const matches = String(url).match(/\/(\d+)(?:[/?#]|$)/g);
    return matches?.at(-1)?.match(/\d+/)?.[0] || undefined;
}

export function isArabamUrl(value) {
    try {
        const url = new URL(value);
        return ['arabam.com', 'www.arabam.com'].includes(url.hostname.toLowerCase());
    } catch {
        return false;
    }
}

export function sourceUrlsFromInput(input) {
    const values = [];
    if (typeof input.url === 'string' && input.url.trim()) values.push(input.url.trim());
    return [...new Set(values)].filter(isArabamUrl);
}

function normalizeTr(text) {
    return String(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i')
        .replace(/ş/g, 's')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9]/g, '');
}

export function cityIdFromLocation(location) {
    if (!location) return undefined;
    if (/^\d+$/.test(location.trim())) return location.trim();
    return CITY_CODES[normalizeTr(location)];
}

export function buildSearchUrl(sourceUrl, { keyword, location, take, page }) {
    const url = new URL(sourceUrl);
    url.searchParams.delete('skip');
    if (keyword) url.searchParams.set('searchText', keyword);
    const cityId = cityIdFromLocation(location);
    if (cityId) url.searchParams.set('city', String(cityId));
    url.searchParams.set('take', String(take));
    url.searchParams.set('page', String(page));
    return url.href;
}

function extractBalancedBlocks(text, marker) {
    const blocks = [];
    let cursor = 0;
    while (cursor < text.length) {
        const index = text.indexOf(marker, cursor);
        if (index === -1) break;
        let start = index + marker.length;
        while (start < text.length && /\s/.test(text[start])) start++;
        if (text[start] !== '{') {
            cursor = start + 1;
            continue;
        }
        let depth = 0;
        let quote = null;
        let escaped = false;
        let end = start;
        for (; end < text.length; end++) {
            const char = text[end];
            if (quote) {
                if (escaped) escaped = false;
                else if (char === '\\') escaped = true;
                else if (char === quote) quote = null;
                continue;
            }
            if (char === '"' || char === "'") quote = char;
            else if (char === '{') depth++;
            else if (char === '}') {
                depth--;
                if (depth === 0) break;
            }
        }
        if (end >= text.length) break;
        blocks.push(text.slice(start, end + 1));
        cursor = end + 1;
    }
    return blocks;
}

function extractBalancedObject(text, marker) {
    const [block] = extractBalancedBlocks(text, marker);
    return block;
}

function parseQuotedString(value) {
    if (typeof value !== 'string' || !value.startsWith('"')) return undefined;
    try {
        return JSON.parse(value);
    } catch {
        return undefined;
    }
}

function stringField(block, field) {
    const match = block.match(new RegExp(`"${field}"\\s*:\\s*("(?:\\\\.|[^"\\\\])*")`));
    return match ? parseQuotedString(match[1]) : undefined;
}

function taxonomyFromBlock(block) {
    const match = block.match(/"taxonomy"\s*:\s*(\[[\s\S]*?\])\s*,\s*"currency"/);
    if (!match) return [];
    try {
        const parsed = JSON.parse(match[1]);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function taxonomyNames(taxonomy) {
    return taxonomy
        .map((item) => (typeof item === 'string' ? item : item?.Name))
        .filter((name) => typeof name === 'string' && name.trim());
}

function insiderPrice(block) {
    const fromExpression = block.match(/"unit_price"\s*:\s*parseFloat\(\(\s*("(?:\\.|[^"\\])*")\s*\)/);
    if (fromExpression) return numberFrom(parseQuotedString(fromExpression[1]));
    const numeric = block.match(/"unit_price"\s*:\s*(\d+(?:\.\d+)?)/);
    return numeric ? Number(numeric[1]) : undefined;
}

function insiderUrl(block) {
    const relative = block.match(/"url"\s*:\s*window\.location\.origin\s*\+\s*("(?:\\.|[^"\\])*")/);
    if (relative) {
        const path = parseQuotedString(relative[1]);
        return path ? `${BASE_URL}${path}` : undefined;
    }
    const absolute = block.match(/"url"\s*:\s*("(?:\\.|[^"\\])*")/);
    const value = absolute ? parseQuotedString(absolute[1]) : undefined;
    if (!value) return undefined;
    return value.startsWith('http') ? value : `${BASE_URL}${value}`;
}

function parseVehicleLookup(html) {
    const byUrl = new Map();
    const byId = new Map();
    for (const node of parseJsonLd(html)) {
        if (node?.['@type'] !== 'Vehicle') continue;
        if (node.url) {
            byUrl.set(node.url, node);
            const id = getListingId(node.url);
            if (id) byId.set(id, node);
        }
    }
    return { byUrl, byId };
}

function vehicleYear(vehicle) {
    return firstDefined(vehicle?.vehicleModelDate, vehicle?.productionDate, vehicle?.modelDate);
}

function vehicleMileage(vehicle) {
    const value = vehicle?.mileageFromOdometer;
    if (value && typeof value === 'object') return firstDefined(value.value, value);
    return value;
}

export function parseSearchItems(html) {
    const { byUrl, byId } = parseVehicleLookup(html);
    return extractBalancedBlocks(html, 'insiderArray.push(')
        .map((block) => {
            const names = taxonomyNames(taxonomyFromBlock(block));
            const image = stringField(block, 'product_image_url');
            const listingId = stringField(block, 'id');
            const url = insiderUrl(block);
            const vehicle = byUrl.get(url) || (listingId ? byId.get(listingId) : undefined);
            const vehicleImage = vehicle?.image;
            let imageUrls = [];
            if (Array.isArray(vehicleImage)) imageUrls = vehicleImage;
            else if (vehicleImage) imageUrls = [vehicleImage];
            else if (image) imageUrls = [image];
            return cleanRecord({
                listingId,
                title: stringField(block, 'name') || vehicle?.name,
                url,
                make: names[1] || vehicle?.brand?.name || vehicle?.manufacturer,
                model: names[2],
                variant: names.slice(3).join(' ') || undefined,
                year: numberFrom(vehicleYear(vehicle)),
                mileage: numberFrom(vehicleMileage(vehicle)),
                drivetrain: vehicle?.driveWheelConfiguration,
                price: firstDefined(numberFrom(vehicle?.offers?.price), insiderPrice(block)),
                currency: vehicle?.offers?.priceCurrency || stringField(block, 'currency') || 'TRY',
                imageUrls: imageUrls.map(fullSizeImage),
            });
        })
        .filter((item) => item.listingId || item.url);
}

function parseCollectData(html) {
    const literal = extractBalancedObject(html, 'collectDataObject = ');
    if (!literal) return {};
    try {
        return JSON.parse(literal);
    } catch {
        return {};
    }
}

function parseSpecs(html) {
    const specs = {};
    const pattern =
        /class="[^"]*property-key[^"]*"[^>]*>([\s\S]*?)<\/(?:div|dt|span|th)>[\s\S]{0,400}?class="[^"]*property-value[^"]*"[^>]*>([\s\S]*?)<\/(?:div|dd|span|td)>/g;
    let match;
    while ((match = pattern.exec(html))) {
        const key = cleanText(match[1]);
        const value = cleanText(match[2]);
        if (key && value) specs[key] = value;
    }
    return specs;
}

function parseGtmTargeting(html) {
    const targeting = {};
    const pattern = /setTargeting\(['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\)/g;
    let match;
    while ((match = pattern.exec(html))) {
        targeting[match[1]] = decodeHtmlEntities(match[2]);
    }
    return targeting;
}

function parseJsonLd(html) {
    const nodes = [];
    const pattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
    let match;
    while ((match = pattern.exec(html))) {
        try {
            const parsed = JSON.parse(match[1]);
            nodes.push(...(Array.isArray(parsed) ? parsed : [parsed]));
        } catch {
            // Ignore malformed JSON-LD blocks.
        }
    }
    return nodes;
}

function specValue(specs, ...keys) {
    const lower = new Map(Object.entries(specs).map(([key, value]) => [key.toLowerCase(), value]));
    for (const key of keys) {
        const value = lower.get(key.toLowerCase());
        if (value) return value;
    }
    return undefined;
}

function sellerTypeFromText(...values) {
    const text = values.filter(Boolean).join(' ').toLowerCase();
    if (!text) return undefined;
    if (text.includes('yetkili') || text.includes('bayi')) return 'yetkili_bayi';
    if (text.includes('galeri')) return 'galeri';
    if (text.includes('sahibinden') || text.includes('bireysel')) return 'sahibinden';
    return undefined;
}

function fullSizeImage(url) {
    return typeof url === 'string' ? url.replace(/_\d+x\d+\./, '_1920x1080.') : url;
}

export function buildRecord(html, seed, sourceUrl) {
    const collect = parseCollectData(html);
    const specs = parseSpecs(html);
    const gtm = parseGtmTargeting(html);
    const jsonLd = parseJsonLd(html);
    const car = jsonLd.find((node) => node?.['@type'] === 'Car') || {};
    const locationMatch = html.match(/class="[^"]*product-location[^"]*"[^>]*>([\s\S]*?)<\/(?:div|span|a)>/);
    const locationText = cleanText(locationMatch?.[1]);
    let district;
    if (locationText) {
        const parts = locationText.split(/[,/]/).map((part) => part.trim()).filter(Boolean);
        if (parts.length > 1) district = parts.at(-2);
    }
    const sellerName = cleanText(
        html.match(/class="[^"]*advert-owner-name[^"]*"[^>]*>([\s\S]*?)<\//)?.[1],
    );
    const sellerMember = cleanText(
        html.match(/class="[^"]*advert-owner-memberType[^"]*"[^>]*>([\s\S]*?)<\//)?.[1],
    );
    let images = [];
    if (Array.isArray(car.image)) images = car.image;
    else if (car.image) images = [car.image];
    images = images.map(fullSizeImage);
    const heading = cleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]);
    const make = firstDefined(seed.make, collect.Brand, specValue(specs, 'Marka'), gtm.brand);
    const model = firstDefined(seed.model, collect.Serial, specValue(specs, 'Seri'), gtm.model);
    const variant = firstDefined(
        seed.variant,
        specValue(specs, 'Model'),
        collect.Model !== model ? collect.Model : undefined,
    );

    return cleanRecord({
        ...seed,
        listingId: firstDefined(seed.listingId, collect.Id)?.toString(),
        title: firstDefined(
            seed.title,
            heading,
            car.name,
            cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]),
        ),
        url: firstDefined(seed.url, sourceUrl),
        make,
        model,
        variant,
        year: numberFrom(
            firstDefined(collect.Year, specValue(specs, 'Yıl', 'Model Yılı'), gtm.year, seed.year),
        ),
        mileage: numberFrom(
            firstDefined(collect.Km, specValue(specs, 'Kilometre', 'km'), gtm.kilometer, seed.mileage),
        ),
        fuelType: firstDefined(collect.Fuel, specValue(specs, 'Yakıt tipi', 'Yakıt'), gtm.fuel),
        transmission: firstDefined(
            collect.Gear,
            specValue(specs, 'Vites tipi', 'Vites'),
            gtm.gear,
        ),
        bodyType: firstDefined(collect.BodyType, specValue(specs, 'Kasa tipi', 'Kasa'), gtm.bodyType),
        engineSize: numberFrom(specValue(specs, 'Motor hacmi', 'Motor')),
        horsePower: numberFrom(specValue(specs, 'Motor gücü', 'Motor Gücü', 'Beygir gücü')),
        color: firstDefined(collect.Color, specValue(specs, 'Renk', 'Dış Renk'), gtm.color),
        price: firstDefined(numberFrom(collect.Price), seed.price),
        currency: seed.currency || 'TRY',
        city: firstDefined(collect.City, gtm.city, locationText?.split(/[,/]/).at(-1)?.trim()),
        district,
        sellerType: sellerTypeFromText(
            sellerMember,
            gtm.owner,
            specValue(specs, 'Kimden'),
            seed.url,
        ),
        sellerName,
        imageUrls: images.length ? images : seed.imageUrls,
        scrapedAt: new Date().toISOString(),
        sourceUrl,
    });
}
