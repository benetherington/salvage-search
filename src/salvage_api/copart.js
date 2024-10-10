const copartWorkers = [];
const stopCopartWorkers = () => copartWorkers.forEach((w) => w.terminate());
const notifyAtHalfway = () => {
    const progress = {px: 0, nx: 0, py: 0, ny: 0, pz: 0, nz: 0};
    let notifiedYet = false;
    return (percentDone, direction) => {
        progress[direction] = percentDone;
        const eachDone = Object.values(progress);
        const totalDone = eachDone.reduce((cur, prev) => cur + prev);
        if (totalDone > 50 && !notifiedYet) {
            sendNotification('Halfway there!');
            notifiedYet = true;
        }
    };
};

const throwCaptchaError = (logMessage) => {
    console.log('Copart wants a CAPTCHA check');
    if (logMessage) console.log(logMessage);
    browser.tabs.create({url: 'https://www.copart.com'});
    throw 'Please complete the CAPTCHA and try again.';
};

const COPART_API = {
    NAME: 'copart',
    URL_PATTERN: '*://*.copart.com/lot/*',
    URL_REGEXP: /copart\.com/,

    /*------*\
      SEARCH  
    \*------*/
    listingUrl: (lotNumber) => `https://www.copart.com/lot/${lotNumber}`,
    search: (vin, notify = sendNotification) => {
        return new Promise(async (resolve, reject) => {
            try {
                const searchResults = await COPART_API.searcher(vin);
                notify('Copart: found a match!', 'success');
                resolve(searchResults);
            } catch (error) {
                console.log(`Copart rejecting: ${error}`);
                notify(`Copart: ${error}.`);
                reject();
            }
        });
    },
    searcher: async (vin) => {
        // Configure VIN search
        const searchUrl = 'https://www.copart.com/public/lots/vin/search';
        const method = 'POST';
        const headers = {
            'User-Agent': window.navigator.userAgent,
            Accept: 'application/json, text/plain, */*',
            'Content-Type': 'application/json;charset=utf-8',
        };
        const body = JSON.stringify({
            filter: {
                MISC: [`ps_vin_number:${vin}`, 'sold_flag:false'],
            },
        });

        // Fetch search results
        const response = await fetch(searchUrl, {method, headers, body});

        // Check status
        if (!response.ok)
            throw `something went wrong on their end: ${response.status} error.`;

        // Check response content
        let jsn;
        try {
            jsn = await response.json();
        } catch (error) {
            throwCaptchaError(response);
        }
        if (!jsn.data.results) throw 'something went wrong on their end...';
        if (!jsn.data.results.content) {
            throw 'something went wrong on their end...';
        }
        if (!jsn.data.results.content.length) throw 'query returned no results';

        // Get listing URLs
        const lotNumbers = jsn.data.results.content.map(
            (vehicle) => vehicle.lotNumberStr,
        );
        const listingUrls = lotNumbers.map((lot) => COPART_API.listingUrl(lot));

        // split results
        const listingUrl = listingUrls.pop();
        const lotNumber = lotNumbers.pop();
        const extras = {listingUrls, lotNumbers};

        // Send back results
        return {salvageName: 'copart', listingUrl, lotNumber, extras};
    },

    /*------*\
      SCRAPE
    \*------*/
    lotNumberFromTab: async (tab) => {
        const lotExecuting = browser.tabs.executeScript(tab.id, {
            code: `
                document
                    .querySelector("#lot-details .lot-number")
                    .lastChild
                    .textContent
                    .trim()`,
        });
        const lotNumber = (await lotExecuting)[0];
        const salvageName = 'copart';
        return {lotNumber, salvageName};
    },

    /*--------*\
      DOWNLOAD
    \*--------*/
    // Image info
    imageInfoFromLotNumber: async (lotNumber) => {
        // Configure image download
        const imagesUrl = `https://www.copart.com/public/data/lotdetails/solr/lotImages/${lotNumber}/USA`;
        const headers = {
            'User-Agent': window.navigator.userAgent,
            Accept: 'application/json, text/plain, */*',
        };

        // Fetch image info
        let response = await fetch(imagesUrl, {headers});

        // Check status
        if (!response.ok)
            throw `Copart encountered a server error: ${response.status} error.`;

        // Check response content
        if (
            !response.headers.get('content-type').startsWith('application/json')
        ) {
            throwCaptchaError();
        }

        // Get response content
        return await response.json();
    },

    // Hero images
    heroImages: async (imageInfo) => {
        console.log('Copart downloading hero images.');

        // Validate imageInfo
        if (imageInfo.returnCode != 1)
            throw 'Copart encountered a server error. Try again later?';

        // Find images, pick the higher resolution
        const heroImages = imageInfo.data.imagesList.content
            .map((image) => {
                if (image.imageTypeEnum !== 'IMAGE') return;
                return image.highResUrl ? image.highResUrl : image.fullResUrl;
            })
            .filter((v) => v);

        // Notify user
        sendNotification(`Processing ${heroImages.length} high-res images.`);

        // Done!
        return heroImages;
    },
    // pickBestImages: (imageInfo) => {
    //     // Grab image resolutions
    //     const highs = imageInfo.data.imagesList.HIGH_RESOLUTION_IMAGE;
    //     const fulls = imageInfo.data.imagesList.FULL_IMAGE;

    //     // Pick the highest resolution for each
    //     const bestUrls = [];
    //     for (let full of fulls) {
    //         // Use full_res_image if a high_res is not available
    //         if (!full.highRes) {
    //             bestUrls.push(full.url);
    //             continue;
    //         }

    //         // Get corresponding high_res_image
    //         const num = full.sequenceNumber;
    //         const high = highs.find((i) => i.sequenceNumber === num);

    //         // Check high_res_image
    //         if (!high) {
    //             bestUrls.push(full.url);
    //             continue;
    //         }

    //         // Use high_res_image
    //         bestUrls.push(high.url);
    //     }

    //     // Done!
    //     return bestUrls;
    // },

    // Panorama/walkaround
    bonusImages: async (imageInfo) => {
        console.log('Copart downloading bonus images.');
        // Fetch images
        let walkaroundUrls, panoUrls;
        try {
            walkaroundUrls = await COPART_API.walkaroundObjectUrls(imageInfo);
        } catch {}

        try {
            panoUrls = await COPART_API.panoramaObjectUrls(imageInfo);
        } catch {}

        // Do some logging
        if (walkaroundUrls)
            console.log(`Fetched ${walkaroundUrls.length} walkaround images.`);
        else console.log('Did not find walkaround images.');
        console.log(
            `${
                panoUrls ? 'Fetched and processed' : 'Did not find'
            } panorama images.`,
        );

        // Done!
        return {walkaroundUrls, panoUrls};
    },
    walkaroundObjectUrls: async (imageInfo) => {
        // Find exterior 360 image
        const exteriorImageInfo = imageInfo.data.imagesList.content.find(
            (i) => i.imageTypeEnum === 'EXTERIOR_360',
        );

        // Extract, format data
        const {image360Url, frameCount} = exteriorImageInfo;
        const frameUrl = (frame) =>
            image360Url.replace(/(?<=frames_)\d+/, frame);
        const walkaroundIndexes = Array(frameCount).keys();

        // Notify user
        sendNotification(`Downloading ${frameCount + 1} exterior 360 images.`);

        // Build a list of all URLs
        const walkaroundUrls = [...Array(frameCount).keys().map(frameUrl)];

        // Fetch image data, convert object URLs
        let walkPromises = walkaroundUrls.map(fetchObjectUrl);
        let walkSettled = await Promise.allSettled(walkPromises);

        // Check for errors, hand back object URLs
        return walkSettled.map((p) => p.value || 'TODO: add rejected image');
    },
    panoramaObjectUrls: async (imageInfo) => {
        // Notify user
        sendNotification('Processing interior 360. Please wait...');

        // Find interior 360 image
        const interiorImageInfo = imageInfo.data.imagesList.content.find(
            (i) => i.imageTypeEnum === 'INTERIOR_360',
        );

        // Fetch image
        const equirectangularImage = await fetchImageData(
            interiorImageInfo.image360Url,
        );

        // Start workers to convert this equirectangular projection
        // into six faces of a cubemap
        let panoUrls;
        try {
            const faceImageDataEntries =
                await COPART_API.convertEquirectangular(equirectangularImage);
            const facesUrlsEntries = faceImageDataEntries.map(([f, iD]) => [
                f,
                urlFromImageData(iD),
            ]);
            const facesUrls = Object.fromEntries(facesUrlsEntries);
            panoUrls = facesUrls;
        } catch (e) {
            console.log(e);
        } finally {
            // Make sure all copartWorkers are shut down!
            // stopCopartWorkers();
            return panoUrls;
        }
    },
    convertEquirectangular: (imageData) => {
        const notifyProgress = notifyAtHalfway();
        const workerPromises = [
            COPART_API.extractCubemapFace(
                imageData,
                'pano_r',
                'px',
                notifyProgress,
            ),
            COPART_API.extractCubemapFace(
                imageData,
                'pano_l',
                'nx',
                notifyProgress,
            ),
            COPART_API.extractCubemapFace(
                imageData,
                'pano_u',
                'py',
                notifyProgress,
            ),
            COPART_API.extractCubemapFace(
                imageData,
                'pano_d',
                'ny',
                notifyProgress,
            ),
            COPART_API.extractCubemapFace(
                imageData,
                'pano_f',
                'pz',
                notifyProgress,
            ),
            COPART_API.extractCubemapFace(
                imageData,
                'pano_b',
                'nz',
                notifyProgress,
            ),
        ];
        return Promise.all(workerPromises);
    },
    extractCubemapFace: async (
        imageData,
        key,
        direction,
        notifyProgress = console.log,
    ) => {
        // Create worker
        const worker = new Worker('./salvage_api/copart-pano-worker.js');
        copartWorkers.push(worker);

        // Listen to error events
        worker.onerror = (error) => console.log(error);
        worker.onmessageerror = (error) => console.log(error);

        // Start worker
        const extractionPromise = new Promise((resolve) => {
            // Start at the end
            worker.onmessage = (message) => {
                const {imageData, percentDone} = message.data;
                if (percentDone) notifyProgress(percentDone, direction);
                if (imageData) resolve([key, imageData]);
            };

            // Send worker data to work on
            worker.postMessage({
                data: imageData,
                face: direction,
                rotation: 0,
                interpolation: 'lanczos',
            });
        });

        // Hand control back. Promise resolves to [key, imageData]
        return extractionPromise;
    },
};

