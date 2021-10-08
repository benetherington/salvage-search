async function openSalvagePages(vinInput) {
    let storage = await browser.storage.local.get("settings")
    let settings = storage.settings || DEFAULT_SETTINGS

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
            reject(()=>{
                let failureUrl = "https://www.copart.com/lotSearchResults/?free=true&query="+vinInput;
                browser.tabs.create({url: failureUrl, active: false})
            })
        } finally {incrementProgressbar()}
    })
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
            reject(()=>{
                let failureUrl = "https://www.iaai.com/Search?Keyword="+vinInput;
                browser.tabs.create({url:failureUrl, active:false})
            })
        } finally {incrementProgressbar()}
    })
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
            let yardName;
            try { // parse the response HTML and catch any errors
                let doc = parser.parseFromString(await response.text(), "text/html");
                let resultCountElement = doc.querySelector("#results-header span")
                let yardNameElement = document.querySelector("span[itemprop] strong")
                vehiclePaths = Array.from( doc.querySelectorAll(".block-link").values() )
                                        .map(  el=>el.attributes.href.value );
                resultsNum = /\d+/.exec(resultCountElement.innerText)[0]
                yardName = yardNameElement.innerText.trim()
            } catch { throw "something looks wrong with this page, try searching by hand."}
            
            if (vehiclePaths.length) {
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
            reject( ()=>{
                browser.tabs.create({url: searchUrl, active: false})
            })
        } finally {incrementProgressbar()}
    })
};


console.log("search loaded!")
