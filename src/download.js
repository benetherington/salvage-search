/*---------------*\
  POPUP INTERFACE  
\*---------------*/
async function downloadImages(vehicleData) {
    // Called from popup via background.js message handler
    console.log("Fetching images.")
    console.log('vehicleData:'); console.log(vehicleData)
    try {
        sendProgress("download", "start")
        console.log("awaiting vd.getImageUrls")
        let imageUrls = await vehicleData.getImageUrls()
        imageUrls.forEach( (url, idx) => {
            console.log(`downloading ${idx}`)
            browser.downloads.download({
                url: url,
                saveAs: false,
                filename: `${vehicleData.salvage.NAME}-${idx}.jpg`
            })
        })
        sendProgress("download", "end")
        sendNotification(`${imageUrls.length} images sent to downloads folder!`, {displayAs: "success"})
    } catch (error) {
        sendProgress("download", "abort")
        sendNotification(error, {displayAs: "error"})
    }
};

const VehicleData = class {
    constructor(data) {
        this.tab = null              //
        this.salvage = null          // Private. If getter works, lotNumber or lotNumberFetcher should also be set.
        this.lotNumber = null        // Private. Get/set lotNumber instead so that data can be persisted.
        this.imageInfo = null        // Private. Get/set imageInfo instead.
        this.imageUrls = null        // Private. Get/set imageUrls instead.
        if (data.tabId) {console.log("setting and removing tabId"); this.setTabId(data.tabID); delete data.tabId}
        if (data) {console.log("setting data");this.setData(data)}
    }
    setData(values) {
        if (values.salvage==="copart") {values.salvage=COPART}
        if (values.salvage==="iaai") {values.salvage=IAAI}
        Object.assign(this, values)
    }
    getData() {
        let data = Object.assign(new Object, this);
        data.salvage = data.salvage.NAME;
        return data;
    }
    async setTabId(id) {this.tab = await browser.tabs.get(id)}
    async getSalvage() {
        if (this.salvage) {return this.salvage}
        if (!this.tab) {throw "no tab"}
        if (/copart\.com/i.test(this.tab.url)) {this.salvage = COPART;}
        else if (/iaai\.com/i.test(this.tab.url)) {this.salvage = IAAI;}
        else if (/poctra\.com/i.test(this.tab.url)) {
            this.setData( await poctraLotNumbersFromTabs() )
        } else if (/bidfax\.info/i.test(this.tab.url)) {
            this.setData( await bidfaxLotNumbersFromTabs() )
        }
        return this.salvage;
    }
    async getLotNumber() {
        if (this.lotNumber) {return this.lotNumber}
        await this.getSalvage()
        this.setData( await this.salvage.lotNumberFromTab(this) )
        return this.lotNumber;
    }
    async getImageInfo() {
        console.log("getImageInfo")
        if (this.imageInfo) {return this.imageInfo}
        console.log("noImageInfo")
        await this.getLotNumber()
        console.log("after getLotNumber() this:")
        console.log(this)
        let data = await this.salvage.imageInfoFromLotNumber(this)
        console.log('data:'); console.log(data)
        this.setData( data )
        return this.imageInfo;
    }
    async getImageUrls() {
        console.log("getImageUrls()")
        console.log('this:'); console.log(this)
        if (this.imageUrls) {return this.imageUrls}
        console.log("no imageURLS")
        await this.getImageInfo()
        this.setData( await this.salvage.imageUrlsFromInfo(this) )
        return this.imageUrls;
    }
    async downloadImages() {
        console.log("downloadImages()")
        console.log('this:'); console.log(this)
        downloadImages(this)
    }
    async do(message, reply) {
        console.log("do()")
        console.log('this:'); console.log(this)
        let request = this[message.action];
        let response;
        if (message.exec) {response = request.bind(this)()}
        if (message.resturn) {reply(response)}
    }
}

browser.runtime.onConnect.addListener( async port=>{
    if (port.name!=="popup-seek") {return}
    vdObjects = await vehicleFromOpenTabs()
    // connect vehicles to future messages
    vdObjects.forEach( (vd, idx)=>{
        port.onMessage.addListener( m=>{
            if (m.idx===idx) {
                vd.do.bind(vd)(m, port.postMessage)
            }
        })
    })
    // reply with data
    vehicleDatas = vdObjects.map(vdo=>vdo.getData())
    port.postMessage({vehicleDatas})
})

