async function searchSalvageSites(vinInput) { console.log("openSalvagePages")
    // FEEDBACK
    sendProgress("search", "start")

    // SETTINGS
    let settings = await defaultedSettings()

    // SEARCH TERM
    vinInput = encodeURIComponent(vinInput).replace(/^\s+|\s+$/g, '');
    if (!VINREGEX.test(vinInput)) {
        sendNotification("That VIN doesn't look right...", {displayAs: "error"})
        sendProgress("search", "end")
        return;
    };

    // PRIMARY SEARCH
    let searchPromises = [];
    if (settings.searchCopart) {
        searchPromises.push( searchCopart(vinInput, settings.fallbackZipCode) )
    }
    if (settings.searchIaai) {
        searchPromises.push( searchIaai(vinInput, settings.fallbackZipCode) )
    }
    if (settings.searchRow52) {
        searchPromises.push( searchRow52(vinInput, settings.fallbackZipCode) )
    }
    // wait for results
    let searchOpener;
    searchOpener = await Promise.any(searchPromises)
        .catch(e=>{if (!e instanceof AggregateError){throw e}})
    // open results
    if (searchOpener) {
        sendProgress("search", "end")
        searchOpener()
        return
    }

    // ARCHIVE SEARCH
    let archivePromises = [];
    if (settings.searchPoctra) {
        archivePromises.push( searchPoctra(vinInput) )
    }
    if (settings.searchBidfax) {
        archivePromises.push( searchBidfax(vinInput) )
    }
    // wait for results
    let archiveOpener;
    archiveOpener = await Promise.any(archivePromises)
                    .catch(e=>{if (!e instanceof AggregateError){throw e}})
    // open results
    if (archiveOpener) {
        archiveOpener()
    }
    sendProgress("search", "end")
}


/*------*\
  COPART  
\*------*/
function searchCopart(vinInput, fallbackZipCode) { // -> function
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
                sendNotification(`Copart: found a match: lot #${lotNumber}!`, {displayAs:"success"})
                resolve( ()=>{
                    lotNumbers.forEach(lotNumber=>{
                        let lotUrl = `https://www.copart.com/lot/${lotNumber}`;
                        browser.tabs.create( {url: lotUrl} )
                        sendProgress("download", "attention")
                    })
                })
            } else {throw "query returned no results";}
        } catch (error) {
            console.log(`Copart rejecting: ${error}`)
            sendNotification(`Copart: ${error}.`, {displayAs: "error"})
            reject()
        }
    })
}


/*----*\
  IAAI  
\*----*/
async function searchIaai(vinInput, fallbackZipCode) { // -> function
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
                sendNotification(`IAAI: found a match: lot #${lotNumber}!`, {displayAs:"success"})
            } else {
                throw "query returned no results."
            }
            resolve(()=>{
                browser.tabs.create({url: redirectUrl})
                sendProgress("download", "attention")
            })
        } catch (error) {
            console.log(`IAAI rejecting: ${error}`)
            sendNotification(`IAAI: ${error}`, {displayAs: "error"})
            reject()
        }
    })
}

/*-----*\
  ROW52  
\*-----*/
async function searchRow52(vinInput, fallbackZipCode) { // -> function
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
                let resultCountElement = doc.querySelector("#results-header span");
                let yardNameElement = document.querySelector("span[itemprop] strong");
                vehiclePaths = Array.from( doc.querySelectorAll(".block-link").values() )
                                        .map(  el=>el.attributes.href.value );
                resultsNum = /\d+/.exec(resultCountElement.innerText)[0]
            } catch { throw "something looks wrong with this page, try searching by hand."}
            
            if (vehiclePaths.length) {
                let yardName = yardNameElement.innerText.trim()
                sendNotification( `Row52: Found a match at ${yardName}!`, {displayAs: "success"} )
                resolve( ()=>{
                    // We shouldn't have more than one listing, but never assume
                    // anything without API documentation.
                    vehiclePaths.forEach( path=>{
                        browser.tabs.create({url: "https://row52.com"+path});
                    })
                    sendProgress("download", "attention")
                })
            } else { throw "query returned no results." }
        } catch (error) {
            console.log(`Row52 rejecting: ${error}`)
            sendNotification(`Row52: ${error}`, {displayAs: "error"})
            reject()
        }
    })
};


