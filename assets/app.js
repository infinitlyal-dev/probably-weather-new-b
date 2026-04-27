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
  const screenDayDetail = $('#day-detail-screen');
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
  const SCREENS = [screenHome, screenHourly, screenWeek, screenDayDetail, screenSearch, screenSettings];
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
      day: { en: "Day", af: "Dag", zu: "Usuku", xh: "Usuku", st: "Letsatsi" },
      sunrise: { en: "Sunrise", af: "Sonop", zu: "Ukuphuma kwelanga", xh: "Ukuphuma kwelanga", st: "Mafube" },
      sunset:  { en: "Sunset",  af: "Sononder", zu: "Ukushona kwelanga", xh: "Ukutshona kwelanga", st: "Letsatsi le likela" },
      hourlySoon: {
        en: "Hourly forecast appears 48 hours before this day.",
        af: "Uurlikse voorspelling verskyn 48 uur voor hierdie dag.",
        zu: "Isibikezelo samahora siphuma amahora angu-48 ngaphambi kwalolu suku.",
        xh: "Isibikezelo seeyure sivela kwiiyure ezingama-48 phambi kwalo mhla.",
        st: "Ponelopele ea hora e hlahella lihora tse 48 pele ho letsatsi lena."
      }
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
        en: ["Jislaaik, stay inside!", "Thunder's grumbling, hey.", "The dog's under the bed. Smart move, honestly.", "Even the hadedas are quiet.", "The sky's having a full-on tantrum.", "Nature's doing its own load shedding.", "Cancel everything. Even your excuses.", "Weather so dramatic it needs a Carte Blanche segment.", "This is why Noah built a boat.", "The braai is cancelled. Yes, really.", "Somewhere a roof is someone's new kite.", "Even the bakkies on the N2 pulled over.", "Eskom wishes it had this power.", "Lightning's putting Eskom's grid to shame.", "The sky just went full Carte Blanche.", "Respect the thunder. It's earned it.", "The lightning is putting on a proper show.", "Windows closed, kettle on, and wait.", "Not the time for hero moves, hey.", "The sky's reminding us who's boss.", "Nature just reminded us of the pecking order.", "The sky's CV just got updated.", "Somewhere a weather reporter is living their best life.", "This is the sky's performance review. It passed.", "Don't even think about driving somewhere.", "Thunder so close the walls shook. Respect.", "Stay safe. The sky is making a point.", "Nature's having a word. Best to listen.", "Big sky energy. Small human response.", "Unplug the things. The sky has plans.", "Wait it out indoors. The mountains aren't going anywhere.", "Beautiful and terrifying in equal measure."],
        af: ["Jinne, bly binne!", "Die donder dreun.", "Die hond is onder die bed. Slim skuif, eerlikwaar.", "Selfs die hadedas is stil.", "Die lug het 'n volle woedebuie.", "Natuur doen sy eie beurtkrag.", "Kanselleer alles. Selfs jou verskonings.", "Weer so dramaties dit het 'n Carte Blanche insetsel nodig.", "Dis hoekom Noag 'n ark gebou het.", "Die braai is gekanselleer. Ja, regtig.", "Iewers is 'n dak iemand se nuwe vlieër.", "Selfs die bakkies op die N2 het stilgehou.", "Eskom wens hy het hierdie krag.", "Weerlig sit Eskom se kragnet in die skadu.", "Die lug het voluit Carte Blanche gegaan.", "Respekteer die donder. Hy het dit verdien.", "Die weerlig sit 'n ordentlike show op.", "Vensters toe, ketel aan, en wag.", "Nie die tyd vir heldedade nie, hey.", "Die lug herinner ons wie die baas is.", "Natuur het ons net herinner wie eerste is.", "Die lug se CV is pas opgedateer.", "Iewers leef 'n weerverslaggewer sy beste lewe.", "Dit is die lug se prestasie-oorsig. Hy het geslaag.", "Moenie eers dink om iewers heen te ry nie.", "Donder so naby die mure het geskud. Respek.", "Bly veilig. Die lug maak 'n punt.", "Natuur wil 'n woordjie sê. Beste om te luister.", "Groot lug-energie. Klein menslike reaksie.", "Trek die goed uit. Die lug het planne.", "Wag dit binne uit. Die berge gaan nêrens nie.", "Pragtig en skrikwekkend in gelyke mate."],
        zu: ["Yoh, hlala ngaphakathi!", "Izulu liyaduma.", "Inja ingaphansi kombhede. Isu elihle, eqinisweni.", "Ngisho ama-hadeda athule.", "Isibhakabhaka sithukuthele ngempela.", "Imvelo yenza ukucisha kwayo.", "Khansela konke. Ngisho nezaba zakho.", "Isimo sezulu esinomdlalo esidinga i-Carte Blanche.", "Yingakho uNowa wakha umkhumbi.", "Ukosa kukhanselelwe. Yebo, ngempela.", "Endaweni ethile uphahla lungumkhumbi omusha.", "Ngisho namabakkie ku-N2 amile eceleni.", "U-Eskom ufisa ukuba namandla anje.", "Umbani ubeka i-Eskom ehlazweni.", "Isibhakabhaka sivele saba i-Carte Blanche ngokuphelele.", "Hlonipha ukuduma. Kukufanele.", "Umbani ubeka umbukiso omuhle.", "Amafasitela avalwe, iketile ivuliwe, ulinde.", "Akusona isikhathi sokuqhawe, hey.", "Isibhakabhaka sisikhumbuza ukuthi ubani ongumphathi.", "Imvelo isanda kusikhumbuza ukuthi ubani ophambili.", "I-CV yesibhakabhaka isanda kubuyekezwa.", "Endaweni ethile umethuli wezindaba zesimo sezulu uphila kahle.", "Lokhu ukuhlolwa kwesibhakabhaka. Siphasile.", "Ungacabangi ngisho ngokushayela ndawo.", "Ukuduma okusondele izindonga zanyakaza. Inhlonipho.", "Hlala uphephile. Isibhakabhaka senza iphuzu.", "Imvelo ifuna ukukhuluma. Kungcono ulalele.", "Amandla amakhulu esibhakabhaka. Impendulo encane yomuntu.", "Susa izinto eziphakwe ku-elektriki. Isibhakabhaka sinezinhlelo.", "Lindela phakathi. Izintaba aziyi ndawo.", "Kuhle futhi kwesabisa ngokulinganayo."],
        xh: ["Yhuu, hlala ngaphakathi!", "Iindudumo ziyagquma.", "Inja ingaphantsi kombhede. Icebo elihle, ngenene.", "Iintaka zithe cwaka.", "Isibhakabhaka siqumba ngokupheleleyo.", "Indalo yenza ukucima kwayo.", "Rhoxisa yonke into. Nezizathu zakho.", "Imozulu edramatiki kakhulu ifuna i-Carte Blanche.", "Yiyo le nto uNowa wakha umkhombe.", "Ukugrila kurhoxisiwe. Ewe, nyhani.", "Kwezinye iindawo uphahla lungumntla omtsha.", "Neebakkie kwi-N2 zime ecaleni.", "U-Eskom unqwenela la mandla.", "Umbane ubeka i-Eskom ehlazweni.", "Isibhakabhaka sivele saba yi-Carte Blanche ngokupheleleyo.", "Hlonela iindudumo. Zikufanele.", "Umbane ubeka umboniso omhle.", "Iifestile zivalwe, iketile ivulwe, ulinde.", "Asilo xesha lamagorha, hey.", "Isibhakabhaka sisikhumbuza ukuba ngubani inkosi.", "Indalo isanda kusikhumbuza ukuba ngubani ophambili.", "I-CV yesibhakabhaka isanda kuhlaziywa.", "Ndaweni ithile umxeli wemozulu uphila ubomi obuhle.", "Olu luhlolo lwesibhakabhaka. Luphumelele.", "Ungacinganga ngokuqhuba ndawo.", "Iindudumo ezikufutshane iindonga zachachamba. Intlonipho.", "Hlala ukhuselekile. Isibhakabhaka senza inkcukacha.", "Indalo ifuna ukuthetha. Kulungile ukuphulaphula.", "Amandla amakhulu esibhakabhaka. Impendulo encinci yomntu.", "Khupha izinto kumbane. Isibhakabhaka sinezicwangciso.", "Yima phakathi. Iintaba aziyi ndawo.", "Kuhle kwaye koyikisa ngokulinganayo."],
        st: ["Eish, dula ka hare!", "Ledimo le a duma.", "Ntja e ka tlas'a bethe. Mohato o bohlale, ka nnete.", "Esita le dinonyana di kgutsitse.", "Lehodimo le halefile ka botlalo.", "Tlhaho e etsa load shedding ea eona.", "Hlakola tsohle. Esita le mabaka a hao.", "Leholimo le dramatic le hloka Carte Blanche.", "Ke kahoo Noa a ileng a haha sekepe.", "Braai e hlakotsoe. E, ka nnete.", "Mohlomong sebakeng se seng marulelo ke khaete e ncha.", "Esita le li-bakkie tsa N2 li emile ka thoko.", "Eskom e ka rata matla ana.", "Lehadima le hlabisa Eskom dihlong.", "Lehodimo le fetohile Carte Blanche ka botlalo.", "Hlonepha modumo. O e tšoanetse.", "Lehadima le beha pontšo e ntle.", "Lifensetere li koetsoe, ketlele e butsoe, ema.", "Ha se nako ea bosenatla, hey.", "Lehodimo le re hopotsa hore ke mang monga'a.", "Tlhaho e sa tsoa re hopotsa hore na ke mang ea pele.", "CV ea lehodimo e sa tsoa ntlafatsoa.", "Kae-kae moromuoa oa leholimo o phela bophelo bo botle.", "Sena ke tlhahlobo ea lehodimo. Le pasitse.", "Se ke oa nahana ho otlela kae kapa kae.", "Modumo o haufi mabota a thothomela. Hlompho.", "Lula u bolokehile. Lehodimo le etsa ntlha.", "Tlhaho e batla ho bua. Ho molemo ho mametsa.", "Matla a maholo a lehodimo. Karabo e nyenyane ea motho.", "Tlosa lintho ho motlakase. Lehodimo le na le merero.", "Ema ka hare. Lithaba ha li ee kae.", "Bo botle le bo tšosa ka tekanyo e lekanang."]
      },
      rain: {
        en: ["The clouds are having a moment.", "Grab your brolly, boet.", "The garden's saying dankie at last.", "The potholes are becoming swimming pools.", "Your car wash was a waste of money.", "Joburg drivers are panicking already.", "Perfect excuse to cancel plans.", "The dams are doing a happy dance.", "The N1 is now a waterpark.", "Good soup weather, not gonna lie.", "Someone's braai just got ruined.", "Rain so heavy it should pay rent.", "Your shoes are about to have a bad day.", "The commute just became a team sport.", "Everyone's forgotten how to drive. Again.", "The umbrella broke on the first gust. Classic.", "Wet socks. The ultimate betrayal.", "You'll dry. Eventually. Probably.", "At least the garden's happy. Someone has to be.", "The wipers are on max and it's still not enough.", "Your suede shoes chose today? Bold.", "The queue at the petrol station just tripled.", "Somewhere an umbrella just turned inside out. Moment of silence.", "The puddle was deeper than it looked. It's always deeper.", "Hair plans: cancelled.", "The traffic is emotional.", "Nobody told the forecast. It just arrived.", "Every taxi on the road has decided to freestyle.", "Yes, it's raining sideways. South Africa speciality.", "The umbrella tax is now in effect.", "Wet jeans for the rest of the day. The classic punishment.", "Solidarity to everyone with one wet shoe right now.", "The pavement is a river and the river has plans.", "Forgot your jacket? The universe noticed.", "The dog is staring at the rain like it's a personal insult.", "The traffic just remembered rain exists. Again."],
        af: ["Die wolke het 'n oomblik.", "Vat jou sambreel, boet.", "Die tuin sê uiteindelik dankie.", "Die slaggate word swembaddens.", "Jou karwas was geldmors.", "Joburg-bestuurders paniek al klaar.", "Perfekte verskoning om planne te kanselleer.", "Die damme doen 'n bly dansie.", "Die N1 is nou 'n waterpark.", "Goeie sopweer, eerlikwaar.", "Iemand se braai is sopnat.", "Reën so swaar dit moet huur betaal.", "Jou skoene gaan 'n slegte dag hê.", "Die rit het 'n spansport geword.", "Almal het vergeet hoe om te bestuur. Weer.", "Die sambreel het gebreek met die eerste wind. Klassiek.", "Nat sokkies. Die finale verraad.", "Jy sal droog word. Uiteindelik. Waarskynlik.", "Ten minste die tuin is bly. Iemand moet wees.", "Die veërs is op max en dit is steeds nie genoeg nie.", "Jou suede skoene het vandag gekies? Dapper.", "Die ry by die petrolstasie het net verdriedubbel.", "Iewers het 'n sambreel net binnestebuie gedraai. Oomblik van stilte.", "Die poel was dieper as wat dit gelyk het. Dis altyd dieper.", "Haarplanne: gekanselleer.", "Die verkeer is emosioneel.", "Niemand het die voorspelling gesê nie. Dit het net opgedaag.", "Elke taxi op die pad het besluit om te vrystyl.", "Ja, dit reën sywaarts. Suid-Afrikaanse spesialiteit.", "Die sambreelbelasting is nou van krag.", "Nat jeans vir die res van die dag. Die klassieke straf.", "Solidariteit aan almal met een nat skoen nou.", "Die sypaadjie is 'n rivier en die rivier het planne.", "Jou baadjie vergeet? Die heelal het opgemerk.", "Die hond staar na die reën soos dit 'n persoonlike belediging is.", "Die verkeer het pas onthou reën bestaan. Weer."],
        zu: ["Amafu anesikhathi sawo.", "Thatha isambulela sakho, boet.", "Ingadi ithi ekugcineni ngiyabonga.", "Imigodi iba amapulazi okubhukuda.", "Ukuwasha imoto kwakho bekuyize yemali.", "Abashayeli baseJoburg sebeyesaba.", "Isizathu esihle sokukhansela izinhlelo.", "Amadamu enza umdanso ojabulayo.", "I-N1 manje yi-waterpark.", "Isimo sezulu esihle sesobho.", "Ukosa komuntu kusanda konakala.", "Imvula enzima kakhulu kufanele ikhokhe irenti.", "Izicathulo zakho zizoba nosuku olubi.", "Uhambo seluphenduke umdlalo weqembu.", "Bonke sebakhohlwe ukushayela. Futhi.", "Isambulela sephuke ngomoya wokuqala. Okujwayelekile.", "Amasokisi amanzi. Ukukhaphela okukhulu.", "Uzokoma. Ekugcineni. Cishe.", "Okungenani ingadi iyajabula. Othile kumele ajabule.", "Ama-wipers aku-max kodwa akwanele.", "Izicathulo zakho zesuede zikhethe namuhla? Isibindi.", "Umugqa esiteshini sikaphethiloli usanda kuphindeka kathathu.", "Endaweni ethile isambulela sisanda kuphenduka ngaphakathi. Umzuzu wokuthula.", "Isiziba sasijule kunalokho ebesibukeka ngakho. Sihlala sijule.", "Izinhlelo zezinwele: zikhanselelwe.", "Ithrafikhi inomzwelo.", "Akekho otshele isibikezelo. Sivele safika.", "Yonke itekisi emgwaqweni ikhethe ukudlala ngokukhululeka.", "Yebo, kuyana ngenhlangothi. Okukhethekile kweNingizimu Afrika.", "Intela yesambulela isiyasebenza.", "Ijiyini emanzi kuyo yonke insuku. Isijeziso esijwayelekile.", "Ukuhlangana nabo bonke abanesicathulo esisodwa esimanzi manje.", "Ipavimende ingumfula futhi umfula uneziluleko.", "Ukhohlwe ijazi lakho? Indawo yonke iqaphele.", "Inja ibheka imvula sengathi inhlamba yomuntu siqu.", "Ithrafikhi isanda kukhumbula ukuthi imvula ikhona. Futhi."],
        xh: ["Amafu anethuba lawo.", "Thatha isambreli sakho, boet.", "Igadi ithi ekugqibeleni enkosi.", "Imingxunya iba ziipuli zokuqubha.", "Ukuhlamba imoto kwakho bekuyimali elahlekileyo.", "Abaqhubi baseJohanesburg sele beyoyika.", "Isizathu esihle sokurhoxisa izicwangciso.", "Amadama enza umdaniso ovuyayo.", "I-N1 ngoku yi-waterpark.", "Imozulu elungele isuphu.", "Ukugrila komntu kusanda konakala.", "Imvula enzima kufanele ihlawule irenti.", "Izihlangu zakho ziza kuba nosuku olubi.", "Uhambo lusanda kuba ngumdlalo weqela.", "Bonke balibele ukuqhuba. Kwakhona.", "Isambreli saphuke ngomoya wokuqala. Okwesiqhelo.", "Iikawusi ezimanzi. Ukukreqwa okukhulu.", "Uya koma. Ekugqibeleni. Mhlawumbi.", "Ubuncinane igadi iyavuya. Umntu kufuneka avuye.", "Ii-wipers ziku-max kodwa azanelanga.", "Izihlangu zakho zesuede zikhethe namhlanje? Isibindi.", "Umgca kwisikhululo sepethroli usanda kuphindeka kathathu.", "Ndaweni ithile isambreli sisanda kuguquka ngaphakathi. Umzuzu wokuthi cwaka.", "Isisele sasinzulu kunalento esasibonakala ngayo. Sisoloko sinzulu.", "Izicwangciso zeenwele: zirhoxisiwe.", "Ithrafiki inomvakalelo.", "Akukho mntu uxelele isibikezelo. Sivele safika.", "Yonke itekisi endleleni ikhethe ukudlala ngokukhululekileyo.", "Ewe, imvula iyana ngecala. Eyodwa yaseMzantsi Afrika.", "Irhafu yesambreli isebenzayo ngoku.", "Ijinsi emanzi yonke imini. Isohlwayo esiqhelekileyo.", "Imanyano kubo bonke abanesihlangu esinye esimanzi ngoku.", "Ipavimente ngumlambo kwaye umlambo unezicwangciso.", "Ulibele ibhatyi yakho? Indalo iqaphele.", "Inja ijonge imvula ngathi yinto yobuqu.", "Itrafikhi isanda kukhumbula ukuba imvula ikhona. Kwakhona."],
        st: ["Maru a na le nako ea 'ona.", "Nka sekhele sa hao, boet.", "Jarata e re kea leboha qetellong.", "Mesima e fetoha matamo a ho sesa.", "Ho hlatsoa koloi ea hao e ne e le chelete e lahliloeng.", "Baotleli ba Joburg ba se ba tšohile.", "Lebaka le letle la ho hlakola merero.", "Matamo a etsa motjeko o thabileng.", "N1 joale ke waterpark.", "Leholimo le letle la soupa.", "Braai ea motho e senyehile.", "Pula e boima haholo e lokela ho lefa rente.", "Lieta tsa hao li tla ba le letsatsi le lebe.", "Leeto le fetohile papali ea sehlopha.", "Bohle ba lebetse ho otlela. Hape.", "Sekhele se robehile ka moea oa pele. Setso.", "Dikausu tse metsi. Boko bo boholo.", "O tla oma. Qetellong. Mohlomong.", "Bonyane jarata e thabile. Motho e mong o tlameha ho thaba.", "Di-wiper di ho max empa ha di ea lekana.", "Lieta tsa hao tsa suede li khethile kajeno? Sebete.", "Mola seteisheneng sa petlolo o sa tsoa phethahala hararo.", "Kae-kae sekhele se sa tsoa reteleha ka hare. Motsotso oa kgutso.", "Letamo le ne le tebile ho feta kamoo le neng le shebahala kateng. Le lula le tebile.", "Merero ea moriri: e hlakotsoe.", "Sephethephethe se na le maikutlo.", "Ha ho motho ea bolelletseng ponelopele. E fihletse feela.", "Tekisi e 'ngoe le e 'ngoe tseleng e khethile ho bapala ka bo eona.", "E, pula e na ka mahlakoreng. Phaello ea Afrika Boroa.", "Lekhetho la sekhele le se le sebetsa.", "Lijinse tse metsi letsatsi lohle. Kotlo ea setso.", "Kopano le bohle ba nang le seeta se le seng se metsi joale.", "Pavimente ke noka mme noka e na le merero.", "U lebetse jase ea hao? Bokahohle bo bone.", "Ntja e shebile pula joalo ka thohako ea botho.", "Sephethephethe se sa tsoa hopola hore pula e teng. Hape."]
      },
      'rain-possible': {
        en: ["Maybe rain, maybe not. Classic.", "Clouds looking proper suspicious.", "Take a brolly just in case, hey.", "50/50 on getting wet. Like a coin toss.", "Don't trust those clouds. They're plotting.", "Weather's being more indecisive than you at Spur.", "Pack an umbrella. Or don't. We don't know either.", "The sky can't make up its mind. Join the club.", "The clouds are threatening but probably bluffing.", "Forecast says maybe. We say probably.", "Bring a jacket. Or sunscreen. Or both.", "The sky's giving mixed signals again.", "Rain? Possibly. Commitment? Never.", "This weather needs a life coach.", "Schrodinger's rain. It both is and isn't.", "The washing's on the line and you're feeling brave.", "Even the weather apps are arguing about this one.", "Somewhere between fine and soaked. Good luck.", "The clouds are just vibing. No promises.", "Trust issues with the sky today."],
        af: ["Miskien reën, miskien nie. Klassiek.", "Wolke lyk behoorlik verdag.", "Vat 'n sambreel net vir ingeval, hey.", "50/50 kans om nat te word. Soos 'n muntstuk.", "Moenie daai wolke vertrou nie. Hulle beplan.", "Die weer is meer besluiteloos as jy by Spur.", "Pak 'n sambreel. Of moenie. Ons weet ook nie.", "Die lug kan nie besluit nie. Sluit by die klub aan.", "Die wolke dreig maar bluf waarskynlik.", "Voorspelling sê miskien. Ons sê waarskynlik.", "Bring 'n baadjie. Of sonbrandroom. Of albei.", "Die lug gee weer gemengde seine.", "Reën? Moontlik. Verbintenis? Nooit.", "Hierdie weer het 'n lewensafrigter nodig.", "Schrödinger se reën. Dit is én is nie.", "Die wasgoed hang buite en jy voel dapper.", "Selfs die weer-apps baklei oor hierdie een.", "Iewers tussen fine en pap nat. Sterkte.", "Die wolke vibe net. Geen beloftes nie.", "Vertroueprobleme met die lug vandag."],
        zu: ["Mhlawumbe imvula, mhlawumbe cha. Okujwayelekile.", "Amafu abukeka esolisa ngempela.", "Thatha isambulela uma kungenzeka, hey.", "50/50 ukuba manzi. Njengenhlahla.", "Ungawathembi lawo mafu. Ayaceba.", "Isimo sezulu asikwazi ukuzinquma njengawe eSpur.", "Phaka isambulela. Noma ungaphaki. Asazi nathi.", "Isibhakabhaka asikwazi ukuzinquma. Joyina iklabhu.", "Amafu ayesabisa kodwa cishe ayakhohlisa.", "Isibikezelo sithi mhlawumbe. Sithi cishe.", "Letha ijazi. Noma isivikelo selanga. Noma kokubili.", "Isibhakabhaka siphinda sinikeze izimpawu ezixubile.", "Imvula? Kungenzeka. Ukuzibophezela? Soze.", "Lesi simo sezulu sidinga umqeqeshi wempilo.", "Imvula ka-Schrödinger. Iyakhona futhi ayikho.", "Izingubo zisemsebenzini futhi uzizwa unesibindi.", "Ngisho nama-app ezulu ayaphikisana ngalokhu.", "Phakathi kokuhle nokumanzi. Inhlanhla enhle.", "Amafu akhona nje. Akukho izithembiso.", "Inkinga yokuthemba isibhakabhaka namuhla."],
        xh: ["Mhlawumbi imvula, mhlawumbi hayi. Okwesiqhelo.", "Amafu abonakala erhanela ngokwenene.", "Thatha isambreli ukuba kunokwenzeka, hey.", "50/50 ukufumana amanzi. Njengomdlalo.", "Musa ukuwathemba lawo mafu. Ayaceba.", "Imozulu ayikwazi ukuzigqiba njengawe eSpur.", "Phakisha isambreli. Okanye ungaphakishi. Asazi nathi.", "Isibhakabhaka asikwazi ukuzigqiba. Joyina iklabhu.", "Amafu ayoyikisa kodwa mhlawumbi ayakhohlisa.", "Isibikezelo sithi mhlawumbi. Sithi mhlawumbi.", "Zisa ijekithi. Okanye isithinteli selanga. Okanye zombini.", "Isibhakabhaka siphinda sinika imiqondiso exubileyo.", "Imvula? Kunokwenzeka. Ukuzibophelela? Soze.", "Le mozulu ifuna umqeqeshi wobomi.", "Imvula kaSchrödinger. Iyakho futhi ayikho.", "Impahla yokuhlamba isemthayeni kwaye uziva unesibindi.", "Kwanee-app zemozulu ziyaxabana ngale nto.", "Phakathi kokuhle nokuba manzi. Inyhani enhle.", "Amafu akhona nje. Akukho zithembiso.", "Iingxaki zokuthemba isibhakabhaka namhlanje."],
        st: ["Mohlomong pula, mohlomong che. Setso.", "Maru a shebahala a belaela ka nnete.", "Nka sekhele ho ba sireletsehile, hey.", "50/50 ho ba metsi. Joalo ka papadi.", "Se ke oa tšepa maru ao. A rera.", "Leholimo ha le tsebe ho iketsa joalo ka uena Spur.", "Paka sekhele. Kapa o se ke oa paka. Ha re tsebe le rona.", "Lehodimo ha le tsebe. Kena klubeng.", "Maru a tšosa empa mohlomong a a qhella.", "Ponelopele e re mohlomong. Re re mohlomong.", "Tlisa jase. Kapa sethibelo sa letsatsi. Kapa ka bobeli.", "Lehodimo le fana le matšoao a tsoakaneng hape.", "Pula? Mohlomong. Boitlamo? Le kgale.", "Leholimo lena le hloka mokoetlisi oa bophelo.", "Pula ea Schrödinger. E teng le ha e eo.", "Liaparo li ntse li omisitsoe mme o ikutloa o le sebete.", "Esita le di-app tsa leholimo li phehisana ka sena.", "Pakeng tsa ho loka le ho ba metsi. Katleho.", "Maru a teng feela. Ha ho litšepiso.", "Mathata a tšepo le lehodimo kajeno."]
      },
      cloudy: {
        en: ["The sky's giving absolutely nothing.", "Overcast but we'll survive.", "Good day for a walk, bad day for a tan.", "The sun's bunking today.", "Moody weather. Same, honestly.", "Not bad, not great. Like a 6/10 date.", "Perfect weather for a Woolies run and Netflix.", "The sky is buffering.", "Even the weather can't be bothered today.", "Grey vibes. The sky matched my Monday.", "Eskom-friendly weather. No solar today.", "It is what it is.", "The sun's on a tea break. No ETA.", "Not depressing. Just... underwhelming.", "A hoodie and an attitude. That's today.", "Could be worse. Could also be better.", "The sky's giving 'I'll try again tomorrow' energy.", "Good enough weather. Not great, not terrible.", "Nobody's posting this sunset on Instagram.", "The clouds are here but they're not doing anything.", "The sky's on mute. Nobody's complaining.", "Not Instagram weather. Not the end of the world.", "The sun sent an out-of-office reply.", "This weather has 'meh' written all over it.", "At least it's not raining. That's the bar.", "The vibe is beige. Accept it.", "Perfect weather for existing without enthusiasm.", "The clouds are committed to being average.", "Nothing to see here. Literally.", "The sky picked a vibe and the vibe is shrug.", "Cloud cover with a side of who-cares.", "The sun's on airplane mode.", "A perfectly average sky doing perfectly average things.", "The clouds RSVP'd 'maybe' and showed up anyway.", "Today's weather: still loading.", "The sky is the colour of an old Tupperware lid.", "Forecast: vibes neutral, expectations lower.", "The sun is technically present. Spiritually elsewhere."],
        af: ["Die lug gee absoluut niks.", "Bewolk maar ons sal oorleef.", "Goeie dag vir 'n stap, slegte dag vir 'n bruining.", "Die son bunk vandag.", "Humeurige weer. Ek ook, eerlikwaar.", "Nie sleg nie, nie great nie. Soos 'n 6/10 date.", "Perfekte weer vir 'n Woolies-draai en Netflix.", "Die lug buffer.", "Selfs die weer kan nie gepla word vandag nie.", "Grys vibes. Die lug pas by my Maandag.", "Eskom-vriendelike weer. Geen solar vandag nie.", "Dit is wat dit is.", "Die son is op teebreek. Geen ETA nie.", "Nie depressief nie. Net... ondermaats.", "'n Hoodie en 'n houding. Dis vandag.", "Kon erger gewees het. Kon ook beter gewees het.", "Die lug gee 'ek probeer weer môre' energie.", "Goeie genoeg weer. Nie great nie, nie verskriklik nie.", "Niemand gaan hierdie sononder op Instagram sit nie.", "Die wolke is hier maar hulle doen niks.", "Die lug is op stil. Niemand kla nie.", "Nie Instagram-weer nie. Nie die einde van die wêreld nie.", "Die son het 'n out-of-office gestuur.", "Hierdie weer het 'meh' oor alles geskryf.", "Ten minste dit reën nie. Dis die standaard.", "Die vibe is beige. Aanvaar dit.", "Perfekte weer vir bestaan sonder entoesiasme.", "Die wolke is toegewy aan gemiddeld wees.", "Niks om te sien hier nie. Letterlik.", "Die lug het 'n vibe gekies en die vibe is skouerophaal.", "Bewolk met 'n sytjie van wie-gee-om.", "Die son is op vliegtuigmodus.", "'n Perfek gemiddelde lug wat perfek gemiddelde goed doen.", "Die wolke het 'miskien' geRSVP en in elk geval opgedaag.", "Vandag se weer: laai nog.", "Die lug is die kleur van 'n ou Tupperware-deksel.", "Voorspelling: vibes neutraal, verwagtinge laer.", "Die son is tegnies hier. Geestelik elders."],
        zu: ["Isibhakabhaka asiniki lutho.", "Kunamafu kodwa sizosinda.", "Usuku oluhle lokuhamba, olubi lokushisa.", "Ilanga liyabaleka namuhla.", "Isimo sezulu esingezinhle. Njengami.", "Akubi kubi, akubi kuhle. Njengedethi ye-6/10.", "Isimo sezulu esihle se-Woolies ne-Netflix.", "Isibhakabhaka siyabafura.", "Ngisho nesimo sezulu asikwazi ukuziphatha namuhla.", "I-grey vibes. Isibhakabhaka sifana noMsombuluko wami.", "Isimo sezulu esilungele i-Eskom. Akukho solar.", "Kuyilokho okuyikho.", "Ilanga lisekhefu letiye. Akukho ETA.", "Akudabukisi. Nje... akuhlabi umxhwele.", "I-hoodie nesimo sengqondo. Namuhla kunje.", "Kungaba kubi kakhulu. Kungaba ngcono futhi.", "Isibhakabhaka sinikeza 'ngizozama kusasa' amandla.", "Isimo sezulu esinele. Asikuhle, asikubi.", "Akekho ozoposta lokhu ku-Instagram.", "Amafu akhona kodwa awenzi lutho.", "Isibhakabhaka sithulile. Akekho okhonondayo.", "Akusona isimo sezulu se-Instagram. Akusikho ukuphela komhlaba.", "Ilanga lithumele i-out-of-office.", "Lesi simo sezulu sinokuthi 'meh' kuyo yonke indawo.", "Okungenani akulini. Yilokho okukhona.", "I-vibe yi-beige. Yamukela.", "Isimo sezulu esihle sokuphila ngaphandle kwentshisekelo.", "Amafu azibophezele ekubeni phakathi naphakathi.", "Akukho okubonwayo lapha. Ngempela.", "Isibhakabhaka sikhethe i-vibe futhi i-vibe iwukunyusa amahlombe.", "Amafu nohlangothi lokuthi ubani onendaba.", "Ilanga liku-airplane mode.", "Isibhakabhaka esiphakathi nendawo esenza izinto eziphakathi nendawo.", "Amafu aphendule athi 'mhlawumbi' avele eza nje.", "Isimo sezulu sanamuhla: sisalayisha.", "Isibhakabhaka sinombala wesivalo seTupperware esidala.", "Isibikezelo: i-vibes ingenamthelela, izindlela ziphansi.", "Ilanga ngokwesibalo likhona. Ngokomoya likwenye indawo."],
        xh: ["Isibhakabhaka asiniki nto.", "Linamafu kodwa siya kuphila.", "Imini entle yokuhamba, embi yokutshisa.", "Ilanga liyabaleka namhlanje.", "Imozulu ezithwele. Njengam.", "Ayimbi, ayintle. Njengedethi ye-6/10.", "Imozulu elungele uWoolies neNetflix.", "Isibhakabhaka siyabafura.", "Imozulu ayonqena namhlanje.", "I-grey vibes. Isibhakabhaka sifana noMvulo wam.", "Imozulu elungele i-Eskom. Akukho solar.", "Kuyiloo nto iyiyo.", "Ilanga lisekhefu letiye. Akukho ETA.", "Ayidakumbi. Nje... ayihlabi umxhwele.", "I-hoodie nesimilo. Namhlanje kunje.", "Kunokuba kubi kakhulu. Kunokuba bhetele futhi.", "Isibhakabhaka sinika 'ndiya kuzama ngomso' amandla.", "Imozulu eyaneleyo. Ayinkulu, ayimbi.", "Akukho mntu uza kuposta oku kwi-Instagram.", "Amafu akho kodwa awenzi nto.", "Isibhakabhaka sithule. Akukho mntu ukhalazayo.", "Ayiyomozulu ye-Instagram. Ayikokuphela kwehlabathi.", "Ilanga lithumele i-out-of-office.", "Le mozulu ibhalwe 'meh' kuyo yonke indawo.", "Ubuncinane ayimvula. Yilonto kuphela.", "I-vibe yi-beige. Yamkela.", "Imozulu elungele ukuphila ngaphandle kwentshisekelo.", "Amafu azibophelele ekubeni phakathi naphakathi.", "Akukho nto ibonwayo apha. Ngenene.", "Isibhakabhaka sikhethe i-vibe kwaye i-vibe kukunyusa amagxa.", "Amafu nelinye icala lokuba ngubani onomdla.", "Ilanga liku-airplane mode.", "Isibhakabhaka esiphakathi esenza izinto eziphakathi.", "Amafu aphendule athi 'mhlawumbi' aze nje.", "Imozulu yanamhlanje: isalayisha.", "Isibhakabhaka sinombala wesiciko seTupperware esidala.", "Isibikezelo: ii-vibes ezingenamfuneko, indlela eziphantsi.", "Ilanga ngokwasemthethweni likho. Ngokomoya likwenye indawo."],
        st: ["Lehodimo ha le fane letho.", "Ho na le maru empa re tla phela.", "Letsatsi le letle la ho tsamaea, le lebe la ho tjhesa.", "Letsatsi le balehile kajeno.", "Leholimo le matšoenyehong. Le nna, ka nnete.", "Ha ho mpe, ha ho motle. Joalo ka dethi ea 6/10.", "Leholimo le lokileng la Woolies le Netflix.", "Lehodimo le a buffera.", "Esita le leholimo ha le khathalehe kajeno.", "Grey vibes. Lehodimo le tšoana le Mantaha oa ka.", "Leholimo le ratoang ke Eskom. Ha ho solar kajeno.", "Ke seo e leng sona.", "Letsatsi le phomoletseng ho noa tee. Ha ho ETA.", "Ha ho masoabi. Feela... ha ho khotsofatse.", "Hoodie le boitšoaro. Ke kajeno.", "E ka ba mpe le ho feta. E ka ba betere le ho feta.", "Lehodimo le fana le 'ke tla leka hosane' matla.", "Leholimo le lekaneng. Ha le leholo, ha le lebe.", "Ha ho motho ea tla posta sena ho Instagram.", "Maru a teng empa ha a etse letho.", "Lehodimo le kgutsitse. Ha ho motho ea llang.", "Ha se leholimo la Instagram. Ha se qetello ea lefatše.", "Letsatsi le romeletse out-of-office.", "Leholimo lena le na le 'meh' karolong e 'ngoe le e 'ngoe.", "Bonyane ha ho ne pula. Ke standaard.", "Vibe ke beige. Amohela.", "Leholimo le loketseng ho phela ntle le mafolofolo.", "Maru a itlamile ho ba karolelano.", "Ha ho letho leo ho le bonoang mona. Ka nnete.", "Lehodimo le khethile vibe mme vibe ke ho phahamisa mahetla.", "Maru le lehlakore la mang ea tsotellang.", "Letsatsi le ho airplane mode.", "Lehodimo le karolelano le etsang lintho tsa karolelano.", "Maru a arabile 'mohlomong' empa a fihlile.", "Leholimo la kajeno: le sa loadhella.", "Lehodimo le na le 'mala oa sekoahelo sa Tupperware sa khale.", "Ponelopele: vibes li bohareng, litebello li tlase.", "Letsatsi ka tsela ea ts'ebetso le teng. Ka moea le sebakeng se seng."]
      },
      uv: {
        en: ["Sunscreen is not optional, boet.", "SPF 50 or regret it by tonight.", "The sun's not playing games today.", "You will look like a lobster. You've been warned.", "Protect that face! It's the only one you've got.", "The ozone layer called. It's on leave.", "Reapply that sunscreen or suffer.", "The sun is personally attacking you.", "Hat, sunnies, sunscreen. Non-negotiable.", "You could braai a steak on the pavement right now.", "Your future self will thank you for that sunscreen.", "The UV index is higher than your expectations.", "Walking to the car counts as a sun hazard today.", "Your nose is going to betray you by 3pm.", "The sun doesn't care about your plans.", "Tan lines are not a personality trait.", "The back of your neck. You forgot that bit.", "Sunscreen budget: higher than your data bill.", "Today's forecast: medium rare.", "Even the shade is warm. Good luck out there."],
        af: ["Sonbrandroom is nie opsioneel nie, boet.", "SPF 50 of jy sal spyt wees teen vanaand.", "Die son speel nie vandag nie.", "Jy gaan soos 'n kreef lyk. Jy is gewaarsku.", "Beskerm daai gesig! Dis die enigste een wat jy het.", "Die osoonlaag het gebel. Hy's op verlof.", "Smeer weer aan of ly.", "Die son val jou persoonlik aan.", "Hoed, sonbrille, sonbrandroom. Nie onderhandelbaar nie.", "Jy kan 'n steak op die sypaadjie braai nou.", "Jou toekomstige self sal jou dankie sê vir daai sonbrandroom.", "Die UV-indeks is hoër as jou verwagtinge.", "Stap na die kar tel as 'n songevaar vandag.", "Jou neus gaan jou verraai teen 3nm.", "Die son gee nie om oor jou planne nie.", "Bruinmerkies is nie 'n persoonlikheidseienskap nie.", "Die agterkant van jou nek. Jy het dit vergeet.", "Sonbrandroom-begroting: hoër as jou data-rekening.", "Vandag se voorspelling: medium gaar.", "Selfs die skaduwee is warm. Sterkte."],
        zu: ["Ikhrimu yelanga ayikhona ukukhetha, boet.", "I-SPF 50 noma uzozisola ngokuhlwa.", "Ilanga alidlali namuhla.", "Uzobukeka njengelobster. Uxwayisiwe.", "Vikela ubuso bakho! Kunye kuphela onabu.", "I-ozone layer ishayile. Iku-leave.", "Sebenzisa futhi noma uhlupheke.", "Ilanga likuhlasela wena mathupha.", "Isigqoko, izibuko, isivikelo. Akudingidwa.", "Ungabhaka isteki epavimentini manje.", "Wena wakusasa uzokubonga ngesivikelo selanga.", "I-UV index iphezulu kunalokho okulindele.", "Ukuhamba uye emotweni kubhekwa njengengozi yelanga namuhla.", "Ikhala lakho lizokudayisa ngo-3pm.", "Ilanga alikhathali ngezinhlelo zakho.", "Imigqa yokushisa ayisiyona ubuntu.", "Ingemuva yentamo yakho. Ukhohlwe leyo ndawo.", "Isabiwezimali sesivikelo selanga: siphezulu kunebhili yakho yedatha.", "Isibikezelo sanamuhla: medium rare.", "Ngisho nomthunzi ufudumele. Inhlanhla enhle."],
        xh: ["Ikhrimu yelanga ayinakukhethwa, boet.", "I-SPF 50 okanye uya kuzisola ngokuhlwa.", "Ilanga alidlali namhlanje.", "Uya kubonakala njenge-lobster. Ulumkisiwe.", "Khusela elo buso! Lelinye kuphela onalo.", "I-ozone layer ifownile. Iku-leave.", "Sebenzisa kwakhona okanye ubandezeleke.", "Ilanga likuhlasela wena buqu.", "Umnqwazi, izipeki, ikhrimu. Akuxoxwa.", "Ungagrila isteki epavimentini ngoku.", "Wena wakusasa uya kukubulela ngekhrimu yelanga.", "I-UV index iphezulu kunalento uyilindeleyo.", "Ukuhamba uye emotweni kubhekwa njengengozi yelanga namhlanje.", "Impumlo yakho iya kukuthengisa ngo-3pm.", "Ilanga alikhathalelanga izicwangciso zakho.", "Imigca yokutshisa ayisiyonto yobuqu.", "Umva wentamo yakho. Ukulibele loo ndawo.", "Iibhajethi zekhrimu yelanga: ngaphezu kwebhili yakho yedatha.", "Isibikezelo sanamhlanje: medium rare.", "Kwanomthunzi ufudumele. Inyhani enhle."],
        st: ["Setofo sa letsatsi ha se kgetho, boet.", "SPF 50 kapa o tla itshola ka bosiu.", "Letsatsi ha le bapale kajeno.", "O tla shebahala joalo ka lobster. O lemoselitsoe.", "Sireletsa sefahleho seo! Ke se le seng feela o nang le sona.", "Ozone layer e llelitse. E leaveng.", "Tšoaea hape kapa o hloke.", "Letsatsi le o hlasela ka bo mong.", "Katiba, liborele, setofo. Ha ho buisanoe.", "O ka chesa steak ho pavement joale.", "Uena oa hosane o tla leboha ka setofo sa letsatsi.", "UV index e phahameng ho feta litšepo tsa hao.", "Ho tsamaea ho ea koloing ke kotsi ea letsatsi kajeno.", "Nko ea hao e tla o eka ka 3pm.", "Letsatsi ha le khathalele merero ea hao.", "Mela ea ho tjhesa ha se botho.", "Ka morao ha molala oa hao. O lebetse moo.", "Bajete ea setofo sa letsatsi: e phahameng ho feta akhaonto ea data.", "Ponelopele ea kajeno: medium rare.", "Esita le moriti o futhumetse. Katleho."]
      },
      wind: {
        en: ["Hold onto your hat! And your kids.", "The southeaster's arrived. Uninvited, as usual.", "Table Mountain's tablecloth is out.", "The Cape Doctor is making house calls.", "Your hairstyle? Gone. Accept it.", "Kite surfers are having the time of their lives.", "The trees are doing involuntary yoga.", "Someone's trampoline is now two streets away.", "Perfect conditions for losing your dignity.", "Even the seagulls are walking today.", "The bins are on an adventure again.", "Your washing just moved to the neighbour's yard.", "Sand in places sand should never be.", "Ponytail holders are doing overtime.", "The wind has a personal vendetta against umbrellas.", "Every loose object in the garden has chosen violence.", "Walking into it feels like a video game boss fight.", "Your car door just became a weapon.", "The braai cover is in the next suburb.", "Not a hairstyle in sight. Just survivors."],
        af: ["Hou jou hoed vas! En jou kinders.", "Die suidooster het aangekom. Ongenooid, soos altyd.", "Tafelberg se tafeldoek is uit.", "Die Kaapse Dokter maak huisbesoeke.", "Jou haarstyl? Weg. Aanvaar dit.", "Vlieërsurfers het die tyd van hul lewe.", "Die bome doen onvrywillige yoga.", "Iemand se trampoline is nou twee strate weg.", "Perfekte toestande om jou waardigheid te verloor.", "Selfs die meeuë loop vandag.", "Die asblikke is weer op 'n avontuur.", "Jou wasgoed het na die buurman se erf getrek.", "Sand in plekke waar sand nooit moet wees nie.", "Poniestert-houer doen oortyd.", "Die wind het 'n persoonlike vendetta teen sambrele.", "Elke los voorwerp in die tuin het geweld gekies.", "Om daarin te loop voel soos 'n video game boss fight.", "Jou kardeur het net 'n wapen geword.", "Die braai-deksel is in die volgende voorstad.", "Nie 'n haarstyl in sig nie. Net oorlewendes."],
        zu: ["Bamba isigqoko sakho! Nabantwana bakho.", "Umoya waseningizimu ufikile. Ungamenyiwe, njengenjwayelo.", "Indwangu yeTafel Mountain iphumile.", "UDokotela waseKapa ufikile ezovakasha.", "Isitayela sakho sezinwele? Sihambile. Yamukela.", "Abadlali be-kite bajabulile kakhulu.", "Izihlahla zenza i-yoga engafuneki.", "I-trampoline yomuntu manje imigwaqo emibili.", "Izimo eziphelele zokulahlekelwa isithunzi.", "Ngisho nezinkonjane ziyahamba namuhla.", "Amabhini asohambweni futhi.", "Izingubo zakho zisanda kuthuthela egcekeni likamakhelwane.", "Isihlabathi ezindaweni isihlabathi okungafanele sibe khona.", "Izibopho zezinwele zisebenza ngokweqile.", "Umoya unenzondo yomuntu siqu ngezambulela.", "Yonke into ekhululekile engadini ikhethe udlame.", "Ukuhamba kuwo kuzizwa njengokulwa ne-boss yomdlalo wevidiyo.", "Umnyango wemoto yakho usanda kuba yisikhali.", "Isembozo sebraai sisesifundeni esilandelayo.", "Akukho sitayela sezinwele esibonwayo. Abasindile kuphela."],
        xh: ["Bamba umnqwazi wakho! Nabantwana bakho.", "Umoya wasemzantsi ufikile. Ungamenyanga, njengoko eqhelile.", "Ilaphu leTable Mountain liphumile.", "UGqirha waseKapa wenza iindwendwe.", "Isimbo seenwele zakho? Simkile. Yamkela.", "Abadlali bekite bonwabile kakhulu.", "Imithi yenza i-yoga engafunekiyo.", "I-trampoline yomntu ngoku zizitalato ezimbini.", "Iimeko ezilungileyo zokulahlekelwa sisidima.", "Neenkonjane ziyahamba namhlanje.", "Iibhini zikwi-adventure kwakhona.", "Impahla yakho isanda kukhutshelwa kwiyadhi yommelwane.", "Intlabathi kwiindawo intlabathi engamele ibe kuzo.", "Izibopho zeenwele zisebenza ngokungaphezulu.", "Umoya unenzondo yobuqu ngesambreli.", "Yonke into ekhululekileyo egadini ikhethe ubundlobongela.", "Ukuhamba kuwo kuziva njengokulwa ne-boss yomdlalo wevidiyo.", "Ucango lwemoto yakho lusanda kuba sisixhobo.", "Isigqubuthelo sebraai sisekwisifunda esilandelayo.", "Akukho simbo seenwele esibonwayo. Abasindileyo kuphela."],
        st: ["Tšoara katiba ea hao! Le bana ba hao.", "Moea oa boroa o fihlile. O sa mengoa, joalo ka kamehla.", "Lesela la Table Mountain le tšoeu.", "Ngaka ea Cape e etsa litšeliso.", "Moriri oa hao? O ile. Amohela.", "Baraleli ba kite ba na le nako e ntle.", "Lifate li etsa yoga e sa batleheng.", "Trampoline ea motho joale e literateng tse peli.", "Maemo a phethahetseng a ho lahleheloa ke seriti.", "Esita le dikoekoe di tsamaea kajeno.", "Matlakala a tsamaisong hape.", "Liaparo tsa hao li sa tsoa fallela jareteng ea moahisane.", "Lehlabathe libakeng tseo lehlabathe le sa lokelang ho ba teng.", "Litlamo tsa moriri li sebetsa nako e eketsehileng.", "Moea o na le vendetta ea motho ka bo eena khahlanong le disekhele.", "Ntho e 'ngoe le e 'ngoe e lokolohileng serapaneng e khethile pefo.", "Ho tsamaea ho eona ho ikutloa joalo ka ntoa ea boss ea papali ea video.", "Monyako oa koloi ea hao o sa tsoa fetoha sebetsa.", "Sekoahelo sa braai se seterekeng se latelang.", "Ha ho setaele sa moriri se bonahalang. Ba pholosehileng feela."]
      },
      cold: {
        en: ["Ja, it's jersey weather. Double jersey.", "Time to dig out that ugly beanie.", "Cold enough for soup. And a second soup.", "Hot chocolate is not a want. It's a need.", "Layer up like you're climbing Sani Pass.", "Two-fleece minimum today.", "The heater is your best friend. Your only friend.", "Even the Capetonians are admitting it's cold.", "Your breath is doing special effects.", "Blanket burrito mode: activated.", "This is not what the tourism brochure promised.", "The duvet had the right idea this morning.", "Why did you leave the house? Honestly.", "Your hands are in your pockets and they're not coming out.", "Three pairs of socks and still not enough.", "The car seats are freezing. Everything is freezing.", "Rooibos consumption just doubled.", "The dog refused to go outside. Fair.", "The cold front is here and it brought friends.", "You're not cold, you're 'lekker koud'. Big difference.", "Getting out of bed was a mistake. A documented one.", "The duvet understood the assignment.", "Your jacket has a jacket. It's that kind of day.", "The kettle is working harder than anyone today.", "Nobody signed up for this temperature.", "Your motivation froze on the way to the door.", "The couch has made a compelling case for staying.", "Outside is a test of character. You're failing.", "Hot water bottle is the real MVP today.", "Why did past-you make plans? Past-you is the worst.", "The duvet is calling and the duvet is winning.", "Even the geyser is putting in extra hours.", "You miss your bed and you've been gone twelve minutes.", "The shower was the highlight. It is downhill from here.", "Your toes have filed a formal complaint.", "Coffee count: rising. Motivation count: still zero.", "Outside has betrayed you and you went anyway.", "The fridge feels warmer than the lounge today."],
        af: ["Ja, dis truiweer. Dubbel trui.", "Tyd om daai lelike beanie te soek.", "Koud genoeg vir sop. En 'n tweede sop.", "Warm sjokolade is nie 'n wens nie. Dis 'n behoefte.", "Trek lae aan asof jy Sani Pass klim.", "Twee-fleece minimum vandag.", "Die heater is jou beste vriend. Jou enigste vriend.", "Selfs die Kapenaars erken dit is koud.", "Jou asem doen spesiale effekte.", "Kombers burrito modus: geaktiveer.", "Dit is nie wat die toerisme brosjure beloof het nie.", "Die duvet het die regte idee gehad vanoggend.", "Hoekom het jy die huis verlaat? Eerlik.", "Jou hande is in jou sakke en hulle kom nie uit nie.", "Drie pare sokkies en steeds nie genoeg nie.", "Die karsitplekke vries. Alles vries.", "Rooibos-verbruik het net verdubbel.", "Die hond het geweier om buite te gaan. Billik.", "Die kouefront is hier en hy het maats gebring.", "Jy is nie koud nie, jy is 'lekker koud'. Groot verskil.", "Om op te staan was 'n fout. 'n Gedokumenteerde een.", "Die duvet het die opdrag verstaan.", "Jou baadjie het 'n baadjie. Dis daai soort dag.", "Die ketel werk harder as enigiemand vandag.", "Niemand het hiervoor ingeteken nie.", "Jou motivering het gevries op pad deur toe.", "Die bank het 'n oortuigende saak gemaak vir bly.", "Buite is 'n karaktertoets. Jy druip.", "Warmwaterbottel is die werklike held vandag.", "Hoekom het verlede-jy planne gemaak? Verlede-jy is die ergste.", "Die duvet roep en die duvet wen.", "Selfs die geyser sit ekstra ure in.", "Jy mis jou bed en jy is twaalf minute weg.", "Die stort was die hoogtepunt. Dit gaan nou afdraand.", "Jou tone het 'n formele klagte ingedien.", "Koffie-telling: styg. Motiverings-telling: steeds nul.", "Buite het jou verraai en jy het in elk geval gegaan.", "Die yskas voel warmer as die sitkamer vandag."],
        zu: ["Yebo, yisikhathi sejezi. Ijezi ephindwe kabili.", "Isikhathi sokumba i-beanie embi.", "Kubanda ngokwanele kwesobho. Nesobho lesibili.", "Ishokoledi eshisayo akusikho isifiso. Yisidingo.", "Gqoka izingubo eziningi njengokukhwela uSani Pass.", "Ama-fleece amabili okungenani namuhla.", "I-heater ingumngane wakho omkhulu. Owodwa.", "Ngisho abaseCape bayavuma kubanda.", "Umphefumulo wakho wenza i-special effects.", "Imodhi ye-blanket burrito: ivuliwe.", "Lokhu akukhona okwethenjiswa yincwadi yokuvakasha.", "I-duvet yayinombono ofanele ekuseni.", "Kungani ushiye indlu? Ngempela.", "Izandla zakho zisemaphaketheni futhi azibuyi.", "Amapheya amathathu amakawusi kodwa akwanele.", "Izihlalo zemoto ziyaqanda. Yonke into iyaqanda.", "Ukusetshenziswa kwerooibos kusanda kuphindeka kabili.", "Inja yenqabile ukuphuma. Kufanele.", "Amakhaza afikile futhi alethe abangane.", "Awubandi, u-'lekker koud'. Umehluko omkhulu.", "Ukuvuka bekuyiphutha. Elibhaliwe phansi.", "I-duvet iyiqondile into edingekayo.", "Ijazi lakho linebhantshi. Usuku olunjalo.", "Iketela lisebenza ngamandla kunabo bonke namuhla.", "Akekho ozibhalisele leli zinga lokushisa.", "Ugqozi lwakho luqande endleleni eya emnyango.", "Isofa yenze icala elinamandla lokuba uhlale.", "Ngaphandle ukuhlolwa kwesimilo. Uyehluleka.", "Ibhodlela lamanzi ashisayo yiqhawe langempela namuhla.", "Kungani wena-wesikhathi-esidlule wenze izinhlelo? Wena-wesikhathi-esidlule mubi.", "I-duvet iyabiza futhi i-duvet iyaphumelela.", "Ngisho ne-geyser isebenza amahora engeziwe.", "Ukhumbula umbhede wakho futhi sekuyimizuzu eyishumi nambili uhambile.", "Ishawa kwakuyinto enhle. Konke kuya phansi manje.", "Izinzwane zakho zifake isikhalazo esisemthethweni.", "Ukubalwa kwekhofi: kuyenyuka. Ukubalwa kogqozi: kusewuziro.", "Ngaphandle kukukhaphele futhi noma kunjalo uhambile.", "Ifriji ibonakala ifudumele kunelawunji namuhla."],
        xh: ["Ewe, lixesha lejezi. Ijezi ephindwe kabini.", "Ixesha lokumba loo beanie imbi.", "Kuyabanda ngokwaneleyo kwesuphu. Nesuphu yesibini.", "Itshokolethi eshushu ayikokufuna. Yimfuno.", "Faka iingubo ezininzi njengokunyuka uSani Pass.", "Ii-fleece ezimbini ubuncinane namhlanje.", "I-heater ngumhlobo wakho omkhulu. Owodwa.", "Nabantu baseCape bayavuma kuyabanda.", "Umphefumlo wakho wenza i-special effects.", "Imowudi ye-blanket burrito: ivuliwe.", "Oku akukokuthenjiswa yincwadi yokhenketho.", "I-duvet yayinecebo elifanelekileyo ngale ntsasa.", "Kutheni ushiye indlu? Ngenene.", "Izandla zakho zisepokothweni kwaye aziphumi.", "Amapheya amathathu eekawusi kodwa ayanelanga.", "Izihlalo zemoto ziyaqanda. Yonke into iyaqanda.", "Ukusetyenziswa kwerooibos kusanda kuphindaphindeka.", "Inja yala ukuphuma. Kulungile.", "Amakhaza afikile kwaye azise abahlobo.", "Akubandi, u-'lekker koud'. Umahluko omkhulu.", "Ukuvuka yayiyimpazamo. Ebhaliweyo phantsi.", "I-duvet iyiqondile into efunekayo.", "Ibhatyi yakho inebhatyi. Yimini enjalo.", "Iketile isebenza ngamandla kunabo bonke namhlanje.", "Akukho mntu ubhalisele oku kushushu.", "Inkuthazo yakho iqandile endleleni eya emnyango.", "Isofa yenze icala elinamandla lokuhlala.", "Ngaphandle luvavanyo lwesimilo. Uyaphulukana.", "Ibhotile yamanzi ashushu ngumqhubi wangempela namhlanje.", "Kutheni wena-wexesha-elidlulileyo wenze izicwangciso? Wena-wexesha-elidlulileyo mbi.", "I-duvet iyabiza kwaye i-duvet iyaphumelela.", "Kwane-geyser isebenza iiyure ezongezelelweyo.", "Ukhumbula ibhedi yakho kwaye sele iyimizuzu elishumi elinambini uhambile.", "Ishawa yayiyincopho. Konke kuya ezantsi ngoku.", "Iinzwane zakho zifake isikhalazo esisesikweni.", "Ukubalwa kwekofu: kunyuka. Ukubalwa kwenkuthazo: kuse zero.", "Ngaphandle kukukhaphele kwaye nokuba kunjalo uhambile.", "Ifriji iziva ifudumele kunelawunji namhlanje."],
        st: ["E, ke leholimo la jersey. Jersey tse peli.", "Nako ea ho qhala beanie e mpe eo.", "Ho bata ho lekana le soupa. Le soupa ea bobeli.", "Tšokolate e chesang ha se takatso. Ke tlhoko.", "Apara liaparo tse ngata joalo ka ho palama Sani Pass.", "Di-fleece tse peli bonyane kajeno.", "Heater ke motsoalle oa hao e moholo. E le mong.", "Esita le ba Cape ba lumela hore ho a bata.", "Mophefumulo oa hao o etsa li-special effects.", "Mokhoa oa kobo burrito: o bulehile.", "Hona ha se seo brosure ea bohahlauli e neng e se tšepisa.", "Duvet e ne e na le mohopolo o nepahetseng hoseng.", "Hobaneng o tlohetse ntlo? Ka nnete.", "Matsoho a hao a lipokothong 'me ha a tsoe.", "Lipara tse tharo tsa dikausu empa ha li ea lekana.", "Litulo tsa koloi li a hatsela. Tsohle li a hatsela.", "Tšebeliso ea rooibos e sa tsoa phethahala habeli.", "Ntja e hanne ho tsoa kantle. Ho lokile.", "Serame se fihlile mme se tlisitse metsoalle.", "Ha o bate, o 'lekker koud'. Phapang e kholo.", "Ho tsoha e ne e le phoso. E ngotsoeng fatshe.", "Duvet e utloisitse mosebetsi.", "Jase ea hao e na le jase. Ke letsatsi le joalo.", "Ketlele e sebetsa ka matla ho feta motho e mong le e mong kajeno.", "Ha ho motho ea ingolisitseng bakeng sa mocheso ona.", "Khothatso ea hao e hatsetse tseleng ho ea monyako.", "Sofa e entsoe nyeoe e matla ea ho dula.", "Kantle ke teko ea botho. O a hloleha.", "Botlolo ea metsi a chesang ke mohale oa 'nete kajeno.", "Hobaneng uena-oa-nakong-e-fetileng o entse merero? Uena-oa-nakong-e-fetileng o mobe.", "Duvet e a bitsa mme duvet e a hlola.", "Esita le geyser e sebetsa lihora tse eketsehileng.", "O hopola bethe ea hao mme o tsoile metsotso e leshome le metso e 'meli.", "Shaoara e ne e le ntho e ntle ka ho fetisisa. Tsohle li theohela tlase joale.", "Menoana ea hao e tlisitse tletlebo ka molao.", "Palo ea kofi: e nyolohang. Palo ea khothatso: e ntse e le zero.", "Kantle ho u eka empa u ile ha le joalo.", "Fridge e ikutloa e futhumetse ho feta lounge kajeno."]
      },
      heat: {
        en: ["Jislaaik, it's properly hot!", "You could fry an egg on the N1.", "Ice cream isn't a treat. It's survival.", "Stay hydrated or become a biltong.", "The pool is not optional.", "Hotter than a bakkie dashboard at noon.", "The AC is begging for mercy.", "Your car seat is a weapon right now.", "Too hot to argue. Too hot to function.", "Even your phone's overheating.", "The tar is soft. The people are softer.", "Somewhere a chocolate bar just died.", "The office aircon war has begun.", "Everyone with a pool just became very popular.", "You're not sweating. You're 'glowing'. Sure.", "The fridge is the coolest room in the house.", "Flip-flops on tar was a mistake.", "Shorts weather? This is underwear weather.", "The ice in your drink lasted exactly 30 seconds.", "Garage pie for lunch because the kitchen is lava.", "The shade is working harder than you today.", "The office aircon debate just went to level 5.", "Everyone's suddenly your friend when you have a pool.", "Water consumption: yes. All of it.", "Your steering wheel is a hot plate.", "The fridge door is getting a workout today.", "Your makeup has an expiry date of 9am.", "The ice cream van is playing everyone's anthem.", "Slowly becoming a puddle in the corner.", "The aircon remote is now public property. Negotiate.", "Whoever has a pool today is your new best friend.", "Even the shade is sweating.", "The ceiling fan is doing its best, but its best is not enough.", "Your iced coffee melted before you reached the car.", "The neighbours' pool has never looked so tempting.", "Don't touch the seatbelt buckle. Trust us."],
        af: ["Jinne, dis ordentlik warm!", "Jy kan 'n eier braai op die N1.", "Roomys is nie 'n lekkerny nie. Dis oorlewing.", "Bly gehidreer of word biltong.", "Die swembad is nie opsioneel nie.", "Warmer as 'n bakkie se dashboard teen middag.", "Die AC smeek om genade.", "Jou karsitplek is 'n wapen nou.", "Te warm om te stry. Te warm om te funksioneer.", "Selfs jou foon oorverhit.", "Die teer is sag. Die mense is sagter.", "Iewers het 'n sjokolade net gesterf.", "Die kantoor-aircon oorlog het begin.", "Almal met 'n swembad het skielik baie populêr geword.", "Jy sweet nie. Jy 'glow'. Ja, reg.", "Die yskas is die koolste kamer in die huis.", "Plakkies op teer was 'n fout.", "Kortbroekie weer? Dis onderbroekie weer.", "Die ys in jou drankie het presies 30 sekondes gehou.", "Garage-pastei vir middagete want die kombuis is lawa.", "Die skaduwee werk harder as jy vandag.", "Die kantoor aircon debat het net vlak 5 bereik.", "Almal is skielik jou vriend as jy 'n swembad het.", "Waterverbruik: ja. Alles.", "Jou stuurwiel is 'n warmplaat.", "Die yskadeur kry 'n oefening vandag.", "Jou grimering se vervaldatum is 9vm.", "Die roomyswa speel almal se volkslied.", "Stadig besig om 'n poel in die hoek te word.", "Die aircon-afstandsbeheer is nou openbare eiendom. Onderhandel.", "Wie ook al vandag 'n swembad het is jou nuwe beste vriend.", "Selfs die skaduwee sweet.", "Die plafonventilator probeer sy bes, maar sy bes is nie genoeg nie.", "Jou ys-koffie het gesmelt voor jy by die kar gekom het.", "Die bure se swembad het nog nooit so verleidelik gelyk nie.", "Moenie aan die veiligheidsgordel-gespe vat nie. Vertrou ons."],
        zu: ["Yoh, kushisa ngempela!", "Ungabhaka iqanda ku-N1.", "I-ice cream ayisiyona isipho. Yikuphila.", "Hlala unamanzi noma ube yi-biltong.", "Ipuli alikho ukukhetha.", "Kushisa ukudlula i-dashboard yebakkie emini.", "I-AC icela umusa.", "Isihlalo semoto sakho siyisikhali manje.", "Kushisa kakhulu ukuphikisa. Kushisa kakhulu ukusebenza.", "Ngisho nefoni yakho iyashisa.", "I-tar ithambile. Abantu bathambile kakhulu.", "Endaweni ethile ishokoledi isanda kufa.", "Impi ye-aircon yasehhovisi isiqalile.", "Bonke abanepuli basanda kuba nesithunzi kakhulu.", "Awujuluki. U-'glow'. Kulungile.", "Ifriji iyindawo epholile kunayo yonke endlini.", "Izicathulo zokushibilika ku-tar bekuyiphutha.", "Isimo sezulu samabhulukwe amafushane? Lesi isimo sezulu samangisi.", "Iqhwa esiphuzweni sakho lihlale imizuzwana engu-30.", "Iphayi lasegalaji ngoba ikhishi yi-lava.", "Umthunzi usebenza ngamandla kunawe namuhla.", "Inkulumo-mpikiswano ye-aircon yasehhovisi isanda kufinyelela izinga 5.", "Bonke bangabangane bakho uma unepuli.", "Ukuphuza amanzi: yebo. Konke.", "Isitelingi sakho siyisitsha esishisayo.", "Umnyango wefriji uthola ukuzivocavoca namuhla.", "I-makeup yakho inesikhathi esiphelelayo sangu-9 ekuseni.", "Imoto ye-ice cream idlala iculo lawo wonke umuntu.", "Kancane ngiba yichibi ekhoneni.", "I-aircon remote manje yimpahla yomphakathi. Xoxisana.", "Noma ngubani onepuli namuhla ngumngane wakho omusha omkhulu.", "Ngisho nomthunzi uyajuluka.", "Ifeni yophahla yenza okusemandleni ayo, kodwa okusemandleni ayo akwanele.", "Ikhofi yakho yeqhwa incibilike ngaphambi kokufika emotweni.", "Ipuli yomakhelwane ayikaze ibukeke ihehekayo kangaka.", "Ungalithinti ibhakili lebhande lokuvikela. Sithembe."],
        xh: ["Yhuu, kushushu ngempela!", "Ungabhaka iqanda kwi-N1.", "I-ice cream ayisosipho. Kukuphila.", "Hlala unamanzi okanye ube yi-biltong.", "Ipuli ayinakukhethwa.", "Kushushu ngaphezu kwe-dashboard yebakkie emini.", "I-AC icela inceba.", "Isihlalo semoto sakho sisixhobo ngoku.", "Kushushu kakhulu ukuxoxa. Kushushu kakhulu ukusebenza.", "Nefowuni yakho iyashushu.", "I-tar ithambile. Abantu bathambile.", "Kwezinye iindawo ishokolethi isanda kufa.", "Imfazwe ye-aircon yaseofisini iqalile.", "Bonke abanepuli basanda kuba bathandwa kakhulu.", "Awubili. U-'glow'. Ewe.", "Ifriji yeyona ndawo ipholileyo endlini.", "Iislipas kwi-tar yayiyimpazamo.", "Imozulu yamabhlukhwe amafutshane? Le yimozulu yamanqisi.", "Umkhenkce kwisiselo sakho uhlale imizuzwana engama-30.", "Iphayi yasegaraji ngenxa yokuba ikhitshi yi-lava.", "Umthunzi usebenza ngamandla kunawe namhlanje.", "Ingxoxo ye-aircon yaseofisini isanda kufikelela inqanaba 5.", "Bonke bangabahlobo bakho xa unepuli.", "Ukusela amanzi: ewe. Onke.", "Isitiyeli sakho sisitya esishushu.", "Ucango lwefriji lufumana ukuzilolonga namhlanje.", "I-makeup yakho ixesha lokugqibela ngu-9 kusasa.", "Imoto ye-ice cream idlala ingoma yabo bonke abantu.", "Kancinane ndijika ndiba lichibana ekoneni.", "I-aircon remote ngoku yimpahla kawonke-wonke. Xoxa.", "Nabani onepuli namhlanje ngumhlobo wakho omtsha omkhulu.", "Nawumthunzi uyabila.", "Ifeni yophahla yenza okusemandleni ayo, kodwa okusemandleni ayo akwanelanga.", "Ikofu yakho yomkhenkce inyibilikile ngaphambi kokufika emotweni.", "Ipuli yommelwane ayikaze ibonakale ihehayo kangaka.", "Ungaluchukumisi ucango lwebhande lokukhusela. Sithembe."],
        st: ["Eish, ho tjhesa ka nnete!", "O ka chesa lehe ho N1.", "Ice cream ha se mpho. Ke bophelo.", "Dula o na le metsi kapa o fetohe biltong.", "Pool ha se kgetho.", "Ho tjhesa ho feta dashboard ea bakkie motsheare.", "AC e kopa mohau.", "Setulo sa koloi ea hao ke sebetsa joale.", "Ho tjhesa haholo ho phehisa. Ho tjhesa haholo ho sebetsa.", "Esita le mohala oa hao o chesang.", "Tara e bonolo. Batho ba bonolo le ho feta.", "Mohlomong sebakeng se seng tšokolate e sa tsoa qhibiliha.", "Ntoa ea aircon ea ofisi e qalile.", "Bohle ba nang le pool ba sa tsoa tuma haholo.", "Ha o futhumetse. O a 'glow'. Ehlile.", "Fridge ke kamore e pholileng ka ho fetisisa ka tlung.", "Lislipase ho tara e ne e le phoso.", "Leholimo la libhulukoe tse khutšoanyane? Lena ke leholimo la lipanty.", "Leqhoa senooeng sa hao le nkile metsotsoana e 30 feela.", "Paee ea garage hobane kitchen ke lava.", "Moriti o sebetsa ka thata ho feta uena kajeno.", "Puisano ea aircon ea ofisi e sa tsoa fihla boemong ba 5.", "Bohle ke metsoalle ea hao ka tšohanyetso ha o na le pool.", "Ho noa metsi: e. Kaofela.", "Setuuruili sa hao ke setjheso.", "Monyako oa fridge o fumana boikoetliso kajeno.", "Grimase ea hao e na le nako ea ho fela ea 9 hoseng.", "Bane ea ice cream e bapala pina ea bohle.", "Butle butle ke fetoha letamo lekhutlong.", "Remote ea aircon joale ke thepa ea sechaba. Buisana.", "Mang kapa mang ea nang le pool kajeno ke motsoalle oa hao e mocha e moholo.", "Esita le moriti o a fufuleloa.", "Fan ea siling e etsa sohle se matla, empa sohle sa eona ha se ea lekana.", "Kofi ea hao ea leqhoa e qhibilihile pele o fihla koloing.", "Pool ea baahisane ha e e-s'o shebahale e khahlisang hakana.", "Se ke oa ama buckle ea seatbelt. Re tšepe."]
      },
      fog: {
        en: ["Can't see a thing. Not a thing.", "Driving slow is not a suggestion.", "Silent Hill vibes. Without the monsters. Hopefully.", "Visibility: basically zero.", "Even your GPS is confused.", "The world just... disappeared.", "Perfect weather for a horror movie.", "Ghost town. But it's just Tuesday.", "If you can read this, you're too close.", "Table Mountain? What Table Mountain?", "The fog ate the neighbourhood.", "Your car is out there. Somewhere. Probably.", "The world got a soft filter this morning.", "Walking the dog has become a trust exercise.", "The streetlights are trying their best.", "Somewhere out there is the road. We think.", "The mountains are on holiday today.", "Everything looks like a film scene. A creepy one.", "Your high beams are making it worse, boet.", "The fog doesn't care about your schedule.", "The neighbours exist. Apparently. Can't confirm.", "Visibility sponsored by nobody.", "Your front gate is now the edge of the known world.", "The street signs gave up.", "Even Google Maps is being vague today.", "Fog so thick it has opinions.", "The traffic lights are vibing in the mist.", "Your driveway is a mystery novel right now.", "The fog arrived unannounced. Classic fog.", "The car is out there. Allegedly.", "Cape Town just got a dimmer switch.", "The world ends two metres past the gate.", "Your headlights are doing a 'thoughts and prayers'.", "The fog drank the mountain.", "Walking to the bin is now an expedition.", "Visibility: vibes only.", "The garden is somewhere out there. We trust the process.", "The morning forgot to render."],
        af: ["Kan niks sien nie. Niks.", "Stadig ry is nie 'n voorstel nie.", "Silent Hill vibes. Sonder die monsters. Hopelik.", "Sigbaarheid: basies nul.", "Selfs jou GPS is verward.", "Die wêreld het net... verdwyn.", "Perfekte weer vir 'n griller.", "Spookdorp. Maar dis net Dinsdag.", "As jy dit kan lees, is jy te naby.", "Tafelberg? Watter Tafelberg?", "Die mis het die buurt opgeëet.", "Jou kar is daarbuite. Iewers. Waarskynlik.", "Die wêreld het 'n sagte filter gekry vanoggend.", "Om die hond te stap het 'n vertroue-oefening geword.", "Die straatligte probeer hul bes.", "Iewers daarbuite is die pad. Ons dink.", "Die berge is op vakansie vandag.", "Alles lyk soos 'n filmtoneel. 'n Grillerige een.", "Jou brights maak dit erger, boet.", "Die mis gee nie om oor jou skedule nie.", "Die bure bestaan. Glo so. Kan nie bevestig nie.", "Sigbaarheid geborg deur niemand nie.", "Jou voorhek is nou die rand van die bekende wêreld.", "Die straatborde het tou opgegooi.", "Selfs Google Maps is vaag vandag.", "Mis so dik dit het menings.", "Die verkeersligte vibe in die mis.", "Jou oprit is 'n spanningsroman nou.", "Die mis het onverwags opgedaag. Klassieke mis.", "Die kar is daarbuite. Glo so.", "Kaapstad het 'n dimmer skakelaar gekry.", "Die wêreld eindig twee meter verby die hek.", "Jou koplampe doen 'n 'gedagtes en gebede'.", "Die mis het die berg opgedrink.", "Stap na die asblik is nou 'n ekspedisie.", "Sigbaarheid: net vibes.", "Die tuin is iewers daar buite. Ons vertrou die proses.", "Die oggend het vergeet om te laai."],
        zu: ["Angiboni lutho. Lutho.", "Ukushayela kancane akusona isiphakamiso.", "I-Silent Hill vibes. Ngaphandle kwezimanga. Sithemba.", "Ukubonakala: cishe iqanda.", "Ngisho ne-GPS yakho iyadideka.", "Umhlaba nje... wanyamalala.", "Isimo sezulu esihle sefilimu yesabisayo.", "Idolobha lesipoki. Kodwa kungoLwesibili nje.", "Uma ungafunda lokhu, useduze kakhulu.", "I-Table Mountain? Iyiphi i-Table Mountain?", "Inkungu idle indawo.", "Imoto yakho ikhona ngaphandle. Endaweni ethile. Cishe.", "Umhlaba uthole ifilitha ethambile ekuseni.", "Ukuhambisa inja sekube umsebenzi wokuthemba.", "Izibani zomgwaqo zizama ngakho konke.", "Endaweni ethile ngaphandle kunomgwaqo. Sicabanga.", "Izintaba ziseholidini namuhla.", "Yonke into ibukeka njengomfanekiso wefilimu. Eyesabekayo.", "Ama-high beam akho enza kube kubi, boet.", "Inkungu ayikhathaleli isheduli yakho.", "Omakhelwane bakhona. Kubonakala kanjalo. Angikwazi ukuqinisekisa.", "Ukubonakala kuxhaswe ngubani. Muntu.", "Isango lakho eliphambili manje ngumkhawulo womhlaba owaziwa.", "Izimpawu zomgwaqo ziyekile.", "Ngisho neGoogle Maps iyantengantenga namuhla.", "Inkungu eqine kakhulu inezimvo.", "Izibani zomgwaqo ziyavuma enkungu.", "Indlela yakho yokungena iyinoveli yemfihlo manje.", "Inkungu ifikile ingamenyiwe. Inkungu yoqobo.", "Imoto ikhona ngaphandle. Kuthiwa nje.", "IKapa lithole iswishi yokuncipha ukukhanya.", "Umhlaba uphela amamitha amabili ngale kwesango.", "Izibani zakho ezinkulu zenza 'imicabango nemikhuleko'.", "Inkungu iphuze intaba.", "Ukuhamba uye esikhongelweni manje kuwuhambo.", "Ukubonakala: ama-vibes kuphela.", "Ingadi ikhona ngaphandle. Sithemba inqubo.", "Ekuseni kukhohliwe ukurenda."],
        xh: ["Andiboni nto. Nto.", "Ukuqhuba kancinci akusosiphakamiso.", "I-Silent Hill vibes. Ngaphandle kwezidalwa. Sinethemba.", "Ukubonakala: phantse iqanda.", "Ne-GPS yakho iyadideka.", "Ihlabathi nje... lanyamalala.", "Imozulu elungele ifilimu yoyiko.", "Idolophu yesipoki. Kodwa ngolwesiBini nje.", "Ukuba ungafunda oku, ukufutshane kakhulu.", "I-Table Mountain? Yiyiphi i-Table Mountain?", "Inkungu itye indawo.", "Imoto yakho ikhona ngaphandle. Ndaweni ithile. Mhlawumbi.", "Ihlabathi lifumene ifilitha ethambileyo ngale ntsasa.", "Ukuhambisa inja kusanda kuba ngumdlalo wokuthemba.", "Izibane zesitalato zizama ngako konke.", "Ndaweni ithile ngaphandle kukho indlela. Sicinga.", "Iintaba ziholide namhlanje.", "Yonke into ibonakala njengomfanekiso wefilimu. Oyoyikisayo.", "Ii-high beam zakho zenza kube kubi, boet.", "Inkungu ayikhathalelanga ishedyuli yakho.", "Abamelwane bakho. Kubonakala kanjalo. Andinakuqinisekisa.", "Ukubonakala kuxhaswe ngubani. Mntu.", "Isango lakho langaphambili ngoku ngumda wehlabathi elaziwayo.", "Izimpawu zendlela ziyekile.", "NeGoogle Maps iyathengathenga namhlanje.", "Inkungu eqine kakhulu inezimvo.", "Izibane zendlela ziyavuma enkungu.", "Indlela yakho yokungena yinoveli yemfihlakalo ngoku.", "Inkungu ifikile ingamenyanga. Inkungu yoqobo.", "Imoto ikho ngaphandle. Kuthiwa nje.", "IKapa lifumene iswitshi yokuncipha ukukhanya.", "Ihlabathi liphela kwiimitha ezimbini ngaphesheya kwesango.", "Iziqhumane zakho ezikhulu zenza 'iingcinga nemithandazo'.", "Inkungu iyiselile intaba.", "Ukuhamba uye kwibhinikhisi ngoku luhambo.", "Ukubonakala: ii-vibes kuphela.", "Igadi ikhona ngaphandle. Siyithemba inkqubo.", "Intsasa ilibele ukurenda."],
        st: ["Ha ke bone letho. Letho.", "Ho khanna butle hase tlhahiso.", "Silent Hill vibes. Ntle le dimanka. Re tšepa.", "Ho boneha: hanyenyane nul.", "Esita le GPS ea hao e ferekane.", "Lefatše le... nyametse.", "Leholimo le letle la filimi ea tšabo.", "Toropo ea meea. Empa ke Labobeli feela.", "Haeba o ka bala sena, o haufi haholo.", "Table Mountain? Table Mountain efe?", "Moholi o jele tikoloho.", "Koloi ea hao e teng kantle. Kae-kae. Mohlomong.", "Lefatše le fumane filitha e bonolo hoseng.", "Ho tsamaisa ntja e fetohile papali ea tšepo.", "Mabone a seterata a leka ka hohle.", "Kae-kae kantle ke tsela. Re nahana.", "Lithaba li holideining kajeno.", "Tsohle li shebahala joalo ka filimi. E tšosang.", "Li-high beam tsa hao li etsa hore ho be ho mpe, boet.", "Moholi ha o khathalele lenaneo la hao.", "Baahisane ba teng. Ho bonahala joalo. Ke ke ke netefatsa.", "Ho boneha ho sponsoritsoe ke motho. Motho.", "Heke ea hao ea ka pele joale ke moeli oa lefatše le tsejoang.", "Matšoao a tsela a lahlile thapo.", "Esita le Google Maps e na le liphetoho kajeno.", "Moholi o mokoto haholo o na le maikutlo.", "Mabone a sephethephethe a a vibe moholing.", "Tsela ea hao ea ho kena ke novele ea sephiri joale.", "Moholi o fihlile a sa memioa. Moholi oa setso.", "Koloi e teng kantle. Ho thoe.", "Cape Town e fumane konopo ea ho fokotsa lesedi.", "Lefatše le qetella limithara tse peli ka mose ho heke.", "Mabone a hao a maholo a etsa 'mehopolo le lithapelo'.", "Moholi o noele thaba.", "Ho tsamaea ho ea bining joale ke leeto.", "Ho boneha: vibes feela.", "Jarata e teng kantle. Re tšepa ts'ebetso.", "Hoseng ho lebetse ho rendera."]
      },
      clear: {
        en: ["Absolutely beautiful out there.", "Perfect day. No excuses. Get out.", "This is why we live in South Africa.", "Not a cloud in sight. Not one.", "Main character weather right here.", "Even the hadedas sound happy.", "If you're inside, you're doing it wrong.", "Nature's flexing and we're here for it.", "Postcard weather. You're welcome.", "The kind of day that makes you forget load shedding.", "Somewhere an estate agent is saying 'lifestyle'.", "Save this one in the memory bank.", "The kind of day you text someone about.", "Africa's sky just hits different.", "Take a moment. Look up. You're welcome.", "The Helderberg is showing off today.", "Days like this should come with a soundtrack.", "Your vitamin D levels are thanking you.", "The fynbos is loving it. You should too.", "Blue sky, warm breeze. The simple stuff.", "The sky's giving everything today.", "This is the weather you'll miss in December traffic.", "Even the parking lot looks pretty today.", "No filter needed. Just look outside.", "The type of day that makes people text 'lekker dag hey'.", "Take your coffee outside. You deserve it.", "Everything looks 4K today. The sky's in ultra mode.", "This is the day the brochure was talking about.", "Your excuse to stay inside just expired.", "Days like this is why we put up with the load shedding.", "This is the stuff. Right here.", "A proper good one. Don't waste it.", "The kind of sky that makes you grateful for free things.", "Pour the coffee outside. Trust us.", "Africa showing off again. Quietly devastating.", "This is the weather we brag about overseas.", "Feels like the country is on its best behaviour.", "Bottle this one. Open it in winter."],
        af: ["Absoluut pragtig daar buite.", "Perfekte dag. Geen verskonings nie. Gaan uit.", "Dis hoekom ons in Suid-Afrika bly.", "Nie 'n wolk in sig nie. Nie een nie.", "Hoofkarakter weer reg hier.", "Selfs die hadedas klink gelukkig.", "As jy binne is, doen jy dit verkeerd.", "Natuur pronk en ons is hier daarvoor.", "Poskaart weer. Plesier.", "Die soort dag wat jou laat vergeet van beurtkrag.", "Iewers sê 'n eiendomsagent 'lifestyle'.", "Stoor hierdie een in die geheue-bank.", "Die soort dag waaroor jy iemand 'n boodskap stuur.", "Afrika se lug tref net anders.", "Neem 'n oomblik. Kyk op. Plesier.", "Die Helderberg pronk vandag.", "Dae soos hierdie behoort 'n klankbaan te hê.", "Jou vitamien D-vlakke bedank jou.", "Die fynbos geniet dit. Jy moet ook.", "Blou lug, warm briesie. Die eenvoudige goed.", "Die lug gee alles vandag.", "Dit is die weer wat jy sal mis in Desember-verkeer.", "Selfs die parkeerterrein lyk mooi vandag.", "Geen filter nodig nie. Kyk net buite.", "Die soort dag wat mense laat 'lekker dag hey' stuur.", "Vat jou koffie buitentoe. Jy verdien dit.", "Alles lyk 4K vandag. Die lug is in ultra modus.", "Dit is die dag waaroor die brosjure gepraat het.", "Jou verskoning om binne te bly het pas verval.", "Dae soos hierdie is hoekom ons die beurtkrag verduur.", "Dit is die ding. Reg hier.", "'n Behoorlike goeie een. Moenie dit mors nie.", "Die soort lug wat jou dankbaar laat voel vir gratis goed.", "Skink die koffie buite. Vertrou ons.", "Afrika pronk weer. Stilweg verwoestend.", "Dit is die weer waaroor ons oorsee spog.", "Voel of die land op sy beste gedrag is.", "Bottel hierdie een. Maak hom oop in die winter."],
        zu: ["Kuhle kakhulu ngaphandle.", "Usuku oluphelele. Akukho zaba. Phuma.", "Yingakho sihlala eNingizimu Afrika.", "Akukho lifu elibonwayo. Nelilodwa.", "Isimo sezulu somlingiswa omkhulu lapha.", "Ngisho ama-hadeda azwakala ejabule.", "Uma ungaphakathi, wenza kabi.", "Imvelo iyaziqhayisa futhi silapha ngayo.", "Isimo sezulu se-postcard. Wamukelekile.", "Uhlobo losuku olwenza ukhohlwe i-load shedding.", "Endaweni ethile i-estate agent ithi 'lifestyle'.", "Gcina lolu suku enkumbulweni.", "Uhlobo losuku othumela umuntu umlayezo ngalo.", "Isibhakabhaka sase-Afrika sihlukile nje.", "Thatha umzuzu. Bheka phezulu. Wamukelekile.", "I-Helderberg iziqhayisa namuhla.", "Izinsuku ezinje kufanele zize ne-soundtrack.", "Amazinga akho e-vitamin D ayakubonga.", "Ifynbos iyakuthanda. Nawe kufanele.", "Isibhakabhaka esiluhlaza, umoya ofudumele. Izinto ezilula.", "Isibhakabhaka sinikeza konke namuhla.", "Lesi yisimo sezulu ozosithanda ethrafikhini kaDisemba.", "Ngisho nepaki ibukeka kahle namuhla.", "Akudingeki ifilitha. Bheka ngaphandle nje.", "Uhlobo losuku olwenza abantu bathumele 'usuku oluhle hey'.", "Thatha ikhofi yakho uyiphumele. Uyakufanelekela.", "Konke kubukeka nge-4K namuhla. Isibhakabhaka siku-ultra mode.", "Lolu usuku incwajana eyayikhuluma ngalo.", "Isizathu sakho sokuhlala ngaphakathi sisanda kuphelelwa.", "Izinsuku ezinje yizona ezenza sikhuthazelele i-load shedding.", "Yilokhu. Lapha nje.", "Olungcono ngempela. Ungalumoshi.", "Uhlobo lwesibhakabhaka olukwenza ubonge izinto zamahhala.", "Thela ikhofi ngaphandle. Sithembe.", "I-Afrika iyaziqhayisa futhi. Ngokuthula ngokuphazamisayo.", "Lesi yisimo sezulu esiziqhenya ngaso phesheya.", "Kuzwakala sengathi izwe lisesimweni esihle.", "Yifake ebhodleleni le. Yivule ebusika."],
        xh: ["Kuhle kakhulu ngaphandle.", "Imini egqibeleleyo. Akukho zaba. Phuma.", "Yiyo le nto sihlala eMzantsi Afrika.", "Akukho lifu elibonwayo. Nelinye.", "Imozulu yomlinganiswa ophambili apha.", "Iintaka zivakala zivuya.", "Ukuba ungaphakathi, wenza ngokuphosakeleyo.", "Indalo iyaziqhayisa kwaye silapha ngenxa yayo.", "Imozulu ye-postcard. Wamkelekile.", "Uhlobo lwemini olwenza ulibale i-load shedding.", "Kwezinye iindawo umthengisi wendlu uthi 'lifestyle'.", "Gcina le mini kwinkumbulo.", "Uhlobo lwemini othumela umntu umyalezo ngalo.", "Isibhakabhaka saseAfrika sihlukile nje.", "Thatha umzuzu. Jonga phezulu. Wamkelekile.", "I-Helderberg iyaziqhayisa namhlanje.", "Iimini ezinje kufanele zize ne-soundtrack.", "Amanqanaba akho e-vitamin D ayakubulela.", "Ifynbos iyakuthanda. Nawe kufanele.", "Isibhakabhaka esiluhlaza, umoya ofudumeleyo. Izinto ezilula.", "Isibhakabhaka sinika yonke into namhlanje.", "Le yimozulu oya kuyikhumbula kwitrafi kaDisemba.", "Kwanendawo yokuphaka ibonakala intle namhlanje.", "Akufuneki ifilitha. Jonga ngaphandle nje.", "Uhlobo lwemini olwenza abantu bathumele 'imini entle hey'.", "Thatha ikofu yakho uye ngaphandle. Uyifanele.", "Yonke into ibonakala nge-4K namhlanje. Isibhakabhaka siku-ultra mode.", "Le yimini incwadana eyayithetha ngayo.", "Isizathu sakho sokuhlala ngaphakathi sisanda kuphelelwa.", "Iimini ezinje zezinto ezisenza sinyamezele i-load shedding.", "Yiloo nto. Apha kanye.", "Eyona ilungileyo. Sukuyichitha.", "Uhlobo lwesibhakabhaka olwenza ubulele izinto zasimahla.", "Galela ikofu ngaphandle. Sithembe.", "I-Afrika iyaziqhayisa kwakhona. Ngokuzolileyo ngokumangalisayo.", "Le yimozulu esiziqhayisa ngayo phesheya.", "Kuvakala ngathi ilizwe likwisimo esihle.", "Yifake ebhotileni le. Yivule ebusika."],
        st: ["Ho motle haholo kantle.", "Letsatsi le phethahetseng. Ha ho mabaka. Tsamaea.", "Ke kahoo re lulang Afrika Boroa.", "Ha ho leru le bonahalang. Le le le leng.", "Leholimo la molingoa oa mantlha mona.", "Esita le dinonyana di utloahala li thabile.", "Haeba o ka hare, o etsa phoso.", "Tlhaho e iponahatsa mme re teng.", "Leholimo la postcard. Kea leboha.", "Mofuta oa letsatsi o etsang hore o lebale load shedding.", "Mohlomong sebakeng se seng estate agent e re 'lifestyle'.", "Boloka letsatsi lena mohopolong.", "Mofuta oa letsatsi oo o romelang motho molaetsa ka lona.", "Lehodimo la Afrika le fapane feela.", "Nka motsotso. Sheba holimo. Kea leboha.", "Helderberg e iponahatsa kajeno.", "Matsatsi a tjena a lokela ho tla le soundtrack.", "Maemo a hao a vitamin D a a leboha.", "Fynbos e e rata. Le uena o lokela.", "Lehodimo le letala, moea o futhumetseng. Lintho tse bonolo.", "Lehodimo le fana le tsohle kajeno.", "Lena ke leholimo leo o tla le thella sephetphetheng sa Tšitoe.", "Esita le sebaka sa liphakinki se bonahala se setle kajeno.", "Ha ho hlokahale filitha. Sheba kantle feela.", "Mofuta oa letsatsi o etsang batho ba romele 'letsatsi le letle hey'.", "Nka kofi ea hao o ee kantle. O e tšoanetse.", "Tsohle li shebahala 4K kajeno. Lehodimo le ultra mode.", "Lena ke letsatsi leo brosure e neng e bua ka lona.", "Lebaka la hao la ho dula ka hare le sa tsoa fela.", "Matsatsi a tjena ke lebaka leo re mametseng load shedding.", "Ke sona sena. Mona feela.", "Le letle ka 'nete. Se ke oa le senya.", "Mofuta oa lehodimo o etsang hore o leboge lintho tsa mahala.", "Tšolla kofi kantle. Re tšepe.", "Afrika e iponahatsa hape. Ka khotso ka ho qhibilihisang.", "Lena ke leholimo leo re le iponelang lichaba.", "Ho utloahala eka naha e maemong a eona a matle.", "Beha lena ka botlolong. Bula nakong ea mariha."]
      },
      night: {
        en: ["Stars out, load shedding can't touch this.", "Perfect night to actually see the Milky Way.", "Quiet out there. Almost suspicious.", "The hadedas are sleeping. Finally.", "Night shift weather: approved.", "Dark outside, bright tomorrow.", "Good night, South Africa.", "The moon's doing the most tonight.", "Somewhere a cricket is really giving it.", "Even Table Mountain's called it a day.", "Nothing a cup of rooibos won't fix.", "The neighbourhood cats have taken over.", "Perfect weather for pretending you'll go to bed early.", "Not a cloud. Just you and the Southern Cross.", "The owls are judging your screen time.", "Cape Town's twinkling. Probably.", "Tomorrow's weather is tomorrow's problem.", "The frogs have entered the chat.", "Warm enough to leave the window open. Brave enough?", "The sky looks like it's showing off."],
        af: ["Sterre uit, beurtkrag kan dit nie raak nie.", "Perfekte nag om die Melkweg te sien.", "Stil daarbuite. Byna verdag.", "Die hadedas slaap. Uiteindelik.", "Nagskof weer: goedgekeur.", "Donker buite, helder môre.", "Goeienag, Suid-Afrika.", "Die maan doen sy bes vanaand.", "Iewers is 'n kriek besig om sy hart uit te sing.", "Selfs Tafelberg het dit 'n dag genoem.", "Niks wat 'n koppie rooibos nie kan regmaak nie.", "Die buurt se katte het oorgevat.", "Perfekte weer om voor te gee jy gaan vroeg slaap.", "Nie 'n wolk nie. Net jy en die Suiderkruis.", "Die uile oordeel jou skermtyd.", "Kaapstad glinster. Waarskynlik.", "Môre se weer is môre se probleem.", "Die paddas het die gesprek betree.", "Warm genoeg om die venster oop te los. Dapper genoeg?", "Die lug lyk of dit pronk."],
        zu: ["Izinkanyezi zikhona, ukucisha akukwazi lokhu.", "Ubusuku obuhle bokubona iNdlela yoSisi.", "Kuthule ngaphandle. Cishe okusolisayo.", "Ama-hadeda ayalala. Ekugcineni.", "Isimo sezulu sangobusuku: samukelwe.", "Umnyama ngaphandle, ukukhanya kusasa.", "Hamba kahle, Ningizimu Afrika.", "Inyanga yenza konke namhlanje ebusuku.", "Endaweni ethile intethe iyazinikela ngempela.", "Ngisho neNtaba yeThebula isiphumule.", "Akukho okungalungiswa yinkomishi yerooibos.", "Amakati akhelwane asethathile.", "Isimo sezulu esihle sokuzenza uzolala kusenesikhathi.", "Akukho lifu. Nguwe neSiphambano saseNingizimu kuphela.", "Izikhova zikwahlulela ngesikhathi sakho sesikrini.", "IKapa licwebezela. Cishe.", "Isimo sezulu sakusasa sinkinga yakusasa.", "Amasele angene engxoxweni.", "Kufudumele ngokwanele ukuvula ifasitela. Unesibindi?", "Isibhakabhaka sibukeka siziqhayisa."],
        xh: ["Iinkwenkwezi ziphumile, ukuCimwa akukwazi oku.", "Ubusuku obulungileyo bokubona iNdlela yaseSisi.", "Kuzolile ngaphandle. Cishe okusolisayo.", "Iintaka zilele. Ekugqibeleni.", "Imozulu yobusuku: yamkelekile.", "Mnyama ngaphandle, kukhanya ngomso.", "Lala kakuhle, Mzantsi Afrika.", "Inyanga ibonakala ngokukhethekileyo ngokuhlwa.", "Ndaweni ithile irhejane lizimisele ngokwenene.", "Kwanentaba yeTafile iphumle ngoku.", "Akukho nto ingalungiswa yikomityi yerooibos.", "Iikati zabamelwane zithathile.", "Imozulu egqibeleleyo yokuzenza uza kulala kwangoko.", "Akukho lifu. Nguwe neCross yaseMzantsi kuphela.", "Izikhova ziyawugweba umsebenzi wakho wesikrini.", "IKapa iyabengezela. Mhlawumbi.", "Imozulu yangomso yingxaki yangomso.", "Amasele angene kwinkcazo.", "Kufudumele ngokwaneleyo ukuvula ifestile. Unesibindi?", "Isibhakabhaka sibonakala siziqhayisa."],
        st: ["Dinaledi di teng, load shedding e ke ke ea ama sena.", "Bosiu bo motle ba ho bona Tsela ea Lebese.", "Ho kgutsitse kantle. E batla ho belaela.", "Dinonyana di robetse. Qetellong.", "Leholimo la bosiu: le amohelitsoe.", "Ho fifala kantle, ho phatsima hosane.", "Robala hantle, Afrika Boroa.", "Khoeli e etsa ho fetisisa bosiu bona.", "Kae-kae tšie e binela ka matla.", "Esita le Thaba ea Table e ithobaletse.", "Ha ho letho le sa lokisoeng ke kopi ea rooibos.", "Dikatse tsa moahisane di nkile taolo.", "Leholimo le loketseng ho ithetsa hore o tla robala ka nako.", "Ha ho leru. Ke uena le Sefapano sa Boroa feela.", "Dikgogo di ahlola nako ea hao ea skrini.", "Cape Town e phatsima. Mohlomong.", "Leholimo la hosane ke bothata ba hosane.", "Digwagwa di kene puisanong.", "Ho futhumetse ho lekane ho bula fensetere. O sebete?", "Leholimo le bonahala le iponahatsa."]
      },
      weekend: {
        en: ["Braai weather, boet! No excuses.", "Fire up the Weber. It's the law.", "The weather gods are showing off.", "Beach or braai? Yes.", "Weekend vibes so strong they need their own playlist.", "If you're working today, we feel sorry for you.", "Perfect for doing absolutely nothing.", "Call the mates. Get the meat. Let's go.", "Today's plans: exist outside.", "The weekend doesn't get better than this.", "The coals aren't going to light themselves.", "Shoes optional. Attitude mandatory.", "Your out-of-office is doing the heavy lifting.", "Kuier weather. Get the people together.", "The Weber's been waiting all week for this.", "The tongs are calling. Answer them.", "No alarm. No agenda. Just vibes.", "This is the weather the weekend was invented for.", "Your only responsibility is choosing charcoal or wood.", "Saturday energy: maximum. Responsibilities: minimum.", "Marinade in. Phone off. Day starts now.", "The chops are calling. So is the chair.", "Boerie roll for breakfast? On a weekend? Acceptable.", "Slip-slops, shorts, sun. The trinity.", "The braai is the social calendar. Show up."],
        af: ["Braaiweer, boet! Geen verskonings nie.", "Steek die Weber aan. Dit is die wet.", "Die weergode pronk vandag.", "Strand of braai? Ja.", "Naweek vibes so sterk hulle het hul eie playlist nodig.", "As jy vandag werk, jammer vir jou.", "Perfek om absoluut niks te doen nie.", "Bel die tjommies. Kry die vleis. Kom ons gaan.", "Vandag se planne: bestaan buitentoe.", "Die naweek word nie beter as dit nie.", "Die kole gaan nie hulself aansteek nie.", "Skoene opsioneel. Houding verpligtend.", "Jou out-of-office doen die swaar werk.", "Kuierweer. Kry die mense bymekaar.", "Die Weber het die hele week hiervoor gewag.", "Die tang roep. Antwoord dit.", "Geen alarm. Geen agenda. Net vibes.", "Dit is die weer waarvoor die naweek uitgevind is.", "Jou enigste verantwoordelikheid is kies houtskool of hout.", "Saterdagenergie: maksimum. Verantwoordelikhede: minimum.", "Marinade in. Foon af. Dag begin nou.", "Die tjoppies roep. Die stoel ook.", "Boerierol vir ontbyt? Op 'n naweek? Aanvaarbaar.", "Slip-slops, kortbroek, son. Die drie-eenheid.", "Die braai is die sosiale kalender. Daag op."],
        zu: ["Izulu lokosa, boet! Akukho zaba.", "Basa i-Weber. Kungumthetho.", "Izinkulunkulu zesimo sezulu ziyaziqhayisa.", "Ibhishi noma ukosa? Yebo.", "I-weekend vibes ezinamandla kakhulu zidinga i-playlist yazo.", "Uma usebenza namuhla, sikuzwela.", "Kulungile ukungakwenzi lutho.", "Shayela abangane. Thola inyama. Masiye.", "Izinhlelo zanamuhla: hlala ngaphandle.", "I-weekend ayibi ngcono kunalokhu.", "Amalahle awazozikhanyisela.", "Izicathulo zingakhethwa. Isimo sengqondo siyaphoqeleka.", "I-out-of-office yakho yenza umsebenzi onzima.", "Isimo sezulu sokuhlangana. Biza abantu.", "I-Weber ibelinde isonto lonke loku.", "Ama-tong ayabiza. Waphendule.", "Akukho i-alarm. Akukho i-agenda. Ama-vibes kuphela.", "Lesi yisimo sezulu i-weekend eyenzelwe sona.", "Umsebenzi wakho owodwa ukukhetha amalahle noma izinkuni.", "Amandla angoMgqibelo: aphezulu. Imisebenzi: iphansi.", "Faka i-marinade. Cisha ifoni. Usuku luqala manje.", "Ama-chop ayabiza. Nesihlalo nawo.", "Iboerie roll yebhulakufesi? Ngempelasonto? Iyamukeleka.", "Izimbadada, amabhulukwe amafushane, ilanga. Inhlangano emithathu.", "Ukosa kuyikhalenda yenhlalo. Vela."],
        xh: ["Imozulu yokugrila, boet! Akukho zaba.", "Basa i-Weber. Ngumthetho.", "Oothixo bemozulu bayaziqhayisa.", "Ibhitshi okanye ukugrila? Ewe.", "Weekend vibes ezinamandla kakhulu zifuna i-playlist yazo.", "Ukuba usebenza namhlanje, siyakuzwela.", "Ilungele ukungenza nto kwaphela.", "Tsalela abahlobo. Fumana inyama. Masiye.", "Izicwangciso zanamhlanje: phila ngaphandle.", "Impelaveki ayibi bhetele kunale.", "Amalahle awayi kuzilayita ngokwawo.", "Izihlangu zingakhethwa. Isimilo siyanyanzelelwa.", "I-out-of-office yakho yenza umsebenzi onzima.", "Imozulu yokuhlangana. Biza abantu.", "I-Weber ibelinde iveki yonke oku.", "Ama-tong ayabiza. Waphendule.", "Akukho i-alarm. Akukho i-agenda. Ii-vibes kuphela.", "Le yimozulu impelaveki eyenzelwe yona.", "Umsebenzi wakho okukuphela ukukhetha amalahle okanye iinkuni.", "Amandla angoMgqibelo: aphezulu. Uxanduva: lusezantsi.", "Faka i-marinade. Cima ifowuni. Imini iqala ngoku.", "Iitshophu ziyabiza. Nesitulo nayo.", "Iboerie roll yebhrekfesi? Ngempelaveki? Iyamkeleka.", "Iislipas, iibhulukhwe ezimfutshane, ilanga. Imanyano emithathu.", "Ukugrila yikhalenda yentlalo. Bonakala."],
        st: ["Leholimo la braai, boet! Ha ho mabaka.", "Chesa Weber. Ke molao.", "Melimo ea leholimo e a iponahatsa.", "Lebopo kapa braai? E.", "Maikutlo a beke a matla haholo a hloka playlist ea 'ona.", "Haeba o sebetsa kajeno, re oa utsoarela.", "E lokile ho se etse letho.", "Letsetsa metsoalle. Fumana nama. Re tsamaee.", "Merero ea kajeno: phela kantle.", "Phomolo ha e be betere ho feta mona.", "Mashala ha a na ho itukisa ka bo 'ona.", "Lieta li ka khethoa. Boitšoaro bo tlamehile.", "Out-of-office ea hao e etsa mosebetsi o boima.", "Leholimo la ho kopana. Bokella batho.", "Weber e emeletse beke eohle bakeng sa sena.", "Tong e a bitsa. Araba eona.", "Ha ho alarm. Ha ho agenda. Vibes feela.", "Lena ke leholimo phomolo e entsoeng bakeng sa lona.", "Boikarabelo ba hao bo le bong feela ke ho khetha mashala kapa patsi.", "Matla a Moqebelo: a hodimo. Boikarabelo: bo tlase.", "Kenya marinade. Tima mohala. Letsatsi le qala joale.", "Lichopo li a bitsa. Setulo le sona.", "Boerie roll bakeng sa lijo tsa hoseng? Mafelong a beke? E lokile.", "Slip-slops, libhulukoe tse khutšoanyane, letsatsi. Boraro bo bong.", "Braai ke khalendara ea boithabiso. Hlaha."]
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
      couldntFetch: { en: "Couldn't fetch weather right now.", af: "Kon nie weer kry nie.", zu: "Ayikwazanga ukuthola isimo sezulu.", xh: "Ayikwazanga ukufumana imozulu.", st: "Ha e khone ho fumana boemo ba leholimo." },
      share: { en: "Share", af: "Deel", zu: "Yabelana", xh: "Yabelana", st: "Arolelana" },
      shareIn: { en: "in", af: "in", zu: "e-", xh: "e-", st: "ho" }
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
    if (shareBtn && navigator.share) shareBtn.style.display = which === screenHome ? '' : 'none';
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
    if (shareBtn) shareBtn.textContent = `↗ ${t('misc', 'share')}`;
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
    // FIX-003: positive cloud-cover override — don't show 'clear' if the sky is actually 55%+ cloudy
    if (isMostlyCloudy) return 'cloudy';
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

    // FIX-001: Log condition decision for debugging
    const votes = norm.sourceConditions || [];
    console.log(`[Condition] API=${apiCondition} rain=${imminentRain}% cloud=${cloud}% wind=${effectiveWind}kph`);
    if (votes.length) console.log('[Source votes]', votes.map(s => `${s.source}:${s.vote}(${s.desc})`).join(', '));

    // FIX-001: Count source votes for majority check
    const rainVotes = votes.filter(v => v.vote === 'rain' || v.vote === 'storm').length;
    const cloudyVotes = votes.filter(v => v.vote === 'cloudy').length;
    const hasMajorityRain = rainVotes >= 2;
    const hasMajorityCloudy = (rainVotes + cloudyVotes) >= 2;

    if (apiCondition === 'storm') return 'storm';
    if (apiCondition === 'cold') return 'cold';
    if (apiCondition === 'heat') return 'heat';
    // FIX: trust the API's rain verdict when 2+ sources voted rain/storm. The API
    // already aggregated source agreement; without this, a unanimous-rain payload
    // gets demoted to 'rain-possible' whenever norm.rainPct happens to land below 50.
    if (apiCondition === 'rain' && votes.length && hasMajorityRain) {
      console.log(`[Rain consensus] API=rain with ${rainVotes} source votes → returning rain`);
      return 'rain';
    }
    if (isNum(imminentRain) && imminentRain >= 50) return 'rain';
    // FIX-001: rain-possible requires either strong rain signal (≥30%) OR majority source agreement
    if (isNum(imminentRain) && imminentRain >= 30) {
      if (hasMajorityRain || hasMajorityCloudy || !votes.length) return 'rain-possible';
      console.log(`[FIX-001] Skipping rain-possible: rain=${imminentRain}% but only ${rainVotes} source(s) vote rain`);
    }
    // FIX-003: rain is coming later today (daily ≥50% but not imminent) — show the possible-showers state
    if (norm.rainLater) {
      console.log(`[FIX-003] rainLater=true, escalating to rain-possible`);
      return 'rain-possible';
    }
    if (isDay && apiCondition === 'uv' && !(isTrulyOvercast || isMostlyCloudy || isSignificantCloud)) return 'uv';
    if (apiCondition === 'wind') return 'wind';
    if (isNum(effectiveWind) && effectiveWind >= 30) return 'wind';
    if (apiCondition === 'fog') return 'fog';
    // FIX-001: cloudy requires majority source agreement
    if (apiCondition === 'cloudy') {
      if (hasMajorityCloudy || !votes.length || isTrulyOvercast || isMostlyCloudy) return 'cloudy';
      console.log(`[FIX-001] Skipping cloudy: only ${cloudyVotes} source(s) vote cloudy, cloud=${cloud}%`);
    }
    if (isNum(effectiveWind) && effectiveWind >= 25) return 'wind';
    const sky = computeSkyCondition(norm);
    if (sky !== 'clear') return sky;
    // FIX-003: positive cloud-cover override — don't show 'clear' if the sky is actually 55%+ cloudy
    if (isMostlyCloudy) {
      console.log(`[FIX-003] cloud ${cloud}% forces cloudy (sky was clear, apiCondition=${apiCondition})`);
      return 'cloudy';
    }
    return 'clear';
  }

  // ========== TRANSLATED TEXT ==========
  function getHeadline(condition) { return T.headlines[condition]?.[settings.lang] || T.headlines[condition]?.en || "Clear skies."; }
  function getHeroLabel(condition) { return T.heroLabels[condition]?.[settings.lang] || T.heroLabels[condition]?.en || "Pleasant"; }
  function getWittyLine(condition) {
    const day = getLocationDayOfWeek(), hour = getLocationHour(activePlace?.lon);
    const isWeekend = day === 0 || day === 6 || (day === 5 && hour >= 16);
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
  function getLocationDayOfWeek() {
    // Returns 0=Sun,1=Mon...6=Sat for the SEARCHED location, not the device.
    // Uses utcOffsetSeconds from the API to shift UTC time to location time.
    const offset = window.__PW_LAST_NORM?.utcOffsetSeconds;
    if (isNum(offset)) {
      const locationMs = Date.now() + offset * 1000;
      return new Date(locationMs).getUTCDay(); // getUTCDay on shifted time = location's day
    }
    return new Date().getDay(); // fallback to device time
  }
  function getLocationDayOfYear() {
    // Returns 1-366 for the searched location, not the device.
    const offset = window.__PW_LAST_NORM?.utcOffsetSeconds;
    if (isNum(offset)) {
      const locMs = Date.now() + offset * 1000;
      const d = new Date(locMs);
      const start = Date.UTC(d.getUTCFullYear(), 0, 1);
      return Math.floor((locMs - start) / 86400000) + 1;
    }
    const d = new Date();
    const start = new Date(d.getFullYear(), 0, 1);
    return Math.floor((d - start) / 86400000) + 1;
  }

  // ========== BACKGROUND & PARTICLES ==========
  // Bucket the current local time into 'dawn' | 'day' | 'dusk' | 'night' using
  // real solar sunrise/sunset from the API. Falls back to clock hours
  // (5/8/17/20) if the API didn't return sunrise/sunset.
  function getTimeOfDay() {
    const norm = window.__PW_LAST_NORM;
    const parseIsoLocalMinutes = (iso) => {
      // API returns local-labelled ISO strings like "2026-04-15T06:23" (no tz). Read HH/MM directly.
      if (typeof iso !== 'string' || iso.length < 16) return null;
      const h = parseInt(iso.slice(11, 13), 10);
      const m = parseInt(iso.slice(14, 16), 10);
      return (Number.isFinite(h) && Number.isFinite(m)) ? h * 60 + m : null;
    };
    const sunriseMin = parseIsoLocalMinutes(norm?.sunrise);
    const sunsetMin  = parseIsoLocalMinutes(norm?.sunset);
    let timeOfDay;
    if (sunriseMin != null && sunsetMin != null && isNum(norm?.utcOffsetSeconds)) {
      const locMs = Date.now() + norm.utcOffsetSeconds * 1000;
      const locDate = new Date(locMs);
      const nowMin = locDate.getUTCHours() * 60 + locDate.getUTCMinutes();
      // Dawn: 45min before sunrise → 30min after. Dusk: 45min before sunset → 15min after.
      const dawnStart = sunriseMin - 45, dawnEnd = sunriseMin + 30;
      const duskStart = sunsetMin  - 45, duskEnd = sunsetMin  + 15;
      if (nowMin >= dawnStart && nowMin < dawnEnd)        timeOfDay = 'dawn';
      else if (nowMin >= dawnEnd && nowMin < duskStart)   timeOfDay = 'day';
      else if (nowMin >= duskStart && nowMin < duskEnd)   timeOfDay = 'dusk';
      else                                                timeOfDay = 'night';
      console.log(`[Solar TOD] now=${Math.floor(nowMin/60)}:${String(nowMin%60).padStart(2,'0')} sunrise=${Math.floor(sunriseMin/60)}:${String(sunriseMin%60).padStart(2,'0')} sunset=${Math.floor(sunsetMin/60)}:${String(sunsetMin%60).padStart(2,'0')} → ${timeOfDay}`);
    } else {
      const hour = getLocationHour(activePlace?.lon);
      timeOfDay = hour >= 5 && hour < 8 ? 'dawn' : hour >= 8 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'dusk' : 'night';
      console.log(`[Solar TOD] fallback to clock hours (no sunrise/sunset in norm) → ${timeOfDay}`);
    }
    return timeOfDay;
  }
  // Hero temperature range, forward-looking by time of day.
  //   dawn  → current temp → today's high   (directional, "warming to")
  //   day   → today's low / today's high    (range, existing behaviour)
  //   dusk  → current temp → tonight's low  (directional, "cooling to")
  //   night → tomorrow's low / tomorrow's high (range)
  function getHeroRange(norm, timeOfDay) {
    const hourly = Array.isArray(norm.hourly) ? norm.hourly : [];
    const localHour = Number.isInteger(norm.localHour) ? norm.localHour : null;
    const fallback = { low: norm.todayLow ?? null, high: norm.todayHigh ?? null, format: 'range' };

    if (timeOfDay === 'dawn') {
      return {
        low: norm.nowTemp ?? norm.todayLow ?? null,
        high: norm.todayHigh ?? null,
        format: 'directional'
      };
    }

    if (timeOfDay === 'dusk') {
      let tonightLow = null;
      if (localHour != null && hourly.length) {
        const sliceEnd = Math.min(localHour + 12, hourly.length);
        const temps = hourly.slice(localHour, sliceEnd).map(h => h?.tempC).filter(isNum);
        if (temps.length) tonightLow = Math.min(...temps);
      }
      if (tonightLow == null) tonightLow = norm.daily?.[1]?.lowC ?? norm.todayLow ?? null;
      return {
        low: tonightLow,
        high: norm.nowTemp ?? norm.todayHigh ?? null,
        format: 'directional'
      };
    }

    if (timeOfDay === 'night') {
      const tomorrow = norm.daily?.[1];
      if (tomorrow?.lowC != null && tomorrow?.highC != null) {
        return { low: tomorrow.lowC, high: tomorrow.highC, format: 'range' };
      }
      return fallback;
    }

    return fallback;
  }
  function setBackgroundFor(condition) {
    const base = 'assets/images/bg', aliasMap = { 'rain-possible': 'cloudy', 'uv': 'clear' };
    const folder = aliasMap[condition] || condition, fallbackFolder = condition === 'cold' ? 'cloudy' : 'clear';
    const timeOfDay = getTimeOfDay();
    const dayOfYear = getLocationDayOfYear();
    let imgFile;
    if (timeOfDay === 'day') {
      // 14-day cycle: day_1 through day_14
      // Sat always day_6 or day_13, Sun always day_7 or day_14
      const dayOfWeek = getLocationDayOfWeek(); // 0=Sun, 1=Mon...6=Sat
      const baseSlot = dayOfWeek === 0 ? 7 : dayOfWeek; // Mon=1...Sat=6, Sun=7
      const weekParity = Math.floor((dayOfYear - 1) / 7) % 2; // 0=week1, 1=week2
      const dayNum = baseSlot + (weekParity * 7); // 1-7 or 8-14
      imgFile = `day_${dayNum}`;
    } else {
      // Dawn/dusk/night: rotate through 3 options using day of year
      const slot = ((dayOfYear - 1) % 3) + 1; // 1, 2, or 3
      imgFile = `${timeOfDay}_${slot}`;
    }
    console.log(`[Image picker] Condition: ${condition}, Folder: ${folder}, Day of year: ${dayOfYear}, Time: ${timeOfDay}, Image: ${imgFile}.jpg`);
    if (bgImg) {
      bgImg.src = `${base}/${folder}/${imgFile}.jpg`;
      bgImg.onerror = () => { bgImg.src = `${base}/${folder}/day.jpg`; bgImg.onerror = () => { bgImg.src = `${base}/${fallbackFolder}/day.jpg`; bgImg.onerror = () => { bgImg.src = `${base}/default.jpg`; }; }; };
    }
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
      const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`, { headers: { 'User-Agent': 'howzit@probablyweather.co.za' }, signal: AbortSignal.timeout(5000) });
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
    // hourly is a 48-entry local-time array (0=midnight today … 47=23:00 tomorrow).
    // Slicing from 0 always grabbed midnight–3am — not "next 4 hours from now".
    // Start at the current local hour so the window genuinely reflects what's
    // about to happen. The 48-hour span gives natural wraparound into tomorrow.
    const localHour = Number.isInteger(payload?.meta?.localHour) ? payload.meta.localHour : null;
    const imminentHours = localHour != null ? hourly.slice(localHour, localHour + 4) : [];
    const imminentRainMax = imminentHours.length > 0 ? Math.max(...imminentHours.map(h => h.rainChance ?? 0)) : null;
    console.log(`[Imminent slice] localHour=${localHour} → next 4 hours rain max: ${imminentRainMax}%`);
    const displayRainPct = isNum(imminentRainMax) ? imminentRainMax : (today.rainChance ?? now.rainChance ?? null);
    const dailyRainPct = today.rainChance ?? now.rainChance ?? null;
    const rainLater = isNum(imminentRainMax) && imminentRainMax < 30 && isNum(dailyRainPct) && dailyRainPct >= 50;
    return { 
      nowTemp: now.tempC ?? null, feelsLike: now.feelsLikeC ?? null, todayHigh: today.highC ?? null, todayLow: today.lowC ?? null, 
      rainPct: displayRainPct, dailyRainPct: dailyRainPct, rainLater: rainLater,
      uv: now.uv ?? null,        // now.uv is null at night (API nulls it after sunset)
      uvDaily: today.uv ?? null, // today's peak UV, for daytime byline reference only
      isDay: now.isDay !== false, // false only when API explicitly says night
      sunrise: now.sunrise ?? null, // ISO string from Open-Meteo, local-labelled (no tz)
      sunset:  now.sunset  ?? null, // used for real solar-time dawn/dusk/night bucketing
      localHour: meta.localHour ?? null, // correct local hour from API (uses real UTC offset)
      utcOffsetSeconds: meta.utcOffsetSeconds ?? null, // UTC offset for location day-of-week calc
      windKph: isNum(payload.wind_kph) ? payload.wind_kph : (isNum(now.windKph) ? now.windKph : 0), 
      maxWindKph: isNum(payload.maxWindKph) ? payload.maxWindKph : null,
      gustKph: isNum(payload.gustKph) ? payload.gustKph : null,
      cloudPct: isNum(now.cloudPct) ? now.cloudPct : (Array.isArray(payload.hourly) && payload.hourly[0] ? payload.hourly[0].cloudPct ?? null : null),
      conditionKey: now.conditionKey || today.conditionKey || null, conditionLabel: now.conditionLabel || today.conditionLabel || '', 
      confidenceKey: payload.consensus?.confidenceKey || 'mixed', 
      used: sources.filter(s => s.ok).map(s => s.name), failed: sources.filter(s => !s.ok).map(s => s.name), 
      hourly: hourly, daily: payload.daily || [], locationName: payload.location?.name, sourceRanges: meta.sourceRanges || [],
      sourceConditions: meta.sourceConditions || [] // FIX-001: per-source condition votes
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

  // Share button (mobile only — Web Share API)
  const shareBtn = $('#shareBtn');
  if (shareBtn) {
    if (!navigator.share) {
      shareBtn.style.display = 'none';
    } else {
      shareBtn.addEventListener('click', async () => {
        const norm = window.__PW_LAST_NORM;
        const hi = norm?.todayHigh, low = norm?.todayLow;
        const hiStr = isNum(hi) ? formatTemp(hi) : '--°';
        const loStr = isNum(low) ? formatTemp(low) : '--°';
        const loc = locationEl?.textContent || '';
        const displayCond = window.__PW_LAST_DISPLAY || 'clear';
        const emoji = conditionEmoji(displayCond);
        const heroLabel = getHeroLabel(displayCond);
        const text = `Waarskynlik ${loStr}/${hiStr} in ${loc} — ${heroLabel} ${emoji}`;
        const lat = activePlace?.lat, lon = activePlace?.lon;
        const lang = settings.lang || 'en';
        const url = (lat && lon) ? `https://probablyweather.co.za?lat=${lat}&lon=${lon}&lang=${lang}` : 'https://probablyweather.co.za';
        try { await navigator.share({ title: 'Probably Weather', text, url }); } catch {}
      });
    }
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
    const currentTemp = norm.nowTemp, rain = norm.rainPct, wind = norm.windKph, uv = norm.uv;
    const displayCondition = computeHomeDisplayCondition(norm), hero = computeTodaysHero(norm);
    document.body.className = `weather-${displayCondition}`;
    let locationName = norm.locationName || activePlace?.name || 'South Africa'; safeText(locationEl, locationName);
    if (isPlaceholderName(locationName) && activePlace?.lat && activePlace?.lon) {
      const cp = activePlace; reverseGeocode(activePlace.lat, activePlace.lon).then(cn => { if (cn && cp === activePlace) { safeText(locationEl, cn); if (activePlace) activePlace.name = cn; if (homePlace && homePlace.lat === cp.lat && homePlace.lon === cp.lon) { homePlace.name = cn; saveJSON(STORAGE.home, homePlace); } } }).catch(() => {});
    }
    // BUG-3 fix: home screen shows min/max range as primary temp, not current temp.
    // Forward-looking: dawn = current → today's high, dusk = current → tonight's low,
    // night = tomorrow's range, day = today's low/high.
    const timeOfDay = getTimeOfDay();
    const { low, high, format } = getHeroRange(norm, timeOfDay);
    console.log(`[Hero range] timeOfDay=${timeOfDay} format=${format} low=${low} high=${high}`);
    const probablyLabel = t('weather', 'probably');
    const hiStr = isNum(high) ? formatTemp(high) : '--°';
    const loStr = isNum(low) ? formatTemp(low) : '--°';
    if (format === 'directional') {
      // dawn: current (low) → today's high. dusk: current (high) → tonight's low.
      const fromStr = (timeOfDay === 'dusk') ? hiStr : loStr;
      const toStr   = (timeOfDay === 'dusk') ? loStr : hiStr;
      safeText(tempEl, `${probablyLabel} ${fromStr} → ${toStr}`);
    } else {
      safeText(tempEl, `${probablyLabel} ${loStr} / ${hiStr}`);
    }
    const hiLoEl = $('#tempHiLo');
    if (hiLoEl) {
      // Show current temp below the range when toggle is on
      if (settings.range && isNum(currentTemp)) {
        hiLoEl.textContent = `${t('weather', 'feelsLike') || 'Now'} ${formatTemp(currentTemp)}`;
        hiLoEl.style.display = '';
      } else {
        hiLoEl.textContent = '';
        hiLoEl.style.display = 'none';
      }
    }
    // At night, override 'clear' copy so we don't say "Beach or braai?" at midnight.
    // Use real solar bucketing so dawn/dusk don't get mislabelled as night.
    // (timeOfDay was already computed earlier for the hero range — reuse it.)
    const displayConditionForCopy = (timeOfDay === 'night' && displayCondition === 'clear') ? 'night' : displayCondition;
    console.log('[Hero copy] timeOfDay:', timeOfDay, 'displayCondition:', displayCondition, 'forCopy:', displayConditionForCopy);
    safeText(headlineEl, getWittyLine(displayConditionForCopy));
    safeText(descriptionEl, getHeadline(displayConditionForCopy));
    console.log('[Layout] description:', descriptionEl?.textContent, 'headline:', headlineEl?.textContent);
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
  function getWeatherIcon(rp, cp, tc, isNight) {
    if (isNum(tc) && tc <= 0) return '❄️';
    if (isNum(rp) && rp >= 50) return '🌧️';
    if (isNum(rp) && rp >= 30) return '🌦️';
    if (isNum(tc) && tc >= 35) return '🔥';
    if (isNum(cp) && cp >= 70) return '☁️';
    if (isNum(cp) && cp >= 40) return '⛅';
    if (isNum(tc) && tc <= 10) return '❄️';
    // BUG-2 fix: show moon at night instead of sun for clear conditions
    return isNight ? '🌙' : '☀️';
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
      // BUG-2 fix: night hours (20:00-05:00) get moon icon instead of sun
      const isNightHour = hourNum >= 20 || hourNum < 5;
      const icon = getWeatherIcon(h.rainChance, h.cloudPct, iconTemp, isNightHour);
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
      const offsetMs = (window.__PW_LAST_NORM?.utcOffsetSeconds ?? 0) * 1000;
      const date = new Date(Date.now() + offsetMs + i * 86400000);
      const dayName = getTranslatedDayName(date.getUTCDay());
      const badge = getDayBadge(d, i, hourlyData);
      const iconTemp = isNum(d.lowC) && d.lowC <= 0 ? d.lowC : d.highC;
      // Daily entries don't have cloudPct from the API. Pass null so getWeatherIcon
      // falls back to rain + temp signals only — matches renderDayDetailSummary behaviour.
      const icon = getWeatherIcon(d.rainChance, null, iconTemp);
      const rainPct = isNum(d.rainChance) ? round0(d.rainChance) + '%' : '--';
      const highTempClass = getTempColorClass(d.highC);
      const lowTempClass = getTempColorClass(d.lowC);
      const div = document.createElement('div'); div.classList.add('daily-row', 'daily-row-tappable');
      div.dataset.dayIndex = String(i);
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', '0');
      div.innerHTML = `<span class="d-day">${dayName}${badge ? ` <span class="day-badge">${badge}</span>` : ''}</span><span class="d-icon">${icon}</span><span class="d-high ${highTempClass}">${isNum(d.highC) ? formatTemp(d.highC) : '--°'}</span><span class="d-low ${lowTempClass}">${isNum(d.lowC) ? formatTemp(d.lowC) : '--°'}</span><span class="d-rain">${rainPct}</span>`;
      div.addEventListener('click', () => {
        console.log(`[Day click] dayIndex=${i}`);
        showScreen(screenDayDetail);
        renderDayDetail(window.__PW_LAST_NORM, i);
      });
      div.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); div.click(); }
      });
      dailyCards.appendChild(div);
    });
  }
  function renderDayDetail(norm, dayIndex) {
    if (!norm) return;
    const day = norm.daily?.[dayIndex];
    if (!day) return;

    // Header: day name + date + condition + high/low.
    const offsetMs = (norm.utcOffsetSeconds ?? 0) * 1000;
    const date = new Date(Date.now() + offsetMs + dayIndex * 86400000);
    const dayName = getTranslatedDayName(date.getUTCDay());
    const dateStr = `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const hi = isNum(day.highC) ? formatTemp(day.highC) : '--°';
    const lo = isNum(day.lowC)  ? formatTemp(day.lowC)  : '--°';
    const cond = day.conditionLabel || '—';
    const headerName = $('#dayDetailDayName');
    const headerMeta = $('#dayDetailMeta');
    if (headerName) headerName.textContent = `${dayName} ${dateStr}`;
    if (headerMeta) headerMeta.textContent = `${cond} • ${lo} / ${hi}`;

    const content = $('#day-detail-content');
    if (!content) return;
    content.innerHTML = '';

    const hourly = Array.isArray(norm.hourly) ? norm.hourly : [];
    if (dayIndex === 0) {
      // Today: now → end of today only. Hourly slice is [localHour..24).
      const startHour = Number.isInteger(norm.localHour) ? norm.localHour : 0;
      renderDayDetailHourly(content, hourly.slice(startHour, 24), startHour);
    } else if (dayIndex === 1) {
      // Tomorrow: full day, hourly[24..48).
      renderDayDetailHourly(content, hourly.slice(24, 48), 0);
    } else {
      renderDayDetailSummary(content, day);
    }

    console.log(`[Day detail] dayIndex=${dayIndex} hourly=${dayIndex <= 1} day=${day.conditionLabel}`);
  }
  function renderDayDetailHourly(container, hourlySlice, startHour) {
    const header = document.createElement('div');
    header.classList.add('hourly-row', 'hourly-header');
    header.innerHTML = `<span class="h-time">${t('weather', 'time') || 'Time'}</span><span class="h-icon"></span><span class="h-temp">${t('weather', 'temp') || 'Temp'}</span><span class="h-rain">${t('weather', 'rain') || 'Rain'}</span><span class="h-wind">${t('weather', 'wind') || 'Wind'}</span><span class="h-uv">${t('weather', 'uv') || 'UV'}</span>`;
    container.appendChild(header);
    const currentWind = window.__PW_LAST_NORM?.windKph || null;
    hourlySlice.forEach((h, i) => {
      if (!h) return;
      const div = document.createElement('div'); div.classList.add('hourly-row');
      const hourNum = (startHour + i) % 24;
      const ht = settings.time === '12'
        ? `${hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum}${hourNum >= 12 ? 'pm' : 'am'}`
        : `${String(hourNum).padStart(2, '0')}:00`;
      const iconTemp = (isNum(h.feelsLikeC) && h.feelsLikeC < h.tempC) ? h.feelsLikeC : h.tempC;
      const isNightHour = hourNum >= 20 || hourNum < 5;
      const icon = getWeatherIcon(h.rainChance, h.cloudPct, iconTemp, isNightHour);
      const rainPct = isNum(h.rainChance) ? round0(h.rainChance) + '%' : '--';
      const rawWind = h.windKmh ?? h.windKph ?? h.wind_kph ?? (i < 3 ? currentWind : null);
      const windSpeed = isNum(rawWind) ? (settings.wind === 'mph' ? round0(rawWind * 0.621371) : round0(rawWind)) : '--';
      const tempClass = getTempColorClass(h.tempC);
      const uvVal = isNum(h.uv) ? round0(h.uv) : '--';
      const uvClass = isNum(h.uv) ? (h.uv >= 8 ? 'uv-extreme' : h.uv >= 6 ? 'uv-high' : h.uv >= 3 ? 'uv-mod' : '') : '';
      div.innerHTML = `<span class="h-time">${ht}</span><span class="h-icon">${icon}</span><span class="h-temp ${tempClass}">${isNum(h.tempC) ? formatTemp(h.tempC) : '--°'}</span><span class="h-rain">${rainPct}</span><span class="h-wind">${windSpeed}</span><span class="h-uv ${uvClass}">${uvVal}</span>`;
      container.appendChild(div);
    });
  }
  function renderDayDetailSummary(container, day) {
    const card = document.createElement('div');
    card.classList.add('day-detail-summary-card');
    const iconTemp = isNum(day.lowC) && day.lowC <= 0 ? day.lowC : day.highC;
    const icon = getWeatherIcon(day.rainChance, null, iconTemp);
    const cond = day.conditionLabel || '—';
    const hi = isNum(day.highC) ? formatTemp(day.highC) : '--°';
    const lo = isNum(day.lowC)  ? formatTemp(day.lowC)  : '--°';
    const hiClass = getTempColorClass(day.highC);
    const loClass = getTempColorClass(day.lowC);
    const rainPct = isNum(day.rainChance) ? round0(day.rainChance) + '%' : '--';
    const uvVal = isNum(day.uv) ? round0(day.uv) : '--';
    const uvClass = isNum(day.uv) ? (day.uv >= 8 ? 'uv-extreme' : day.uv >= 6 ? 'uv-high' : day.uv >= 3 ? 'uv-mod' : '') : '';
    const fmtTime = (iso) => {
      if (typeof iso !== 'string' || iso.length < 16) return '--';
      const h = parseInt(iso.slice(11, 13), 10);
      const m = parseInt(iso.slice(14, 16), 10);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return '--';
      if (settings.time === '12') {
        const hh12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${hh12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`;
      }
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    const sunrise = fmtTime(day.sunrise);
    const sunset  = fmtTime(day.sunset);
    const rainLabel = t('weather', 'rain') || 'Rain';
    const uvLabel = t('weather', 'uv') || 'UV';
    const sunriseLabel = t('weather', 'sunrise') || 'Sunrise';
    const sunsetLabel  = t('weather', 'sunset')  || 'Sunset';
    const disclaimer = t('weather', 'hourlySoon') || 'Hourly forecast appears 48 hours before this day.';
    card.innerHTML = `
      <div class="ds-headline">
        <span class="ds-icon">${icon}</span>
        <span class="ds-condition">${cond}</span>
      </div>
      <div class="ds-temps">
        <span class="ds-low ${loClass}">${lo}</span>
        <span class="ds-sep">/</span>
        <span class="ds-high ${hiClass}">${hi}</span>
      </div>
      <div class="ds-stats">
        <div class="ds-stat"><span class="ds-stat-label">${rainLabel}</span><span class="ds-stat-value">${rainPct}</span></div>
        <div class="ds-stat"><span class="ds-stat-label">${uvLabel}</span><span class="ds-stat-value ${uvClass}">${uvVal}</span></div>
        <div class="ds-stat"><span class="ds-stat-label">${sunriseLabel}</span><span class="ds-stat-value">${sunrise}</span></div>
        <div class="ds-stat"><span class="ds-stat-label">${sunsetLabel}</span><span class="ds-stat-value">${sunset}</span></div>
      </div>
      <div class="ds-disclaimer">${disclaimer}</div>
    `;
    container.appendChild(card);
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
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&addressdetails=1`, { headers: { 'User-Agent': 'howzit@probablyweather.co.za' }, signal: activeSearchController.signal });
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
  $('#dayDetailBack')?.addEventListener('click', () => showScreen(screenWeek));
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
  // FIX-4: Parse ?lang= URL parameter before loading settings
  // Shared links include ?lang=af so recipients see the sender's language
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get('lang');
  const SUPPORTED_LANGS = ['en', 'af', 'zu', 'xh', 'st'];
  if (urlLang && SUPPORTED_LANGS.includes(urlLang)) {
    saveJSON(SETTINGS_KEYS.lang, urlLang);
    console.log(`[FIX-4] Applied ?lang=${urlLang} from URL parameter`);
  }
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

