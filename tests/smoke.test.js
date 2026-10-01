import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const schema = JSON.parse(await readFile(new URL('../.actor/input_schema.json', import.meta.url), 'utf8'));
const input = JSON.parse(await readFile(new URL('../INPUT.json', import.meta.url), 'utf8'));
const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const parser = await readFile(new URL('../src/parser.js', import.meta.url), 'utf8');

describe('Arabam actor contract', () => {
    it('keeps the input schema simple and credential-free', () => {
        expect(schema.properties).toHaveProperty('url');
        expect(schema.properties).toHaveProperty('keyword');
        expect(schema.properties).toHaveProperty('location');
        expect(schema.properties).toHaveProperty('results_wanted');
        expect(schema.properties).toHaveProperty('max_pages');
        expect(schema.properties).not.toHaveProperty('startUrls');
        expect(schema.properties).not.toHaveProperty('apiKey');
        expect(schema.properties).not.toHaveProperty('filters');
        expect(schema.properties).not.toHaveProperty('take');
        expect(schema.properties.results_wanted).not.toHaveProperty('maximum');
        expect(schema.properties.max_pages).not.toHaveProperty('maximum');
    });

    it('uses the fallback input file with a valid category URL', () => {
        expect(new URL(input.url).hostname).toBe('www.arabam.com');
        expect(input.url).toContain('/ikinci-el/otomobil');
        expect(input.results_wanted).toBeGreaterThan(0);
        expect(input.max_pages).toBeGreaterThan(0);
    });

    it.each([
        'https://www.arabam.com/ikinci-el/otomobil',
        'https://www.arabam.com/ikinci-el/otomobil/volkswagen-passat?days=30&sort=startedAt.desc',
        'https://www.arabam.com/ilan/galeriden-satilik-volkswagen-passat/39355250',
    ])('accepts Arabam URL pattern %s', (url) => {
        const parsed = new URL(url);
        expect(['arabam.com', 'www.arabam.com']).toContain(parsed.hostname);
    });

    it('uses HTTP-only extraction with impit', () => {
        expect(source).toContain("from 'impit'");
        expect(source).not.toContain("from 'patchright'");
        expect(source).not.toContain("from 'playwright'");
        expect(source).not.toContain("from 'cheerio'");
        expect(source).not.toContain("from 'got-scraping'");
        expect(source).not.toContain('document.querySelector');
    });

    it('reads the server-rendered Arabam data containers', () => {
        expect(parser).toContain('insiderArray.push(');
        expect(parser).toContain('collectDataObject');
    });
});