/*------*\
  POCTRA  
\*------*/
async function searchPoctra(vinInput) { // -> function
    return new Promise(async (resolve, reject)=>{
        let POCTRA_REGEX = /^(?<yard>.*?) (Stock|Lot) No: (?<stock>\d*)<br>.*<br>Location: (?<location>.*)$/;
        try {
            // SEARCH
            let searchUrl = `https://poctra.com/search/ajax`;
            let body = `q=${vinInput}&by=&asc=&page=1`;
            let headers = {"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"};
            let response = await fetch( searchUrl, {method: "POST", headers, body} );
            if (!response.ok) { throw "something went wrong on their end..." }
            // CHECK FOR RESULTS
            let lotUrls = [];
            let parser = new DOMParser();
            let doc = parser.parseFromString(await response.text(), "text/html");
            // set base URI so that relative links work
            let base = doc.createElement("base");
            base.href = searchUrl;
            doc.head.append(base)
            let searchResults = doc.querySelectorAll(".clickable-row");
            if (!searchResults.length) {throw "search returned no results."}
            // PARSE RESULTS
            for (searchResult of searchResults) {
                // FIND PAGE LINK
                let lotLink = searchResult.querySelector("a");
                if (!lotLink) {continue}
                lotUrls.push(lotLink.href)
                // NOTIFY
                try {
                    let detailsElement = searchResult.querySelector("p");
                    let details = POCTRA_REGEX.exec(detailsElement.innerHTML.trim()).groups;
                    sendNotification( `Poctra: found a match at ${details.yard}! Lot ${details.stock}.`, {displayAs: "success"} )
                } catch {
                    sendNotification( "Poctra: found a match!", {displayAs: "success"})
                }
            }
            if (!lotUrls.length) {throw "search returned no results"}
            // SUCCESS!
            resolve(()=>{
                lotUrls.forEach( lotUrl=>{
                    browser.tabs.create({url: lotUrl})
                })
                sendProgress("download", "attention")
            })
        } catch (error) {
            console.log(`Poctra rejecting: ${error}`)
            sendNotification(`Poctra: ${error}`, {displayAs: "error"})
            reject()
        }
    })
};


/*------*\
  BIDFAX  
\*------*/
async function searchBidfax(vinInput) { // -> function
    return new Promise(async (resolve, reject)=>{
        try {
            // FETCH GC TOKEN
            let homeUrl = "https://en.bidfax.info";
            let tokenTab = await browser.tabs.create({url:homeUrl, active:false})
            await browser.tabs.executeScript(tokenTab.id,{code:
                `(()=>{
                    document.querySelector("#submit").click()
                })()`
            })
            let token = await browser.tabs.executeScript(tokenTab.id, {code:
                `(()=>{return (new URL(document.querySelector("link[rel=alternate]").href)).searchParams.get('token2');})()`
            })[0]
            browser.tabs.remove(tokenTab.id)
            
            // SEARCH
            let searchUrl = new URL("https://en.bidfax.info/")
            searchUrl.searchParams.append("do", "search")
            searchUrl.searchParams.append("subaction", "search")
            searchUrl.searchParams.append("story", vinInput)
            searchUrl.searchParams.append("token2", token)
            searchUrl.searchParams.append("action2", "search_action")
            let response = await fetch(searchUrl);
            if (!response.ok) { throw "something went wrong on their end..." }
            if (response.status === 301) {
                // Moved Permanently is returned when the GC token is invalid or
                // missing.
                console.log("BidFax wants a CAPTCHA check")
                browser.tabs.create({url:homeUrl})
                throw "CAPTCHA failed. Please click on a listing before trying again."
            }
            // CHECK FOR RESULTS
            let parser = new DOMParser()
            let doc = parser.parseFromString(await response.text(), "text/html");
            let searchResults = doc.querySelectorAll(".thumbnail.offer");
            if (!searchResults.length) {throw "search returned no results."}
            // PARSE RESULTS
            let lotUrls = [];
            let stockNumbers = [];
            for (searchResult of searchResults) {
                // FIND PAGE LINK
                let lotLinkElement = searchResult.querySelector(".caption a");
                if (!lotLinkElement) {continue}
                lotUrls.push(lotLinkElement.href)
                // NOTIFY
                try {
                    let yardNameElement = searchResult.querySelector(".short-storyup span");
                    let yardName = yardNameElement.innerText.trim();
                    let stockNumberElement = searchResult.querySelector(".short-story span");
                    let stockNumber = stockNumberElement.innerText;
                    if (stockNumbers.includes(stockNumber)) {
                        // Sometimes, multiple pages for the same lot number are
                        // returned, and we don't want to include this URL after
                        // all.
                        lotUrls.pop(lotLinkElement.href)
                        continue
                    }
                    stockNumbers.push(stockNumber)
                    sendNotification( `BidFax: found a match at ${yardName}! Lot ${stockNumber}.`, {displayAs: "success"} )
                } catch {
                    sendNotification( "BidFax: found a match!", {displayAs: "success"})
                }
            }
            if (!lotUrls.length) {throw "search returned no results"}
            // SUCCESS!
            resolve(()=>{
                lotUrls.forEach( lotUrl=>{
                    browser.tabs.create({url: lotUrl})
                })
                sendProgress("download", "attention")
            })
        } catch (error) {
            console.log(`BidFax rejecting: ${error}`)
            sendNotification(`BidFax: ${error}`, {displayAs: "error"})
            reject()
        }
    })
}

console.log("search loaded!")