// ImageInfo looks like:
// {
//   "returnCode": 1,
//   "returnCodeDesc": "Success",
//   "data": {
//     "lotDetails": {
//       "driveStatus": false,
//       "siteCodes": [
//         "CPRTUS"
//       ],
//       "dynamicLotDetails": {
//         "errorCode": "",
//         "buyerNumber": 1,
//         "source": "web",
//         "buyTodayBid": 0,
//         "currentBid": 0,
//         "totalAmountDue": 0,
//         "sealedBid": false,
//         "firstBid": true,
//         "hasBid": false,
//         "sellerReserveMet": true,
//         "lotSold": false,
//         "bidStatus": "NEVER_BID",
//         "saleStatus": "PURE_SALE",
//         "counterBidStatus": "DEFAULT",
//         "startingBidFlag": false,
//         "buyerHighBidder": false,
//         "anonymous": false,
//         "nonSyncedBuyer": false
//       },
//       "vehicleTypeCode": "VEHTYPE_V",
//       "soldToMember": 0,
//       "showClaimForm": false,
//       "lotPlugAcv": 26750,
//       "readyForReplayFlag": false,
//       "carFaxReportAvailable": false,
//       "lotNumberStr": "74980204",
//       "lotYardSameAsKioskYard": false,
//       "pwlot": false,
//       "lotSold": false,
//       "ln": 74980204,
//       "mkn": "HONDA",
//       "lmg": "ACCORD",
//       "lm": "ACCORD SPO",
//       "mtrim": "SPORT",
//       "lcy": 2022,
//       "fv": "1HGCV1F35NA******",
//       "la": 26376,
//       "rc": 7100.56,
//       "orr": 28353,
//       "egn": "1.5L  4",
//       "cy": "4",
//       "ld": "2022 HONDA ACCORD SPORT",
//       "yn": "CA - REDDING",
//       "cuc": "USD",
//       "tz": "PDT",
//       "lad": 1728025200000,
//       "at": "12:00:00",
//       "hb": 0,
//       "ss": 5,
//       "bndc": "",
//       "bnp": 0,
//       "sbf": false,
//       "dd": "REAR END",
//       "tims": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/lpp/1024/b088c713470c4862b93f1fcd1cbd4665_thb.jpg",
//       "lic": [
//         "CERT-D",
//         "IV"
//       ],
//       "gr": "",
//       "dtc": "RR",
//       "al": "",
//       "ynumb": 343,
//       "phynumb": 343,
//       "bf": false,
//       "ymin": 60,
//       "long": -122.27402,
//       "lat": 40.42233,
//       "zip": "96007 8706",
//       "offFlg": false,
//       "locCountry": "USA",
//       "locCity": "ANDERSON",
//       "locState": "CA",
//       "tsmn": "AUTOMATIC",
//       "htsmn": "Y",
//       "tmtp": "AUTOMATIC",
//       "vfs": false,
//       "myb": 0,
//       "lmc": "HOND",
//       "lcc": "CERT-D",
//       "lcd": "RUNS AND DRIVES",
//       "clr": "WHITE",
//       "ft": "GAS",
//       "hk": "YES",
//       "drv": "Front-wheel Drive",
//       "ess": "Pure Sale",
//       "slfg": false,
//       "lsts": "O",
//       "showSeller": false,
//       "sstpflg": false,
//       "lipn": "9ESM310",
//       "hcr": true,
//       "vehTypDesc": "AUTOMOBILE",
//       "syn": "CA - REDDING",
//       "ifs": false,
//       "ils": false,
//       "pbf": true,
//       "crg": 0,
//       "lu": 1728341112000,
//       "brand": "COPART",
//       "mof": false,
//       "bsf": true,
//       "blucar": false,
//       "hegn": "Y",
//       "lstg": 40,
//       "ldu": "2022-honda-accord-sport-ca-redding",
//       "pcf": false,
//       "btcf": false,
//       "tpfs": false,
//       "trf": false,
//       "csc": "NOT_APPLICABLE",
//       "mlf": false,
//       "fcd": false,
//       "slgc": "0",
//       "cfx": false,
//       "hcfx": true,
//       "isPWlot": false,
//       "lspa": 0
//     },
//     "imagesList": {
//       "totalElements": 14,
//       "content": [
//         {
//           "swiftFlag": false,
//           "frameCount": 0,
//           "status": "I",
//           "imageTypeDescription": "UNKNOWN",
//           "fullUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/b088c713470c4862b93f1fcd1cbd4665_ful.jpg",
//           "thumbnailUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/b088c713470c4862b93f1fcd1cbd4665_thb.jpg",
//           "highResUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/b088c713470c4862b93f1fcd1cbd4665_hrs.jpg",
//           "imageSeqNumber": 1,
//           "imageTypeCode": "IMG",
//           "highRes": true,
//           "imageTypeEnum": "IMAGE"
//         },
//         {
//           "swiftFlag": false,
//           "frameCount": 0,
//           "status": "I",
//           "imageTypeDescription": "UNKNOWN",
//           "fullUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/3d093ab595464bea9dae0d7807050cbb_ful.jpg",
//           "thumbnailUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/3d093ab595464bea9dae0d7807050cbb_thb.jpg",
//           "highResUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/3d093ab595464bea9dae0d7807050cbb_hrs.jpg",
//           "imageSeqNumber": 2,
//           "imageTypeCode": "IMG",
//           "highRes": true,
//           "imageTypeEnum": "IMAGE"
//         },
//         {
//           "swiftFlag": false,
//           "frameCount": 0,
//           "status": "I",
//           "imageTypeDescription": "UNKNOWN",
//           "fullUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/9d6efde96a534d81a84ad030f9257a9a_ful.jpg",
//           "thumbnailUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/9d6efde96a534d81a84ad030f9257a9a_thb.jpg",
//           "highResUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/9d6efde96a534d81a84ad030f9257a9a_hrs.jpg",
//           "imageSeqNumber": 3,
//           "imageTypeCode": "IMG",
//           "highRes": true,
//           "imageTypeEnum": "IMAGE"
//         },
//         {
//           "swiftFlag": false,
//           "frameCount": 0,
//           "status": "I",
//           "imageTypeDescription": "UNKNOWN",
//           "fullUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/aec002ceb6d04ecda6b0b3b244a33af3_ful.jpg",
//           "thumbnailUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/aec002ceb6d04ecda6b0b3b244a33af3_thb.jpg",
//           "highResUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/aec002ceb6d04ecda6b0b3b244a33af3_hrs.jpg",
//           "imageSeqNumber": 4,
//           "imageTypeCode": "IMG",
//           "highRes": true,
//           "imageTypeEnum": "IMAGE"
//         },
//         {
//           "swiftFlag": false,
//           "frameCount": 0,
//           "status": "I",
//           "imageTypeDescription": "UNKNOWN",
//           "fullUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/f96d902e3fe1444094b22f5e169129de_ful.jpg",
//           "thumbnailUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/f96d902e3fe1444094b22f5e169129de_thb.jpg",
//           "highResUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/f96d902e3fe1444094b22f5e169129de_hrs.jpg",
//           "imageSeqNumber": 5,
//           "imageTypeCode": "IMG",
//           "highRes": true,
//           "imageTypeEnum": "IMAGE"
//         },
//         {
//           "swiftFlag": false,
//           "frameCount": 0,
//           "status": "I",
//           "imageTypeDescription": "UNKNOWN",
//           "fullUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/a3cd875ee87d4d049c2fd26308e07d0c_ful.jpg",
//           "thumbnailUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/a3cd875ee87d4d049c2fd26308e07d0c_thb.jpg",
//           "highResUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/a3cd875ee87d4d049c2fd26308e07d0c_hrs.jpg",
//           "imageSeqNumber": 6,
//           "imageTypeCode": "IMG",
//           "highRes": true,
//           "imageTypeEnum": "IMAGE"
//         },
//         {
//           "swiftFlag": false,
//           "frameCount": 0,
//           "status": "I",
//           "imageTypeDescription": "UNKNOWN",
//           "fullUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/269297e026f24e2bab55ab1ab64f55a3_ful.jpg",
//           "thumbnailUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/269297e026f24e2bab55ab1ab64f55a3_thb.jpg",
//           "highResUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/269297e026f24e2bab55ab1ab64f55a3_hrs.jpg",
//           "imageSeqNumber": 7,
//           "imageTypeCode": "IMG",
//           "highRes": true,
//           "imageTypeEnum": "IMAGE"
//         },
//         {
//           "swiftFlag": false,
//           "frameCount": 0,
//           "status": "I",
//           "imageTypeDescription": "UNKNOWN",
//           "fullUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/2e5f460deb1e408db43479f6ade60602_ful.jpg",
//           "thumbnailUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/2e5f460deb1e408db43479f6ade60602_thb.jpg",
//           "highResUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/2e5f460deb1e408db43479f6ade60602_hrs.jpg",
//           "imageSeqNumber": 8,
//           "imageTypeCode": "IMG",
//           "highRes": true,
//           "imageTypeEnum": "IMAGE"
//         },
//         {
//           "swiftFlag": false,
//           "frameCount": 0,
//           "status": "I",
//           "imageTypeDescription": "UNKNOWN",
//           "fullUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/a45b46e4d38e4564966ed57b927bab46_ful.jpg",
//           "thumbnailUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/a45b46e4d38e4564966ed57b927bab46_thb.jpg",
//           "highResUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/a45b46e4d38e4564966ed57b927bab46_hrs.jpg",
//           "imageSeqNumber": 9,
//           "imageTypeCode": "IMG",
//           "highRes": true,
//           "imageTypeEnum": "IMAGE"
//         },
//         {
//           "swiftFlag": false,
//           "frameCount": 55,
//           "status": "I",
//           "imageTypeDescription": "UNKNOWN",
//           "fullUrl": "https://c-static.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/8236acd34e0f439cb9944c908b35fe3b_ful.jpg",
//           "image360Url": "https://c-static.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/8236acd34e0f439cb9944c908b35fe3b_frames_0.jpg",
//           "thumbnailUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/8236acd34e0f439cb9944c908b35fe3b_thb.jpg",
//           "imageSeqNumber": 11,
//           "imageTypeCode": "EXT360",
//           "highRes": false,
//           "imageTypeEnum": "EXTERIOR_360"
//         },
//         {
//           "swiftFlag": false,
//           "frameCount": 0,
//           "status": "I",
//           "imageTypeDescription": "UNKNOWN",
//           "fullUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/3ef5871180cb4fb78baccbf7e4c0e797_ful.jpg",
//           "thumbnailUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/3ef5871180cb4fb78baccbf7e4c0e797_thb.jpg",
//           "highResUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/3ef5871180cb4fb78baccbf7e4c0e797_hrs.jpg",
//           "imageSeqNumber": 11,
//           "imageTypeCode": "IMG",
//           "highRes": true,
//           "imageTypeEnum": "IMAGE"
//         },
//         {
//           "swiftFlag": false,
//           "frameCount": 0,
//           "status": "I",
//           "imageTypeDescription": "UNKNOWN",
//           "fullUrl": "https://c-static.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/3a10653476a549399b15569a7a632b4d_O.jpeg",
//           "image360Url": "https://c-static.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/3a10653476a549399b15569a7a632b4d_O.jpeg",
//           "thumbnailUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/3a10653476a549399b15569a7a632b4d_thb.jpg",
//           "highResUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/3a10653476a549399b15569a7a632b4d_O.jpeg",
//           "imageSeqNumber": 12,
//           "imageTypeCode": "INT360",
//           "highRes": true,
//           "imageTypeEnum": "INTERIOR_360"
//         },
//         {
//           "swiftFlag": false,
//           "frameCount": 0,
//           "status": "I",
//           "imageTypeDescription": "UNKNOWN",
//           "fullUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/fdb1104c829d405394bdef569f21fa9a_ful.jpg",
//           "thumbnailUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/fdb1104c829d405394bdef569f21fa9a_thb.jpg",
//           "highResUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/fdb1104c829d405394bdef569f21fa9a_hrs.jpg",
//           "imageSeqNumber": 12,
//           "imageTypeCode": "IMG",
//           "highRes": true,
//           "imageTypeEnum": "IMAGE"
//         },
//         {
//           "swiftFlag": false,
//           "frameCount": 0,
//           "status": "I",
//           "imageTypeDescription": "UNKNOWN",
//           "fullUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/fe71e8d4b3184d4c91ad23f02283a863_ful.jpg",
//           "thumbnailUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/fe71e8d4b3184d4c91ad23f02283a863_thb.jpg",
//           "highResUrl": "https://cs.copart.com/v1/AUTH_svc.pdoc00001/ids-c-prod-lpp/1024/fe71e8d4b3184d4c91ad23f02283a863_hrs.jpg",
//           "imageSeqNumber": 14,
//           "imageTypeCode": "IMG",
//           "highRes": true,
//           "imageTypeEnum": "IMAGE"
//         }
//       ],
//       "facetFields": [],
//       "spellCheckList": null,
//       "suggestions": null,
//       "realTime": false
//     }
//   }
// }

