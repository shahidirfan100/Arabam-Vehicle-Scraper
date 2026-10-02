import { describe, expect, it } from 'vitest';

import { buildRecord, buildSearchUrl, cityIdFromLocation, getListingId, parseSearchItems } from '../src/parser.js';

const SEARCH_HTML = `
<script>
var insiderArray = []
try{
insiderArray.push({
                        "id": "44522709",
                        "name": "Hyundai i20 1.4 MPI Elite",
                        "taxonomy": [{"Id":18,"Name":"Otomobil"},{"Id":21621,"Name":"Hyundai"},{"Id":21736,"Name":"i20"},{"Id":1,"Name":"1.4 MPI"},{"Id":2,"Name":"Elite"}],
                        "currency": "TRY",
                        "unit_price": parseFloat(("1.364.750 TL").replace(' TL','').replace(/\\./g,'')),
                        "unit_sale_price": parseFloat(("1.364.750 TL").replace(' TL','').replace(/\\./g,'')),
                        "url": window.location.origin + "/ilan/galeriden-satilik-hyundai-i20/2021-i20/44522709",
                        "product_image_url": "https://arbstorage.mncdn.com/ilanfotograflari/2026/10/01/44522709/x_image_for_silan_44522709_580x435.jpg"
                    })
}
</script>
<script type="application/ld+json">[{"@context":"https://schema.org","@type":"Vehicle","url":"https://www.arabam.com/ilan/galeriden-satilik-hyundai-i20/2021-i20/44522709","mileageFromOdometer":{"@type":"QuantitativeValue","value":100000,"unitCode":"KMT"},"manufacturer":"Hyundai","brand":{"@type":"Brand","name":"Hyundai"},"vehicleModelDate":2021,"productionDate":2021,"name":"Hyundai i20 1.4 MPI Elite","image":"https://arbstorage.mncdn.com/ilanfotograflari/2026/10/01/44522709/x_image_for_silan_44522709_120x90.jpg","driveWheelConfiguration":"Önden Çekiş","offers":{"@type":"Offer","priceCurrency":"TRY","price":1364750,"url":"https://www.arabam.com/ilan/galeriden-satilik-hyundai-i20/2021-i20/44522709"}}]</script>`;

const DETAIL_HTML = `
<script>
var collectDataObject = {"City":"Bolu","Brand":"Hyundai","Model":"1.4 MPI Elite","Year":"2021","Gear":"Otomatik","Fuel":"Benzin","Km":"100000","Price":1364750,"Id":44522709,"Category":"Otomobil > Hyundai > i20 > 1.4 MPI > Elite","CategoryId":21736,"Serial":"i20","Color":"Kırmızı","Class":"B","BodyType":null}
</script>
<div class="property-item"><div class="property-key">Kilometre</div><div class="property-value">100.000 KM</div></div>
<div class="property-item"><div class="property-key">Motor hacmi</div><div class="property-value">1368 CC</div></div>
<div class="property-item"><div class="property-key">Motor g&#252;c&#252;</div><div class="property-value">100 HP</div></div>
<div class="property-item"><div class="property-key">Kasa tipi</div><div class="property-value">Hatchback/5</div></div>
<div class="property-item"><div class="property-key">Kimden</div><div class="property-value">Galeriden</div></div>
<div class="advert-owner-container"><div class="advert-owner-name">ÇAMLIOĞLU OTOMOTİV</div></div>
<script>googletag.pubads().setTargeting('city', 'Bolu'); googletag.pubads().setTargeting('owner', 'Galeriden');</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Car","name":"Hyundai i20","image":["https://arbstorage.mncdn.com/ilanfotograflari/2026/10/01/44522709/x_image_for_silan_44522709_580x435.jpg"]}</script>`;

describe('Arabam parser', () => {
    it('parses the search-page insiderArray blocks', () => {
        const items = parseSearchItems(SEARCH_HTML);
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            listingId: '44522709',
            title: 'Hyundai i20 1.4 MPI Elite',
            url: 'https://www.arabam.com/ilan/galeriden-satilik-hyundai-i20/2021-i20/44522709',
            make: 'Hyundai',
            model: 'i20',
            variant: '1.4 MPI Elite',
            year: 2021,
            mileage: 100000,
            price: 1364750,
            currency: 'TRY',
        });
        expect(items[0].imageUrls[0]).toContain('_1920x1080.jpg');
    });

    it('merges search data with detail collectDataObject and specs', () => {
        const [seed] = parseSearchItems(SEARCH_HTML);
        const record = buildRecord(DETAIL_HTML, seed, 'https://www.arabam.com/ikinci-el/otomobil');
        expect(record).toMatchObject({
            listingId: '44522709',
            make: 'Hyundai',
            model: 'i20',
            variant: '1.4 MPI Elite',
            year: 2021,
            mileage: 100000,
            fuelType: 'Benzin',
            transmission: 'Otomatik',
            bodyType: 'Hatchback/5',
            engineSize: 1368,
            horsePower: 100,
            color: 'Kırmızı',
            price: 1364750,
            currency: 'TRY',
            city: 'Bolu',
            sellerType: 'galeri',
            sellerName: 'ÇAMLIOĞLU OTOMOTİV',
            sourceUrl: 'https://www.arabam.com/ikinci-el/otomobil',
        });
        expect(record.imageUrls[0]).toContain('_1920x1080.jpg');
    });

    it('builds a paginated search URL with keyword and city', () => {
        const url = new URL(
            buildSearchUrl('https://www.arabam.com/ikinci-el/otomobil', {
                keyword: 'volkswagen passat',
                location: 'İstanbul',
                take: 50,
                page: 2,
            }),
        );
        expect(url.searchParams.get('searchText')).toBe('volkswagen passat');
        expect(url.searchParams.get('city')).toBe('34');
        expect(url.searchParams.get('take')).toBe('50');
        expect(url.searchParams.get('page')).toBe('2');
    });

    it('maps Turkish location names and listing IDs', () => {
        expect(cityIdFromLocation('İstanbul')).toBe(34);
        expect(cityIdFromLocation('ankara')).toBe(6);
        expect(cityIdFromLocation('34')).toBe('34');
        expect(cityIdFromLocation('nowhere')).toBeUndefined();
        expect(getListingId('https://www.arabam.com/ilan/x/44522709')).toBe('44522709');
    });
});
