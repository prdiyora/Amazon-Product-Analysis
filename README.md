# Amazon Product Analysis

Aa Chrome Manifest V3 extension selected Amazon India (`amazon.in`) athva USA (`amazon.com`) ni current category/search listing mathi maximum 50 unique non-sponsored products collect kare chhe. Product details fetch kari Google Sheetma `Bought Count` highest ane tie hoy tyare `Review Count` lowest orderma rows save kare chhe.

## Data columns

Run timestamp, category URL/name, full category path, ASIN, title, brand, product URL, price, numeric price, currency, rating, review count, bought text/count, scrape status, error ane marketplace.

`Category Path` breadcrumb formatma save thase, jem ke `Home & Kitchen›Kitchen & Dining›Kitchen Tools›Oil Preparation & Dispensers›Oil Sprayers`.

`Bought Count` Amazon par display thata approximate text (jem ke `1K+ bought in past month`) par based chhe. Amazon aa value darek product mate batavtu nathi; eva product sortingma niche aavse.

## 1. Google Sheet ane Apps Script setup

1. Navi Google Sheet create karo.
2. Sheetma `Extensions > Apps Script` open karo.
3. Default code delete kari `apps-script/Code.gs` nu code paste karo.
4. Optional security mate `Project Settings > Script Properties`ma `AZ_SCRAPER_TOKEN` property ane tamaro random token add karo.
5. `Deploy > New deployment > Web app` select karo.
6. `Execute as: Me` ane required access `Anyone` set kari deploy karo.
7. Maleli `https://script.google.com/macros/s/.../exec` URL copy karo.

Apps Script India mate `Amazon Products IN` ane USA mate `Amazon Products USA` tabs automatic create karse. Web App URL private rakhvi. Shared token accidental writes ochha kare chhe, pan publicly distributed extension mate complete authentication nathi.

Apps Script exact Spreadsheet ID `12JfxDejTWTMsOUlnVANQsnjsIg27UE82_9KuFbeZq-k` par locked chhe. Product URL host server-side validate thay chhe, etle `amazon.com` product India tabma ane `amazon.in` product USA tabma save nahi thai shake.

### One-time fresh Sheet reset

Aa update deploy karya pachi first scrape Spreadsheetna **badha old tabs/data ek var permanently delete** kari only `Amazon Products IN` ane `Amazon Products USA` clean tabs headers sathe create karse. Reset schema version Script Propertiesma mark thay chhe, etle pachhina runs data delete nahi kare.

Futurema fari manual fresh reset joie to Apps Script editorna function dropdownma `resetProductSheets` select kari **Run** karo. Aa function badha tabs/data permanently delete kari only clean IN/USA tabs recreate kare chhe.

Darek marketplace tabma `ASIN` unique key chhe. Same product fari scrape thay to duplicate row add thavane badle existing row latest category, price, rating, review ane bought data sathe update thase. Same ASIN India ane USA mate respective separate tabsma rahese. ASIN missing hoy to marketplace + product URL fallback unique key chhe.

Code update karya pachi existing Apps Script deploymentma `Deploy > Manage deployments > Edit > New version > Deploy` karvu jaruri chhe. Khali editor save karvathi old `/exec` deployment update nathi thatu.

## 2. Extension install

1. Aa folderma `npm install` ane `npm test` run karo.
2. Chrome ma `chrome://extensions` open karo.
3. `Developer mode` enable karo.
4. `Load unpacked` click kari aa project folder select karo.
5. Extension pin karo.

## 3. Scraping run

1. Popupma `Amazon India (.in)` ke `Amazon USA (.com)` select karo.
2. Selected marketplace par category ke search listing open karo.
3. Extension popupma Apps Script `/exec` URL paste karo.
4. Script property set kari hoy to same shared token enter karo.
5. `Start Scraping` dabavo.
6. Popup close kari shakay; fari open karta current progress dekhase.

Extension pagination follow kari 50 products collect karva try karse. Pages khuti jay to available products j upload thase. Product HTTP fetch blocked/incomplete hoy to extension ek temporary inactive tab open kari parse karse ane pote create karelo tab j close karse.

Darek 10 completed products pachi progressive Sheet save thase. Run complete thay tyare popup new/updated/failed/missing price/missing bought summary batavse ane `Open Sheet` button direct respective India/USA tab kholse. Progressive save fail thay to already-saved batches Sheetma safe rahese ane pending batch `Retry Upload`thi mokli shakay.

`Open Sheet` button hamesha visible chhe ane default project Google Sheet khole chhe. Successful run pachi Apps Script exact IN/USA tab URL aape to button e specific tab kholse.

## Reliability ane limitations

- Amazon markup badlai shake chhe; selectors `src/parsers`ma centralized chhe.
- Requests low concurrency ane delay sathe chale chhe, etle 50 productsma thodo samay lagse.
- CAPTCHA/robot check bypass nathi thatu. Eva case ma run stop/fail thai shake ane Amazon tabma manual verification karvu padse.
- Logged-in account par automation mate zero-risk guarantee nathi. Separate Chrome profile/logged-out session, limited manual runs ane reasonable request volume safer chhe.
- Scraping complete pan upload fail thay to popupma `Retry Upload` thi cached rows fari mokli shakay.
- Amazon terms ane applicable rules follow kari personal, reasonable-volume use karo.

## Tests

```powershell
npm test
```

Tests sanitized fixtures par sponsored exclusion, pagination, product fields, blocked-page detection, count normalization ane final sorting verify kare chhe.
