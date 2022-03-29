/*------*\
  SEARCH  
\*------*/
const IAAI_S = {
    __proto__: Salvage,
    NAME: "iaai",
    PRETTY_NAME: "IAAI",
    search: (vin, notify=sendNotification)=>{
        return new Promise( async (resolve, reject)=>{
            try {
                const searchResults = await IAAI_S.searcher(vin);
                notify(
                    `IAAI: found a match!`,
                    {displayAs:"success"}
                )
                resolve(searchResults)
            } catch (error) {
                console.log(`IAAI rejecting: ${error}`)
                notify(`IAAI: ${error}`, {displayAs: "status"})
                reject()
            }
        })
    },
    searcher: async (vin)=>{
        // Configure VIN search
        const searchUrl = `https://www.iaai.com/Search?SearchVIN=${vin}`;
        const headers = {
            "User-Agent":   window.navigator.userAgent,
            "Accept":       "application/json, text/plain, */*",
            "Content-Type": "application/json;charset=utf-8"
        };
        
        // Fetch search results
        const response = await fetch(searchUrl, {headers});
        
        // Check status
        if (!response.ok) throw `something went wrong on their end: ${response.status} error.`;
        if (!response.redirected) throw "query returned no results.";
        
        // Check response content
        if (!/(itemid|vehicledetails)/.test(response.url)) throw "query returned no results.";
        
        // Get listing URL
        const listingUrl = response.url;
        const lotNumber = /\d{8}/.exec(response.url)[0];
        const extras = [];
        
        // Send back results
        return {salvage: "iaai", listingUrl, lotNumber, extras};
    },
    getVehicleInfo: async (vehicle, options)=>{
        if (options.url) {
            let response = await fetch(options.url);
            if (!response.ok) {console.log("IAAI redirect URL invalid");return}
            let parser = new DOMParser();
            let doc = parser.parseFromString(await response.text(), "text/html");
            let jsn = JSON.parse(doc.querySelector("#ProductDetailsVM").innerText);
            vehicle.lotNumber = jsn.VehicleDetailsViewModel.StockNo
        }
    }
};