async function vehicleFromOpenTabs(salvageTab) {
    let salvageTabs;
    if (salvageTab) {
        salvageTabs = [salvageTab];
    } else {
        // get all salvage tabs
        salvageTabs = await browser.tabs.query({
            url: [COPART.URL_PATTERN, IAAI.URL_PATTERN, POCTRA.URL_PATTERN, BIDFAX.URL_PATTERN]
        });
        // if any are active, discard all others
        let activeTabs = salvageTabs.filter(t=>t.active);
        if (activeTabs.length) { salvageTabs = activeTabs; }
        // sort decending by ID. First element will be oldest
        salvageTabs.sort( (t1, t2)=>t1.id>t2.id?-1:1 )
    }
    vdPromises = salvageTabs.map( async tab=>{
        let vd = new VehicleData({tab});
        await vd.getLotNumber()
        return vd
    })
    return await Promise.all(vdPromises)
}

/*------*\
  COPART  
\*------*/
const COPART = {
    NAME: "copart",
    URL_PATTERN: "*://*.copart.com/lot/*",
    lotNumberFromTab: async (tabOrVehicleData)=>{
        let copartTab;
        if (tabOrVehicleData instanceof VehicleData) { copartTab = tabOrVehicleData.tab }
        else { copartTab = tabOrVehicleData }
        let lotMatch = copartTab.title.match(/^(.*) for Sale/i);
        let lotNumber;
        if (lotMatch) { lotNumber = lotMatch[0] }
        else {
            let framesResponses = await browser.tabs.executeScript(
                copartTab.id, {code:`document.querySelector("#lot-details .lot-number").lastChild.textContent.trim()`}
            )
            lotNumber = framesResponses[0]
        }
        return {lotNumber}
    },
    imageInfoFromLotNumber: async (lotNumberOrVehicleData)=>{
        let lotNumber;
        if (lotNumberOrVehicleData instanceof VehicleData) {
            lotNumber = await lotNumberOrVehicleData.getLotNumber();
        } else { lotNumber = lotNumberOrVehicleData; }
        let imagesUrl = `https://www.copart.com/public/data/lotdetails/solr/lotImages/${lotNumber}/USA`;
        let headers = { "User-Agent": window.navigator.userAgent,
                        "Accept": "application/json, text/plain, */*" }
        let response = await fetch(imagesUrl, headers)
        let imageInfo;
        if (response.headers.get("content-type").startsWith("application/json")) {
            imageInfo = await response.json();
        } else {
            console.log("Copart wants a CAPTCHA check")
            browser.tabs.create({url:"https://www.copart.com"})
            throw "please complete the CAPTCHA and try again."
        }
        return {imageInfo}
    },
    imageUrlsFromInfo: async (imageInfosOrVehicleData)=>{
        // Accepts a single lot number, multiple lot numbers, or an array of lot numbers.
        let imageInfos, lotNumber;
        if (imageInfosOrVehicleData instanceof VehicleData) {
            imageInfos = [await imageInfosOrVehicleData.getImageInfo()]
            lotNumber = imageInfosOrVehicleData.lotNumber;
        } else { imageInfos = Array.from(arguments).flat(); }
        if (!imageInfos.length) {throw "no lot number provided.";}
        sendNotification(`Copart: downloading images from lot #${lotNumber},`)
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
            } catch (error) {throw `Copart: lot #${lotNumber} ${error}`}
        }
        return {imageUrls}
    }
}


