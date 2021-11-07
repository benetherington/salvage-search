/*---------------*\
  POPUP INTERFACE  
\*---------------*/
async function downloadImages(messageValue) {
    // Called from popup via background.js message handler
    console.log("Fetching images.")
    let {yardName, lotNumber} = messageValue;
    try {
        sendProgress("download", "start")
        let imageUrls = [];
        // If we know the yard, skip the other. If we don't know, try both.
        if (yardName==="copart" || !yardName) {
            imageUrls.push(... await copartImageUrlsFromLot(lotNumber))
        } else if (yardName==="iaai" || !yardName) {
            imageUrls.push(... await iaaiImageUrlsFromStock(lotNumber))
        }
        imageUrls.forEach( (url, idx) => {
            console.log(`downloading ${idx}`)
            browser.downloads.download({
                url: url,
                saveAs: false,
                filename: `${yardName}-${idx}.jpg`
            })
        })
        sendProgress("download", "end")
        sendNotification(`${imageUrls.length} images sent to downloads folder!`, {displayAs: "success"})
    } catch (error) {
        sendProgress("download", "abort")
        sendNotification(error, {displayAs: "error"})
    }
};

const Salvage = class SalvageObject {
    constructor(tabId=null, data=null) {
        this.tab = null              //
        this.salvageName = null     // Private. If getter works, lotNumber or lotNumberFetcher should also be set.
        this.lotNumber = null       // Private. Get/set lotNumber instead so that data can be persisted.
        this.lotNumberFetcher = null // A Copart, IAAI, Poctra, or BidFax function.
        this.imageInfo = null       // Private. Get/set imageInfo instead.
        this.imageInfoFetcher = null // A Copart or IAAI function.
        this.imageUrls = null       // Private. Get/set imageUrls instead.
        this.imageUrlsFetcher = null // A Copart or IAAI function.
        if (tabId) {this.setTabId(tabId)}
        if (data) {this.setData(data)}
    }
    setData(values) {
        Object.assign(this, values)
    }
    async setTabId(id) {this.tab = await browser.tabs.get(id)}
    async getSalvageName() {
        if (this.salvageName) {return this.salvageName}
        if (this.tab) {
            await this.fetchFromTab()
            return this.salvageName;
        } else {throw "no tab"}
    }
    async fetchFromTab() {
        // get salvageName as well as lotNumber or lotNumberFetcher from the tab
        if (/copart\.com/i.test(this.tab.url)) {
            this.salvageName = 'copart';
            this.lotNumberFetcher = copartLotNumbersFromTab;
        } else if (/iaai\.com/i.test(this.tab.url)) {
            this.salvageName = 'iaai';
            this.lotNumberFetcher = iaaiStockNumbersFromTab;
        } else if (/poctra\.com/i.test(this.tab.url)) {
            this.setData( await poctraLotNumbersFromTabs() )
        } else if (/bidfax\.info/i.test(this.tab.url)) {
            this.setData( await bidfaxLotNumbersFromTabs() )
        }
    }
    async getLotNumber() {
        if (this.lotNumber) {return this.lotNumber}
        if (await this.getSalvageName()) {
            this.setData( await this.lotNumberFetcher(this) )
            return this.lotNumber
        }
    }
    async getImageInfo() {
        if (this.imageInfo) {return this.imageInfo}
        if (this.imageInfoFetcher || await this.getLotNumber()) {
            this.setData( await this.imageInfoFetcher(this) )
            return this.imageInfo;
        }
    }
    async getImageUrls() {
        if (this.imageUrls) {return this.imageUrls}
        if (this.imageUrlsFetcher || await this.getImageInfo()) {
            this.setData( await this.imageUrlsFetcher(this) )
            return this.imageUrls;
        }
    }
}

