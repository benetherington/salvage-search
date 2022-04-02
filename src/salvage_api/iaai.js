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
    URL_PATTERN: "*://*.iaai.com/*ehicle*etail*",
    
    
    // Tabs
    lotNumberFromTab: async (tab)=>{
        try {
            const lastEvaluated = await browser.tabs.executeScript(
                tab.id,
                {code:`document.querySelector("#ProductDetailsVM").innerText`}
            );
            const jsn = JSON.parse(lastEvaluated[0]);
            
            // Not sure if this was a change, or just a configuration I missed
            // the first time round...
            if (jsn.VehicleDetailsViewModel) return jsn.VehicleDetailsViewModel.StockNo;
            if (jsn.auctionInformation) return jsn.auctionInformation.stockNumber;
        } catch {
            throw "something went wrong getting this vehicle's stock number. Please reload the page and try again."
        }
    },
    
    
    // Image info
    imageInfoFromLotNumber: async (stockNumber)=>{
        console.log(`IAAI fetching image info for ${stockNumber}`)
        
        // Make request
        const {url, headers} = IAAI_D.buildImageInfoRequest(stockNumber);
        const response = await fetch(url, headers);
        console.log("IAAI imageInfo request complete")
        
        // Check response status
        if (!response.ok) throw "server error";
        
        // Check response content
        if (response.headers.get("content-length") <= '0') {
            throw "no images found.";
        }
        
        // Everything looks good!
        return response.json()
    },
    buildImageInfoRequest: (stockNumber)=>{
        // Create URL with search body
        const url = new URL("https://iaai.com/Images/GetJsonImageDimensions");
        url.searchParams.append(
            'json', JSON.stringify({"stockNumber":stockNumber})
        )
        
        // Create headers
        const headers = {
            "User-Agent": window.navigator.userAgent,
            "Accept": "application/json, text/plain, */*"
        };
        
        return {url, headers}
    },
    
    
    // Image fetching
    imageUrlsFromInfo: async function (lotDetails, notify=sendNotification) {
        console.log(`IAAI downloading images.`)
        notify(`IAAI: processing ${lotDetails.keys.length} images.`)
        
        // Start processing heros
        const imageUrls = await IAAI_D.fetchHeroImages(lotDetails.keys);
        
        // Start processing interactives
        const {walkaroundUrls, panoImageInfo} =
            await SPINCAR_D.interactiveUrlsFromImageInfo(lotDetails);
        
        // DONE
        return {imageUrls, walkaroundUrls, panoImageInfo}
    },
    // IAAI uses Deepzoom/OpenSeaDragon, so there's a lot of work to get
    // full-res images.
    fetchHeroImages: async function (imageKeys) {
        // Fetch tiles for each image
        const imagesAsTilesPromises = imageKeys.map(IAAI_D.fetchImageTiles);
        const imagesAsTiles = await Promise.all(imagesAsTilesPromises);
        
        // Zip keys and downloaded tiles
        const stitchableImages = imagesAsTiles.map(
            (tiles, idx)=>{return {tiles, key: imageKeys[idx]}}
        )
        
        // Stitch each set of tiles into a single image
        const stitchedImagePromises = stitchableImages.map(IAAI_D.stitchImage);
        const stitchedImages = await Promise.all(stitchedImagePromises);
        
        // Return ObjectUrls
        return stitchedImages
    },
    // Tile fetching
    TILE_SIZE: 250,
    fetchImageTiles: key=>{
        // Plan out tile requests
        let xTiles = Math.ceil(key.W / IAAI_D.TILE_SIZE);
        let yTiles = Math.ceil(key.H / IAAI_D.TILE_SIZE);
        let xRange = [...Array(xTiles).keys()];
        let yRange = [...Array(yTiles).keys()];
        
        // Fetch all tiles for this image
        let bmpPromises = [];
        for (let x of xRange) {
            for (let y of yRange){
                bmpPromises.push(IAAI_D.fetchBmpDetail(key, x, y))
            }
        }
        return Promise.all(bmpPromises)
    },
    fetchBmpDetail: async (key, x, y)=>{
        const url = IAAI_D.getTileUrl(key, x,y);
        const response = await fetch(url);
        const blob = await response.blob();
        const bmp = await createImageBitmap(blob);
        return {x, y, bmp};
    },
    getTileUrl: (key, x, y)=>{
        const url = new URL ("https://anvis.iaai.com/deepzoom");
        url.searchParams.append("imageKey", key.K)
        url.searchParams.append("level", 12)
        url.searchParams.append("x", x)
        url.searchParams.append("y", y)
        url.searchParams.append("overlap", 0)
        url.searchParams.append("tilesize", IAAI_D.TILE_SIZE)
        return url;
    },
    // Tile stitching
    stitchImage: ({key, tiles})=>{
        // Create canvas
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")
        canvas.width  = key.W;
        canvas.height = key.H;
        
        // Paint tiles onto canvas
        tiles.forEach(tile=>{
            const {bmp,x,y} = tile;
            ctx.drawImage(
                bmp,
                x*IAAI_D.TILE_SIZE,
                y*IAAI_D.TILE_SIZE
            )
        })
        
        // Export canvas
        const dataURL = canvas.toDataURL("image/jpeg");
        const objectURL = IAAI_D.dataURLtoObjectURL(dataURL);
        
        // Done!
        console.log(`${key.K} processed`)
        return objectURL
    },
    dataURLtoObjectURL: (uri, name)=>{
        // Takes a dataURL and turns it into a temporary object URL. This makes it
        // easier to pass around. See: https://stackoverflow.com/a/12300351
        const byteString = atob(uri.split(',')[1]);
        const mimeString = uri.split(',')[0].split(':')[1].split(';')[0]
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], {type: mimeString});
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
    interactiveUrlsFromImageInfo: async (imageInfo)=>{
        // Validate imageInfo
        if (!imageInfo.Image360Ind) {
            console.log("no 360 indicated")
            return [];
        }
        
        // Fetch interactive info
        let spinUrl = imageInfo.Image360Url;
        let spinPath = /com\/(.*)/.exec(spinUrl)[1];
        let apiUrl = "https://api.spincar.com/spin/" + spinPath;
        let headers = { "User-Agent": window.navigator.userAgent,
                    "Accept": "application/json" };
        let spinInfo = await fetch(apiUrl, headers).then(r=>r.json());
        
        // Fetch images
        let walkaroundUrls = await SPINCAR_D.walkaroundObjectUrlsFromImageInfo(spinInfo);
        let panoImageInfo = await SPINCAR_D.panoObjectUrlsFromImageInfo(spinInfo);
        
        // Done!
        return {walkaroundUrls, panoImageInfo}
    },
    walkaroundObjectUrlsFromImageInfo: async (spinInfo) =>{
        // Build image urls
        let walkaroundCount = spinInfo.info.options.numImgEC;
        let walkaroundUrls = Array.from(Array(walkaroundCount).keys()).map(
            idx=>`https:${spinInfo.cdn_image_prefix}ec/0-${idx}.jpg`
        );
        
        // Fetch image data, convert object URLs
        let walkPromises = walkaroundUrls.map(imageUrl=>{
            return fetch(imageUrl)
                .then(response=>response.blob())
                .then(blob=>URL.createObjectURL(blob))
        });
        let walkSettled = await Promise.allSettled(walkPromises);
        
        // Check for errors, hand back object URLs
        return walkSettled.map(p=>p.value||"TODO: add rejected image")
    },
    panoObjectUrlsFromImageInfo: async (spinInfo) =>{
        // Build image URLs
        const faceNames = ['pano_f', 'pano_l', 'pano_b', 'pano_r', 'pano_u', 'pano_d'];
        let panoUrls = faceNames.map(
            cubeFace=>(`https:${spinInfo.cdn_image_prefix}pano/${cubeFace}.jpg`)
        );
        
        // Fetch image data, convert to object URLs
        let panoPromises = panoUrls.map(url=>{
            return fetch(url)
                .then(response=>response.blob())
                .then(blob=>URL.createObjectURL(blob))
        });
        let panoSettled = await Promise.allSettled(panoPromises);
        
        // Check for errors, add face labels
        let panoObjectUrls = panoSettled.map((promise, idx)=>{
            const url = promise.value||"TODO: add rejected image";
            const face = faceNames[idx];
            return [face, url];
        });
        
        // Send back object URLs and information on how to interpret them
        return {
            cubemap: true,
            equirectangular: false,
            faces: Object.fromEntries(panoObjectUrls)
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

