async function openSalvagePages(vinInput) {
    let storage = await browser.storage.local.get("settings");
    let settings = storage.settings || DEFAULT_SETTINGS;
    // Fallbacks will be enabled in a future version
    settings.openFallbacks = false;

    // test the clipboard text out of an abundance of caution since we need to do code injection for Copart.
    vinInput = encodeURIComponent(vinInput).replace(/^\s+|\s+$/g, '');
    if (!VINREGEX.test(vinInput)) {
        sendNotification("That VIN doesn't look right...", {displayAs: "error"})
        return;
    };

    // start the progress bar. Each search will increment once.
    let searchCount = [settings.searchCopart,
                       settings.searchIaai,
                       settings.searchRow52].filter(e=>e).length
    browser.runtime.sendMessage({
        type: "feedback", values: [{
            action: "search-start",
            total: searchCount
        }]
    }).catch( err=> console.log(err+"\n is the popup closed?") )

    // go through each enabled site and get either a listing page or a fallback URL
    let searchPromises = [];
    if (settings.searchCopart) {
        searchPromises.push( searchCopart(vinInput, settings.fallbackZipCode) )
    }
    if (settings.searchIaai) {
        searchPromises.push( searchIaai(vinInput, settings.fallbackZipCode) )
    };
    if (settings.searchRow52) {
        searchPromises.push( searchRow52(vinInput, settings.fallbackZipCode) )
    };

    // alert user if no searches were enabled
    if (!searchPromises.length) {
        sendNotification("No salvage yards enabled. Check the settings page.")
    }
    // wait for searches to complete
    let results = await Promise.allSettled(searchPromises);

    // sort searches into sucesses and failures
    let successfulOpeners = [];
    let fallbackOpeners = [];
    results.map( promise=>{
        if (promise.status==="fulfilled") {
            successfulOpeners.push(promise.value)
        } else {
            fallbackOpeners.push(promise.reason)
        }
    })

    // if any one search succeeded, skip fallbacks
    if (successfulOpeners.length) {
        // Each search function notifies on success with more details than we
        // have access to.
        successfulOpeners.forEach(opener=>opener())
    } else if (settings.openFallbacks) {
        sendNotification("No matches were found in your configured sites.", {displayAs: "error"})
        fallbackOpeners.forEach(opener=>opener())
    }
    browser.runtime.sendMessage({
        type: "feedback", values: [{
            action: "search-end",
            total: searchCount
        }]
    }).catch( err=>console.log(err+"\n is the popup closed?") )
};

let incrementProgressbar = ()=>{
    browser.runtime.sendMessage({
        type: "feedback",
        values: [{
            action: "search-increment"
        }]
    }).catch( err=>console.log(err+"\n is the popup closed?") )
}


/*------*\
  COPART  
\*------*/
function searchCopart(vinInput, fallbackZipCode) {
    return new Promise(async (resolve, reject) => {
        try {
            // perform query for VIN
            let searchUrl = "https://www.copart.com/public/lots/vin/search";
            let payload = {
                "filter": {
                    "MISC": [
                        `ps_vin_number:${vinInput}`,
                        "sold_flag:false"
            ]}};
            let response = await fetch(
                searchUrl,
                {
                    method: "POST",
                    headers: {
                        "User-Agent": window.navigator.userAgent,
                        "Accept": "application/json, text/plain, */*",
                        "Content-Type": "application/json;charset=utf-8"
                    },
                    body: JSON.stringify(payload)
                }
            )
            if (!response.ok) {throw `something went wrong on their end: ${response.status} error.`;}
            // parse response
            let jsn = await response.json()
            if (!jsn.data.hasOwnProperty("results")) {throw "something went wrong on their end...";}
            // build opener
            if (jsn.data.results.content.length) {
                let lotNumbers = jsn.data.results.content.map( (vehicle)=>vehicle.lotNumberStr )
                let openers = ()=>{
                    lotNumbers.forEach( (lotNumber)=>{
                        let lotUrl = `https://www.copart.com/lot/${lotNumber}`;
                        sendNotification(`Copart: your vehicle is lot #${lotNumber}!`, {displayAs:"success"})
                        browser.tabs.create( {url: lotUrl, active: false} )
                    })
                }
                resolve(openers);
            } else {throw "query returned no results";}
        } catch (error) {
            console.log(`Copart rejecting: ${error}`)
            sendNotification(`Copart: ${error}.`, {displayAs: "error"})
            reject( fallbackCopart(vinInput, fallbackZipCode) )
        } finally {incrementProgressbar(vinInput, fallbackZipCode)}
    })
}
function fallbackCopart(vinInput, fallbackZipCode) {
    // https://
    // www.copart.com/
    // vehicleFinderSearch/?
    // displayStr=
    //     %5B0%20TO%20250000%5D,
    //     %5B2011%20TO%202022%5D,
    //     10101&
    // searchStr=
    //     %7BMISC:%5B%23VehicleTypeCode:VEHTYPE_V,
    //     %23OdometerReading:%5B0%20TO%20250000%5D,
    //     %23LotYear:%5B2011%20TO%202022%5D,
    //     %257B!geofilt%2520pt%253D40.7085%252C-74.0037%2520sfield%253Dyard_location%2520d%253D50%257D%5D,
    //     sortByZip:true,
    //     buyerEnteredZip:10101,
    //     milesAway:50%7D
    let failureUrl = "https://www.copart.com/lotSearchResults/?free=true&query="+vinInput;
    return() => { browser.tabs.create({url: failureUrl, active: false}) }
}