async function identifySalvageTabs() {
    // get all salvage tabs
    let salvageTabs = await browser.tabs.query({
        url: [COPART_URL_PATTERN, IAAI_URL_PATTERN, POCTRA_URL_PATTERN, BIDFAX_URL_PATTERN]
    });
    // if any are active, discard all others
    let activeTabs = salvageTabs.filter(t=>t.active);
    if (activeTabs.length) { salvageTabs = activeTabs; }
    // sort decending by ID. First element will be oldest
    salvageTabs.sort( (t1, t2)=>t1.id>t2.id?-1:1 )
    return salvageTabs.map( tab=>new Salvage(tab) )
}
// function () {
//     if (!lotNumbers.some(ln=>ln.yard!="unknown")) // if we didn't get at least one solid hit
//     for (let lotNumber of lotNumbers) {
//         let urls;
//         if (lotNumber.yard==="copart") {
//             urls = await copartImageUrlsFromLot(lotNumber.number)
//         } else if (lotNumber.yard==="iaai") {
//             urls = await iaaiImageUrlsFromStock(lotNumber.number)
//         } else { console.log('lotNumber:'); console.log(lotNumber) }
//         imageUrls.push(...urls)
//     }
//     {throw "is this an archived listing for a Copart or IAAI sale? If so, please send Ben the URL. They've changed something."}
// }

/*------*\
  COPART  
\*------*/
const COPART_URL_PATTERN = "*://*.copart.com/lot/*";
// async function copartGetTabs(queryOptions={}) { // -> [objectURL]
//     Object.assign( {active:true, url:[COPART_URL_PATTERN]}, queryOptions)
//     return browser.tabs.query(...queryOptions);
// }
// async function copartLotNumbersFromTabs(copartTabOrTabs) { // => array of URLs
//     let copartTabs = Array.from(arguments).flat();
//     let lotNumbers = copartTabs.map(tab=>{
//         // can also extract more data from the title!
//         // let ymm = tab.title.match(/^(.*) for Sale/i)[1];
//         return tab.url.match(/copart\.com\/lot\/(\d*)/)[1];
//     })
//     return {yardName: 'copart', lotNumbers};
// }
async function copartLotNumbersFromTab(tabOrSalvage) {
    let copartTab;
    if (tabOrSalvage instanceof Salvage) { copartTab = tabOrSalvage.tab }
    else { copartTab = tabOrSalvage }
    let salvageName = 'copart';
    let lotMatch = copartTab.title.match(/^(.*) for Sale/i);
    let lotNumber;
    if (lotMatch) { lotNumber = lotMatch[0] }
    else {
        let framesResponses = await browser.tabs.executeScript(
            copartTab.id, {code:`document.querySelector("#lot-details .lot-number").lastChild.textContent.trim()`}
        )
        lotNumber = framesResponses[0]
    }
    let imageInfoFetcher = copartFetchImageInfoFromLotNumber
    let imageUrlsFetcher = copartImageUrlsFromInfo
    return {salvageName, lotNumber, imageInfoFetcher, imageUrlsFetcher}
}
async function copartImageUrlsFromInfo(imageInfosOrSalvage) { // => array of URLs
    // Accepts a single lot number, multiple lot numbers, or an array of lot numbers.
    let imageInfos;
    if (imageInfosOrSalvage instanceof Salvage) {
        imageInfos = [await imageInfosOrSalvage.getImageInfo()]
    } else { imageInfos = Array.from(arguments).flat(); }
    if (!imageInfos.length) {throw "no lot number provided.";}
    sendNotification(`Copart: downloading images from lot #${imageInfos.map(i=>i.lotNumber).join(", ")},`)
    // PROCESS
    let imageUrls = [];
    for (let jsn of imageInfos) {
        try {
            if (  !jsn.hasOwnProperty("returnCode")
               ||  jsn.returnCode!=1
               || !jsn.hasOwnProperty("data")
               || !jsn.data.hasOwnProperty("imagesList") )
                {throw "encountered a server error."}
            if (!jsn.data.imagesList.hasOwnProperty("HIGH_RESOLUTION_IMAGE"))
                {throw `has no high resolution images.`}
            // TODO: sometimes, imagesList has more images in FULL_RESOLUTION
            // than in HIGH_RESOLUTION. We need to go over FULL and return HIGH
            // if present, FULL if not.
            let highResImages = jsn.data.imagesList.HIGH_RESOLUTION_IMAGE.map(image=>image.url)
                imageUrls.push( ...highResImages )
        } catch (error) {throw `Copart: lot #${jsn.lotNumber} ${error}`}
    }
    return {imageUrls}
};
async function copartFetchImageInfoFromLotNumber(lotNumberOrSalvage) { // => JSON object
    let lotNumber;
    if (lotNumberOrSalvage instanceof Salvage) {
        lotNumber = await lotNumberOrSalvage.getLotNumber();
    } else { lotNumber = lotNumberOrSalvage; }
    let imagesUrl = `https://www.copart.com/public/data/lotdetails/solr/lotImages/${lotNumber}/USA`;
    let headers = { "User-Agent": window.navigator.userAgent,
                    "Accept": "application/json, text/plain, */*" }
    let response = await fetch(imagesUrl, headers)
    if (response.headers.get("content-type").startsWith("application/json")) {
        let jsn = await response.json();
        jsn.lotNumber = lotNumber;
        return jsn
    } else {
        console.log("Copart wants a CAPTCHA check")
        browser.tabs.create({url:"https://www.copart.com"})
        throw "please complete the CAPTCHA and try again."
    }
};


