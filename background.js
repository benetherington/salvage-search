async function openMyPage(resolve, reject) {
  let storage = await browser.storage.local.get("settings")
  settings = storage.settings
  let clip = await navigator.clipboard.readText()

  const vin_regex = RegExp("^[A-HJ-NPR-Z0-9]{3}[A-HJ-NPR-Z0-9]{5}[0-9X][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9]{6}$")

  if (!vin_regex.test(clip)) {
   browser.tabs.create({'url':'malformed.html'})
   return
  };

  if ((typeof settings === 'undefined') || settings.copart) {
    browser.tabs.create({
     "url": "https://www.copart.com/lotSearchResults/?query="+clip
    });
  };
  if ((typeof settings === 'undefined') || settings.iaai) {
    browser.tabs.create({
      "url": "https://www.iaai.com/VehicleSearch/SearchDetails?Keyword="+clip
    });
  };

  if ((typeof settings === 'undefined') || settings.row52) {
    var url = 'https://row52.com/Search/?YMMorVin=VIN&Year=&'+
    'V1='   + clip[0] +
    '&V2='  + clip[1] +
    '&V3='  + clip[2] +
    '&V4='  + clip[3] +
    '&V5='  + clip[4] +
    '&V6='  + clip[5] +
    '&V7='  + clip[6] +
    '&V8='  + clip[7] +
    '&V9='  + clip[8] +
    '&V10=' + clip[9] +
    '&V11=' + clip[10] +
    '&V12=' + clip[11] +
    '&V13=' + clip[12] +
    '&V14=' + clip[13] +
    '&V15=' + clip[14] +
    '&V16=' + clip[15] +
    '&V17=' + clip[16] +
    '&ZipCode=&Page=1&ModelId=&MakeId=&LocationId=&IsVin=true&Distance=50';

    browser.tabs.create({
      "url": url
    });
  };
};

browser.browserAction.onClicked.addListener(openMyPage);
