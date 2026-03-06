document.addEventListener("DOMContentLoaded", () => {
  const $ = (sel) => document.querySelector(sel);

  // ========== DOM ELEMENTS ==========
  const locationEl = $('#location');
  const headlineEl = $('#headline');
  const tempEl = $('#temp');
  const descriptionEl = $('#description');
  const extremeLabelEl = $('#extremeLabel');
  const extremeValueEl = $('#extremeValue');
  const bgImg = $('#bgImg');
  const saveCurrent = $('#saveCurrent');
  const particlesEl = $('#particles');
  const myLocationBtn = $('#myLocationBtn');

  const navHome = $('#navHome');
  const navHourly = $('#navHourly');
  const navWeek = $('#navWeek');
  const navSearch = $('#navSearch');
  const navSettings = $('#navSettings');

  const screenHome = $('#home-screen');
  const screenHourly = $('#hourly-screen');
  const screenWeek = $('#week-screen');
  const screenSearch = $('#search-screen');
  const screenSettings = $('#settings-screen');

  const hourlyTimeline = $('#hourly-timeline');
  const dailyCards = $('#daily-cards');

  const searchInput = $('#searchInput');
  const searchCancel = $('#searchCancel');
  const favoritesList = $('#favoritesList');
  const recentList = $('#recentList');
  const manageFavorites = $('#manageFavorites');
  const clearRecentsBtn = $('#clearRecents');

  const unitsTempSelect = $('#unitsTemp');
  const unitsWindSelect = $('#unitsWind');
  const probRangeToggle = $('#probRange');
  const timeFormatSelect = $('#timeFormat');
  const languageSelect = $('#languageSelect');

  const loader = $('#loader');
  const toast = $('#toast');
  const capeWindBanner = $('#capeWindBanner');
  const capeWindText = $('#capeWindText');
  const capeWindDismiss = $('#capeWindDismiss');

  const STORAGE = { favorites: "pw_favorites", recents: "pw_recents", home: "pw_home", location: "pw_location" };
  const SCREENS = [screenHome, screenHourly, screenWeek, screenSearch, screenSettings];
  const THRESH = { RAIN_PCT: 40, WIND_KPH: 25, COLD_C: 16, HOT_C: 32 };

  // ========== INDEXEDDB WEATHER CACHE ==========
  const CACHE_DB = 'pw_weather_cache';
  const CACHE_STORE = 'responses';
  const CACHE_VERSION = 1;
  const CACHE_MAX_AGE = 30 * 60 * 1000; // 30 minutes
  let cacheDB = null;
  function openCacheDB() {
    return new Promise((resolve, reject) => {
      if (cacheDB) { resolve(cacheDB); return; }
      const req = indexedDB.open(CACHE_DB, CACHE_VERSION);
      req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE); };
      req.onsuccess = () => { cacheDB = req.result; resolve(cacheDB); };
      req.onerror = () => reject(req.error);
    });
  }
  function cacheKey(place) { return `${parseFloat(place.lat).toFixed(3)},${parseFloat(place.lon).toFixed(3)}`; }
  async function getCachedWeather(place) {
    try {
      const db = await openCacheDB();
      return new Promise((resolve) => {
        const tx = db.transaction(CACHE_STORE, 'readonly');
        const req = tx.objectStore(CACHE_STORE).get(cacheKey(place));
        req.onsuccess = () => {
          const entry = req.result;
          if (entry && (Date.now() - entry.timestamp) < CACHE_MAX_AGE) resolve(entry);
          else resolve(null);
        };
        req.onerror = () => resolve(null);
      });
    } catch { return null; }
  }
  async function setCachedWeather(place, payload) {
    try {
      const db = await openCacheDB();
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      tx.objectStore(CACHE_STORE).put({ payload, timestamp: Date.now() }, cacheKey(place));
    } catch { /* silent fail */ }
  }
  const offlineEl = document.getElementById('offlineIndicator');
  function showCacheAge(timestamp) {
    if (!offlineEl) return;
    const mins = Math.round((Date.now() - timestamp) / 60000);
    offlineEl.textContent = mins < 1 ? 'Using cached data (just now)' : `Last updated ${mins} min ago`;
    offlineEl.classList.add('visible');
  }
  function hideCacheAge() { if (offlineEl) offlineEl.classList.remove('visible'); }

  // ========== FULL UI TRANSLATIONS ==========
  const T = {
    // Navigation
    nav: {
      home: { en: "Home", af: "Tuis", zu: "Ikhaya", xh: "Ikhaya", st: "Lapeng" },
      hourly: { en: "Hourly", af: "Uurliks", zu: "Ngamahora", xh: "Ngeyure", st: "Ka hora" },
      week: { en: "Week", af: "Week", zu: "Iviki", xh: "Iveki", st: "Beke" },
      search: { en: "Search", af: "Soek", zu: "Sesha", xh: "Khangela", st: "Batla" },
      settings: { en: "Settings", af: "Instellings", zu: "Izilungiselelo", xh: "Iisetingi", st: "Litlhophiso" }
    },
    // Screen titles
    screens: {
      hourly: { en: "Hourly", af: "Uurliks", zu: "Ngamahora", xh: "Ngeyure", st: "Ka hora" },
      week: { en: "7-Day", af: "7-Dae", zu: "Izinsuku-7", xh: "Intsuku-7", st: "Matsatsi-7" },
      search: { en: "Search", af: "Soek", zu: "Sesha", xh: "Khangela", st: "Batla" },
      settings: { en: "Settings", af: "Instellings", zu: "Izilungiselelo", xh: "Iisetingi", st: "Litlhophiso" }
    },
    // Search screen
    search: {
      placeholder: { en: "Search for a place", af: "Soek 'n plek", zu: "Sesha indawo", xh: "Khangela indawo", st: "Batla sebaka" },
      cancel: { en: "Cancel", af: "Kanselleer", zu: "Khansela", xh: "Rhoxisa", st: "Hlakola" },
      savedPlaces: { en: "Saved Places", af: "Gestoorde Plekke", zu: "Izindawo Ezigciniwe", xh: "Iindawo Ezigciniweyo", st: "Libaka tse Bolokiloeng" },
      recent: { en: "Recent", af: "Onlangs", zu: "Okwakamuva", xh: "Okutsha", st: "Tsa morao tjena" },
      noSaved: { en: "No saved places yet.", af: "Nog geen gestoorde plekke nie.", zu: "Azikho izindawo ezigciniwe.", xh: "Akukho ndawo igciniweyo.", st: "Ha ho libaka tse bolokiloeng." },
      noRecent: { en: "No recent searches yet.", af: "Nog geen onlangse soektogte nie.", zu: "Azikho ukusesha kwakamuva.", xh: "Akukho kukhangela kwakutsha.", st: "Ha ho ho batla ha morao tjena." },
      clearRecents: { en: "Clear recents", af: "Verwyder onlangs", zu: "Susa okamuva", xh: "Susa okutsha", st: "Hlakola tsa morao" },
      manage: { en: "Manage", af: "Bestuur", zu: "Phatha", xh: "Lawula", st: "Tsamaisa" },
      done: { en: "Done", af: "Klaar", zu: "Kwenziwe", xh: "Kwenziwe", st: "Ho phethiloe" }
    },
    // Settings screen
    settings: {
      units: { en: "Units", af: "Eenhede", zu: "Iziyunithi", xh: "Iiyunithi", st: "Diyuniti" },
      temperature: { en: "Temperature", af: "Temperatuur", zu: "Izinga lokushisa", xh: "Ubushushu", st: "Mocheso" },
      windSpeed: { en: "Wind speed", af: "Windspoed", zu: "Isivinini somoya", xh: "Isantya somoya", st: "Lebelo la moea" },
      display: { en: "Display", af: "Vertoon", zu: "Ukubonisa", xh: "Ukubonisa", st: "Bonts'a" },
      showRange: { en: "Show temperature range", af: "Wys temperatuurreeks", zu: "Bonisa ibanga lokushisa", xh: "Bonisa uluhlu lobushushu", st: "Bonts'a sekhahla sa mocheso" },
      timeFormat: { en: "Time format", af: "Tydformaat", zu: "Ifomethi yesikhathi", xh: "Ifomathi yexesha", st: "Sebopeho sa nako" },
      language: { en: "Language", af: "Taal", zu: "Ulimi", xh: "Ulwimi", st: "Puo" },
      wittyIn: { en: "Language", af: "Taal", zu: "Ulimi", xh: "Ulwimi", st: "Puo" },
      about: { en: "About", af: "Aangaande", zu: "Mayelana", xh: "Malunga", st: "Mabapi" },
      aboutText: {
        en: "Probably Weather combines forecasts from Open-Meteo, WeatherAPI.com, MET Norway & Pirate Weather to give you a more reliable prediction.",
        af: "Probably Weather kombineer voorspellings van Open-Meteo, WeatherAPI.com, MET Norway & Pirate Weather om jou 'n meer betroubare voorspelling te gee.",
        zu: "I-Probably Weather ihlanganisa izibikezelo ezivela ku-Open-Meteo, WeatherAPI.com, MET Norway & Pirate Weather ukukunikeza isibikezelo esithembekile.",
        xh: "I-Probably Weather idibanisa izithembiso ezivela ku-Open-Meteo, WeatherAPI.com, MET Norway & Pirate Weather ukukunika isithembiso esithembekileyo.",
        st: "Probably Weather e kopanya diponelopele tse tsoang ho Open-Meteo, WeatherAPI.com, MET Norway & Pirate Weather ho u fa ponelopele e tšepahalang."
      }
    },
    // Sidebar
    sidebar: {
      todaysHero: { en: "Right Now:", af: "Nou:", zu: "Manje:", xh: "Ngoku:", st: "Hona Joale:" },
      sources: { en: "Sources", af: "Bronne", zu: "Imithombo", xh: "Imithombo", st: "Mehlodi" }
    },
    // Weather byline terms
    weather: {
      probably: { en: "Probably", af: "Waarskynlik", zu: "Mhlawumbe", xh: "Mhlawumbi", st: "Mohlomong" },
      wind: { en: "Wind", af: "Wind", zu: "Umoya", xh: "Umoya", st: "Moea" },
      rain: { en: "Rain", af: "Reën", zu: "Imvula", xh: "Imvula", st: "Pula" },
      uv: { en: "UV", af: "UV", zu: "UV", xh: "UV", st: "UV" },
      feelsLike: { en: "Feels like", af: "Voel soos", zu: "Kuzwakala sengathi", xh: "Kuziva ngathi", st: "Ho utlwahala joalo ka" },
      later: { en: "Later ⏰", af: "Later ⏰", zu: "Kamuva ⏰", xh: "Kamva ⏰", st: "Hamorao ⏰" },
      none: { en: "None", af: "Geen", zu: "Lutho", xh: "Akukho", st: "Ha ho" },
      gusts: { en: "gusts", af: "windstote", zu: "amafindo", xh: "iimphuphuma", st: "lifofane" },
      unlikely: { en: "Unlikely", af: "Onwaarskynlik", zu: "Akunakwenzeka", xh: "Akunakwenzeka", st: "Ha ho kgonehe" },
      possible: { en: "Possible", af: "Moontlik", zu: "Kungenzeka", xh: "Kunokwenzeka", st: "Ho ka etsahala" },
      likely: { en: "Likely", af: "Waarskynlik", zu: "Kungenzeka", xh: "Kunokubakho", st: "Ho ka etsahala" },
      low: { en: "Low", af: "Laag", zu: "Phansi", xh: "Phantsi", st: "Tlase" },
      moderate: { en: "Moderate", af: "Matig", zu: "Okuphakathi", xh: "Phakathi", st: "Mahareng" },
      high: { en: "High", af: "Hoog", zu: "Phezulu", xh: "Phezulu", st: "Hodimo" },
      veryHigh: { en: "Very High", af: "Baie Hoog", zu: "Phezulu Kakhulu", xh: "Phezulu Kakhulu", st: "Hodimo Haholo" },
      // Table headers
      time: { en: "Time", af: "Tyd", zu: "Isikhathi", xh: "Ixesha", st: "Nako" },
      temp: { en: "Temp", af: "Temp", zu: "Temp", xh: "Temp", st: "Temp" },
      day: { en: "Day", af: "Dag", zu: "Usuku", xh: "Usuku", st: "Letsatsi" }
    },
    // Day hero badges
    badges: {
      rainy: { en: "Rainy", af: "Reënerig", zu: "Imvula", xh: "Imvula", st: "Pula" },
      showers: { en: "Showers", af: "Buie", zu: "Izihlambi", xh: "Iimvula", st: "Lipula" },
      rainLater: { en: "Rain later", af: "Reën later", zu: "Imvula kamuva", xh: "Imvula kamva", st: "Pula hamorao" },
      rainTonight: { en: "Rain tonight", af: "Reën vanaand", zu: "Imvula namhlanje", xh: "Imvula ngokuhlwa", st: "Pula bosiu" },
      rainMorning: { en: "Rain AM", af: "Reën oggend", zu: "Imvula ekuseni", xh: "Imvula kusasa", st: "Pula hoseng" },
      highUV: { en: "High UV", af: "Hoë UV", zu: "UV Ephezulu", xh: "UV Ephezulu", st: "UV e Phahameng" },
      hot: { en: "Hot", af: "Warm", zu: "Kushisa", xh: "Kushushu", st: "Ho tjhesa" },
      cold: { en: "Cold", af: "Koud", zu: "Kubanda", xh: "Kubanda", st: "Ho bata" },
      uvAlert: { en: "UV Alert", af: "UV Waarskuwing", zu: "Isexwayiso se-UV", xh: "Isilumkiso se-UV", st: "Temoso ea UV" }
    },
    // Hero labels
    heroLabels: {
      storm: { en: "Severe weather", af: "Erge weer", zu: "Isimo sezulu esibi", xh: "Imozulu embi", st: "Leholimo le lebe" },
      rain: { en: "Wet conditions", af: "Nat toestande", zu: "Izimo ezimanzi", xh: "Iimeko ezimanzi", st: "Maemo a metsi" },
      'rain-possible': { en: "Possible showers", af: "Moontlike buie", zu: "Imvula engenzeka", xh: "Imvula enokubakho", st: "Lipula tse ka bang teng" },
      wind: { en: "Gusty winds", af: "Sterk wind", zu: "Umoya onamandla", xh: "Imimoya enamandla", st: "Meea e matla" },
      cold: { en: "Chilly", af: "Koud", zu: "Kubanda", xh: "Kubanda", st: "Ho bata" },
      heat: { en: "Very hot", af: "Baie warm", zu: "Kushisa kakhulu", xh: "Kushushu kakhulu", st: "Ho tjhesa haholo" },
      uv: { en: "High UV", af: "Hoë UV", zu: "I-UV ephezulu", xh: "I-UV ephezulu", st: "UV e phahameng" },
      fog: { en: "Low visibility", af: "Lae sigbaarheid", zu: "Ukubonakala okuphansi", xh: "Ukubonakala okuphantsi", st: "Pono e tlase" },
      cloudy: { en: "Overcast", af: "Bewolk", zu: "Kunamafu", xh: "Linamafu", st: "Maru" },
      clear: { en: "Pleasant", af: "Aangenaam", zu: "Kumnandi", xh: "Kumnandi", st: "Ho monate" },
      night: { en: "Clear night", af: "Helder nag", zu: "Ubusuku obuhlanzekile", xh: "Ubusuku obuhle", st: "Bosiu bo hlakileng" }
    },
    // Day names (short)
    days: {
      sun: { en: "Sun", af: "Son", zu: "Son", xh: "Caw", st: "Sont" },
      mon: { en: "Mon", af: "Maa", zu: "Mso", xh: "Mvu", st: "Mant" },
      tue: { en: "Tue", af: "Din", zu: "Bil", xh: "Lwes", st: "Lab" },
      wed: { en: "Wed", af: "Woe", zu: "Tha", xh: "Tha", st: "Lar" },
      thu: { en: "Thu", af: "Don", zu: "Sin", xh: "Sin", st: "Labo" },
      fri: { en: "Fri", af: "Vry", zu: "Hla", xh: "Hlanu", st: "Laboh" },
      sat: { en: "Sat", af: "Sat", zu: "Mgq", xh: "Mgqi", st: "Moq" }
    },
    // Headlines
    headlines: {
      storm: { en: "Storms rolling in.", af: "Storm op pad.", zu: "Isiphepho siyeza.", xh: "Isaqhwithi siyeza.", st: "Ledimo le a tla." },
      rain: { en: "Rain's here.", af: "Dit reën.", zu: "Imvula ikhona.", xh: "Imvula ikhona.", st: "Pula e a na." },
      'rain-possible': { en: "Might rain.", af: "Dalk reën.", zu: "Kungase line.", xh: "Mhlawumbi iya kuna.", st: "Mohlomong pula." },
      cloudy: { en: "Cloudy vibes.", af: "Bewolk vandag.", zu: "Kunamafu.", xh: "Linamafu.", st: "Maru a teng." },
      wind: { en: "Wind's up.", af: "Dit waai.", zu: "Umoya uyavunguza.", xh: "Umoya uvuthuza.", st: "Moea o a foka." },
      cold: { en: "It's chilly.", af: "Dis koud.", zu: "Kuyabanda.", xh: "Kuyabanda.", st: "Ho a bata." },
      heat: { en: "It's hot.", af: "Dis warm.", zu: "Kushisa.", xh: "Kushushu.", st: "Ho tjhesa." },
      uv: { en: "UV's hectic.", af: "UV is hoog.", zu: "I-UV iphezulu.", xh: "I-UV iphezulu.", st: "UV e hodimo." },
      fog: { en: "Foggy out there.", af: "Dis mistig.", zu: "Kunenkungu.", xh: "Linenkungula.", st: "Ho na le mohodi." },
      clear: { en: "Clear skies.", af: "Helder lug.", zu: "Izulu lihlanzekile.", xh: "Isibhakabhaka sihlanzekile.", st: "Lehodimo le hlakileng." },
      night: { en: "Clear night.", af: "Helder nag.", zu: "Ubusuku obuhlanzekile.", xh: "Ubusuku obuhle.", st: "Bosiu bo hlakileng." }
    },
    // Witty lines
    witty: {
      storm: {
        en: ["Jislaaik, stay inside!", "Thunder's grumbling, hey.", "Eskom wishes it had this power.", "Even the hadedas are quiet.", "The sky's having a full-on tantrum.", "Nature's doing its own load shedding.", "Cancel everything. Even your excuses.", "Weather so dramatic it needs a Carte Blanche segment.", "This is why Noah built a boat.", "The braai is cancelled. Yes, really.", "Somewhere a roof is someone's new kite.", "Lightning's putting Eskom's grid to shame."],
        af: ["Jinne, bly binne!", "Die donder dreun.", "Eskom wens hy het hierdie krag.", "Selfs die hadedas is stil.", "Die lug het 'n volle woedebuie.", "Natuur doen sy eie beurtkrag.", "Kanselleer alles. Selfs jou verskonings.", "Weer so dramaties dit het 'n Carte Blanche insetsel nodig.", "Dis hoekom Noag 'n ark gebou het.", "Die braai is gekanselleer. Ja, regtig.", "Iewers is 'n dak iemand se nuwe vlieër.", "Weerlig sit Eskom se kragnet in die skadu."],
        zu: ["Yoh, hlala ngaphakathi!", "Izulu liyaduma.", "U-Eskom ufisa ukuba namandla anje.", "Ngisho ama-hadeda athule.", "Isibhakabhaka sithukuthele ngempela.", "Imvelo yenza ukucisha kwayo.", "Khansela konke. Ngisho nezaba zakho.", "Isimo sezulu esinomdlalo esidinga i-Carte Blanche.", "Yingakho uNowa wakha umkhumbi.", "Ukosa kukhanselelwe. Yebo, ngempela.", "Endaweni ethile uphahla lungumkhumbi omusha.", "Umbani ubeka i-Eskom ehlazweni."],
        xh: ["Yhuu, hlala ngaphakathi!", "Iindudumo ziyagquma.", "U-Eskom unqwenela la mandla.", "Iintaka zithe cwaka.", "Isibhakabhaka siqumba ngokupheleleyo.", "Indalo yenza ukucima kwayo.", "Rhoxisa yonke into. Nezizathu zakho.", "Imozulu edramatiki kakhulu ifuna i-Carte Blanche.", "Yiyo le nto uNowa wakha umkhombe.", "Ukugrila kurhoxisiwe. Ewe, nyhani.", "Kwezinye iindawo uphahla lungumntla omtsha.", "Umbane ubeka i-Eskom ehlazweni."],
        st: ["Eish, dula ka hare!", "Ledimo le a duma.", "Eskom e ka rata matla ana.", "Esita le dinonyana di kgutsitse.", "Lehodimo le halefile ka botlalo.", "Tlhaho e etsa load shedding ea eona.", "Hlakola tsohle. Esita le mabaka a hao.", "Leholimo le dramatic le hloka Carte Blanche.", "Ke kahoo Noa a ileng a haha sekepe.", "Braai e hlakotsoe. E, ka nnete.", "Mohlomong sebakeng se seng marulelo ke khaete e ncha.", "Lehadima le hlabisa Eskom dihlong."]
      },
      rain: {
        en: ["The clouds are having a moment.", "Grab your brolly, boet.", "The garden's saying dankie at last.", "The potholes are becoming swimming pools.", "Your car wash was a waste of money.", "Joburg drivers are panicking already.", "Perfect excuse to cancel plans.", "The dams are doing a happy dance.", "The N1 is now a waterpark.", "Good soup weather, not gonna lie.", "Someone's braai just got ruined.", "Rain so heavy it should pay rent."],
        af: ["Die wolke het 'n oomblik.", "Vat jou sambreel, boet.", "Die tuin sê uiteindelik dankie.", "Die slaggate word swembaddens.", "Jou karwas was geldmors.", "Joburg-bestuurders paniek al klaar.", "Perfekte verskoning om planne te kanselleer.", "Die damme doen 'n bly dansie.", "Die N1 is nou 'n waterpark.", "Goeie sopweer, eerlikwaar.", "Iemand se braai is sopnat.", "Reën so swaar dit moet huur betaal."],
        zu: ["Amafu anesikhathi sawo.", "Thatha isambulela sakho, boet.", "Ingadi ithi ekugcineni ngiyabonga.", "Imigodi iba amapulazi okubhukuda.", "Ukuwasha imoto kwakho bekuyize yemali.", "Abashayeli baseJoburg sebeyesaba.", "Isizathu esihle sokukhansela izinhlelo.", "Amadamu enza umdanso ojabulayo.", "I-N1 manje yi-waterpark.", "Isimo sezulu esihle sesobho.", "Ukosa komuntu kusanda konakala.", "Imvula enzima kakhulu kufanele ikhokhe irenti."],
        xh: ["Amafu anethuba lawo.", "Thatha isambreli sakho, boet.", "Igadi ithi ekugqibeleni enkosi.", "Imingxunya iba ziipuli zokuqubha.", "Ukuhlamba imoto kwakho bekuyimali elahlekileyo.", "Abaqhubi baseJohanesburg sele beyoyika.", "Isizathu esihle sokurhoxisa izicwangciso.", "Amadama enza umdaniso ovuyayo.", "I-N1 ngoku yi-waterpark.", "Imozulu elungele isuphu.", "Ukugrila komntu kusanda konakala.", "Imvula enzima kufanele ihlawule irenti."],
        st: ["Maru a na le nako ea 'ona.", "Nka sekhele sa hao, boet.", "Jarata e re kea leboha qetellong.", "Mesima e fetoha matamo a ho sesa.", "Ho hlatsoa koloi ea hao e ne e le chelete e lahliloeng.", "Baotleli ba Joburg ba se ba tšohile.", "Lebaka le letle la ho hlakola merero.", "Matamo a etsa motjeko o thabileng.", "N1 joale ke waterpark.", "Leholimo le letle la soupa.", "Braai ea motho e senyehile.", "Pula e boima haholo e lokela ho lefa rente."]
      },
      'rain-possible': {
        en: ["Maybe rain, maybe not. Classic.", "Clouds looking proper suspicious.", "Take a brolly just in case, hey.", "50/50 on getting wet. Like a coin toss.", "Don't trust those clouds. They're plotting.", "Weather's being more indecisive than you at Spur.", "Pack an umbrella. Or don't. We don't know either.", "The sky can't make up its mind. Join the club."],
        af: ["Miskien reën, miskien nie. Klassiek.", "Wolke lyk behoorlik verdag.", "Vat 'n sambreel net vir ingeval, hey.", "50/50 kans om nat te word. Soos 'n muntstuk.", "Moenie daai wolke vertrou nie. Hulle beplan.", "Die weer is meer besluiteloos as jy by Spur.", "Pak 'n sambreel. Of moenie. Ons weet ook nie.", "Die lug kan nie besluit nie. Sluit by die klub aan."],
        zu: ["Mhlawumbe imvula, mhlawumbe cha. Okujwayelekile.", "Amafu abukeka esolisa ngempela.", "Thatha isambulela uma kungenzeka, hey.", "50/50 ukuba manzi. Njengenhlahla.", "Ungawathembi lawo mafu. Ayaceba.", "Isimo sezulu asikwazi ukuzinquma njengawe eSpur.", "Phaka isambulela. Noma ungaphaki. Asazi nathi.", "Isibhakabhaka asikwazi ukuzinquma. Joyina iklabhu."],
        xh: ["Mhlawumbi imvula, mhlawumbi hayi. Okwesiqhelo.", "Amafu abonakala erhanela ngokwenene.", "Thatha isambreli ukuba kunokwenzeka, hey.", "50/50 ukufumana amanzi. Njengomdlalo.", "Musa ukuwathemba lawo mafu. Ayaceba.", "Imozulu ayikwazi ukuzigqiba njengawe eSpur.", "Phakisha isambreli. Okanye ungaphakishi. Asazi nathi.", "Isibhakabhaka asikwazi ukuzigqiba. Joyina iklabhu."],
        st: ["Mohlomong pula, mohlomong che. Setso.", "Maru a shebahala a belaela ka nnete.", "Nka sekhele ho ba sireletsehile, hey.", "50/50 ho ba metsi. Joalo ka papadi.", "Se ke oa tšepa maru ao. A rera.", "Leholimo ha le tsebe ho iketsa joalo ka uena Spur.", "Paka sekhele. Kapa o se ke oa paka. Ha re tsebe le rona.", "Lehodimo ha le tsebe. Kena klubeng."]
      },
      cloudy: {
        en: ["The sky's giving absolutely nothing.", "Overcast but we'll survive.", "Good day for a walk, bad day for a tan.", "The sun's bunking today.", "Moody weather. Same, honestly.", "Not bad, not great. Like a 6/10 date.", "Eskom-friendly weather. No solar today.", "The sky is buffering.", "Even the weather can't be bothered today.", "Grey vibes. The sky matched my Monday."],
        af: ["Die lug gee absoluut niks.", "Bewolk maar ons sal oorleef.", "Goeie dag vir 'n stap, slegte dag vir 'n bruining.", "Die son bunk vandag.", "Humeurige weer. Ek ook, eerlikwaar.", "Nie sleg nie, nie great nie. Soos 'n 6/10 date.", "Eskom-vriendelike weer. Geen solar vandag nie.", "Die lug buffer.", "Selfs die weer kan nie gepla word vandag nie.", "Grys vibes. Die lug pas by my Maandag."],
        zu: ["Isibhakabhaka asiniki lutho.", "Kunamafu kodwa sizosinda.", "Usuku oluhle lokuhamba, olubi lokushisa.", "Ilanga liyabaleka namuhla.", "Isimo sezulu esingezinhle. Njengami.", "Akubi kubi, akubi kuhle. Njengedethi ye-6/10.", "Isimo sezulu esilungele i-Eskom. Akukho solar.", "Isibhakabhaka siyabafura.", "Ngisho nesimo sezulu asikwazi ukuziphatha namuhla.", "I-grey vibes. Isibhakabhaka sifana noMsombuluko wami."],
        xh: ["Isibhakabhaka asiniki nto.", "Linamafu kodwa siya kuphila.", "Imini entle yokuhamba, embi yokutshisa.", "Ilanga liyabaleka namhlanje.", "Imozulu ezithwele. Njengam.", "Ayimbi, ayintle. Njengedethi ye-6/10.", "Imozulu elungele i-Eskom. Akukho solar.", "Isibhakabhaka siyabafura.", "Imozulu ayonqena namhlanje.", "I-grey vibes. Isibhakabhaka sifana noMvulo wam."],
        st: ["Lehodimo ha le fane letho.", "Ho na le maru empa re tla phela.", "Letsatsi le letle la ho tsamaea, le lebe la ho tjhesa.", "Letsatsi le balehile kajeno.", "Leholimo le matšoenyehong. Le nna, ka nnete.", "Ha ho mpe, ha ho motle. Joalo ka dethi ea 6/10.", "Leholimo le ratoang ke Eskom. Ha ho solar kajeno.", "Lehodimo le a buffera.", "Esita le leholimo ha le khathalehe kajeno.", "Grey vibes. Lehodimo le tšoana le Mantaha oa ka."]
      },
      uv: {
        en: ["Sunscreen is not optional, boet.", "SPF 50 or regret it by tonight.", "The sun's not playing games today.", "You will look like a lobster. You've been warned.", "Protect that face! It's the only one you've got.", "The ozone layer called. It's on leave.", "Reapply that sunscreen or suffer.", "The sun is personally attacking you.", "Hat, sunnies, sunscreen. Non-negotiable.", "You could braai a steak on the pavement right now."],
        af: ["Sonbrandroom is nie opsioneel nie, boet.", "SPF 50 of jy sal spyt wees teen vanaand.", "Die son speel nie vandag nie.", "Jy gaan soos 'n kreef lyk. Jy is gewaarsku.", "Beskerm daai gesig! Dis die enigste een wat jy het.", "Die osoonlaag het gebel. Hy's op verlof.", "Smeer weer aan of ly.", "Die son val jou persoonlik aan.", "Hoed, sonbrille, sonbrandroom. Nie onderhandelbaar nie.", "Jy kan 'n steak op die sypaadjie braai nou."],
        zu: ["Ikhrimu yelanga ayikhona ukukhetha, boet.", "I-SPF 50 noma uzozisola ngokuhlwa.", "Ilanga alidlali namuhla.", "Uzobukeka njengelobster. Uxwayisiwe.", "Vikela ubuso bakho! Kunye kuphela onabu.", "I-ozone layer ishayile. Iku-leave.", "Sebenzisa futhi noma uhlupheke.", "Ilanga likuhlasela wena mathupha.", "Isigqoko, izibuko, isivikelo. Akudingidwa.", "Ungabhaka isteki epavimentini manje."],
        xh: ["Ikhrimu yelanga ayinakukhethwa, boet.", "I-SPF 50 okanye uya kuzisola ngokuhlwa.", "Ilanga alidlali namhlanje.", "Uya kubonakala njenge-lobster. Ulumkisiwe.", "Khusela elo buso! Lelinye kuphela onalo.", "I-ozone layer ifownile. Iku-leave.", "Sebenzisa kwakhona okanye ubandezeleke.", "Ilanga likuhlasela wena buqu.", "Umnqwazi, izipeki, ikhrimu. Akuxoxwa.", "Ungagrila isteki epavimentini ngoku."],
        st: ["Setofo sa letsatsi ha se kgetho, boet.", "SPF 50 kapa o tla itshola ka bosiu.", "Letsatsi ha le bapale kajeno.", "O tla shebahala joalo ka lobster. O lemoselitsoe.", "Sireletsa sefahleho seo! Ke se le seng feela o nang le sona.", "Ozone layer e llelitse. E leaveng.", "Tšoaea hape kapa o hloke.", "Letsatsi le o hlasela ka bo mong.", "Katiba, liborele, setofo. Ha ho buisanoe.", "O ka chesa steak ho pavement joale."]
      },
      wind: {
        en: ["Hold onto your hat! And your kids.", "The southeaster's arrived. Uninvited, as usual.", "Table Mountain's tablecloth is out.", "The Cape Doctor is making house calls.", "Your hairstyle? Gone. Accept it.", "Kite surfers are having the time of their lives.", "The trees are doing involuntary yoga.", "Someone's trampoline is now two streets away.", "Perfect conditions for losing your dignity.", "Even the seagulls are walking today."],
        af: ["Hou jou hoed vas! En jou kinders.", "Die suidooster het aangekom. Ongenooid, soos altyd.", "Tafelberg se tafeldoek is uit.", "Die Kaapse Dokter maak huisbesoeke.", "Jou haarstyl? Weg. Aanvaar dit.", "Vlieërsurfers het die tyd van hul lewe.", "Die bome doen onvrywillige yoga.", "Iemand se trampoline is nou twee strate weg.", "Perfekte toestande om jou waardigheid te verloor.", "Selfs die meeuë loop vandag."],
        zu: ["Bamba isigqoko sakho! Nabantwana bakho.", "Umoya waseningizimu ufikile. Ungamenyiwe, njengenjwayelo.", "Indwangu yeTafel Mountain iphumile.", "UDokotela waseKapa ufikile ezovakasha.", "Isitayela sakho sezinwele? Sihambile. Yamukela.", "Abadlali be-kite bajabulile kakhulu.", "Izihlahla zenza i-yoga engafuneki.", "I-trampoline yomuntu manje imigwaqo emibili.", "Izimo eziphelele zokulahlekelwa isithunzi.", "Ngisho nezinkonjane ziyahamba namuhla."],
        xh: ["Bamba umnqwazi wakho! Nabantwana bakho.", "Umoya wasemzantsi ufikile. Ungamenyanga, njengoko eqhelile.", "Ilaphu leTable Mountain liphumile.", "UGqirha waseKapa wenza iindwendwe.", "Isimbo seenwele zakho? Simkile. Yamkela.", "Abadlali bekite bonwabile kakhulu.", "Imithi yenza i-yoga engafunekiyo.", "I-trampoline yomntu ngoku zizitalato ezimbini.", "Iimeko ezilungileyo zokulahlekelwa sisidima.", "Neenkonjane ziyahamba namhlanje."],
        st: ["Tšoara katiba ea hao! Le bana ba hao.", "Moea oa boroa o fihlile. O sa mengoa, joalo ka kamehla.", "Lesela la Table Mountain le tšoeu.", "Ngaka ea Cape e etsa litšeliso.", "Moriri oa hao? O ile. Amohela.", "Baraleli ba kite ba na le nako e ntle.", "Lifate li etsa yoga e sa batleheng.", "Trampoline ea motho joale e literateng tse peli.", "Maemo a phethahetseng a ho lahleheloa ke seriti.", "Esita le dikoekoe di tsamaea kajeno."]
      },
      cold: {
        en: ["Ja, it's jersey weather. Double jersey.", "Time to dig out that ugly beanie.", "Cold enough for soup. And a second soup.", "Hot chocolate is not a want. It's a need.", "Layer up like you're climbing Sani Pass.", "Two-fleece minimum today.", "The heater is your best friend. Your only friend.", "Even the Capetonians are admitting it's cold.", "Your breath is doing special effects.", "Blanket burrito mode: activated.", "This is not what the tourism brochure promised."],
        af: ["Ja, dis truiweer. Dubbel trui.", "Tyd om daai lelike beanie te soek.", "Koud genoeg vir sop. En 'n tweede sop.", "Warm sjokolade is nie 'n wens nie. Dis 'n behoefte.", "Trek lae aan asof jy Sani Pass klim.", "Twee-fleece minimum vandag.", "Die heater is jou beste vriend. Jou enigste vriend.", "Selfs die Kapenaars erken dit is koud.", "Jou asem doen spesiale effekte.", "Kombers burrito modus: geaktiveer.", "Dit is nie wat die toerisme brosjure beloof het nie."],
        zu: ["Yebo, yisikhathi sejezi. Ijezi ephindwe kabili.", "Isikhathi sokumba i-beanie embi.", "Kubanda ngokwanele kwesobho. Nesobho lesibili.", "Ishokoledi eshisayo akusikho isifiso. Yisidingo.", "Gqoka izingubo eziningi njengokukhwela uSani Pass.", "Ama-fleece amabili okungenani namuhla.", "I-heater ingumngane wakho omkhulu. Owodwa.", "Ngisho abaseCape bayavuma kubanda.", "Umphefumulo wakho wenza i-special effects.", "Imodhi ye-blanket burrito: ivuliwe.", "Lokhu akukhona okwethenjiswa yincwadi yokuvakasha."],
        xh: ["Ewe, lixesha lejezi. Ijezi ephindwe kabini.", "Ixesha lokumba loo beanie imbi.", "Kuyabanda ngokwaneleyo kwesuphu. Nesuphu yesibini.", "Itshokolethi eshushu ayikokufuna. Yimfuno.", "Faka iingubo ezininzi njengokunyuka uSani Pass.", "Ii-fleece ezimbini ubuncinane namhlanje.", "I-heater ngumhlobo wakho omkhulu. Owodwa.", "Nabantu baseCape bayavuma kuyabanda.", "Umphefumlo wakho wenza i-special effects.", "Imowudi ye-blanket burrito: ivuliwe.", "Oku akukokuthenjiswa yincwadi yokhenketho."],
        st: ["E, ke leholimo la jersey. Jersey tse peli.", "Nako ea ho qhala beanie e mpe eo.", "Ho bata ho lekana le soupa. Le soupa ea bobeli.", "Tšokolate e chesang ha se takatso. Ke tlhoko.", "Apara liaparo tse ngata joalo ka ho palama Sani Pass.", "Di-fleece tse peli bonyane kajeno.", "Heater ke motsoalle oa hao e moholo. E le mong.", "Esita le ba Cape ba lumela hore ho a bata.", "Mophefumulo oa hao o etsa li-special effects.", "Mokhoa oa kobo burrito: o bulehile.", "Hona ha se seo brosure ea bohahlauli e neng e se tšepisa."]
      },
      heat: {
        en: ["Jislaaik, it's properly hot!", "You could fry an egg on the N1.", "Ice cream isn't a treat. It's survival.", "Stay hydrated or become a biltong.", "The pool is not optional.", "Hotter than a bakkie dashboard at noon.", "The AC is begging for mercy.", "Your car seat is a weapon right now.", "Too hot to argue. Too hot to function.", "Even your phone's overheating.", "The tar is soft. The people are softer.", "Somewhere a chocolate bar just died."],
        af: ["Jinne, dis ordentlik warm!", "Jy kan 'n eier braai op die N1.", "Roomys is nie 'n lekkerny nie. Dis oorlewing.", "Bly gehidreer of word biltong.", "Die swembad is nie opsioneel nie.", "Warmer as 'n bakkie se dashboard teen middag.", "Die AC smeek om genade.", "Jou karsitplek is 'n wapen nou.", "Te warm om te stry. Te warm om te funksioneer.", "Selfs jou foon oorverhit.", "Die teer is sag. Die mense is sagter.", "Iewers het 'n sjokolade net gesterf."],
        zu: ["Yoh, kushisa ngempela!", "Ungabhaka iqanda ku-N1.", "I-ice cream ayisiyona isipho. Yikuphila.", "Hlala unamanzi noma ube yi-biltong.", "Ipuli alikho ukukhetha.", "Kushisa ukudlula i-dashboard yebakkie emini.", "I-AC icela umusa.", "Isihlalo semoto sakho siyisikhali manje.", "Kushisa kakhulu ukuphikisa. Kushisa kakhulu ukusebenza.", "Ngisho nefoni yakho iyashisa.", "I-tar ithambile. Abantu bathambile kakhulu.", "Endaweni ethile ishokoledi isanda kufa."],
        xh: ["Yhuu, kushushu ngempela!", "Ungabhaka iqanda kwi-N1.", "I-ice cream ayisosipho. Kukuphila.", "Hlala unamanzi okanye ube yi-biltong.", "Ipuli ayinakukhethwa.", "Kushushu ngaphezu kwe-dashboard yebakkie emini.", "I-AC icela inceba.", "Isihlalo semoto sakho sisixhobo ngoku.", "Kushushu kakhulu ukuxoxa. Kushushu kakhulu ukusebenza.", "Nefowuni yakho iyashushu.", "I-tar ithambile. Abantu bathambile.", "Kwezinye iindawo ishokolethi isanda kufa."],
        st: ["Eish, ho tjhesa ka nnete!", "O ka chesa lehe ho N1.", "Ice cream ha se mpho. Ke bophelo.", "Dula o na le metsi kapa o fetohe biltong.", "Pool ha se kgetho.", "Ho tjhesa ho feta dashboard ea bakkie motsheare.", "AC e kopa mohau.", "Setulo sa koloi ea hao ke sebetsa joale.", "Ho tjhesa haholo ho phehisa. Ho tjhesa haholo ho sebetsa.", "Esita le mohala oa hao o chesang.", "Tara e bonolo. Batho ba bonolo le ho feta.", "Mohlomong sebakeng se seng tšokolate e sa tsoa qhibiliha."]
      },
      fog: {
        en: ["Can't see a thing. Not a thing.", "Driving slow is not a suggestion.", "Silent Hill vibes. Without the monsters. Hopefully.", "Visibility: basically zero.", "Even your GPS is confused.", "The world just... disappeared.", "Perfect weather for a horror movie.", "Ghost town. But it's just Tuesday.", "If you can read this, you're too close.", "Table Mountain? What Table Mountain?", "The fog ate the neighbourhood."],
        af: ["Kan niks sien nie. Niks.", "Stadig ry is nie 'n voorstel nie.", "Silent Hill vibes. Sonder die monsters. Hopelik.", "Sigbaarheid: basies nul.", "Selfs jou GPS is verward.", "Die wêreld het net... verdwyn.", "Perfekte weer vir 'n griller.", "Spookdorp. Maar dis net Dinsdag.", "As jy dit kan lees, is jy te naby.", "Tafelberg? Watter Tafelberg?", "Die mis het die buurt opgeëet."],
        zu: ["Angiboni lutho. Lutho.", "Ukushayela kancane akusona isiphakamiso.", "I-Silent Hill vibes. Ngaphandle kwezimanga. Sithemba.", "Ukubonakala: cishe iqanda.", "Ngisho ne-GPS yakho iyadideka.", "Umhlaba nje... wanyamalala.", "Isimo sezulu esihle sefilimu yesabisayo.", "Idolobha lesipoki. Kodwa kungoLwesibili nje.", "Uma ungafunda lokhu, useduze kakhulu.", "I-Table Mountain? Iyiphi i-Table Mountain?", "Inkungu idle indawo."],
        xh: ["Andiboni nto. Nto.", "Ukuqhuba kancinci akusosiphakamiso.", "I-Silent Hill vibes. Ngaphandle kwezidalwa. Sinethemba.", "Ukubonakala: phantse iqanda.", "Ne-GPS yakho iyadideka.", "Ihlabathi nje... lanyamalala.", "Imozulu elungele ifilimu yoyiko.", "Idolophu yesipoki. Kodwa ngolwesiBini nje.", "Ukuba ungafunda oku, ukufutshane kakhulu.", "I-Table Mountain? Yiyiphi i-Table Mountain?", "Inkungu itye indawo."],
        st: ["Ha ke bone letho. Letho.", "Ho khanna butle hase tlhahiso.", "Silent Hill vibes. Ntle le dimanka. Re tšepa.", "Ho boneha: hanyenyane nul.", "Esita le GPS ea hao e ferekane.", "Lefatše le... nyametse.", "Leholimo le letle la filimi ea tšabo.", "Toropo ea meea. Empa ke Labobeli feela.", "Haeba o ka bala sena, o haufi haholo.", "Table Mountain? Table Mountain efe?", "Moholi o jele tikoloho."]
      },
      clear: {
        en: ["Absolutely beautiful out there.", "Perfect day. No excuses. Get out.", "This is why we live in South Africa.", "Not a cloud in sight. Not one.", "Main character weather right here.", "Even the hadedas sound happy.", "If you're inside, you're doing it wrong.", "Nature's flexing and we're here for it.", "Postcard weather. You're welcome.", "The kind of day that makes you forget load shedding.", "Somewhere an estate agent is saying 'lifestyle'."],
        af: ["Absoluut pragtig daar buite.", "Perfekte dag. Geen verskonings nie. Gaan uit.", "Dis hoekom ons in Suid-Afrika bly.", "Nie 'n wolk in sig nie. Nie een nie.", "Hoofkarakter weer reg hier.", "Selfs die hadedas klink gelukkig.", "As jy binne is, doen jy dit verkeerd.", "Natuur pronk en ons is hier daarvoor.", "Poskaart weer. Plesier.", "Die soort dag wat jou laat vergeet van beurtkrag.", "Iewers sê 'n eiendomsagent 'lifestyle'."],
        zu: ["Kuhle kakhulu ngaphandle.", "Usuku oluphelele. Akukho zaba. Phuma.", "Yingakho sihlala eNingizimu Afrika.", "Akukho lifu elibonwayo. Nelilodwa.", "Isimo sezulu somlingiswa omkhulu lapha.", "Ngisho ama-hadeda azwakala ejabule.", "Uma ungaphakathi, wenza kabi.", "Imvelo iyaziqhayisa futhi silapha ngayo.", "Isimo sezulu se-postcard. Wamukelekile.", "Uhlobo losuku olwenza ukhohlwe i-load shedding.", "Endaweni ethile i-estate agent ithi 'lifestyle'."],
        xh: ["Kuhle kakhulu ngaphandle.", "Imini egqibeleleyo. Akukho zaba. Phuma.", "Yiyo le nto sihlala eMzantsi Afrika.", "Akukho lifu elibonwayo. Nelinye.", "Imozulu yomlinganiswa ophambili apha.", "Iintaka zivakala zivuya.", "Ukuba ungaphakathi, wenza ngokuphosakeleyo.", "Indalo iyaziqhayisa kwaye silapha ngenxa yayo.", "Imozulu ye-postcard. Wamkelekile.", "Uhlobo lwemini olwenza ulibale i-load shedding.", "Kwezinye iindawo umthengisi wendlu uthi 'lifestyle'."],
        st: ["Ho motle haholo kantle.", "Letsatsi le phethahetseng. Ha ho mabaka. Tsamaea.", "Ke kahoo re lulang Afrika Boroa.", "Ha ho leru le bonahalang. Le le le leng.", "Leholimo la molingoa oa mantlha mona.", "Esita le dinonyana di utloahala li thabile.", "Haeba o ka hare, o etsa phoso.", "Tlhaho e iponahatsa mme re teng.", "Leholimo la postcard. Kea leboha.", "Mofuta oa letsatsi o etsang hore o lebale load shedding.", "Mohlomong sebakeng se seng estate agent e re 'lifestyle'."]
      },
      night: {
        en: ["Stars out, load shedding can't touch this.", "Perfect night to actually see the Milky Way.", "Quiet out there. Almost suspicious.", "The hadedas are sleeping. Finally.", "Night shift weather: approved.", "Dark outside, bright tomorrow.", "Good night, South Africa."],
        af: ["Sterre uit, beurtkrag kan dit nie raak nie.", "Perfekte nag om die Melkweg te sien.", "Stil daarbuite. Byna verdag.", "Die hadedas slaap. Uiteindelik.", "Nagskof weer: goedgekeur.", "Donker buite, helder môre.", "Goeienag, Suid-Afrika."],
        zu: ["Izinkanyezi zikhona, ukucisha akukwazi lokhu.", "Ubusuku obuhle bokubona iNdlela yoSisi.", "Kuthule ngaphandle. Cishe okusolisayo.", "Ama-hadeda ayalala. Ekugcineni.", "Isimo sezulu sangobusuku: samukelwe.", "Umnyama ngaphandle, ukukhanya kusasa.", "Hamba kahle, Ningizimu Afrika."],
        xh: ["Iinkwenkwezi ziphumile, ukuCimwa akukwazi oku.", "Ubusuku obulungileyo bokubona iNdlela yaseSisi.", "Kuzolile ngaphandle. Cishe okusolisayo.", "Iintaka zilele. Ekugqibeleni.", "Imozulu yobusuku: yamkelekile.", "Mnyama ngaphandle, kukhanya ngomso.", "Lala kakuhle, Mzantsi Afrika."],
        st: ["Dinaledi di teng, load shedding e ke ke ea ama sena.", "Bosiu bo motle ba ho bona Tsela ea Lebese.", "Ho kgutsitse kantle. E batla ho belaela.", "Dinonyana di robetse. Qetellong.", "Leholimo la bosiu: le amohelitsoe.", "Ho fifala kantle, ho phatsima hosane.", "Robala hantle, Afrika Boroa."]
      },
      weekend: {
        en: ["Braai weather, boet! No excuses.", "Fire up the Weber. It's the law.", "The weather gods are showing off.", "Beach or braai? Yes.", "Weekend vibes so strong they need their own playlist.", "If you're working today, we feel sorry for you.", "Perfect for doing absolutely nothing.", "Call the mates. Get the meat. Let's go.", "Today's plans: exist outside.", "The weekend doesn't get better than this."],
        af: ["Braaiweer, boet! Geen verskonings nie.", "Steek die Weber aan. Dit is die wet.", "Die weergode pronk vandag.", "Strand of braai? Ja.", "Naweek vibes so sterk hulle het hul eie playlist nodig.", "As jy vandag werk, jammer vir jou.", "Perfek om absoluut niks te doen nie.", "Bel die tjommies. Kry die vleis. Kom ons gaan.", "Vandag se planne: bestaan buitentoe.", "Die naweek word nie beter as dit nie."],
        zu: ["Izulu lokosa, boet! Akukho zaba.", "Basa i-Weber. Kungumthetho.", "Izinkulunkulu zesimo sezulu ziyaziqhayisa.", "Ibhishi noma ukosa? Yebo.", "I-weekend vibes ezinamandla kakhulu zidinga i-playlist yazo.", "Uma usebenza namuhla, sikuzwela.", "Kulungile ukungakwenzi lutho.", "Shayela abangane. Thola inyama. Masiye.", "Izinhlelo zanamuhla: hlala ngaphandle.", "I-weekend ayibi ngcono kunalokhu."],
        xh: ["Imozulu yokugrila, boet! Akukho zaba.", "Basa i-Weber. Ngumthetho.", "Oothixo bemozulu bayaziqhayisa.", "Ibhitshi okanye ukugrila? Ewe.", "Weekend vibes ezinamandla kakhulu zifuna i-playlist yazo.", "Ukuba usebenza namhlanje, siyakuzwela.", "Ilungele ukungenza nto kwaphela.", "Tsalela abahlobo. Fumana inyama. Masiye.", "Izicwangciso zanamhlanje: phila ngaphandle.", "Impelaveki ayibi bhetele kunale."],
        st: ["Leholimo la braai, boet! Ha ho mabaka.", "Chesa Weber. Ke molao.", "Melimo ea leholimo e a iponahatsa.", "Lebopo kapa braai? E.", "Maikutlo a beke a matla haholo a hloka playlist ea 'ona.", "Haeba o sebetsa kajeno, re oa utsoarela.", "E lokile ho se etse letho.", "Letsetsa metsoalle. Fumana nama. Re tsamaee.", "Merero ea kajeno: phela kantle.", "Phomolo ha e be betere ho feta mona."]
      }
    },
    // UV Card
    uvCard: {
      label: { en: "UV Index", af: "UV-Indeks", zu: "I-UV Index", xh: "I-UV Index", st: "UV Index" },
      low: { en: "Low", af: "Laag", zu: "Phansi", xh: "Phantsi", st: "Tlase" },
      moderate: { en: "Moderate", af: "Matig", zu: "Okuphakathi", xh: "Phakathi", st: "Mahareng" },
      high: { en: "High", af: "Hoog", zu: "Phezulu", xh: "Phezulu", st: "Hodimo" },
      veryHigh: { en: "Very High", af: "Baie Hoog", zu: "Phezulu Kakhulu", xh: "Phezulu Kakhulu", st: "Hodimo Haholo" },
      extreme: { en: "Extreme", af: "Uiters", zu: "Kakhulukazi", xh: "Kakhulu", st: "Ho Fetisisa" },
      sunscreen: { en: "☀️ Sunscreen recommended", af: "☀️ Sonskerm aanbeveel", zu: "☀️ Ikhrimu yelanga iyacelwa", xh: "☀️ Ikhrimu yelanga icetyiswa", st: "☀️ Setofo sa letsatsi se kgothalletsoa" }
    },
    // Braai Index
    braai: {
      label: { en: "Braai Index", af: "Braai-Indeks", zu: "I-Braai Index", xh: "I-Braai Index", st: "Braai Index" },
      perfect: { en: "🔥 Perfect braai weather!", af: "🔥 Perfekte braai-weer!", zu: "🔥 Isimo esihle se-braai!", xh: "🔥 Imozulu efanelekileyo ye-braai!", st: "🔥 Leholimo le lokileng la braai!" },
      great: { en: "🥩 Great conditions", af: "🥩 Fantastiese toestande", zu: "🥩 Izimo ezinhle kakhulu", xh: "🥩 Iimeko ezintle kakhulu", st: "🥩 Maemo a matle haholo" },
      decent: { en: "👍 Decent — light the coals", af: "👍 Redelik — steek die kole aan", zu: "👍 Kulungile — basa amalahle", xh: "👍 Kulungile — layita amalahle", st: "👍 Ho lokile — hotela mashala" },
      risky: { en: "🌧️ Risky — keep an eye on the sky", af: "🌧️ Riskant — hou die lug dop", zu: "🌧️ Kuyingozi — qapha isibhakabhaka", xh: "🌧️ Yingozi — jonga isibhakabhaka", st: "🌧️ Kotsi — sheba leholimong" },
      nope: { en: "🚫 Not today, boet", af: "🚫 Nie vandag nie, boet", zu: "🚫 Hayi namhlanje, mfowethu", xh: "🚫 Hayi namhlanje, mfondini", st: "🚫 Eseng kajeno, motswalle" }
    },
    // Cape Doctor wind alert
    capeDr: {
      lines: {
        en: ["Ag no, the tablecloth is out 💨", "Cape Doctor is doing rounds today", "Hold onto your hat, the Southeaster means business", "The Southeaster arrived uninvited — as always", "Wind's hectic — even the seagulls are walking"],
        af: ["Ag nee, die tafeldoek is uit 💨", "Die Kaapse Dokter maak vandag huisbesoeke", "Hou jou hoed vas, die Suidooster bedoel sake", "Die Suidooster het ongenooid opgedaag — soos altyd", "Die wind is hectic — selfs die meeuë loop"],
        zu: ["Yoh, ilaphu letafel liphumile 💨", "UDokotela waseKapa uyashayela namuhla", "Bamba isigqoko sakho, iSoutheaster iyasebenza", "Umoya waseNingizimu ufikile ungamenyiwe — njengenjwayelo", "Umoya unamandla — ngisho nezinkonjane ziyahamba"],
        xh: ["Yhuu, ilaphu letafile liphumile 💨", "UGqirha waseKapa wenza iindwendwe namhlanje", "Bamba umnqwazi, iSoutheaster iyasebenza", "Umoya waseMzantsi ufikile ungamenywanga — njengoko eqhelile", "Umoya unamandla — neenkonjane ziyahamba"],
        st: ["Eish, lesela la tafoleng le teng 💨", "Ngaka ea Cape e etsa litšeliso kajeno", "Tšoara katiba ea hao, Southeaster e bolela ka nnete", "Moea oa boroa o fihlile o sa mengoa — joalo ka kamehla", "Moea o matla — esita le dikoekoe di tsamaea"]
      }
    },
    // Toasts
    toasts: {
      saved: { en: "Saved!", af: "Gestoor!", zu: "Kugciniwe!", xh: "Igciniwe!", st: "E bolokiloe!" },
      removed: { en: "Removed", af: "Verwyder", zu: "Isusiwe", xh: "Isusiwe", st: "E tlositsoe" },
      maxPlaces: { en: "Max 5 places. Remove one first.", af: "Maks 5 plekke. Verwyder een eers.", zu: "Izindawo ezi-5 kuphela. Susa eyodwa kuqala.", xh: "Iindawo ezi-5 kuphela. Susa enye kuqala.", st: "Libaka tse 5 feela. Tlosa e le 'ngoe pele." },
      alreadySaved: { en: "Already saved!", af: "Reeds gestoor!", zu: "Seyigciniwe!", xh: "Sele igciniwe!", st: "E se e bolokiloe!" },
      cleared: { en: "Cleared", af: "Skoongemaak", zu: "Kususiwe", xh: "Kucociwe", st: "E hlakiloe" },
      noPlaces: { en: "No saved places", af: "Geen gestoorde plekke", zu: "Azikho izindawo", xh: "Akukho ndawo", st: "Ha ho libaka" },
      locationUpdated: { en: "Location updated", af: "Ligging opgedateer", zu: "Indawo ibuyekeziwe", xh: "Indawo ihlaziyiwe", st: "Sebaka se ntjhafaditsoe" },
      locationError: { en: "Could not get location", af: "Kon nie ligging kry nie", zu: "Ayikwazanga ukuthola indawo", xh: "Ayikwazanga ukufumana indawo", st: "Ha e khone ho fumana sebaka" },
      usingSaved: { en: "Using saved location", af: "Gebruik gestoorde ligging", zu: "Isebenzisa indawo egciniwe", xh: "Isebenzisa indawo egciniweyo", st: "E sebedisa sebaka se bolokiloeng" }
    },
    // Misc
    misc: {
      loading: { en: "Loading...", af: "Laai...", zu: "Iyalayisha...", xh: "Iyalayisha...", st: "E a jarolla..." },
      error: { en: "Error", af: "Fout", zu: "Iphutha", xh: "Impazamo", st: "Phoso" },
      couldntFetch: { en: "Couldn't fetch weather right now.", af: "Kon nie weer kry nie.", zu: "Ayikwazanga ukuthola isimo sezulu.", xh: "Ayikwazanga ukufumana imozulu.", st: "Ha e khone ho fumana boemo ba leholimo." }
    }
  };

  // Helper to get translation
  const t = (category, key) => {
    const lang = settings.lang || 'en';
    return T[category]?.[key]?.[lang] || T[category]?.[key]?.en || key;
  };

  // ========== STATE ==========
  let activePlace = null, homePlace = null, lastPayload = null, manageMode = false;
  window.__PW_LAST_NORM = null;
  const pendingFavMeta = new Set();
  const SETTINGS_KEYS = { temp: 'units.temp', wind: 'units.wind', range: 'display.range', time: 'format.time', lang: 'lang' };
  const DEFAULT_SETTINGS = { temp: 'C', wind: 'kmh', range: false, time: '24', lang: 'en' };
  let settings = { ...DEFAULT_SETTINGS };

  // ========== UTILITIES ==========
  const safeText = (el, txt) => { if (el) el.textContent = txt ?? "--"; };
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  const round0 = (n) => isNum(n) ? Math.round(n) : null;
  const loadJSON = (key, fb) => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; } catch { return fb; } };
  const saveJSON = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };
  const samePlace = (a, b) => a && b && Number(a.lat).toFixed(4) === Number(b.lat).toFixed(4) && Number(a.lon).toFixed(4) === Number(b.lon).toFixed(4);
  const favoriteKey = (p) => `${Number(p.lat).toFixed(4)},${Number(p.lon).toFixed(4)}`;
  const isPlaceholderName = (name) => { const v = String(name || '').trim(); return !v || /^unknown\b/i.test(v) || /^my location\b/i.test(v); };
  const escapeHtml = (s) => String(s ?? "").replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const conditionEmoji = (key) => { const m = { storm: '⛈️', rain: '🌧️', wind: '💨', cold: '❄️', heat: '🔥', fog: '🌫️', clear: '☀️' }; return m[String(key || '').toLowerCase()] || '⛅'; };

  // ========== IP GEOLOCATION FALLBACK ==========
  // Used when GPS is blocked (e.g. WhatsApp in-app browser)
  async function getIPLocation() {
    try {
      const resp = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) throw new Error('IP lookup failed');
      const data = await resp.json();
      if (data.latitude && data.longitude) {
        return {
          name: data.city && data.country_code ? `${data.city}, ${data.country_code}` : (data.city || 'My Location'),
          lat: Math.round(data.latitude * 10) / 10,
          lon: Math.round(data.longitude * 10) / 10
        };
      }
    } catch (e) { console.log('IP geolocation failed:', e); }
    // Ultimate fallback - Johannesburg (most populated SA city)
    return { name: "Johannesburg, ZA", lat: -26.2, lon: 28.0 };
  }

  function loadSettings() { settings = { temp: loadJSON(SETTINGS_KEYS.temp, DEFAULT_SETTINGS.temp), wind: loadJSON(SETTINGS_KEYS.wind, DEFAULT_SETTINGS.wind), range: loadJSON(SETTINGS_KEYS.range, DEFAULT_SETTINGS.range), time: loadJSON(SETTINGS_KEYS.time, DEFAULT_SETTINGS.time), lang: loadJSON(SETTINGS_KEYS.lang, DEFAULT_SETTINGS.lang) }; }
  function saveSettings() { saveJSON(SETTINGS_KEYS.temp, settings.temp); saveJSON(SETTINGS_KEYS.wind, settings.wind); saveJSON(SETTINGS_KEYS.range, settings.range); saveJSON(SETTINGS_KEYS.time, settings.time); saveJSON(SETTINGS_KEYS.lang, settings.lang); }
  const convertTemp = (c) => !isNum(c) ? null : settings.temp === 'F' ? (c * 9 / 5) + 32 : c;
  const formatTemp = (c) => { const v = convertTemp(c); return isNum(v) ? `${round0(v)}°` : '--°'; };
  const formatWind = (kph) => !isNum(kph) ? '--' : settings.wind === 'mph' ? `${round0(kph * 0.621371)} mph` : settings.wind === 'ms' ? `${round0(kph / 3.6)} m/s` : `${round0(kph)} km/h`;
  const getTempColorClass = (tempC) => {
    if (!isNum(tempC)) return '';
    if (tempC <= 0) return 'temp-freezing';
    if (tempC <= 10) return 'temp-cold';
    if (tempC >= 35) return 'temp-hot';
    if (tempC >= 28) return 'temp-warm';
    return '';
  };

  const NAV_MAP = [[screenHome, navHome], [screenHourly, navHourly], [screenWeek, navWeek], [screenSearch, navSearch], [screenSettings, navSettings]];
  function showScreen(which) {
    SCREENS.forEach(s => { if (s) { s.classList.add("hidden"); s.setAttribute('hidden', ''); } });
    if (which) { which.classList.remove("hidden"); which.removeAttribute('hidden'); }
    NAV_MAP.forEach(([scr, btn]) => { if (btn) btn.classList.toggle('active', scr === which); });
    document.body.classList.toggle('modal-open', which && which !== screenHome);
    if (saveCurrent) saveCurrent.style.display = which === screenHome ? '' : 'none';
    const sidebar = document.querySelector('.sidebar'); if (sidebar) sidebar.style.display = which === screenHome ? '' : 'none';
  }
  const showLoader = (show) => { if (loader) loader.classList[show ? 'remove' : 'add']('hidden'); };
  function showToast(message, duration = 3000) { if (!toast) return; toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), duration); }

  // ========== UPDATE UI LANGUAGE ==========
  function updateUILanguage() {
    if (navHome) navHome.textContent = t('nav', 'home');
    if (navHourly) navHourly.textContent = t('nav', 'hourly');
    if (navWeek) navWeek.textContent = t('nav', 'week');
    if (navSearch) navSearch.textContent = t('nav', 'search');
    if (navSettings) navSettings.textContent = t('nav', 'settings');
    const hourlyTitle = screenHourly?.querySelector('.screen-title'); if (hourlyTitle) hourlyTitle.textContent = t('screens', 'hourly');
    const weekTitle = screenWeek?.querySelector('.screen-title'); if (weekTitle) weekTitle.textContent = t('screens', 'week');
    const searchTitle = screenSearch?.querySelector('.screen-title'); if (searchTitle) searchTitle.textContent = t('screens', 'search');
    const settingsTitle = screenSettings?.querySelector('.screen-title'); if (settingsTitle) settingsTitle.textContent = t('screens', 'settings');
    if (searchInput) searchInput.placeholder = t('search', 'placeholder');
    if (searchCancel) searchCancel.textContent = t('search', 'cancel');
    if (clearRecentsBtn) clearRecentsBtn.textContent = t('search', 'clearRecents');
    if (manageFavorites) manageFavorites.textContent = manageMode ? t('search', 'done') : t('search', 'manage');
    const savedH = screenSearch?.querySelector('.section h3'); if (savedH) savedH.textContent = t('search', 'savedPlaces');
    const recentH = screenSearch?.querySelectorAll('.section h3')[1]; if (recentH) recentH.textContent = t('search', 'recent');
    const unitsH = screenSettings?.querySelector('.settings-section h3'); if (unitsH) unitsH.textContent = t('settings', 'units');
    const tempLabel = unitsTempSelect?.closest('.settings-option')?.querySelector('label'); if (tempLabel) tempLabel.textContent = t('settings', 'temperature');
    const windLabel = unitsWindSelect?.closest('.settings-option')?.querySelector('label'); if (windLabel) windLabel.textContent = t('settings', 'windSpeed');
    const displayH = screenSettings?.querySelectorAll('.settings-section h3')[1]; if (displayH) displayH.textContent = t('settings', 'display');
    const rangeLabel = probRangeToggle?.closest('.settings-option')?.querySelector('label'); if (rangeLabel) rangeLabel.textContent = t('settings', 'showRange');
    const timeLabel = timeFormatSelect?.closest('.settings-option')?.querySelector('label'); if (timeLabel) timeLabel.textContent = t('settings', 'timeFormat');
    const langH = screenSettings?.querySelectorAll('.settings-section h3')[2]; if (langH) langH.textContent = '';
    const langLabel = languageSelect?.closest('.settings-option')?.querySelector('label'); if (langLabel) langLabel.textContent = t('settings', 'language');
    const aboutH = screenSettings?.querySelectorAll('.settings-section h3')[3]; if (aboutH) aboutH.textContent = t('settings', 'about');
    const aboutP = screenSettings?.querySelector('.settings-section:last-of-type p'); if (aboutP) aboutP.textContent = T.settings.aboutText[settings.lang] || T.settings.aboutText.en;
    if (extremeLabelEl) extremeLabelEl.textContent = t('sidebar', 'todaysHero');
    const sourcesLabel = document.querySelector('.sources-desktop .label'); if (sourcesLabel) sourcesLabel.textContent = t('sidebar', 'sources');
    const sourcesToggleLabel = document.querySelector('.sources-toggle-label'); if (sourcesToggleLabel) sourcesToggleLabel.textContent = `4 ${t('sidebar', 'sources').toLowerCase()}`;
  }

  // ========== WEATHER LOGIC ==========
  function computeSkyCondition(norm) {
    const condKey = (norm.conditionKey || '').toLowerCase(), rain = norm.rainPct, cloudPct = norm.cloudPct ?? (Array.isArray(norm.hourly) && norm.hourly[0]?.cloudPct);
    if (condKey === 'storm' || condKey.includes('thunder')) return 'storm';
    if (condKey === 'fog' || condKey.includes('mist') || condKey.includes('haze')) return 'fog';
    if (isNum(rain) && rain >= 50) return 'rain'; if (isNum(rain) && rain >= 30) return 'rain-possible';
    // Only show cloudy for genuinely overcast skies (80%+) or heavy cloud (60%+)
    if (isNum(cloudPct) && cloudPct >= 60) return 'cloudy';
    // If we don't have cloudPct, fall back to condKey but only for overcast, not "partly cloudy"
    if (!isNum(cloudPct) && (condKey.includes('overcast') || condKey === 'cloudy')) return 'cloudy';
    // Partly cloudy (30-60%) is basically clear with some clouds
    return 'clear';
  }
  function computeTodaysHero(norm) {
    const apiCondition = (norm.conditionKey || '').toLowerCase();
    const dailyRain = norm.dailyRainPct;
    const effectiveWind = norm.windKph; // Use mean wind, not gusts
    const cloud = norm.cloudPct;
    const isTrulyOvercast    = isNum(cloud) && cloud >= 80;
    const isMostlyCloudy     = isNum(cloud) && cloud >= 55;
    const isSignificantCloud = isNum(cloud) && cloud >= 40;
    const isDay = norm.isDay !== false; // false only when API says night
    if (isNum(dailyRain) && dailyRain >= 50) return 'rain';
    if (apiCondition === 'storm') return 'storm';
    if (apiCondition === 'cold') return 'cold';
    if (apiCondition === 'heat') return 'heat';
    if (isDay && apiCondition === 'uv' && !(isTrulyOvercast || isMostlyCloudy || isSignificantCloud)) return 'uv';
    if (isNum(dailyRain) && dailyRain >= 30) return 'rain';
    if (apiCondition === 'wind') return 'wind';
    if (isNum(effectiveWind) && effectiveWind >= 30) return 'wind';
    if (apiCondition === 'fog') return 'fog';
    if (apiCondition === 'cloudy') return 'cloudy';
    const hi = norm.todayHigh, low = norm.todayLow, uv = norm.uvDaily, feels = norm.feelsLike;
    if (isNum(feels) && feels <= -5) return 'cold';
    if (isNum(low) && low <= 0) return 'cold';
    if (isNum(hi) && hi >= THRESH.HOT_C) return 'heat';
    if (isDay && isNum(uv) && uv >= 8 && !(isTrulyOvercast || isMostlyCloudy || isSignificantCloud)) return 'uv';
    if (isNum(effectiveWind) && effectiveWind >= 25) return 'wind';
    if (isNum(hi) && hi <= 10) return 'cold';
    return 'clear';
  }
  
  function computeHomeDisplayCondition(norm) {
    const imminentRain = norm.rainPct;
    const apiCondition = (norm.conditionKey || '').toLowerCase();
    const effectiveWind = norm.windKph; // Use mean wind, not gusts
    const cloud = norm.cloudPct;
    const isTrulyOvercast    = isNum(cloud) && cloud >= 80;
    const isMostlyCloudy     = isNum(cloud) && cloud >= 55;
    const isSignificantCloud = isNum(cloud) && cloud >= 40;
    const isDay = norm.isDay !== false;
    if (apiCondition === 'storm') return 'storm';
    if (apiCondition === 'cold') return 'cold';
    if (apiCondition === 'heat') return 'heat';
    if (isNum(imminentRain) && imminentRain >= 50) return 'rain';
    if (isNum(imminentRain) && imminentRain >= 30) return 'rain-possible';
    if (isDay && apiCondition === 'uv' && !(isTrulyOvercast || isMostlyCloudy || isSignificantCloud)) return 'uv';
    if (apiCondition === 'wind') return 'wind';
    if (isNum(effectiveWind) && effectiveWind >= 30) return 'wind';
    if (apiCondition === 'fog') return 'fog';
    if (apiCondition === 'cloudy') return 'cloudy';
    if (isNum(effectiveWind) && effectiveWind >= 25) return 'wind';
    const sky = computeSkyCondition(norm);
    return sky !== 'clear' ? sky : 'clear';
  }

  // ========== TRANSLATED TEXT ==========
  function getHeadline(condition) { return T.headlines[condition]?.[settings.lang] || T.headlines[condition]?.en || "Clear skies."; }
  function getHeroLabel(condition) { return T.heroLabels[condition]?.[settings.lang] || T.heroLabels[condition]?.en || "Pleasant"; }
  function getWittyLine(condition) {
    const day = new Date().getDay(), isWeekend = day === 0 || day === 5 || day === 6;
    if (isWeekend && (condition === 'clear' || condition === 'heat')) {
      const wl = T.witty.weekend[settings.lang] || T.witty.weekend.en; return wl[Math.floor(Math.random() * wl.length)];
    }
    const lines = T.witty[condition]?.[settings.lang] || T.witty[condition]?.en || T.witty.clear.en;
    return lines[Math.floor(Math.random() * lines.length)];
  }
  function getDayBadge(d, dayIndex, hourlyData) {
    const ck = (d.conditionKey || '').toLowerCase();
    if (ck === 'storm') return t('badges', 'rainy');
    if (ck === 'cold') return t('badges', 'cold');
    if (ck === 'heat') return t('badges', 'hot');
    const r = d.rainChance;
    const isRainy = ck === 'rain' || ck === 'rain-possible' || (isNum(r) && r >= 30);
    if (isRainy && dayIndex === 0 && Array.isArray(hourlyData) && hourlyData.length > 0) {
      const currentHour = getLocationHour(activePlace?.lon);
      const rainThreshold = 25;
      let firstRainHour = -1;
      for (let i = 0; i < Math.min(24, hourlyData.length); i++) {
        const h = hourlyData[i];
        if (isNum(h.rainChance) && h.rainChance >= rainThreshold) { firstRainHour = (currentHour + i) % 24; break; }
      }
      if (firstRainHour === -1) return isNum(r) && r >= 50 ? t('badges', 'rainLater') : t('badges', 'showers');
      const hoursUntilRain = firstRainHour >= currentHour ? firstRainHour - currentHour : (24 - currentHour) + firstRainHour;
      if (hoursUntilRain <= 2) return isNum(r) && r >= 50 ? t('badges', 'rainy') : t('badges', 'showers');
      else if (firstRainHour >= 18 || firstRainHour < 5) return t('badges', 'rainTonight');
      else if (firstRainHour >= 5 && firstRainHour < 12) return t('badges', 'rainMorning');
      else return t('badges', 'rainLater');
    }
    if (ck === 'rain') return t('badges', 'rainy');
    if (ck === 'rain-possible') return t('badges', 'showers');
    if (ck === 'uv') return t('badges', 'highUV');
    if (ck === 'wind') return t('heroLabels', 'wind') || 'Windy';
    const u = d.uv, h = d.highC, low = d.lowC;
    if (isNum(low) && low <= 0) return t('badges', 'cold');
    if (isNum(h) && h <= 0) return t('badges', 'cold');
    if (isNum(r) && r >= 50) return t('badges', 'rainy');
    if (isNum(h) && h >= THRESH.HOT_C) return t('badges', 'hot');
    if (isNum(u) && u >= 8) return t('badges', 'highUV');
    if (isNum(r) && r >= 30) return t('badges', 'showers');
    if (isNum(h) && h <= 10) return t('badges', 'cold');
    if (isNum(u) && u >= 6) return t('badges', 'uvAlert');
    return '';
  }
  function getTranslatedDayName(dayIndex) {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return t('days', days[dayIndex]);
  }

  // ========== LOCATION TIME HELPER ==========
  function getLocationHour(lon) {
    // Prefer API-provided localHour (uses real UTC offset from Open-Meteo).
    // lon/15 approximation is off by up to 1hr in many SA locations.
    const apiHour = window.__PW_LAST_NORM?.localHour;
    if (isNum(apiHour)) return apiHour;
    if (!isNum(lon)) return new Date().getUTCHours();
    const now = new Date();
    const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
    const offsetHours = lon / 15;
    return Math.floor((utcHour + offsetHours + 24) % 24);
  }

  // ========== BACKGROUND & PARTICLES ==========
  const DAY_IMAGE_COUNT = 7;
  function setBackgroundFor(condition) {
    const base = 'assets/images/bg', aliasMap = { 'rain-possible': 'cloudy', 'uv': 'clear' };
    const folder = aliasMap[condition] || condition, fallbackFolder = condition === 'cold' ? 'cloudy' : 'clear';
    const hour = getLocationHour(activePlace?.lon);
    const timeOfDay = hour >= 5 && hour < 8 ? 'dawn' : hour >= 8 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'dusk' : 'night';
    // Day-of-week maps to image number: Mon=1, Tue=2... Sat=6, Sun=7
    // This way you can curate weekend images (day_6, day_7) to be leisure/outdoor
    // and weekday images (day_1-5) to include urban/work contexts if appropriate
    const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon...6=Sat
    const dayNum = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert to 1-7 (Mon-Sun)
    const imgFile = timeOfDay === 'day' ? `day_${dayNum}` : timeOfDay;
    if (bgImg) { bgImg.src = `${base}/${folder}/${imgFile}.jpg`; bgImg.onerror = () => { bgImg.src = `${base}/${folder}/day.jpg`; bgImg.onerror = () => { bgImg.src = `${base}/${fallbackFolder}/day.jpg`; }; }; }
  }
  function createParticles(condition) {
    if (!particlesEl) return; particlesEl.innerHTML = '';
    let pc = null, amt = 20;
    if (condition === 'rain' || condition === 'storm') { pc = 'rain'; amt = 28; }
    else if (condition === 'cold') { pc = 'snow'; amt = 18; }
    else if (condition === 'wind') { pc = 'wind'; amt = 16; }
    if (!pc) return;
    for (let i = 0; i < amt; i++) { const p = document.createElement('div'); p.classList.add('particle', pc); p.style.left = `${Math.random() * 100}%`; p.style.animationDelay = `${Math.random() * 2}s`; p.style.animationDuration = `${Math.random() * 3 + 2}s`; particlesEl.appendChild(p); }
  }

  // ========== API ==========
  // Cascading reverse geocode: zoom=16 for hamlet/suburb detail, smart fallback
  // Priority: village/town BEFORE city — so "Wilderness" wins over "George"
  async function reverseGeocode(lat, lon) {
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`, { headers: { 'User-Agent': 'ProbablyWeather/1.0' }, signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return null;
      const data = await resp.json();
      const addr = data.address || {};
      const smallPlace = addr.village || addr.town;
      const suburb = addr.suburb || addr.neighbourhood;
      const city = addr.city || addr.municipality;
      const province = addr.state || addr.province || addr.region;
      const country = addr.country;
      if (smallPlace) return province ? `${smallPlace}, ${province}` : (country ? `${smallPlace}, ${country}` : smallPlace);
      if (suburb && city) return `${suburb}, ${city}`;
      if (suburb) return province ? `${suburb}, ${province}` : (country ? `${suburb}, ${country}` : suburb);
      if (city) return province ? `${city}, ${province}` : (country ? `${city}, ${country}` : city);
      if (province) return country ? `${province}, ${country}` : province;
      if (country) return country;
      return null;
    } catch { return null; }
  }
  async function resolvePlaceName(place) { if (!place || !isNum(place.lat) || !isNum(place.lon)) return place?.name || 'Unknown'; if (!isPlaceholderName(place.name)) return place.name; return await reverseGeocode(place.lat, place.lon) || place.name || 'Unknown'; }
  async function fetchProbable(place) { const url = `/api/weather?lat=${encodeURIComponent(place.lat)}&lon=${encodeURIComponent(place.lon)}&name=${encodeURIComponent(place.name || '')}`; const resp = await fetch(url); if (!resp.ok) throw new Error('API error'); return await resp.json(); }
  function normalizePayload(payload) {
    const now = payload.now || {}, today = payload.daily?.[0] || {}, meta = payload.meta || {}, sources = meta.sources || [];
    const hourly = payload.hourly || [];
    const imminentHours = hourly.slice(0, 4);
    const imminentRainMax = imminentHours.length > 0 ? Math.max(...imminentHours.map(h => h.rainChance ?? 0)) : null;
    const displayRainPct = isNum(imminentRainMax) ? imminentRainMax : (today.rainChance ?? now.rainChance ?? null);
    const dailyRainPct = today.rainChance ?? now.rainChance ?? null;
    const rainLater = isNum(imminentRainMax) && imminentRainMax < 30 && isNum(dailyRainPct) && dailyRainPct >= 50;
    return { 
      nowTemp: now.tempC ?? null, feelsLike: now.feelsLikeC ?? null, todayHigh: today.highC ?? null, todayLow: today.lowC ?? null, 
      rainPct: displayRainPct, dailyRainPct: dailyRainPct, rainLater: rainLater,
      uv: now.uv ?? null,        // now.uv is null at night (API nulls it after sunset)
      uvDaily: today.uv ?? null, // today's peak UV, for daytime byline reference only
      isDay: now.isDay !== false, // false only when API explicitly says night
      localHour: meta.localHour ?? null, // correct local hour from API (uses real UTC offset)
      windKph: isNum(payload.wind_kph) ? payload.wind_kph : (isNum(now.windKph) ? now.windKph : 0), 
      maxWindKph: isNum(payload.maxWindKph) ? payload.maxWindKph : null,
      gustKph: isNum(payload.gustKph) ? payload.gustKph : null,
      cloudPct: isNum(now.cloudPct) ? now.cloudPct : (Array.isArray(payload.hourly) && payload.hourly[0] ? payload.hourly[0].cloudPct ?? null : null),
      conditionKey: now.conditionKey || today.conditionKey || null, conditionLabel: now.conditionLabel || today.conditionLabel || '', 
      confidenceKey: payload.consensus?.confidenceKey || 'mixed', 
      used: sources.filter(s => s.ok).map(s => s.name), failed: sources.filter(s => !s.ok).map(s => s.name), 
      hourly: hourly, daily: payload.daily || [], locationName: payload.location?.name, sourceRanges: meta.sourceRanges || [] 
    };
  }

  // ========== UV INDEX CARD ==========
  function renderUvCard(norm) {
    const card = $('#uvCard');
    if (!card) return;
    const uv = norm.uv;
    // Hide at night or when UV data unavailable
    if (!norm.isDay || !isNum(uv)) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    const labelEl = $('#uvCardLabel'), sevEl = $('#uvSeverity'), ssEl = $('#uvSunscreen');
    if (labelEl) safeText(labelEl, t('uvCard', 'label'));
    let sevText, sevClass;
    if (uv <= 2) { sevText = t('uvCard', 'low'); sevClass = 'uv-low'; }
    else if (uv <= 5) { sevText = t('uvCard', 'moderate'); sevClass = 'uv-moderate'; }
    else if (uv <= 7) { sevText = t('uvCard', 'high'); sevClass = 'uv-high'; }
    else if (uv <= 10) { sevText = t('uvCard', 'veryHigh'); sevClass = 'uv-veryhigh'; }
    else { sevText = t('uvCard', 'extreme'); sevClass = 'uv-extreme'; }
    if (sevEl) {
      safeText(sevEl, `${round0(uv)} — ${sevText}`);
      sevEl.className = 'uv-severity ' + sevClass;
    }
    if (ssEl) safeText(ssEl, uv >= 6 ? t('uvCard', 'sunscreen') : '');
  }

  // ========== BRAAI INDEX ==========
  function calculateBraaiIndex(norm) {
    // Composite score 0-100:  Rain (40%), Temp (30%), Wind (20%), Cloud (10%)
    let rainScore = 100;
    if (isNum(norm.rainPct)) {
      if (norm.rainPct >= 70) rainScore = 0;
      else if (norm.rainPct >= 50) rainScore = 20;
      else if (norm.rainPct >= 30) rainScore = 55;
      else if (norm.rainPct >= 15) rainScore = 80;
      else rainScore = 100;
    }
    let tempScore = 50;
    const tc = norm.nowTemp;
    if (isNum(tc)) {
      // Sweet spot 22-28°C = 100, slopes down outside
      if (tc >= 22 && tc <= 28) tempScore = 100;
      else if (tc >= 18 && tc < 22) tempScore = 70 + (tc - 18) * 7.5;
      else if (tc > 28 && tc <= 34) tempScore = 100 - (tc - 28) * 8;
      else if (tc >= 14 && tc < 18) tempScore = 40 + (tc - 14) * 7.5;
      else if (tc > 34) tempScore = Math.max(0, 52 - (tc - 34) * 10);
      else tempScore = Math.max(0, tc * 2.8);  // below 14
    }
    let windScore = 100;
    const w = norm.windKph;
    if (isNum(w)) {
      if (w <= 15) windScore = 100;
      else if (w <= 25) windScore = 80 - (w - 15) * 2;
      else if (w <= 40) windScore = 60 - (w - 25) * 3;
      else windScore = Math.max(0, 15 - (w - 40) * 1.5);
    }
    let cloudScore = 80;
    if (isNum(norm.cloudPct)) {
      cloudScore = norm.cloudPct <= 30 ? 100 : Math.max(20, 100 - (norm.cloudPct - 30) * 1.1);
    }
    return Math.round(rainScore * 0.4 + tempScore * 0.3 + windScore * 0.2 + cloudScore * 0.1);
  }
  function renderBraaiIndex(norm) {
    const card = $('#braaiCard');
    if (!card) return;
    // Only show during the day
    if (!norm.isDay) { card.classList.add('hidden'); return; }
    const score = calculateBraaiIndex(norm);
    card.classList.remove('hidden');
    const labelEl = $('#braaiLabel'), scoreEl = $('#braaiScore'), verdictEl = $('#braaiVerdict');
    if (labelEl) safeText(labelEl, t('braai', 'label'));
    if (scoreEl) safeText(scoreEl, `${score}/100`);
    let verdictKey;
    if (score >= 85) verdictKey = 'perfect';
    else if (score >= 70) verdictKey = 'great';
    else if (score >= 50) verdictKey = 'decent';
    else if (score >= 30) verdictKey = 'risky';
    else verdictKey = 'nope';
    if (verdictEl) safeText(verdictEl, t('braai', verdictKey));
    // Colour the score based on tier
    if (scoreEl) {
      scoreEl.style.color = score >= 85 ? '#4caf50' : score >= 70 ? '#8bc34a' : score >= 50 ? '#fdd835' : score >= 30 ? '#ff9800' : '#f44336';
    }
  }

  // ========== CAPE DOCTOR WIND ALERT ==========
  let capeWindDismissed = false;
  function isWesternCape(place) {
    if (!place || !isNum(place.lat) || !isNum(place.lon)) return false;
    return place.lat >= -34.5 && place.lat <= -33.0 && place.lon >= 17.5 && place.lon <= 20.0;
  }
  function renderCapeWind(norm) {
    if (!capeWindBanner) return;
    const wind = norm.windKph;
    if (!capeWindDismissed && isWesternCape(activePlace) && isNum(wind) && wind >= 50) {
      const lines = T.capeDr.lines[settings.lang] || T.capeDr.lines.en;
      safeText(capeWindText, lines[Math.floor(Math.random() * lines.length)]);
      capeWindBanner.classList.remove('hidden');
    } else {
      capeWindBanner.classList.add('hidden');
    }
  }
  if (capeWindDismiss) capeWindDismiss.addEventListener('click', () => { capeWindDismissed = true; if (capeWindBanner) capeWindBanner.classList.add('hidden'); });

  // Sources tap-to-swap (mobile only — CSS hides toggle on desktop)
  const sourcesToggle = $('#sourcesToggle');
  const sidebarEl = document.querySelector('.sidebar');
  let sourcesTimer = null;
  if (sourcesToggle && sidebarEl) {
    sourcesToggle.addEventListener('click', () => {
      const opening = !sidebarEl.classList.contains('sources-open');
      if (sourcesTimer) { clearTimeout(sourcesTimer); sourcesTimer = null; }
      if (opening) {
        sidebarEl.classList.add('sources-open');
        sourcesTimer = setTimeout(() => { sidebarEl.classList.remove('sources-open'); sourcesTimer = null; }, 4000);
      } else {
        sidebarEl.classList.remove('sources-open');
      }
    });
  }

  // ========== RENDER ==========
  function renderLoading(name) { showLoader(true); safeText(locationEl, name); safeText(headlineEl, t('misc', 'loading')); safeText(tempEl, '--°'); safeText(descriptionEl, '—'); }
  function renderError(msg) { showLoader(false); safeText(headlineEl, t('misc', 'error')); safeText(descriptionEl, msg || t('misc', 'couldntFetch')); }
  function renderSidebar(norm, heroOverride) {
    if (!norm && window.__PW_LAST_NORM) norm = window.__PW_LAST_NORM; if (!norm) return;
    const sr = norm.sourceRanges || [];
    const text = sr.length > 0 ? (sr.filter(s => isNum(s.minTemp) && isNum(s.maxTemp)).map(s => `${s.name}: ${round0(s.minTemp)}°-${round0(s.maxTemp)}°`).join('\n') || '--') : ({ strong: 'Strong', decent: 'Decent', mixed: 'Mixed' }[norm.confidenceKey] || 'Mixed');
    safeText($('#confidenceValue'), text);
    safeText($('#confidenceValueDesktop'), text);
    safeText($('#sourcesSwap'), text);
  }
  function renderHome(norm) {
    showLoader(false);
    const currentTemp = norm.nowTemp, hi = norm.todayHigh, low = norm.todayLow, rain = norm.rainPct, wind = norm.windKph, uv = norm.uv;
    const displayCondition = computeHomeDisplayCondition(norm), hero = computeTodaysHero(norm);
    document.body.className = `weather-${displayCondition}`;
    let locationName = norm.locationName || activePlace?.name || 'South Africa'; safeText(locationEl, locationName);
    if (isPlaceholderName(locationName) && activePlace?.lat && activePlace?.lon) {
      const cp = activePlace; reverseGeocode(activePlace.lat, activePlace.lon).then(cn => { if (cn && cp === activePlace) { safeText(locationEl, cn); if (activePlace) activePlace.name = cn; if (homePlace && homePlace.lat === cp.lat && homePlace.lon === cp.lon) { homePlace.name = cn; saveJSON(STORAGE.home, homePlace); } } }).catch(() => {});
    }
    const probablyLabel = t('weather', 'probably');
    safeText(tempEl, isNum(currentTemp) ? `${probablyLabel} ${formatTemp(currentTemp)}` : `${probablyLabel} --°`);
    const hiLoEl = $('#tempHiLo');
    if (hiLoEl) {
      if (settings.range) {
        const hiStr = isNum(hi) ? formatTemp(hi) : '--°';
        const loStr = isNum(low) ? formatTemp(low) : '--°';
        hiLoEl.textContent = '';
        const hiSpan = document.createElement('span'); hiSpan.className = 'hi'; hiSpan.textContent = `\u2191${hiStr}`;
        const loSpan = document.createElement('span'); loSpan.className = 'lo'; loSpan.textContent = `\u2193${loStr}`;
        hiLoEl.appendChild(hiSpan); hiLoEl.append(' '); hiLoEl.appendChild(loSpan);
        hiLoEl.style.display = '';
      } else {
        hiLoEl.textContent = '';
        hiLoEl.style.display = 'none';
      }
    }
    // At night, override 'clear' copy so we don't say "Beach or braai?" at midnight
    const displayConditionForCopy = (!norm.isDay && displayCondition === 'clear') ? 'night' : displayCondition;
    safeText(headlineEl, getWittyLine(displayConditionForCopy));
    safeText(descriptionEl, getHeadline(displayConditionForCopy));
    const bylineEl = $('#weatherByline');
    if (bylineEl) {
      const gust = norm.gustKph;
      const showGust = isNum(gust) && isNum(wind) && gust > wind * 1.3;
      const ws = isNum(wind) ? (showGust ? `${formatWind(wind)} (${t('weather','gusts')||'gusts'} ${formatWind(gust)})` : formatWind(wind)) : '--';
      const rainLabel = t('weather', 'rain'), windLabel = t('weather', 'wind'), uvLabel = t('weather', 'uv');
      let rs = '--'; 
      if (isNum(rain)) { rs = rain < 10 ? t('weather', 'none') : rain < 30 ? t('weather', 'unlikely') : rain < 55 ? t('weather', 'possible') : t('weather', 'likely'); }
      if (norm.rainLater) { rs = t('weather', 'later') || 'Later'; }
      // uv is null at night (API nulls now.uv after sunset) — show nothing
      let us = '--'; if (isNum(uv)) { us = (uv < 3 ? t('weather', 'low') : uv < 6 ? t('weather', 'moderate') : uv < 8 ? t('weather', 'high') : t('weather', 'veryHigh')) + ` (${round0(uv)})`; }
      const feels = norm.feelsLike;
      const showFeels = isNum(feels) && isNum(currentTemp) && Math.abs(feels - currentTemp) >= 3;
      const feelsStr = showFeels ? `${t('weather', 'feelsLike')} ${formatTemp(feels)}` : '';
      const line1 = `${windLabel} ${ws} • ${rainLabel} ${rs}`;
      const line2 = `${uvLabel} ${us}${feelsStr ? ' • ' + feelsStr : ''}`;
      bylineEl.innerHTML = `<div class="byline-row">${line1}</div><div class="byline-row">${line2}</div>`;
    }
    const hc = ['hero-storm', 'hero-rain', 'hero-heat', 'hero-cold', 'hero-wind', 'hero-uv', 'hero-clear', 'hero-cloudy', 'hero-fog'];
    [headlineEl, tempEl].forEach(el => { if (el) { el.classList.remove(...hc); el.classList.add('hero-' + displayCondition); } });
    window.__PW_LAST_DISPLAY = displayCondition; window.__PW_LAST_HERO = hero;
    renderSidebar(norm, hero); setBackgroundFor(displayCondition); createParticles(displayCondition);
    renderCapeWind(norm);
  }
  function getWeatherIcon(rp, cp, tc) {
    if (isNum(tc) && tc <= 0) return '❄️';
    if (isNum(rp) && rp >= 50) return '🌧️';
    if (isNum(rp) && rp >= 30) return '🌦️';
    if (isNum(tc) && tc >= 35) return '🔥';
    if (isNum(cp) && cp >= 70) return '☁️';
    if (isNum(cp) && cp >= 40) return '⛅';
    if (isNum(tc) && tc <= 10) return '❄️';
    return '☀️';
  }
  function renderHourly(hourly) {
    if (!hourlyTimeline) return; hourlyTimeline.innerHTML = '';
    const nowHour = getLocationHour(activePlace?.lon);
    const currentWind = window.__PW_LAST_NORM?.windKph || null;
    const header = document.createElement('div');
    header.classList.add('hourly-row', 'hourly-header');
    header.innerHTML = `<span class="h-time">${t('weather', 'time') || 'Time'}</span><span class="h-icon"></span><span class="h-temp">${t('weather', 'temp') || 'Temp'}</span><span class="h-rain">${t('weather', 'rain') || 'Rain'}</span><span class="h-wind">${t('weather', 'wind') || 'Wind'}</span><span class="h-uv">${t('weather', 'uv') || 'UV'}</span>`;
    hourlyTimeline.appendChild(header);
    // Hourly array starts at midnight local time. Slice from current hour so
    // the data shown matches the time label. Show remaining hours of today + up to 24 total.
    const slicedHourly = hourly.slice(nowHour, nowHour + 24);
    slicedHourly.forEach((h, i) => {
      const div = document.createElement('div'); div.classList.add('hourly-row');
      const hourNum = (nowHour + i) % 24;
      const ht = settings.time === '12' ? `${hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum}${hourNum >= 12 ? 'pm' : 'am'}` : `${String(hourNum).padStart(2, '0')}:00`;
      const iconTemp = (isNum(h.feelsLikeC) && h.feelsLikeC < h.tempC) ? h.feelsLikeC : h.tempC;
      const icon = getWeatherIcon(h.rainChance, h.cloudPct, iconTemp);
      const rainPct = isNum(h.rainChance) ? round0(h.rainChance) + '%' : '--';
      const rawWind = h.windKmh ?? h.windKph ?? h.wind_kph ?? (i < 3 ? currentWind : null);
      const windSpeed = isNum(rawWind) ? (settings.wind === 'mph' ? round0(rawWind * 0.621371) : round0(rawWind)) : '--';
      const tempClass = getTempColorClass(h.tempC);
      const uvVal = isNum(h.uv) ? round0(h.uv) : '--';
      const uvClass = isNum(h.uv) ? (h.uv >= 8 ? 'uv-extreme' : h.uv >= 6 ? 'uv-high' : h.uv >= 3 ? 'uv-mod' : '') : '';
      div.innerHTML = `<span class="h-time">${ht}</span><span class="h-icon">${icon}</span><span class="h-temp ${tempClass}">${formatTemp(h.tempC)}</span><span class="h-rain">${rainPct}</span><span class="h-wind">${windSpeed}</span><span class="h-uv ${uvClass}">${uvVal}</span>`;
      hourlyTimeline.appendChild(div);
    });
  }
  function renderWeek(daily, hourlyData) {
    if (!dailyCards) return; dailyCards.innerHTML = '';
    const header = document.createElement('div');
    header.classList.add('daily-row', 'daily-header');
    header.innerHTML = `<span class="d-day">${t('weather', 'day') || 'Day'}</span><span class="d-icon"></span><span class="d-high">${t('weather', 'high') || 'High'}</span><span class="d-low">${t('weather', 'low') || 'Low'}</span><span class="d-rain">${t('weather', 'rain') || 'Rain'}</span>`;
    dailyCards.appendChild(header);
    daily.forEach((d, i) => {
      const date = new Date(Date.now() + i * 86400000);
      const dayName = getTranslatedDayName(date.getDay());
      const badge = getDayBadge(d, i, hourlyData);
      const iconTemp = isNum(d.lowC) && d.lowC <= 0 ? d.lowC : d.highC;
      const icon = getWeatherIcon(d.rainChance, d.cloudPct, iconTemp);
      const rainPct = isNum(d.rainChance) ? round0(d.rainChance) + '%' : '--';
      const highTempClass = getTempColorClass(d.highC);
      const lowTempClass = getTempColorClass(d.lowC);
      const div = document.createElement('div'); div.classList.add('daily-row');
      div.innerHTML = `<span class="d-day">${dayName}${badge ? ` <span class="day-badge">${badge}</span>` : ''}</span><span class="d-icon">${icon}</span><span class="d-high ${highTempClass}">${isNum(d.highC) ? formatTemp(d.highC) : '--°'}</span><span class="d-low ${lowTempClass}">${isNum(d.lowC) ? formatTemp(d.lowC) : '--°'}</span><span class="d-rain">${rainPct}</span>`;
      dailyCards.appendChild(div);
    });
  }
  function applySettings() {
    if (unitsTempSelect) unitsTempSelect.value = settings.temp;
    if (unitsWindSelect) unitsWindSelect.value = settings.wind;
    if (probRangeToggle) probRangeToggle.checked = !!settings.range;
    if (timeFormatSelect) timeFormatSelect.value = settings.time;
    if (languageSelect) languageSelect.value = settings.lang;
    updateUILanguage();
    if (lastPayload) { const norm = normalizePayload(lastPayload); window.__PW_LAST_NORM = norm; renderHome(norm); renderHourly(norm.hourly); renderWeek(norm.daily, norm.hourly); }
    renderFavorites(); renderRecents();
  }
  async function loadAndRender(place) {
    activePlace = place; renderLoading(place.name || 'My Location');
    // 1. Try showing cached data instantly
    const cached = await getCachedWeather(place);
    if (cached) {
      try {
        lastPayload = cached.payload;
        const norm = normalizePayload(cached.payload);
        window.__PW_LAST_NORM = norm;
        renderHome(norm); renderHourly(norm.hourly); renderWeek(norm.daily, norm.hourly);
        showCacheAge(cached.timestamp);
      } catch { /* stale cache, ignore */ }
    }
    // 2. Fetch fresh data from network
    try {
      const payload = await fetchProbable(place);
      lastPayload = payload;
      const norm = normalizePayload(payload);
      window.__PW_LAST_NORM = norm;
      renderHome(norm); renderHourly(norm.hourly); renderWeek(norm.daily, norm.hourly);
      hideCacheAge();
      setCachedWeather(place, payload);
    } catch (e) {
      console.error("Load failed:", e);
      if (!cached) renderError(t('misc', 'couldntFetch'));
      // If cached data was shown, user still sees stale but usable data
    }
  }

  // ========== FAVORITES & RECENTS ==========
  const loadFavorites = () => loadJSON(STORAGE.favorites, []);
  const loadRecents = () => loadJSON(STORAGE.recents, []);
  const saveFavorites = (list) => saveJSON(STORAGE.favorites, list);
  const saveRecents = (list) => saveJSON(STORAGE.recents, list);
  function clearRecents() { localStorage.removeItem(STORAGE.recents); renderRecents(); }
  async function addFavorite(place) {
    let list = loadFavorites();
    if (list.some(p => samePlace(p, place))) { showToast(t('toasts', 'alreadySaved')); return; }
    if (list.length >= 5) { showToast(t('toasts', 'maxPlaces')); return; }
    const rn = await resolvePlaceName(place); list.unshift({ ...place, name: rn }); saveFavorites(list.slice(0, 5)); renderFavorites(); showToast(t('toasts', 'saved'));
  }
  async function addRecentIfNew(place) {
    const favs = loadFavorites(); if (favs.some(p => samePlace(p, place))) return;
    const existing = loadRecents(); if (existing.some(p => samePlace(p, place))) return;
    const rn = await resolvePlaceName(place); saveRecents([{ ...place, name: rn }, ...existing.filter(p => !samePlace(p, { ...place, name: rn }))].slice(0, 20)); renderRecents();
  }
  async function toggleFavorite(place) {
    let list = loadFavorites();
    if (list.some(p => samePlace(p, place))) { list = list.filter(p => !samePlace(p, place)); saveFavorites(list); renderFavorites(); showToast(t('toasts', 'removed')); return; }
    await addFavorite(place);
  }
  async function ensureFavoriteMeta(place) {
    if (!place || !isNum(place.lat) || !isNum(place.lon) || (isNum(place.tempC) && place.conditionKey)) return;
    const key = favoriteKey(place); if (pendingFavMeta.has(key)) return; pendingFavMeta.add(key);
    try { const norm = normalizePayload(await fetchProbable(place)); const list = loadFavorites(); const idx = list.findIndex(p => samePlace(p, place)); if (idx !== -1) { list[idx] = { ...list[idx], tempC: norm.nowTemp ?? null, conditionKey: norm.conditionKey ?? null }; saveFavorites(list); renderFavorites(); } } catch {} finally { pendingFavMeta.delete(key); }
  }
  function renderRecents() {
    if (!recentList) return; const list = loadRecents();
    const logoMini = `<svg class="recent-logo" viewBox="0 0 40 40" width="18" height="18"><circle cx="20" cy="20" r="18" fill="url(#logoGrad)"/><text x="12" y="28" font-family="Poppins,sans-serif" font-size="22" font-weight="800" fill="#fff">P</text><defs><linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFDD44"/><stop offset="100%" stop-color="#FFAA00"/></linearGradient></defs></svg>`;
    recentList.innerHTML = list.map(p => `<li class="recent-item" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}">${logoMini}<span class="recent-name">${escapeHtml(p.name)}</span></li>`).join('') || `<li style="opacity:0.6;cursor:default;">${t('search', 'noRecent')}</li>`;
    recentList.querySelectorAll('li[data-lat]').forEach(li => { li.addEventListener('click', () => { showScreen(screenHome); loadAndRender({ name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon) }); }); });
  }
  function renderFavorites() {
    if (!favoritesList) return; const list = loadFavorites();
    const fl = document.getElementById('favLimit'); if (fl) fl.style.display = list.length >= 5 ? 'block' : 'none';
    favoritesList.innerHTML = list.map(p => {
      const temp = isNum(p.tempC) ? formatTemp(p.tempC) : '--°';
      const rb = manageMode ? `<button class="remove-fav" data-lat="${p.lat}" data-lon="${p.lon}">✕</button>` : '';
      return `<li class="favorite-item" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}"><button class="fav-star" data-lat="${p.lat}" data-lon="${p.lon}">★</button><span class="fav-name">${escapeHtml(p.name)}</span><span class="fav-temp">${temp}</span>${rb}</li>`;
    }).join('') || `<li style="opacity:0.6;cursor:default;">${t('search', 'noSaved')}</li>`;
    favoritesList.querySelectorAll('li[data-lat] .fav-name').forEach(span => { span.addEventListener('click', () => { const li = span.closest('li'); showScreen(screenHome); loadAndRender({ name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon) }); }); });
    favoritesList.querySelectorAll('.fav-star').forEach(btn => { btn.addEventListener('click', async (e) => { e.stopPropagation(); await toggleFavorite({ name: btn.closest('li')?.dataset?.name, lat: parseFloat(btn.dataset.lat), lon: parseFloat(btn.dataset.lon) }); }); });
    favoritesList.querySelectorAll('.remove-fav').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); let list = loadFavorites(); list = list.filter(p => !samePlace(p, { lat: parseFloat(btn.dataset.lat), lon: parseFloat(btn.dataset.lon) })); saveFavorites(list); renderFavorites(); showToast(t('toasts', 'removed')); }); });
    list.forEach(p => ensureFavoriteMeta(p));
  }

  // ========== SEARCH ==========
  let searchTimeout = null, searchResults = [], activeSearchController = null, searchSeq = 0;
  const searchMiniCache = new Map();
  async function runSearch(query) {
    if (!query || query.length < 2) { renderSearchResults([]); return; }
    const thisSeq = ++searchSeq; if (activeSearchController) activeSearchController.abort(); activeSearchController = new AbortController();
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&addressdetails=1`, { headers: { 'User-Agent': 'ProbablyWeather/1.0' }, signal: activeSearchController.signal });
      if (thisSeq !== searchSeq || !resp.ok) return;
      searchResults = (await resp.json()).map(r => ({ name: r.display_name?.split(',')[0] || 'Unknown', fullName: r.display_name, lat: r.lat, lon: r.lon, address: r.address }));
      renderSearchResults(searchResults);
    } catch (e) { if (e.name !== 'AbortError') console.error('Search error:', e); }
  }
  function formatSearchResult(r) { const a = r.address || {}; const city = a.city || a.town || a.village || r.name; return a.country ? `${city}, ${a.country}` : city; }
  async function miniFetchTemp(lat, lon) { const key = `${lat.toFixed(2)},${lon.toFixed(2)}`; if (searchMiniCache.has(key)) return searchMiniCache.get(key); try { const norm = normalizePayload(await fetchProbable({ lat, lon, name: '' })); const r = { temp: formatTemp(norm.nowTemp), icon: conditionEmoji(norm.conditionKey) }; searchMiniCache.set(key, r); return r; } catch { return { temp: '--°', icon: '⛅' }; } }
  function renderSearchResults(results) {
    const rl = document.getElementById('searchResults') || (() => { const ul = document.createElement('ul'); ul.id = 'searchResults'; ul.className = 'search-results'; document.querySelector('.search-body')?.prepend(ul); return ul; })();
    if (!results.length) { rl.innerHTML = ''; return; }
    const favs = loadFavorites();
    rl.innerHTML = results.map(r => { const fn = escapeHtml(formatSearchResult(r)), isFav = favs.some(p => samePlace(p, { lat: parseFloat(r.lat), lon: parseFloat(r.lon) })); return `<li class="search-result-item" data-lat="${r.lat}" data-lon="${r.lon}" data-name="${fn}"><button class="fav-star${isFav ? ' is-fav' : ''}" data-lat="${r.lat}" data-lon="${r.lon}">${isFav ? '★' : '☆'}</button><span class="result-icon">⛅</span><span class="result-name">${fn}</span><span class="result-temp">--°</span></li>`; }).join('');
    rl.querySelectorAll('li[data-lat]').forEach(li => { li.addEventListener('click', async (e) => { if (e.target.closest('.fav-star')) return; const place = { name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon) }; showScreen(screenHome); loadAndRender(place); if (searchInput) searchInput.value = ''; rl.innerHTML = ''; addRecentIfNew(place).catch(() => {}); }); });
    rl.querySelectorAll('.fav-star').forEach(btn => { btn.addEventListener('click', async (e) => { e.stopPropagation(); await toggleFavorite({ name: btn.closest('li')?.dataset?.name, lat: parseFloat(btn.dataset.lat), lon: parseFloat(btn.dataset.lon) }); renderSearchResults(results); }); });
    rl.querySelectorAll('li[data-lat]').forEach(async (li) => { const mini = await miniFetchTemp(parseFloat(li.dataset.lat), parseFloat(li.dataset.lon)); const ie = li.querySelector('.result-icon'), te = li.querySelector('.result-temp'); if (ie) ie.textContent = mini.icon || '⛅'; if (te) te.textContent = mini.temp || '--°'; });
  }
  if (searchInput) searchInput.addEventListener('input', (e) => { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => runSearch(e.target.value), 300); });

  // ========== NAV & EVENTS ==========
  navHome?.addEventListener('click', () => { showScreen(screenHome); });
  navHourly?.addEventListener('click', () => showScreen(screenHourly));
  navWeek?.addEventListener('click', () => showScreen(screenWeek));
  navSearch?.addEventListener('click', () => { showScreen(screenSearch); renderRecents(); renderFavorites(); });
  navSettings?.addEventListener('click', () => showScreen(screenSettings));
  
  // Build a display name from reverse geocode data — never returns "My Location, ZA"
  function buildLocationName(data, lat, lon) {
    const city = data?.city;
    const admin1 = data?.admin1;
    const nearCity = data?.nearCity;
    if (city && admin1) return `${city}, ${admin1}`;
    if (city) return city;
    if (admin1) return admin1;
    // Ultimate fallback: use coordinates rounded for display
    return `${Math.abs(lat).toFixed(1)}°${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(1)}°${lon < 0 ? 'W' : 'E'}`;
  }

  // My Location button - reset to geolocation
  myLocationBtn?.addEventListener('click', () => {
    showScreen(screenHome);
    const savedGpsLoc = loadJSON(STORAGE.location, null);
    if ("geolocation" in navigator) {
      renderLoading("Getting location...");
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = Math.round(pos.coords.latitude * 10) / 10, lon = Math.round(pos.coords.longitude * 10) / 10;
        try {
          const rev = await fetch(`/api/weather?reverse=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
          const data = await rev.json();
          const displayName = buildLocationName(data, lat, lon);
          saveJSON(STORAGE.location, { city: data?.city, admin1: data?.admin1, countryCode: data?.countryCode, lat, lon });
          homePlace = { name: displayName, lat, lon };
          saveJSON(STORAGE.home, homePlace);
          loadAndRender(homePlace);
          showToast('📍 ' + (t('toasts', 'locationUpdated') || 'Location updated'));
        } catch {
          // API failed — try client-side reverse geocode
          const fallbackName = await reverseGeocode(lat, lon);
          homePlace = { name: fallbackName || `${Math.abs(lat).toFixed(1)}°S, ${Math.abs(lon).toFixed(1)}°E`, lat, lon };
          saveJSON(STORAGE.home, homePlace);
          loadAndRender(homePlace);
        }
      }, (err) => {
        console.log('Geolocation error:', err.code, err.message);
        if (savedGpsLoc?.lat && savedGpsLoc?.lon) {
          const savedName = savedGpsLoc.city && savedGpsLoc.admin1
            ? `${savedGpsLoc.city}, ${savedGpsLoc.admin1}`
            : (savedGpsLoc.city || savedGpsLoc.admin1 || 'South Africa');
          homePlace = { name: savedName, lat: savedGpsLoc.lat, lon: savedGpsLoc.lon };
          saveJSON(STORAGE.home, homePlace);
          loadAndRender(homePlace);
          showToast('📍 ' + (t('toasts', 'usingSaved') || 'Using saved location'));
        } else {
          // GPS blocked, no saved location - use IP geolocation
          getIPLocation().then(place => {
            homePlace = place;
            saveJSON(STORAGE.home, homePlace);
            loadAndRender(homePlace);
          });
        }
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    } else {
      if (savedGpsLoc?.lat && savedGpsLoc?.lon) {
        const savedName = savedGpsLoc.city && savedGpsLoc.admin1
          ? `${savedGpsLoc.city}, ${savedGpsLoc.admin1}`
          : (savedGpsLoc.city || savedGpsLoc.admin1 || 'South Africa');
        homePlace = { name: savedName, lat: savedGpsLoc.lat, lon: savedGpsLoc.lon };
        saveJSON(STORAGE.home, homePlace);
        loadAndRender(homePlace);
        showToast('📍 ' + (t('toasts', 'usingSaved') || 'Using saved location'));
      } else {
        getIPLocation().then(place => {
          homePlace = place;
          saveJSON(STORAGE.home, homePlace);
          loadAndRender(homePlace);
        });
      }
    }
  });
  
  unitsTempSelect?.addEventListener('change', () => { settings.temp = unitsTempSelect.value; saveSettings(); applySettings(); });
  unitsWindSelect?.addEventListener('change', () => { settings.wind = unitsWindSelect.value; saveSettings(); applySettings(); });
  probRangeToggle?.addEventListener('change', () => { settings.range = !!probRangeToggle.checked; saveSettings(); applySettings(); });
  timeFormatSelect?.addEventListener('change', () => { settings.time = timeFormatSelect.value; saveSettings(); applySettings(); });
  languageSelect?.addEventListener('change', () => { settings.lang = languageSelect.value; saveSettings(); applySettings(); });
  saveCurrent?.addEventListener('click', () => { if (activePlace) addFavorite(activePlace); });
  searchCancel?.addEventListener('click', () => { showScreen(screenHome); if (searchInput) searchInput.value = ''; });
  manageFavorites?.addEventListener('click', () => { if (loadFavorites().length === 0) { showToast(t('toasts', 'noPlaces')); return; } manageMode = !manageMode; manageFavorites.textContent = manageMode ? t('search', 'done') : t('search', 'manage'); renderFavorites(); });
  clearRecentsBtn?.addEventListener('click', () => { clearRecents(); showToast(t('toasts', 'cleared')); });

  // ========== INIT ==========
  loadSettings(); applySettings(); renderRecents(); renderFavorites();
  homePlace = loadJSON(STORAGE.home, null);
  const savedLoc = loadJSON(STORAGE.location, null);
  if (homePlace) { showScreen(screenHome); loadAndRender(homePlace); }
  else if (savedLoc?.lat && savedLoc?.lon) {
    const sn = savedLoc.city && savedLoc.admin1 ? `${savedLoc.city}, ${savedLoc.admin1}` : (savedLoc.city || savedLoc.admin1 || 'South Africa');
    homePlace = { name: sn, lat: savedLoc.lat, lon: savedLoc.lon }; saveJSON(STORAGE.home, homePlace); showScreen(screenHome); loadAndRender(homePlace);
  }
  else { showScreen(screenHome); renderLoading("Locating...");
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = Math.round(pos.coords.latitude * 10) / 10, lon = Math.round(pos.coords.longitude * 10) / 10;
        try {
          const rev = await fetch(`/api/weather?reverse=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`); const data = await rev.json();
          const displayName = buildLocationName(data, lat, lon);
          saveJSON(STORAGE.location, { city: data?.city, admin1: data?.admin1, countryCode: data?.countryCode, lat, lon });
          homePlace = { name: displayName, lat, lon }; saveJSON(STORAGE.home, homePlace); loadAndRender(homePlace);
        } catch {
          const fn = await reverseGeocode(lat, lon);
          homePlace = { name: fn || 'South Africa', lat, lon }; saveJSON(STORAGE.home, homePlace); loadAndRender(homePlace);
        }
      }, () => {
        // GPS blocked on first visit - use IP geolocation instead of hardcoded city
        getIPLocation().then(place => {
          homePlace = place;
          saveJSON(STORAGE.home, homePlace);
          loadAndRender(homePlace);
        });
      }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
    } else {
      // No geolocation support - use IP geolocation
      getIPLocation().then(place => {
        homePlace = place;
        saveJSON(STORAGE.home, homePlace);
        loadAndRender(place);
      });
    }
  }

  // ========== AUTO-REFRESH ==========
  // Refresh weather data every 30 minutes to keep conditions current
  const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
  let lastFetchTime = Date.now();
  setInterval(() => {
    if (activePlace && document.visibilityState === 'visible') {
      loadAndRender(activePlace);
      lastFetchTime = Date.now();
    }
  }, REFRESH_INTERVAL);

  // Also refresh when user returns to the app after being away
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && activePlace) {
      const elapsed = Date.now() - lastFetchTime;
      // Only refresh if more than 15 minutes since last fetch
      if (elapsed > 15 * 60 * 1000) {
        loadAndRender(activePlace);
        lastFetchTime = Date.now();
      }
    }
  });
});