/*----*\
  IAAI  
\*----*/
const IAAI_URL_PATTERN = "*://*.iaai.com/*ehicle*etails*";
// async function iaaiGetTabs(queryOptions={}) { // -> [objectURL]
//     Object.assign( {active:true, url:[IAAI_URL_PATTERN]}, queryOptions)
//     return browser.tabs.query(...queryOptions);
// }
// async function iaaiStockNumbersFromTabs(iaaiTabOrTabs) { // -> [string]
//     // Gets image keys from the provided tab.
//     let iaaiTabs = Array.from(arguments).flat();
//     console.log(`iaaiStockNumbersFromTab(${iaaiTabs.map(t=>t.id)})`)
//     try {
//         let stockPromises = iaaiTabs.map(iaaiTab=>
//             browser.tabs.executeScript(
//                 iaaiTab.id, {code:`document.querySelector("#ProductDetailsVM").innerText`}
//             ).catch(()=>{ throw "there was an error communicating with the page."+
//                                 "Please reload the page and try again." })
//             .then( lastEvaluated=>JSON.parse(lastEvaluated[0]) )
//             .then( jsn=>jsn.VehicleDetailsViewModel.StockNo )
//         )
//         let stockNumbers = await Promise.all(stockPromises);
//         return {yardName: 'iaai', lotNumbers};
//     } catch {
//         throw "something went wrong getting this vehicle's stock number. Please reload the page and try again."
//     }
// }
async function iaaiStockNumbersFromTab(iaaiTabOrSalvage) { // -> [string]
    // Gets image keys from the provided tab.
    let iaaiTab;
    if (iaaiTabOrSalvage instanceof Salvage) {
        iaaiTab = iaaiTabOrSalvage.tab;
    } else { iaaiTab = iaaiTabOrSalvage }
    // try {
        let salvageName = 'iaai';
        let lotNumber = await browser.tabs.executeScript(
                iaaiTab.id, {code:`document.querySelector("#ProductDetailsVM").innerText`}
            ).catch(()=>{ throw "there was an error communicating with the page."+
                                "Please reload the page and try again." })
            .then( lastEvaluated=>JSON.parse(lastEvaluated[0]) )
            .then( jsn=>jsn.VehicleDetailsViewModel.StockNo );
        let imageInfoFetcher = iaaiFetchImageInfosFromLotNumber;
        let imageUrlsFetcher = iaaiImageUrlsFromImageInfo;
        return {salvageName, lotNumber, imageInfoFetcher, imageUrlsFetcher}
    // } catch {
    //     throw "something went wrong getting this vehicle's stock number. Please reload the page and try again."
    // }
}

