const VINREGEX = RegExp("^[A-HJ-NPR-Z0-9]{3}[A-HJ-NPR-Z0-9]{5}[0-9X][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9]{6}$", "i");

async function openSalvagePages(vinInput) {
    let storage = await browser.storage.local.get("settings");
    // console.log(storage);
    settings = storage.settings;
    let vinInput = await navigator.clipboard.readText();

    // test the clipboard text out of an abundance of caution since we need to do code injection for Copart.
    vinInput = encodeURIComponent(vinInput).replace(/^\s+|\s+$/g, '');
    if (!VINREGEX.test(vinInput)) {
        // browser.tabs.create({'url':'malformed.html'});
        console.log("Heyyyy, how did this bad input get through?")
        return;
    };
    if ((typeof settings === 'undefined') || settings.copart) {
        openCopart(vinInput);
    };
    if ((typeof settings === 'undefined') || settings.iaai) {
        openIaai(vinInput);
    };
    if ((typeof settings === 'undefined') || settings.row52) {
        openRow52(vinInput);
    };

};

function openCopart (vinInput) {
        payload = "".concat(
            "document.querySelector(\'input[data-uname=homeFreeFormSearch]\').value = \'", vinInput, "\';",
            "document.querySelector(\'input[data-uname=homeFreeFormSearch]\').dispatchEvent(new CompositionEvent(\'compositionend\'));",
            "document.querySelector(\'button[data-uname=homepageHeadersearchsubmit]\').click();"
        );
    chrome.tabs.create({url: "https://www.copart.com/"}, function (tab) {
        console.log('tabs.create');
        browser.tabs.executeScript(tab.id, {code: payload});
    });
  };

function openIaai (vinInput) {
    chrome.tabs.create({
        "url": "https://www.iaai.com/VehicleSearch/SearchDetails?Keyword="+vinInput
    });
};

function openRow52 (vinInput) {
        var url = 'https://row52.com/Search/?YMMorVin=VIN&Year=&'+
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
    browser.tabs.create({"url": url});
};

console.log("search loaded!")
