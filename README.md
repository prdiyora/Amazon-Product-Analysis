# Amazon Product Analysis

Aa Chrome Manifest V3 extension Amazon India (`amazon.in`) athva USA (`amazon.com`) par 3 research modes aape chhe: current Category, Brand search ane Product search. Darek run maximum 50 unique non-sponsored products collect kari Google Sheetma `Bought Count` highest ane tie hoy tyare `Review Count` lowest orderma rows save kare chhe.

## Research modes

- `Category`: current Amazon category/listing page scrape kare chhe.
- `Brand`: brand name (jem ke `Sellbotic`) par Amazon keyword search page open kare chhe ane tena results scrape kare chhe.
- `Product`: product term (jem ke `oil sprayer`) par Amazon keyword search page open kare chhe ane tena results scrape kare chhe.

Brand ane Product mode Amazon na keyword search results use kare chhe. Amazon relevance pramane bija related products pan batavi shake chhe.

## Dynamic analysis tabs

Darek run pela user `Analysis tab name` aape chhe. Extension selected marketplace pramane suffix add kare chhe:

- `Umbrella Analysis` + India -> `Umbrella Analysis - IN`
- `Umbrella Analysis` + USA -> `Umbrella Analysis - USA`

Same analysis name fari use karsho to same ASIN latest data sathe update thase ane nava ASIN append thase. Custom analysis tabs default `Amazon Products IN/USA` tabs thi alag rahese.

## Data columns

Run timestamp, category URL/name, full category path, ASIN, title, brand, product URL, price, numeric price, currency, rating, review count, bought text/count, scrape status, error ane marketplace.

`Category Path` breadcrumb formatma save thase, jem ke `Home & Kitchen›Kitchen & Dining›Kitchen Tools›Oil Preparation & Dispensers›Oil Sprayers`.

`Bought Count` Amazon par display thata approximate text (jem ke `1K+ bought in past month`) par based chhe. Amazon aa value darek product mate batavtu nathi; eva product sortingma niche aavse.

## 1. Google Sheet ane Apps Script setup

1. Darek user mate dedicated navi Google Sheet create karo. Aa Sheetma biju important data na rakho.
2. Sheetma `Extensions > Apps Script` open karo.
3. Default code delete kari `apps-script/Code.gs` nu code paste karo.
4. Apps Script editorna function dropdownma `configureTargetSpreadsheet` select kari `Run` karo ane permissions allow karo. Aa current Sheet ID deployment mate save karse.
5. Optional security mate `Project Settings > Script Properties`ma `AZ_SCRAPER_TOKEN` property ane tamaro random token add karo.
6. `Deploy > New deployment > Web app` select karo.
7. `Execute as: Me` ane access `Anyone` set kari deploy karo.
8. Maleli `https://script.google.com/macros/s/.../exec` URL extension popupna `Apps Script Web App URL` fieldma paste karo.

Apps Script darek deploymentne `configureTargetSpreadsheet` vakhte active hati e Sheet sathe bind kare chhe. Etle alag userni alag Sheet ane alag `/exec` URL rahese. Setup vakhte fakt default `Amazon Products IN` tab banse. `Amazon Products USA` tab first USA run vakhte j banse. Custom named analysis run potana `Name - IN/USA` tabma j data lakhse.

Apps Script existing `Amazon Products IN/USA`, custom analysis ane unrelated tabs/data delete ke rename kartu nathi. Requested custom tab pehla thi unrelated headers/data sathe exist karto hoy to overwrite karvane badle clear error aapse.

Darek custom analysis tabma `ASIN` unique key chhe. Same product fari scrape thay to duplicate row add thavane badle existing row latest category, price, rating, review ane bought data sathe update thase. ASIN missing hoy to marketplace + product URL fallback unique key chhe.

Code update karya pachi existing Apps Script deploymentma `Deploy > Manage deployments > Edit > New version > Deploy` karvu jaruri chhe. Khali editor save karvathi old `/exec` deployment update nathi thatu.

## 2. Extension install

1. Aa folderma `npm install` ane `npm test` run karo.
2. Chrome ma `chrome://extensions` open karo.
3. `Developer mode` enable karo.
4. `Load unpacked` click kari aa project folder select karo.
5. Extension pin karo.

## 3. Scraping run

1. Popupma `Amazon India (.in)` ke `Amazon USA (.com)` select karo.
2. `Analysis tab name` enter karo ane live `- IN` / `- USA` tab preview check karo.
3. Potani Apps Script `/exec` URL paste karo ane token set karyo hoy to same token enter karo.
4. `Category` mode mate Amazon category page open kari `Start analysis` dabavo.
5. `Brand` athva `Product` mode mate keyword enter kari `Open Amazon search` dabavo.
6. Amazon result page open thay pachi extension popup fari open kari `Start analysis` dabavo.
7. Popup close kari shakay; fari open karta current progress dekhase.

Extension pagination follow kari 50 products collect karva try karse. Pages khuti jay to available products j upload thase. Product HTTP fetch blocked/incomplete hoy to extension ek temporary inactive tab open kari parse karse ane pote create karelo tab j close karse.

Darek 10 completed products pachi progressive save same named analysis tabma thase. Run complete thay tyare popup new/updated/failed/missing price/missing bought summary batavse ane `Open Sheet` button exact custom analysis tab kholse. Progressive save fail thay to already-saved batches safe rahese ane pending batch `Retry Upload`thi same original tabma mokli shakay.

`Open Sheet` button successful upload pachi j enable thase. Endpoint badalsho to navi deployment par successful upload thay tya sudhi old Sheet open nahi thay.

## Reliability ane limitations

- Amazon markup badlai shake chhe; selectors `src/parsers`ma centralized chhe.
- Requests low concurrency ane delay sathe chale chhe, etle 50 productsma thodo samay lagse.
- CAPTCHA/robot check bypass nathi thatu. Eva case ma run stop/fail thai shake ane Amazon tabma manual verification karvu padse.
- Logged-in account par automation mate zero-risk guarantee nathi. Separate Chrome profile/logged-out session, limited manual runs ane reasonable request volume safer chhe.
- Scraping complete pan upload fail thay to popupma `Retry Upload` thi cached rows fari mokli shakay.
- Fatal error ave to popup stage, error code, HTTP status, time ane suggested fix batavse. `Copy diagnostics` token/product payload vagar troubleshooting details copy karse.
- Individual product parse/fetch issues popupma ASIN sathe batavse ane Sheetna `Status`/`Error` columnsma pan save thase.
- Amazon terms ane applicable rules follow kari personal, reasonable-volume use karo.

## Tests

```powershell
npm test
```

Tests sanitized fixtures par sponsored exclusion, pagination, product fields, blocked-page detection, count normalization ane final sorting verify kare chhe.