// async function iaaiImageUrlsFromStockNumber(stockNumberOrNumbers) { // -> [objectURL]
//     // Accepts a single stockNumber, multiple stockNumbers, or an array of stockNumbers.
//     let stockNumbers = Array.from(arguments).flat();
//     console.log(`iaaiImageUrlsFromStock(${stockNumbers})`)
//     let imageUrls = [];
//     try {
//         // GET DETAILS
//         let lotDetails = await iaaiFetchImageInfoFromLotNumber(stockNumbers)
//         let imageCount = countImages(lotDetails)
//         await sendNotification(`IAAI: processing ${imageCount} images.`)
//         await sendProgress("download", "start", {total:imageCount})
//         // FETCH IMAGES
//         imageUrls = await iaaiImageUrlsFromImageInfo(lotDetails);
//     } catch (error) {throw `IAAI: ${error}`}
//     return imageUrls
// }
function countImages(imageDetailOrDetails){ // -> int
    let imageDetails = Array.from(arguments).flat()
    return imageDetails.reduce((total, details)=>{
        return total + details.keys.length
    }, initialValue=0)
}
// async function iaaiFetchImageInfosFromLotNumber(stockNumberOrNumbers) { //-> [ {keys:[]} ]
//     let stockNumbers;
//     if (stockNumberOrNumbers instanceof Salvage) {
//         stockNumbers = [await stockNumberOrNumbers.getLotNumber()];
//     } else {
//         stockNumbers = Array.from(arguments).flat();
//     }
//     // ENSURE TYPE
//     stockNumbers = stockNumbers.map( stockNumber=>stockNumber.toString() );
//     console.log(`iaaiFetchImageInfoFromLotNumber(${stockNumbers})`)
//     let lotPromises = stockNumbers.map( stockNumber=>{
//         // BUILD REQUEST
//         let getLotDetailsUrl = new URL("https://iaai.com/Images/GetJsonImageDimensions");
//         getLotDetailsUrl.searchParams.append(
//             'json', JSON.stringify({"stockNumber":stockNumber})
//         )
//         let headers = { "User-Agent": window.navigator.userAgent,
//                         "Accept": "application/json, text/plain, */*" };
//         // FETCH AND PARSE
//         return fetch(getLotDetailsUrl, {headers})
//             .then( response=> {
//                 if (response.ok) {return response}
//                 else {throw "server error"}
//             }).then( response=> {
//                 if (response.headers.get("content-length") > '0')
//                 {return response.json()}
//                 {throw "no images found."}
//             })
//     })
//     return Promise.all(lotPromises)
// }
async function iaaiFetchImageInfosFromLotNumber(stockNumberOrSalvage) { //-> [ {keys:[]} ]
    let stockNumber;
    if (stockNumberOrSalvage instanceof Salvage) {
        stockNumber = await stockNumberOrSalvage.getLotNumber()
    } else {
        stockNumber = stockNumberOrSalvage;
    }
    // ENSURE TYPE
    stockNumber = stockNumber.toString();
    console.log(`iaaiFetchImageInfoFromLotNumber(${stockNumber})`)
    // BUILD REQUEST
    let getLotDetailsUrl = new URL("https://iaai.com/Images/GetJsonImageDimensions");
    getLotDetailsUrl.searchParams.append(
        'json', JSON.stringify({"stockNumber":stockNumber})
    )
    let headers = { "User-Agent": window.navigator.userAgent,
                    "Accept": "application/json, text/plain, */*" };
    // FETCH AND PARSE
    let imageInfo = await fetch(getLotDetailsUrl, {headers})
        .then( response=> {
            if (response.ok) {return response}
            else {throw "server error"}
        }).then( response=> {
            if (response.headers.get("content-length") > '0') {
                return response.json()
            } else {throw "no images found."}
        })
    return {imageInfo}
}
// FOR REFERENCE
// getJsonImageDimensions returns:
// {
//     DeepZoomInd: true
//     Image360Ind: true
//     Image360Url:                   "https://spins.spincar.com/iaa-rochester/000-31355822"
//                  https://cdn.spincar.com/swipetospin-viewers/iaa-rochester/000-31355822/2021 09 28 16 53 05.CUFD0VOL/ec/0-41.jpg
//     UndercarriageInd: false
//     VRDUrl: "https://mediastorageaccountprod.blob.core.windows.net/media/31819854_VES-100_1"
//     Videos: [{…}]
//     keys: (11) [{
//         AR: 1.33,
//         ART: 1.35,
//         B: 671,
//         H: 1944,
//         I: 0,
//         IN: 1,
//         K: "31819854~SID~B671~S0~I1~RW2592~H1944~TH0",
//         S: 0,
//         SID: 31819854,
//         SN: 31355822,
//         TH: 72,
//         TW: 96,
//         W: 2592,
//     }, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}]
// }