// ImageInfo used to look like:
// {
//     returnCode: 1,
//     returnCodeDesc: "Success",
//     data: {
//         lotDetails: null,
//         imagesList: {
//             HIGH_RESOLUTION_IMAGE: [
//                 {
//                     url: "https://cs.copart.com/v1/AUTH_svc.pdoc00001/HPX93/f3aba7e6-f488-4fe4-aa47-11309988ced0.JPG",
//                     imageType: "H",
//                     sequenceNumber: 1,
//                     swiftFlag: false,
//                     frameCount: 0,
//                     status: "I",
//                     imageTypeDescription: "HIGH_RESOLUTION_IMAGE",
//                     highRes: false
//                 }
//             ],
//             FULL_IMAGE: [
//                 {
//                     url: "https://cs.copart.com/v1/AUTH_svc.pdoc00001/PIX450/dd68c0bd-4e50-42d6-a067-3b2e1ae5abdd.JPG",
//                     imageType: "F",
//                     sequenceNumber: 1,
//                     swiftFlag: false,
//                     frameCount: 0,
//                     status: "I",
//                     imageTypeDescription: "FULL_IMAGE",
//                     highRes: true
//                 }
//             ],
//             THUMBNAIL_IMAGE: [
//                 {
//                     url: "https://cs.copart.com/v1/AUTH_svc.pdoc00001/PIX450/3ab2c19a-b02d-489b-822d-080219171da5.JPG",
//                     imageType: "T",
//                     sequenceNumber: 1,
//                     swiftFlag: false,
//                     frameCount: 0,
//                     status: "I",
//                     imageTypeDescription: "THUMBNAIL_IMAGE",
//                     highRes: false
//                 }
//             ],
//             EXTERIOR_360: [
//                 {
//                     url: "https://c-static.copart.com/v1/AUTH_svc.pdoc00001/LPP236/eab3b74477b74d0e89e7a6210d2841a2_frames_0.jpg",
//                     imageType: "EXT360",
//                     sequenceNumber: 11,
//                     swiftFlag: false,
//                     frameCount: 55,
//                     status: "I",
//                     imageTypeDescription: "EXTERIOR_360",
//                     highRes: false
//                 }
//             ],
//             INTERIOR_360: [
//                 {
//                     url: "https://c-static.copart.com/v1/AUTH_svc.pdoc00001/LPP236/2c776bee45ed483cb9c102b465b7f8a5_O.jpeg",
//                     imageType: "INT360",
//                     sequenceNumber: 12,
//                     swiftFlag: false,
//                     frameCount: 0,
//                     status: "I",
//                     imageTypeDescription: "INTERIOR_360",
//                     highRes: false
//                 }
//             ]
//         }
//     }
// }

SALVAGE_APIS.copart = COPART_API;