/*--------*\
  DOWNLOAD
\*--------*/
const IAAI_D = {
    __proto__: Salvage,
    NAME: "iaai",
    URL_PATTERN: "*://*.iaai.com/*ehicle*etails*",
    lotNumberFromTab: async (tabOrVehicle)=>{
        let tabId;
        if (tabOrVehicle.tabId)   {tabId = tabOrVehicle.tabId;}
        else if (tabOrVehicle.id) {tabId = tabOrVehicle.id;}
        else                      {tabId = tabOrVehicle;}
        
        try {
            let lotNumber = await browser.tabs.executeScript(
                    tabId, {code:`document.querySelector("#ProductDetailsVM").innerText`}
                ).catch(()=>{ throw "there was an error communicating with the page."+
                                    "Please reload the page and try again." })
                .then( lastEvaluated=>JSON.parse(lastEvaluated[0]) )
                .then( jsn=>jsn.VehicleDetailsViewModel.StockNo );
            return lotNumber;
        } catch {
            throw "something went wrong getting this vehicle's stock number. Please reload the page and try again."
        }
    },
    lotNumberValid: async (stockNumberOrVehicle)=>{
        try {
            let imageInfo = await IAAI_D.imageInfoFromLotNumber(stockNumberOrVehicle)
            return imageInfo.imageInfo.keys.length;
        } catch (error) {if (error==="no images found.") {
            return 0;
        }}
    },
    imageInfoFromLotNumber: async (stockNumberOrVehicle)=>{
        let vehicle, stockNumber;
        if (stockNumberOrVehicle instanceof DownloadableVehicle) {
            vehicle = stockNumberOrVehicle
            stockNumber = await vehicle.getLotNumber()
        } else {
            stockNumber = stockNumberOrVehicle;
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
    imageUrlsFromInfo: async function (lotDetailsOrVehicle) {
        let vehicle, lotDetails;
        if (lotDetailsOrVehicle instanceof DownloadableVehicle) {
            vehicle = lotDetailsOrVehicle;
            lotDetails = await vehicle.getImageInfo();
        } else {
            lotDetails = lotDetailsOrVehicle;
        }
        console.log("iaaiImageUrlsFromImageInfo(...)")
        console.log(lotDetails)
        if (!lotDetails){return []}
        // FETCH AND PROCESS
        if (vehicle) {
            sendNotification(`IAAI: processing ${lotDetails.keys.length} images from lot #${vehicle.lotNumber}`)
        } else {
            sendNotification(`IAAI: processing ${lotDetails.keys.length} images.`)
        }
        let imageUrls = await IAAI_D.fetchAndDezoom(lotDetails.keys)
        let {walkaroundUrls, panoUrls} = await SPINCAR_D.interactiveUrlsFromImageInfo(lotDetailsOrVehicle);
        // DONE
        return {imageUrls, walkaroundUrls, panoUrls}
    },
    countImages: function (...imageDetails) {
        imageDetails = imageDetails.flat()
        return imageDetails.reduce((total, details)=>{
            return total + details.keys.length
        }, initialValue=0)
    },
    TILE_SIZE: 250,
    fetchAndDezoom: async function (...imageKeys) {
        // Accepts a single keys object, multiple keys objects, or an array of keys
        // objects.
        imageKeys = imageKeys.flat()
        console.log("iaaiFetchAndDezoom(...)")
        console.log(imageKeys)
        let canvas = document.createElement("canvas");
        let ctx = canvas.getContext("2d")
        let processedPromises = [];
        for (let key of imageKeys) {
            processedPromises.push(new Promise(async (resolve, reject)=>{
                // PLAN
                let tileUrl = (x, y)=>`https://anvis.iaai.com/deepzoom?imageKey=${key.K}`+
                                      `&level=12&x=${x}&y=${y}&overlap=0&tilesize=${IAAI_D.TILE_SIZE}`;
                canvas.width  = key.W;
                canvas.height = key.H;
                let xTiles = Math.ceil(key.W / IAAI_D.TILE_SIZE);
                let yTiles = Math.ceil(key.H / IAAI_D.TILE_SIZE);
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
                    ctx.drawImage(bmp,x*IAAI_D.TILE_SIZE,y*IAAI_D.TILE_SIZE)
                })
                let dataURL = canvas.toDataURL("image/jpeg");
                let objectURL = IAAI_D.dataURLtoObjectURL(dataURL);
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
// FOR REFERENCE
// getJsonImageDimensions returns:
// {
//     DeepZoomInd: true
//     Image360Ind: true
//     Image360Url: https://cdn.spincar.com/swipetospin-viewers/iaa-rochester/000-31355822/20210928165305.CUFD0VOL/ec/0-41.jpg
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


let SPINCAR_D = {
    __proto__: Salvage,
    interactiveUrlsFromImageInfo: async (imageInfoOrVehicle)=>{
        // TODO: add error catching to Spincar functions
        let imageInfo;
        if (imageInfoOrVehicle instanceof DownloadableVehicle) {
            imageInfo = await imageInfoOrVehicle.getImageInfo();
        } else {
            imageInfo = imageInfoOrVehicle;
        }
        if (!imageInfo.Image360Ind) {console.log("no 360 indicated");return;}
        
        let spinUrl = imageInfo.Image360Url;
        let spinPath = /com\/(.*)/.exec(spinUrl)[1];
        let apiUrl = "https://api.spincar.com/spin/" + spinPath;
        let headers = { "User-Agent": window.navigator.userAgent,
                    "Accept": "application/json" };
        let spinInfo = await fetch(apiUrl, headers).then(r=>r.json());
        let walkaroundUrls = await SPINCAR_D.walkaroundObjectUrlsFromImageInfo(spinInfo);
        let panoImageInfo = await SPINCAR_D.panoObjectUrlsFromImageInfo(spinInfo);
        panoUrls = panoImageInfo.urls;
        return {walkaroundUrls, panoUrls}
    },
    walkaroundObjectUrlsFromImageInfo: async (spinInfo) =>{
        let walkaroundCount = spinInfo.info.options.numImgEC;
        let walkaroundUrls = Array.from(Array(walkaroundCount).keys()).map(
            idx=>`https:${spinInfo.cdn_image_prefix}ec/0-${idx}.jpg`
        );
        let walkPromises = walkaroundUrls.map(imageUrl=>{
            return fetch(imageUrl)
                .then(response=>response.blob())
                .then(blob=>URL.createObjectURL(blob))
        });
        let walkSettled = await Promise.allSettled(walkPromises);
        return walkSettled.map(p=>p.value||"TODO: add rejected image")
    },
    panoObjectUrlsFromImageInfo: async (spinInfo) =>{
        let panoUrls = ['pano_f', 'pano_l', 'pano_b', 'pano_r', 'pano_u', 'pano_d'].map(
            cubeFace=>(`https:${spinInfo.cdn_image_prefix}pano/${cubeFace}.jpg`)
        );
        let panoPromises = panoUrls.map(imageUrl=>{
            return fetch(imageUrl)
                .then(response=>response.blob())
                .then(blob=>URL.createObjectURL(blob))
        });
        let panoSettled = await Promise.allSettled(panoPromises);
        let panoObjectUrls = panoSettled.map(p=>p.value||"TODO: add rejected image");
        return {
            cubemap: true,
            equirectangular: false,
            urls: panoObjectUrls
        }
    },
}

// FOR REFERENCE:
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