// IMAGE PROCESSING
// These send no notifications, but they do increment the progressbar. Any
// errors are thrown without formatting.
async function iaaiImageUrlsFromImageInfo(lotInfosOrSalvage) { // -> [objectURL]
    // accepts a single imageDetails object, multiple imageDetails objects, or
    // an array of imageDetails objects
    let lotDetails;
    if (lotInfosOrSalvage instanceof Salvage) {
        lotDetails = [await lotInfosOrSalvage.getImageInfo()];
    } else {
        lotDetails = Array.from(arguments).flat();
    }
    console.log("iaaiImageUrlsFromImageInfo(...)")
    console.log(lotDetails)
    if (!lotDetails.length){return []}
    // FETCH AND PROCESS
    let processedUrls = [];
    for (let lotDetail of lotDetails) {
        let dezoomed = await iaaiFetchAndDezoom(lotDetail.keys)
        processedUrls.push(...dezoomed)
        // let {walkaroundUrls, panoUrls} = await spincarFetchDetails(lotDetail.cdn_image_prefix)
        // processedUrls.push(...pano)
        // processedUrls.push(...walkaround)
    };
    // DONE
    return {imageUrls: processedUrls}
}
const TILE_SIZE = 250;
async function iaaiFetchAndDezoom(imageKeyOrKeys) { // -> [objectURL]
    // Accepts a single keys object, multiple keys objects, or an array of keys
    // objects.
    let imageKeys = Array.from(arguments).flat()
    console.log("iaaiFetchAndDezoom(...)")
    console.log(imageKeys)
    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d")
    let processedPromises = [];
    for (let key of imageKeys) {
        processedPromises.push(new Promise(async (resolve, reject)=>{
            // PLAN
            let tileUrl = (x, y)=>`https://anvis.iaai.com/deepzoom?imageKey=${key.K}&level=12&x=${x}&y=${y}&overlap=0&tilesize=${TILE_SIZE}`;
            canvas.width  = key.W;
            canvas.height = key.H;
            let xTiles = Math.ceil(key.W / TILE_SIZE);
            let yTiles = Math.ceil(key.H / TILE_SIZE);
            let xRange = [...Array(xTiles).keys()];
            let yRange = [...Array(yTiles).keys()];
            // FETCH
            let bitmapPromises = [];
            for (let x of xRange) { for (let y of yRange){
                bitmapPromises.push(
                    fetch(tileUrl(x,y))
                    .then(r => r.blob())
                    .then(createImageBitmap)
                    .then(bmp => new Object({x,y,bmp}))
                )
            }}
            let bmpDetails = await Promise.all(bitmapPromises)
            bmpDetails.forEach(bmpDetails=>{
                let {bmp,x,y} = bmpDetails;
                ctx.drawImage(bmp,x*TILE_SIZE,y*TILE_SIZE)
            })
            let dataURL = canvas.toDataURL("image/jpeg");
            let objectURL = dataURLtoObjectURL(dataURL);
            console.log(`${key.K} processed`)
            sendProgress("download", "increment")
            resolve(objectURL)
        }))
    }
    return Promise.all(processedPromises)
}
async function spincarFetchDetails(spinUrlOrUrls) {
    let spinUrls = Array.from(arguments).flat()
    let spinPromises = spinUrls.map( async spinUrl=>{
        let spinPath = /com\/(.*)/.exec(spinUrl)[1];
        let apiUrl = "https://api.spincar.com/spin/" + spinPath;
        let headers = { "User-Agent": window.navigator.userAgent,
                       "Accept": "application/json" };
        let jsn = await fetch( apiUrl, headers )
                        .then( r=>r.json() );
        let walkaroundCount = jsn.info.options.numImgEC;
        let walkaroundUrls = [...Array(walkaroundCount).keys()].map(
            idx=>`https:${jsn.cdn_image_prefix}ec/0-${idx}.jpg`
        );
        let panoUrls = ['f', 'l', 'b', 'r', 'u', 'd'].map(
            dir=>`https:${jsn.cdn_image_prefix}pano/pano_${dir}.jpg`
        );
        return {walkaroundUrls, panoUrls}
    })
    return Promise.all(spinPromises)
}
function dataURLtoObjectURL(uri, name) { // -> objectURL
    // Takes a dataURL and turns it into a temporary object URL. This makes it
    // easier to pass around. See: https://stackoverflow.com/a/12300351
    let byteString = atob(uri.split(',')[1]);
    let mimeString = uri.split(',')[0].split(':')[1].split(';')[0]
    let ab = new ArrayBuffer(byteString.length);
    let ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    let blob = new Blob([ab], {type: mimeString});
    blob.name = name+".jpg"
    return URL.createObjectURL(blob)
};
// FOR REFERENCE
// walkaround/pano URL format is:
// https://cdn.spincar.com/swipetospin-viewers/iaa-rochester/000-31355822/20210928165305.CUFD0VOL/ec/0-49.jpg
// https://cdn.spincar.com/swipetospin-viewers/iaa-rochester/000-31355822/20210928165305.CUFD0VOL/pano/pano_u.jpg
//
// api.spincar.com/spin returns:
// {
//     "cdn_image_prefix": "//cdn.spincar.com/swipetospin-viewers/iaa-rochester/000-31355822/20210928165305.CUFD0VOL/",
//     "customer": {...},
//     "customer_name": "IAA - Rochester",
//     "enable_auction_disclaimer": true,
//     "finance_insurance_products": null,
//     "ft_locale": "en-US",
//     "ga_tracking_id": "UA-6058889-4",
//     "info": {
//       "body_type": null,
//       "created_by": "adesa@spincar.com",
//       "factory_upgrades": null,
//       "ft_locale": "en-US",
//       "is_new": false,
//       "isdamage_tags": {},
//       "last_keywords_update": "2021-10-28 14:51:18.206559",
//       "make": "Mazda",
//       "model": "CX-7",
//       "options": {
//         "additional_videos": [],
//         "closeup_tags": {},
//         "disable_autoplay": false,
//         "disable_autospin": false,
//         "disable_vr_mode": false,
//         "enable_drag_to_view_overlay": false,
//         "enable_factory_upgrades": false,
//         "enable_photo_labels": false,
//         "features_translated": [],
//         "has_custom_pano_overlay": false,
//         "has_pano": true,
//         "has_raw_pano": true,
//         "has_thumbs": true,
//         "hide_carousel": true,
//         "hide_photos": false,
//         "hotspots": [{...}],
//         "needs_assessment_quiz": false,
//         "numImgEC": 64,
//         "s3_folder": "iaa-rochester",
//         "version": "20210928165305.CUFD0VOL"
//       },
//       "stock": null,
//       "video_tour_key": null,
//       "views": {
//         "closeup": {},
//         "exterior": {
//           "has_low_res": true,
//           "source": "app"
//         },
//         "interior": {},
//         "pano": {
//           "has_low_res": true,
//           "source": "app"
//         }
//       },
//       "vin": "000-31355822",
//       "year": "2009"
//     },
//     "partner_id": 15,
//     "perf": {
//       "customer_config_cache": 27,
//       "local_info:vin": 27,
//       "total": 54,
//       "vehicle_query": 12
//     },
//     "s3_folder": "iaa-rochester",
//     "s3_prefix": "s3://swipetospin-viewers/iaa-rochester/000-31355822/",
//     "show_feature_highlights": false,
//     "show_featuretour": true,
//     "show_finance_insurance_products": false,
//     "show_finance_insurance_quiz": false,
//     "show_spin": true,
//     "thumb": "//cdn.spincar.com/swipetospin-viewers/iaa-rochester/000-31355822/20210928165305.CUFD0VOL/thumb-sm.jpg",
//     "vin": "000-31355822",
//     "wa_products": {
//       "ft": true,
//       "wa_360": true
//     }
//   }



