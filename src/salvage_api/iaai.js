
const IAAI_API = {
    NAME: "iaai",
    PRETTY_NAME: "IAAI",
    
    
    /*------*\
      SEARCH  
    \*------*/
    search: (vin, notify=sendNotification)=>{
        return new Promise( async (resolve, reject)=>{
            try {
                const searchResults = await IAAI_API.searcher(vin);
                notify("IAAI: found a match!", "success")
                resolve(searchResults)
            } catch (error) {
                console.log(`IAAI rejecting: ${error}`)
                notify(`IAAI: ${error}`)
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
        return {salvageName: "iaai", listingUrl, lotNumber, extras};
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
    },
    
    
    /*------*\
      SCRAPE
    \*------*/
    URL_PATTERN: "*://*.iaai.com/*ehicle*etail*",
    lotNumberFromTab: async (tab)=>{
        try {
            // Execute content script
            const lastEvaluated = await browser.tabs.executeScript(
                tab.id,
                {code:`document.querySelector("#ProductDetailsVM").innerText`}
            );
            
            // Parse out lotNumber
            let lotNumber;
            const jsn = JSON.parse(lastEvaluated[0]);
            // Not sure if below are alternatives, or the first was superceded.
            if (jsn.VehicleDetailsViewModel) lotNumber = jsn.VehicleDetailsViewModel.StockNo;
            if (jsn.auctionInformation)      lotNumber = jsn.auctionInformation.stockNumber;
            
            // Done!
            const salvageName = "iaai";
            return {lotNumber, salvageName};
        } catch {
            throw "something went wrong getting this vehicle's stock number. Please reload the page and try again."
        }
    },
    
    
    /*--------*\
      DOWNLOAD
    \*--------*/
    // Image info
    imageInfoFromLotNumber: async (lotNumber)=>{
        console.log(`IAAI fetching image info for ${lotNumber}`)
        
        // Make request
        const {url, headers} = IAAI_API.buildImageInfoRequest(lotNumber);
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
    buildImageInfoRequest: (lotNumber)=>{
        // Create URL with search body
        const url = new URL("https://iaai.com/Images/GetJsonImageDimensions");
        url.searchParams.append(
            'json', JSON.stringify({"stockNumber": lotNumber})
        )
        
        // Create headers
        const headers = {
            "User-Agent": window.navigator.userAgent,
            "Accept": "application/json, text/plain, */*"
        };
        
        return {url, headers}
    },
    
    
    // Hero images
    heroImages: async (imageInfo) => {
        console.log("IAAI downloading images.")
        
        // TODO: Validate imageInfo
        
        // Process Images
        sendNotification(`Processing ${imageInfo.keys.length} high-res images. Please wait...`)
        const heroImages = await IAAI_API.fetchHeroImages(imageInfo.keys);
        
        // DONE
        return heroImages;
    },
    // IAAI uses Deepzoom/OpenSeaDragon, so there's a lot of work to get
    // full-res images.
    fetchHeroImages: async (imageKeys) => {
        // Fetch tiles for each image
        const imagesAsTilesPromises = imageKeys.map(IAAI_API.fetchImageTiles);
        const imagesAsTiles = await Promise.all(imagesAsTilesPromises);
        
        // Zip keys and downloaded tiles
        const stitchableImages = imagesAsTiles.map(
            (tiles, idx)=>{return {tiles, key: imageKeys[idx]}}
        )
        
        // Stitch each set of tiles into a single image
        const stitchedImagePromises = stitchableImages.map(IAAI_API.stitchImage);
        const stitchedImages = await Promise.all(stitchedImagePromises);
        
        // Return ObjectUrls
        return stitchedImages
    },
    // Tile fetching
    TILE_SIZE: 250,
    fetchImageTiles: key=>{
        // Plan out tile requests
        let xTiles = Math.ceil(key.W / IAAI_API.TILE_SIZE);
        let yTiles = Math.ceil(key.H / IAAI_API.TILE_SIZE);
        let xRange = [...Array(xTiles).keys()];
        let yRange = [...Array(yTiles).keys()];
        
        // Fetch all tiles for this image
        let bmpPromises = [];
        for (let x of xRange) {
            for (let y of yRange){
                bmpPromises.push(IAAI_API.fetchBmpDetail(key, x, y))
            }
        }
        return Promise.all(bmpPromises)
    },
    fetchBmpDetail: async (key, x, y)=>{
        const url = IAAI_API.getTileUrl(key, x,y);
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
        url.searchParams.append("tilesize", IAAI_API.TILE_SIZE)
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
                x*IAAI_API.TILE_SIZE,
                y*IAAI_API.TILE_SIZE
            )
        })
        
        // Export canvas
        const dataURL = canvas.toDataURL("image/jpeg");
        const objectURL = urlFromDataUrl(dataURL);
        
        // Done!
        console.log(`${key.K} processed`)
        return objectURL
    },
    
    
    // Panorama/walkaround
    bonusImages: async (imageInfo)=>{
        // Fetch bonus info
        const bonusInfo = await IAAI_API.bonusImageInfo(imageInfo);
        
        // Fetch images
        let walkaroundUrls, panoUrls;
        try {
            walkaroundUrls = await IAAI_API.walkaroundObjectUrls(bonusInfo);
        } catch {}
        try {
            panoUrls = await IAAI_API.panoramaObjectUrls(bonusInfo);
        } catch {}
        
        // Done!
        return {walkaroundUrls, panoUrls};
    },
    bonusImageInfo: async (imageInfo)=>{
        // Validate imageInfo
        if (!imageInfo.Image360Url) return;
        
        try {
            // Build request, turning spincar viewer url into the raw images url.
            const spinUrl = imageInfo.Image360Url;
            const spinPath = /com\/(.*)/.exec(spinUrl)[1];
            const apiUrl = "https://api.spincar.com/spin/" + spinPath;
            const headers = { "User-Agent": window.navigator.userAgent,
            "Accept": "application/json" };
            
            // Send request
            const spincarRequest = fetch(apiUrl, headers).then(r=>r.json());
            spincarRequest.catch(error=>{
                console.error("Spincar request failed!")
                console.error(error)
                return;
            })
            return spincarRequest;
        } catch (error) {
            console.error("IAAI failed while requesting Spincar info.")
            console.error(`spinUrl: ${spinUrl}`)
            console.error(`apiUrl: ${apiUrl}`)
            console.error(error)
        }
    },
    walkaroundObjectUrls: async (bonusInfo)=>{
        // Validate bonusInfo
        if (!bonusInfo.info                 ) return;
        if (!bonusInfo.info.options         ) return;
        if (!bonusInfo.info.options.numImgEC) return;
        
        // Extract data
        const walkaroundCount = bonusInfo.info.options.numImgEC;
        const frameIndexes = Array(walkaroundCount).keys();
        
        // Notify user
        sendNotification(`Downloading ${walkaroundCount+1} exterior 360 images.`)
        
        // Build a list of all urls
        const walkaroundUrls = [];
        for (idx of frameIndexes) {
            walkaroundUrls.push(`https:${bonusInfo.cdn_image_prefix}ec/0-${idx}.jpg`)
        }
        
        // Fetch image data, convert object URLs
        let walkPromises = walkaroundUrls.map(fetchObjectUrl);
        let walkSettled = await Promise.allSettled(walkPromises);
        
        // Check for errors, hand back object URLs
        return walkSettled.map(p=>p.value||"TODO: add rejected image")
    },
    panoramaObjectUrls: async (bonusInfo) =>{
        // Validate bonusInfo
        if (!bonusInfo.cdn_image_prefix) return;
        
        // Notify user
        sendNotification("Downloading interior 360.")
        
        // Build image URLs
        const faceNames = ['pano_f', 'pano_l', 'pano_b', 'pano_r', 'pano_u', 'pano_d'];
        let spincarUrls = faceNames.map(
            cubeFace=>(`https:${bonusInfo.cdn_image_prefix}pano/${cubeFace}.jpg`)
        );
        
        // Fetch image data, convert to object URLs
        let panoPromises = spincarUrls.map(fetchObjectUrl);
        let panoSettled = await Promise.allSettled(panoPromises);
        
        // Check for errors, add face labels
        let panoObjectUrls = panoSettled.map((promise, idx)=>{
            const url = promise.value||"TODO: add rejected image";
            const face = faceNames[idx];
            return [face, url];
        });
        const panoUrls = Object.fromEntries(panoObjectUrls);
        
        // Send back object URLs and information on how to interpret them
        return panoUrls;
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