/*----*\
  IAAI  
\*----*/
async function searchIaai(vinInput, fallbackZipCode) {
    return new Promise(async (resolve, reject)=>{
        try {
            // perform query for VIN
            let searchUrl = `https://www.iaai.com/Search?SearchVIN=${vinInput}`;
            let response = await fetch(
                searchUrl,
                {headers: {
                    "User-Agent": window.navigator.userAgent,
                    "Accept": "application/json, text/plain, */*"
                }}
            )
            if (!response.ok) {throw `something went wrong on their end: ${response.status} error.`;}
            if (!response.redirected) {throw "query returned no results.";}
            // open redirect URL in a new tab
            let redirectUrl = response.url;
            lotRe = /itemid=(\d{8})/
            if (lotRe.test(redirectUrl)){
                let lotNumber = lotRe.exec(redirectUrl)[1];
                sendNotification(`IAAI: your vehicle is lot #${lotNumber}!`, {displayAs:"success"})
            } else {
                throw "query returned no results."
            }
            resolve(()=>{ browser.tabs.create({url: redirectUrl, active: false}) })
        } catch (error) {
            console.log(`IAAI rejecting: ${error}`)
            sendNotification(`IAAI: ${error}`, {displayAs: "error"})
            reject( fallbackIaai(vinInput, fallbackZipCode) )
        } finally {incrementProgressbar()}
    })
}
function fallbackIaai(vinInput, fallbackZipCode) {
    let failureUrl = "https://www.iaai.com/Search?Keyword="+vinInput;
    return() => { browser.tabs.create({url: failureUrl, active: false}) }
}

/*-----*\
  ROW52  
\*-----*/
async function searchRow52(vinInput, fallbackZipCode) {
    return new Promise(async (resolve, reject)=>{
        try {
            var searchUrl = 'https://row52.com/Search/?YMMorVin=VIN&Year=&'+
            'V1='   + vinInput[0] +
            '&V2='  + vinInput[1] +
            '&V3='  + vinInput[2] +
            '&V4='  + vinInput[3] +
            '&V5='  + vinInput[4] +
            '&V6='  + vinInput[5] +
            '&V7='  + vinInput[6] +
            '&V8='  + vinInput[7] +
            '&V9='  + vinInput[8] +
            '&V10=' + vinInput[9] +
            '&V11=' + vinInput[10] +
            '&V12=' + vinInput[11] +
            '&V13=' + vinInput[12] +
            '&V14=' + vinInput[13] +
            '&V15=' + vinInput[14] +
            '&V16=' + vinInput[15] +
            '&V17=' + vinInput[16] +
            '&ZipCode=&Page=1&ModelId=&MakeId=&LocationId=&IsVin=true&Distance=50';
            let response = await fetch(searchUrl);
            if (!response.ok) { throw "something went wrong on their end..." }
            let parser = new DOMParser();
            let vehiclePaths;
            let resultsNum;
            try { // parse the response HTML and catch any errors
                let doc = parser.parseFromString(await response.text(), "text/html");
                let resultCountElement = doc.querySelector("#results-header span")
                let yardNameElement = document.querySelector("span[itemprop] strong")
                vehiclePaths = Array.from( doc.querySelectorAll(".block-link").values() )
                                        .map(  el=>el.attributes.href.value );
                resultsNum = /\d+/.exec(resultCountElement.innerText)[0]
            } catch { throw "something looks wrong with this page, try searching by hand."}
            
            if (vehiclePaths.length) {
                let yardName = yardNameElement.innerText.trim()
                sendNotification( `this vehicle is at ${yardName}`, {displayAs: "success"} )
                // We shouldn't have more than one listing, but never assume
                // anything without documentation.
                resolve( ()=>{
                    vehiclePaths.forEach( path=>{
                        browser.tabs.create({url: "https://row52.com"+path, active: false});
                    })
                })
            } else { throw "query returned no results." }
        } catch (error) {
            console.log(`Row52 rejecting: ${error}`)
            sendNotification(`Row52: ${error}`, {displayAs: "error"})
            reject( fallbackRow52(vinInput, fallbackZipCode) )
        } finally {incrementProgressbar()}
    })
};
function fallbackRow52(vinInput, fallbackZipCode) {
    let failureUrl = "https://www.copart.com/lotSearchResults/?free=true&query="+vinInput;
    return() => { browser.tabs.create({url: failureUrl, active: false}) }
}


/*------*\
  POCTRA  
\*------*/
async function searchPoctra(vinInput) {
    let POCTRA_REGEX = /^(?<yard>.*?) (Stock|Lot) No: (?<stock>\d*)<br>.*<br>Location: (?<location>.*)$/;
    try {
        let searchUrl = `https://poctra.com/search/ajax`;
        let body = `q=${vinInput}&by=&asc=&page=1`;
        let headers = {"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"};
        let response = await fetch( searchUrl, {method: "POST", headers, body} );
        if (!response.ok) { throw "something went wrong on their end..." }
        let parser = new DOMParser();
        try { // parse the response HTML and catch any errors
            let doc = parser.parseFromString(await response.text(), "text/html");
            let searchResults = doc.querySelectorAll("p");
            let stockNumbers = [];
            for (searchResult of searchResults) {
                let matched = POCTRA_REGEX.exec(searchResult.innerHTML.trim())
                if (!mached) {continue}
                stockNumbers.push(matched.groups)
                sendNotification( `Poctra: found a match: ${matched.yard} lot ${matched.stock}`, {displayAs: "success"} )
            }
        } catch { throw "something looks wrong with this page, try searching by hand."}
        return downloadByStock(stockNumbers)
    } catch (error) {
        console.log(`Poctra rejecting: ${error}`)
        sendNotification(`Poctra: ${error}`, {displayAs: "error"})
        reject( fallbackRow52(vinInput, fallbackZipCode) )
    }
}




console.log("search loaded!")