/*------*\
  POCTRA  
\*------*/
const POCTRA_URL_PATTERN = "*://*.poctra.com/*/id-*/*";
// async function poctraLotNumbersFromTabs(poctraTabOrTabs) {
//     let poctraTabs = Array.from(arguments).flat();
//     try {
//         return await Promise.all(
//             poctraTabs.map(async poctraTab=>{
//                 let framesResults = await browser.tabs.executeScript(poctraTab.id, { code:`(${poctraGetLotNumber.toString()})()` });
//                 return framesResults[0]
//             })
//         );
//     } catch (error) {throw `Poctra: ${error}`}
// }
async function poctraLotNumbersFromTab(poctraTab) {
    try {
        let framesResults = await browser.tabs.executeScript(poctraTab.id, { code:`(${poctraGetLotNumber.toString()})()` });
        return framesResults[0]
    } catch (error) {throw `Poctra: ${error}`}
}
function poctraGetLotNumber() {
    let idElement = document.querySelector("h2");
    if (!idElement) {return null}
    let idString = idElement.innerText;
    let idMatches = /(?<type>Lot|Stock) no: (?<lotNumber>\d*)/.exec(idString);
    let type, salvageName, lotNumber;
    if (idMatches){
        ({type, lotNumber} = idMatches.groups);
        salvageName = {lot:"copart", stock:"iaai"}[type];
    } else {
        salvageName = "unknown";
    }
    
    return {salvageName, lotNumber}
}