/*----*\
  IAAI  
\*----*/
const IAAI = {
    NAME: "iaai",
    URL_PATTERN: "*://*.iaai.com/*ehicle*etails*",
    lotNumberFromTab: async (iaaiTabOrVehicleData)=>{
        let iaaiTab;
        if (iaaiTabOrVehicleData instanceof VehicleData) {
            iaaiTab = iaaiTabOrVehicleData.tab;
        } else { iaaiTab = iaaiTabOrVehicleData }
        try {
            let salvageName = 'iaai';
            let lotNumber = await browser.tabs.executeScript(
                    iaaiTab.id, {code:`document.querySelector("#ProductDetailsVM").innerText`}
                ).catch(()=>{ throw "there was an error communicating with the page."+
                                    "Please reload the page and try again." })
                .then( lastEvaluated=>JSON.parse(lastEvaluated[0]) )
                .then( jsn=>jsn.VehicleDetailsViewModel.StockNo );
            return {lotNumber}
        } catch {
            throw "something went wrong getting this vehicle's stock number. Please reload the page and try again."
        }
    },
    imageInfoFromLotNumber: async (stockNumberOrVehicleData)=>{
        let stockNumber;
        if (stockNumberOrVehicleData instanceof VehicleData) {
            stockNumber = await stockNumberOrVehicleData.getLotNumber()
        } else {
            stockNumber = stockNumberOrVehicleData;
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
    },
    imageUrlsFromInfo: async (lotInfosOrVehicleData)=>{
        // accepts a single imageDetails object, multiple imageDetails objects, or
        // an array of imageDetails objects
        let lotDetails;
        if (lotInfosOrVehicleData instanceof VehicleData) {
            lotDetails = [await lotInfosOrVehicleData.getImageInfo()];
        } else {
            lotDetails = Array.from(arguments).flat();
        }
        console.log("iaaiImageUrlsFromImageInfo(...)")
        console.log(lotDetails)
        if (!lotDetails.length){return []}
        // FETCH AND PROCESS
        let processedUrls = [];
        for (let lotDetail of lotDetails) {
            let dezoomed = await IAAI.fetchAndDezoom(lotDetail.keys)
            processedUrls.push(...dezoomed)
            // let {walkaroundUrls, panoUrls} = await SpinCar.fetchDetails(lotDetail.cdn_image_prefix)
            // processedUrls.push(...pano)
            // processedUrls.push(...walkaround)
        };
        // DONE
        return {imageUrls: processedUrls}
    },
    countImages: (imageDetailOrDetails)=>{
        let imageDetails = Array.from(arguments).flat()
        return imageDetails.reduce((total, details)=>{
            return total + details.keys.length
        }, initialValue=0)
    },
    TILE_SIZE: 250,
    fetchAndDezoom: async (imageKeyOrKeys)=>{
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
                let objectURL = IAAI.dataURLtoObjectURL(dataURL);
                console.log(`${key.K} processed`)
                sendProgress("download", "increment")
                resolve(objectURL)
            }))
        }
        return Promise.all(processedPromises)
    },
    dataURLtoObjectURL: (uri, name)=>{
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
    }
}
const SpinCar = {
    fetchDetails: (spinUrlOrUrls)=>{
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
//
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
const POCTRA = {
    URL_PATTERN: "*://*.poctra.com/*/id-*/*",
    lotNumbersFromTab: async (poctraTab)=>{
        try {
            let framesResults = await browser.tabs.executeScript(poctraTab.id, { code:`(${POCTRA.getLotNumber.toString()})()` });
            return framesResults[0]
        } catch (error) {throw `Poctra: ${error}`}
    },
    getLotNumber: ()=>{
        let idElement = document.querySelector("h2");
        if (!idElement) {return null}
        let idString = idElement.innerText;
        let idMatches = /(?<type>Lot|Stock) no: (?<lotNumber>\d*)/.exec(idString);
        let type, salvageName, lotNumber;
        if (idMatches) {
            ({type, lotNumber} = idMatches.groups);
            salvageName = {lot:"copart", stock:"iaai"}[type];
        } else {salvageName = "unknown";}
        return {salvageName, lotNumber}
    }
}


/*------*\
  BIDFAX  
\*------*/
const BIDFAX = {
    URL_PATTERN: "*://en.bidfax.info/*",
    lotNumbersFromTab: async (bidfaxTab)=>{
        let framesResults = await browser.tabs.executeScript(bidfaxTab.id, { code:`(${BIDFAX.getLotNumber.toString()})()` });
        return framesResults[0]
    },
    getLotNumber: ()=>{
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
}


console.log("download-background loaded")