/*------*\
  BIDFAX  
\*------*/
const BIDFAX_URL_PATTERN = "*://en.bidfax.info/*";
// async function bidfaxLotNumbersFromTabs(bidfaxTabOrTabs) {
//     let bidfaxTabs = Array.from(arguments).flat()
//     try {
//         return await Promise.all(
//             bidfaxTabs.map(async bidfaxTab=>{
//                 let framesResults = await browser.tabs.executeScript(bidfaxTab.id, { code:`(${bidfaxGetLotNumber.toString()})()` });
//                 return framesResults[0]
//             })
//         );
//     } catch (error) {throw `BidFax: ${error}`}
// }
async function bidfaxLotNumbersFromTab(bidfaxTab) {
    let framesResults = await browser.tabs.executeScript(bidfaxTab.id, { code:`(${bidfaxGetLotNumber.toString()})()` });
    return framesResults[0]
}
function bidfaxGetLotNumber() {
    // GET LOT INFO
    let infoElement = document.querySelector("#aside")
    if (!infoElement) {return null}
    // LOOK FOR CORRECT INFO
    // we're looking for bits of text like: "Auction:  IAAI" and "Lot number: 31451264"
    let yardRe = /(?<=auction:.*)iaai|copart/i;
    let yardMatch = yardRe.exec(infoElement.innerText) || ["unknown"];
    let salvageName = yardMatch[0].toLowerCase();
    
    let numberRe = /(?<=lot.*:\D*)\d+/i;
    let numberMatch = numberRe.exec(infoElement.innerText) || [undefined];
    let lotNumber = numberMatch[0]
    
    return {salvageName, lotNumber};
}


console.log("download-background loaded")
