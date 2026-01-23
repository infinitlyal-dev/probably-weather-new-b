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

  const STORAGE = { favorites: "pw_favorites", recents: "pw_recents", home: "pw_home", location: "pw_location" };
  const SCREENS = [screenHome, screenHourly, screenWeek, screenSearch, screenSettings];
  const THRESH = { RAIN_PCT: 40, WIND_KPH: 25, COLD_C: 16, HOT_C: 32, RAIN_NONE: 10, RAIN_UNLIKELY: 30, RAIN_POSSIBLE: 55, UV_LOW: 3, UV_MODERATE: 6, UV_HIGH: 8, UV_VERY_HIGH: 11 };

  // ========== TRANSLATIONS ==========
  const TRANSLATIONS = {
    headlines: {
      storm: { en: "Storms rolling in.", af: "Storm op pad.", zu: "Isiphepho siyeza.", xh: "Isaqhwithi siyeza.", st: "Ledimo le a tla." },
      rain: { en: "Rain's here.", af: "Dit reën.", zu: "Imvula ikhona.", xh: "Imvula ikhona.", st: "Pula e a na." },
      'rain-possible': { en: "Might rain.", af: "Dalk reën.", zu: "Kungase line.", xh: "Mhlawumbi iya kuna.", st: "Mohlomong pula." },
      cloudy: { en: "Cloudy vibes.", af: "Bewolk vandag.", zu: "Kunamafu.", xh: "Linamafu.", st: "Maru a teng." },
      wind: { en: "Wind's up.", af: "Dis waai.", zu: "Umoya uyavunguza.", xh: "Umoya uvuthuza.", st: "Moea o a foka." },
      cold: { en: "It's chilly.", af: "Dis koud.", zu: "Kuyabanda.", xh: "Kuyabanda.", st: "Ho a bata." },
      heat: { en: "It's hot.", af: "Dis warm.", zu: "Kushisa.", xh: "Kushushu.", st: "Ho tjhesa." },
      uv: { en: "UV's hectic.", af: "UV is hoog.", zu: "I-UV iphezulu.", xh: "I-UV iphezulu.", st: "UV e hodimo." },
      fog: { en: "Foggy out there.", af: "Dis mistig.", zu: "Kunenkungu.", xh: "Linenkungula.", st: "Ho na le mohodi." },
      clear: { en: "Clear skies.", af: "Helder lug.", zu: "Izulu lihlanzekile.", xh: "Isibhakabhaka sihlanzekile.", st: "Lehodimo le hlakileng." }
    },
    wittyLines: {
      storm: {
        en: ["Jislaaik, stay inside!", "Thunder's grumbling, hey.", "Not even the taxi's running.", "Eskom wishes it had this power.", "Cancel everything, seriously.", "Even the hadedas are quiet."],
        af: ["Jinne, bly binne!", "Die donder dreun.", "Selfs die taxi ry nie.", "Eskom wens hy het hierdie krag.", "Kanselleer alles, ernstig.", "Selfs die hadedas is stil."],
        zu: ["Yoh, hlala ngaphakathi!", "Izulu liyaduma.", "Ngisho netekisi alikho.", "U-Eskom ufisa ukuba namandla anje.", "Khansela konke, ngempela.", "Ngisho ama-hadeda athule."],
        xh: ["Yhuu, hlala ngaphakathi!", "Iindudumo ziyagquma.", "Akukho neeteksi ezihambayo.", "U-Eskom unqwenela la mandla.", "Rhoxisa yonke into.", "Neentak zithe cwaka."],
        st: ["Eish, dula ka hare!", "Ledimo le a duma.", "Esita le taxi ha e tsamae.", "Eskom e ka rata matla ana.", "Hlakola tsohle, ka nnete.", "Esita le dinonyana di kgutsitse."]
      },
      rain: {
        en: ["Grab your brolly, boet.", "Spat spat on the roof.", "The garden's saying dankie.", "Traffic's about to be chaos.", "The dams are smiling.", "Stay dry out there."],
        af: ["Vat jou sambreel.", "Dit plas op die dak.", "Die tuin sê dankie.", "Verkeer gaan chaos wees.", "Die damme glimlag.", "Bly droog daar buite."],
        zu: ["Thatha isambulela sakho.", "Imvula iyashaya ophahleni.", "Ingadi ithi ngiyabonga.", "Ithrafikhi izoba yinhlekelele.", "Amadamu ayamamatheka.", "Hlala womile."],
        xh: ["Thatha isambreli sakho.", "Imvula ibetha eluphahleni.", "Igadi ithi enkosi.", "Ithrafiki iza kuba yingxwaba-ngxwaba.", "Amadama ayancuma.", "Hlala uwomile."],
        st: ["Nka sampolela sa hao.", "Pula e otla marulelong.", "Jarata e re kea leboha.", "Sephethephethe se tla ba moferefere.", "Matamo a a bososela.", "Dula o omile."]
      },
      'rain-possible': {
        en: ["Maybe rain, maybe not.", "Clouds looking suspicious.", "Take a brolly just in case.", "50/50 on getting wet."],
        af: ["Miskien reën, miskien nie.", "Wolke lyk verdag.", "Vat 'n sambreel net vir ingeval.", "50/50 kans om nat te word."],
        zu: ["Mhlawumbe imvula, mhlawumbe cha.", "Amafu abukeka esolisa.", "Thatha isambulela uma kungenzeka.", "50/50 ukuba manzi."],
        xh: ["Mhlawumbi imvula, mhlawumbi hayi.", "Amafu abonakala erhanela.", "Thatha isambreli ukuba kunokwenzeka.", "50/50 ukufumana amanzi."],
        st: ["Mohlomong pula, mohlomong che.", "Maru a shebahala a belaela.", "Nka sampolela ho ba sireletsehile.", "50/50 ho ba metsi."]
      },
      cloudy: {
        en: ["Grey skies, no drama.", "Overcast but okay.", "Good day for a walk.", "The sun's taking a nap."],
        af: ["Grys lug, geen drama.", "Bewolk maar okay.", "Goeie dag vir 'n stap.", "Die son vat 'n nap."],
        zu: ["Isibhakabhaka esimpunga, akukho drama.", "Kunamafu kodwa kulungile.", "Usuku oluhle lokuhamba.", "Ilanga lithatha ikhefana."],
        xh: ["Isibhakabhaka esingwevu, akukho drama.", "Linamafu kodwa kulungile.", "Imini entle yokuhamba.", "Ilanga lithatha isaphulelo."],
        st: ["Lehodimo le leiutsu, ha ho drama.", "Ho na le maru empa ho lokile.", "Letsatsi le letle la ho tsamaea.", "Letsatsi le nka boroko."]
      },
      uv: {
        en: ["Sunscreen is not optional.", "SPF 50 or regret it.", "The sun's not playing.", "Seek shade, my friend.", "Protect that face!"],
        af: ["Sonbrand room is nie opsioneel nie.", "SPF 50 of jy sal spyt wees.", "Die son speel nie.", "Soek skaduwee, my vriend.", "Beskerm daai gesig!"],
        zu: ["Isivikelo selanga asikhona ukukhetha.", "I-SPF 50 noma uzozisola.", "Ilanga alidlali.", "Funa umthunzi, mngane wami.", "Vikela ubuso bakho!"],
        xh: ["Ikhrimu yelanga ayinakukhethwa.", "I-SPF 50 okanye uya kuzisola.", "Ilanga alidlali.", "Funa umthunzi, mhlobo wam.", "Khusela elo buso!"],
        st: ["Setofo sa letsatsi ha se kgetho.", "SPF 50 kapa o tla itshola.", "Letsatsi ha le bapale.", "Batla moriti, motsoalle oa ka.", "Sireletsa sefahleho seo!"]
      },
      wind: {
        en: ["Hold onto your hat!", "The southeaster's here.", "Table Mountain's tablecloth is out.", "Doors will slam today.", "The Cape Doctor is in.", "Perfect for drying washing!"],
        af: ["Hou jou hoed vas!", "Die suidooster is hier.", "Tafelberg se tafeldoek is uit.", "Deure gaan klap vandag.", "Die Kaapse Dokter is in.", "Perfek om wasgoed te droog!"],
        zu: ["Bamba isigqoko sakho!", "Umoya waseningizimu ukhona.", "Indwangu yeTafel Mountain iphumile.", "Iminyango izoshayeka namuhla.", "UDokotela waseKapa ukhona.", "Kuhle ukuomisa izingubo!"],
        xh: ["Bamba umnqwazi wakho!", "Umoya wasemzantsi ulapha.", "Ilaphu leTable Mountain liphumile.", "Iminyango iza kubetha namhlanje.", "UGqirha waseKapa ulapha.", "Ilungile ukuomisa impahla!"],
        st: ["Tšoara katiba ea hao!", "Moea oa boroa o teng.", "Lesela la Table Mountain le tšoeu.", "Menyako e tla otla kajeno.", "Ngaka ea Cape e teng.", "Ho lokile ho omisa diaparo!"]
      },
      cold: {
        en: ["Ja, it's jersey weather.", "Time to find that beanie.", "Cold enough for soup.", "Hot chocolate kind of day.", "Layer up, buttercup."],
        af: ["Ja, dis truiweer.", "Tyd om daai beanie te vind.", "Koud genoeg vir sop.", "Warm sjokolade tipe dag.", "Trek lae aan, buttercup."],
        zu: ["Yebo, yisikhathi sejezi.", "Isikhathi sokuthola i-beanie.", "Kubanda ngokwanele kwesobho.", "Usuku lweshokoledi eshisayo.", "Gqoka izingubo eziningi."],
        xh: ["Ewe, lixesha lejezi.", "Ixesha lokufumana loo beanie.", "Kuyabanda ngokwaneleyo kwesuphu.", "Uhlobo lwemini lwetshokolethi eshushu.", "Faka iingubo ezininzi."],
        st: ["E, ke leholimo la jersey.", "Nako ea ho fumana beanie eo.", "Ho bata ho lekana le soupa.", "Letsatsi la tšokolate e chesang.", "Apara liaparo tse ngata."]
      },
      heat: {
        en: ["Jislaaik, it's hot!", "Melting is a real possibility.", "Ice cream is a necessity.", "Shorts and slops only.", "Stay hydrated, boet.", "The pool is calling.", "Hotter than a bakkie bonnet."],
        af: ["Jinne, dis warm!", "Smelt is 'n werklike moontlikheid.", "Roomys is 'n noodsaaklikheid.", "Net kortbroeke en slops.", "Bly gehidreer, boet.", "Die swembad roep.", "Warmer as 'n bakkie bonnet."],
        zu: ["Yoh, kushisa!", "Ukuncibilika kungenzeka ngempela.", "I-ice cream iyadingeka.", "Amabhulukwe amafushane kuphela.", "Hlala unamanzi, boet.", "Ipulazi liyabiza.", "Kushisa ukudlula ibhonnethi yebakkie."],
        xh: ["Yhuu, kushushu!", "Ukuqina kunokwenzeka.", "I-ice cream iyafuneka.", "Iibhulukhwe ezimfutshane kuphela.", "Hlala unamanzi, boet.", "Ipuli iyabiza.", "Kushushu ngaphezu kwebhonethi yebakkie."],
        st: ["Eish, ho tjhesa!", "Ho qhibiliha ho ka etsahala.", "Ice cream ke tlhoko.", "Feela borikhoe bo bokgutshoane.", "Dula o na le metsi, boet.", "Pool e a bitsa.", "Ho tjhesa ho feta bonete ea bakkie."]
      },
      fog: {
        en: ["Can't see a thing, hey.", "Driving slow is the vibe.", "Mysterious morning.", "Watch out for the other cars."],
        af: ["Kan niks sien nie, hey.", "Stadig ry is die vibe.", "Geheimsinnige oggend.", "Kyk uit vir die ander karre."],
        zu: ["Angiboni lutho, hey.", "Ukushayela kancane kuyinto.", "Ukusa okuyimfihlakalo.", "Qaphela ezinye izimoto."],
        xh: ["Andiboni nto, hey.", "Ukuqhuba kancinci yinto.", "Ukusa okuyimfihlakalo.", "Lumka ezinye iimoto."],
        st: ["Ha ke bone letho, hey.", "Ho khanna butle ke mokhoa.", "Hoseng ho nang le sephiri.", "Hlokomela dikoloi tse ding."]
      },
      clear: {
        en: ["Absolutely beautiful out there.", "Perfect day, no excuses.", "Get outside and enjoy it!", "Blue skies and good vibes.", "This is why we live here.", "Not a cloud in sight.", "Main character weather."],
        af: ["Absoluut pragtig daar buite.", "Perfekte dag, geen verskonings nie.", "Gaan buitentoe en geniet dit!", "Blou lug en goeie vibes.", "Dis hoekom ons hier bly.", "Nie 'n wolk in sig nie.", "Hoofkarakter weer."],
        zu: ["Kuhle kakhulu ngaphandle.", "Usuku oluphelele, akukho zaba.", "Phuma phandle ujabulele!", "Isibhakabhaka esiluhlaza nemizwa emihle.", "Yingakho sihlala lapha.", "Akukho lifu elibonwayo.", "Isimo sezulu somlingiswa omkhulu."],
        xh: ["Kuhle kakhulu ngaphandle.", "Imini egqibeleleyo, akukho zaba.", "Phuma phandle wonwabele!", "Isibhakabhaka esiluhlaza nemibono emihle.", "Yiyo le nto sihlala apha.", "Akukho lifu elibonwayo.", "Imozulu yomlinganiswa ophambili."],
        st: ["Ho motle haholo kantle.", "Letsatsi le phethahetseng, ha ho mabaka.", "Tsamaea kantle o natefeloe!", "Lehodimo le letala le meea e metle.", "Ke kahoo re lulang mona.", "Ha ho leru le bonahalang.", "Leholimo la molingoa oa mantlha."]
      },
      weekend: {
        en: ["Braai weather, boet!", "Fire up the Weber!", "Perfect for a jol outside.", "Get the tongs ready!", "Beach or braai? Both!", "The ancestors approve."],
        af: ["Braaiweer, boet!", "Maak die Weber aan!", "Perfek vir 'n jol buite.", "Kry die tang gereed!", "Strand of braai? Albei!", "Die voorouers keur goed."],
        zu: ["Izulu lokosa, boet!", "Basa i-Weber!", "Kuhle ukujabulela ngaphandle.", "Lungisa ama-tong!", "Ibhishi noma ukosa? Kokubili!", "Okhokho bayavuma."],
        xh: ["Imozulu yokugrila, boet!", "Basa i-Weber!", "Ilungele ukonwabela ngaphandle.", "Lungisa ii-tong!", "Ibhitshi okanye ukugrila? Zombini!", "Ooyihlomkhulu bayavuma."],
        st: ["Leholimo la braai, boet!", "Chesa Weber!", "E lokile ho ithabisa kantle.", "Lokisetsa ditong!", "Lebopo kapa braai? Ka bobedi!", "Baholo-holo ba ea lumela."]
      }
    },
    ui: {
      todaysHero: { en: "Today's Hero:", af: "Vandag se Held:", zu: "Iqhawe Lanamuhla:", xh: "Iqhawe Lanamhlanje:", st: "Mohale oa Kajeno:" },
      heroLabels: {
        storm: { en: "Severe weather", af: "Erge weer", zu: "Isimo sezulu esibi", xh: "Imozulu embi", st: "Leholimo le lebe" },
        rain: { en: "Wet conditions", af: "Nat toestande", zu: "Izimo ezimanzi", xh: "Iimeko ezimanzi", st: "Maemo a metsi" },
        'rain-possible': { en: "Possible showers", af: "Moontlike buie", zu: "Imvula engenzeka", xh: "Imvula enokubakho", st: "Lipula tse ka bang teng" },
        wind: { en: "Gusty winds", af: "Sterk wind", zu: "Umoya onamandla", xh: "Imimoya enamandla", st: "Meea e matla" },
        cold: { en: "Chilly", af: "Koud", zu: "Kubanda", xh: "Kubanda", st: "Ho bata" },
        heat: { en: "Very hot", af: "Baie warm", zu: "Kushisa kakhulu", xh: "Kushushu kakhulu", st: "Ho tjhesa haholo" },
        uv: { en: "High UV", af: "Hoë UV", zu: "I-UV ephezulu", xh: "I-UV ephezulu", st: "UV e phahameng" },
        fog: { en: "Low visibility", af: "Lae sigbaarheid", zu: "Ukubonakala okuphansi", xh: "Ukubonakala okuphantsi", st: "Pono e tlase" },
        clear: { en: "Pleasant", af: "Aangenaam", zu: "Kumnandi", xh: "Kumnandi", st: "Ho monate" }
      }
    }
  };

  // ========== STATE ==========
  let activePlace = null, homePlace = null, lastPayload = null, manageMode = false;
  window.__PW_LAST_NORM = null;
  let state = { city: "Cape Town" };
  const pendingFavMeta = new Set();
  const SETTINGS_KEYS = { temp: 'units.temp', wind: 'units.wind', range: 'display.range', time: 'format.time', lang: 'lang' };
  const DEFAULT_SETTINGS = { temp: 'C', wind: 'kmh', range: false, time: '24', lang: 'en' };
  let settings = { ...DEFAULT_SETTINGS };

  // ========== UTILITIES ==========
  const safeText = (el, txt) => { if (el) el.textContent = txt ?? "--"; };
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  const round0 = (n) => isNum(n) ? Math.round(n) : null;
  const round1 = (n) => isNum(n) ? Math.round(n * 10) / 10 : null;
  const loadJSON = (key, fallback) => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; } };
  const saveJSON = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };
  const samePlace = (a, b) => a && b && Number(a.lat).toFixed(4) === Number(b.lat).toFixed(4) && Number(a.lon).toFixed(4) === Number(b.lon).toFixed(4);
  const favoriteKey = (p) => `${Number(p.lat).toFixed(4)},${Number(p.lon).toFixed(4)}`;
  const isPlaceholderName = (name) => { const v = String(name || '').trim(); return !v || /^unknown\b/i.test(v) || /^my location\b/i.test(v); };
  const escapeHtml = (s) => String(s ?? "").replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  function conditionEmoji(key) {
    switch (String(key || '').toLowerCase()) {
      case 'storm': return '⛈️'; case 'rain': return '🌧️'; case 'wind': return '💨'; case 'cold': return '❄️';
      case 'heat': return '🔥'; case 'fog': return '🌫️'; case 'clear': return '☀️'; default: return '⛅';
    }
  }

  function loadSettings() {
    settings = { temp: loadJSON(SETTINGS_KEYS.temp, DEFAULT_SETTINGS.temp), wind: loadJSON(SETTINGS_KEYS.wind, DEFAULT_SETTINGS.wind),
      range: loadJSON(SETTINGS_KEYS.range, DEFAULT_SETTINGS.range), time: loadJSON(SETTINGS_KEYS.time, DEFAULT_SETTINGS.time), lang: loadJSON(SETTINGS_KEYS.lang, DEFAULT_SETTINGS.lang) };
  }
  function saveSettings() {
    saveJSON(SETTINGS_KEYS.temp, settings.temp); saveJSON(SETTINGS_KEYS.wind, settings.wind);
    saveJSON(SETTINGS_KEYS.range, settings.range); saveJSON(SETTINGS_KEYS.time, settings.time); saveJSON(SETTINGS_KEYS.lang, settings.lang);
  }
  const convertTemp = (c) => !isNum(c) ? null : settings.temp === 'F' ? (c * 9 / 5) + 32 : c;
  const formatTemp = (c) => { const v = convertTemp(c); return isNum(v) ? `${round0(v)}°` : '--°'; };
  const formatWind = (kph) => !isNum(kph) ? '--' : settings.wind === 'mph' ? `${round0(kph * 0.621371)} mph` : `${round0(kph)} km/h`;

  function showScreen(which) {
    SCREENS.forEach(s => { if (s) { s.classList.add("hidden"); s.setAttribute('hidden', ''); } });
    if (which) { which.classList.remove("hidden"); which.removeAttribute('hidden'); }
    document.body.classList.toggle('modal-open', which && which !== screenHome);
    if (saveCurrent) saveCurrent.style.display = which === screenHome ? '' : 'none';
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = which === screenHome ? '' : 'none';
  }
  const showLoader = (show) => { if (loader) loader.classList[show ? 'remove' : 'add']('hidden'); };
  function showToast(message, duration = 3000) {
    if (!toast) return; toast.textContent = message; toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
  }

  // ========== WEATHER LOGIC ==========
  function computeSkyCondition(norm) {
    const condKey = (norm.conditionKey || '').toLowerCase(), rain = norm.rainPct, cloudPct = Array.isArray(norm.hourly) && norm.hourly[0]?.cloudPct;
    if (condKey === 'storm' || condKey.includes('thunder')) return 'storm';
    if (condKey === 'fog' || condKey.includes('mist') || condKey.includes('haze')) return 'fog';
    if (isNum(rain) && rain >= 50) return 'rain';
    if (isNum(rain) && rain >= 30) return 'rain-possible';
    if ((isNum(cloudPct) && cloudPct >= 60) || condKey.includes('cloud') || condKey.includes('overcast')) return 'cloudy';
    return 'clear';
  }
  function computeTodaysHero(norm) {
    const condKey = (norm.conditionKey || '').toLowerCase(), rain = norm.rainPct, wind = norm.windKph, hi = norm.todayHigh, uv = norm.uv;
    if (condKey === 'storm' || condKey.includes('thunder')) return 'storm';
    if (isNum(rain) && rain >= 50) return 'rain';
    if (isNum(rain) && rain >= 30) return 'rain';
    if (isNum(wind) && wind >= 20) return 'wind';
    if (isNum(hi) && hi >= THRESH.HOT_C) return 'heat';
    if (isNum(hi) && hi <= 10) return 'cold';
    if (isNum(uv) && uv >= 8) return 'uv';
    if (isNum(hi) && hi <= THRESH.COLD_C) return 'cold';
    return 'clear';
  }
  function computeHomeDisplayCondition(norm) { const hero = computeTodaysHero(norm), sky = computeSkyCondition(norm); return hero !== 'clear' ? hero : sky; }

  // ========== TRANSLATED TEXT ==========
  function getHeadline(condition) {
    const lang = settings.lang || 'en', headlines = TRANSLATIONS.headlines[condition];
    return headlines?.[lang] || headlines?.en || "Clear skies.";
  }
  function getHeroLabel(condition) {
    const lang = settings.lang || 'en', labels = TRANSLATIONS.ui.heroLabels[condition];
    return labels?.[lang] || labels?.en || "Pleasant";
  }
  function getWittyLine(condition, rainPct, maxC) {
    const lang = settings.lang || 'en', day = new Date().getDay(), isWeekend = day === 0 || day === 5 || day === 6;
    if (isWeekend && (condition === 'clear' || condition === 'heat')) {
      const wl = TRANSLATIONS.wittyLines.weekend[lang] || TRANSLATIONS.wittyLines.weekend.en;
      return wl[Math.floor(Math.random() * wl.length)];
    }
    const lines = TRANSLATIONS.wittyLines[condition];
    const opts = lines?.[lang] || lines?.en || TRANSLATIONS.wittyLines.clear.en;
    return opts[Math.floor(Math.random() * opts.length)];
  }

  // ========== BACKGROUND & PARTICLES ==========
  function setBackgroundFor(condition) {
    const base = 'assets/images/bg', aliasMap = { 'rain-possible': 'cloudy', 'uv': 'clear' };
    const folder = aliasMap[condition] || condition, fallbackFolder = condition === 'cold' ? 'cloudy' : 'clear';
    const hour = new Date().getHours();
    const timeOfDay = hour >= 5 && hour < 8 ? 'dawn' : hour >= 8 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'dusk' : 'night';
    if (bgImg) {
      bgImg.src = `${base}/${folder}/${timeOfDay}.jpg`;
      bgImg.onerror = () => { bgImg.src = `${base}/${folder}/day.jpg`; bgImg.onerror = () => { bgImg.src = `${base}/${fallbackFolder}/day.jpg`; }; };
    }
  }
  function createParticles(condition, count = 20) {
    if (!particlesEl) return; particlesEl.innerHTML = '';
    let particleClass = null, amount = count;
    if (condition === 'rain' || condition === 'storm') { particleClass = 'rain'; amount = 28; }
    else if (condition === 'cold') { particleClass = 'snow'; amount = 18; }
    else if (condition === 'wind') { particleClass = 'wind'; amount = 16; }
    if (!particleClass) return;
    for (let i = 0; i < amount; i++) {
      const p = document.createElement('div'); p.classList.add('particle', particleClass);
      p.style.left = `${Math.random() * 100}%`; p.style.animationDelay = `${Math.random() * 2}s`; p.style.animationDuration = `${Math.random() * 3 + 2}s`;
      particlesEl.appendChild(p);
    }
  }

  // ========== API ==========
  async function reverseGeocode(lat, lon) {
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`, { headers: { 'User-Agent': 'ProbablyWeather/1.0' }, signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return null;
      const data = await resp.json();
      const city = data.address?.suburb || data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || 'Unknown Location';
      return data.address?.country ? `${city}, ${data.address.country}` : city;
    } catch { return null; }
  }
  async function resolvePlaceName(place) {
    if (!place || !isNum(place.lat) || !isNum(place.lon)) return place?.name || 'Unknown';
    if (!isPlaceholderName(place.name)) return place.name;
    return await reverseGeocode(place.lat, place.lon) || place.name || 'Unknown';
  }
  async function fetchProbable(place) {
    const url = `/api/weather?lat=${encodeURIComponent(place.lat)}&lon=${encodeURIComponent(place.lon)}&name=${encodeURIComponent(place.name || '')}`;
    const resp = await fetch(url); if (!resp.ok) throw new Error('API error'); return await resp.json();
  }
  function normalizePayload(payload) {
    const now = payload.now || {}, today = payload.daily?.[0] || {}, meta = payload.meta || {}, sources = meta.sources || [];
    return { nowTemp: now.tempC ?? null, feelsLike: now.feelsLikeC ?? null, todayHigh: today.highC ?? null, todayLow: today.lowC ?? null,
      rainPct: today.rainChance ?? now.rainChance ?? null, uv: today.uv ?? null, windKph: isNum(payload.wind_kph) ? payload.wind_kph : (isNum(now.windKph) ? now.windKph : 0),
      conditionKey: now.conditionKey || today.conditionKey || null, conditionLabel: now.conditionLabel || today.conditionLabel || 'Weather today',
      confidenceKey: payload.consensus?.confidenceKey || 'mixed', used: sources.filter(s => s.ok).map(s => s.name), failed: sources.filter(s => !s.ok).map(s => s.name),
      hourly: payload.hourly || [], daily: payload.daily || [], locationName: payload.location?.name, sourceRanges: meta.sourceRanges || [] };
  }

  // ========== RENDER ==========
  function renderLoading(name) { showLoader(true); safeText(locationEl, name); safeText(headlineEl, 'Loading...'); safeText(tempEl, '--°'); safeText(descriptionEl, '—'); safeText(extremeValueEl, '--'); }
  function renderError(msg) { showLoader(false); safeText(headlineEl, 'Error'); safeText(descriptionEl, msg); }
  function renderSidebar(norm, heroOverride) {
    if (!norm && window.__PW_LAST_NORM) norm = window.__PW_LAST_NORM; if (!norm) return;
    const hero = heroOverride || window.__PW_LAST_HERO || computeTodaysHero(norm), lang = settings.lang || 'en';
    safeText(extremeLabelEl, TRANSLATIONS.ui.todaysHero[lang] || TRANSLATIONS.ui.todaysHero.en);
    safeText(extremeValueEl, getHeroLabel(hero));
    const sr = norm.sourceRanges || [];
    if (sr.length > 0) { safeText($('#confidenceValue'), sr.filter(s => isNum(s.minTemp) && isNum(s.maxTemp)).map(s => `${s.name}: ${round0(s.minTemp)}°-${round0(s.maxTemp)}°`).join('\n') || '--'); }
    else { safeText($('#confidenceValue'), { strong: 'Strong', decent: 'Decent', mixed: 'Mixed' }[norm.confidenceKey] || 'Mixed'); }
  }
  function renderHome(norm) {
    showLoader(false);
    const hi = norm.todayHigh, low = norm.todayLow, rain = norm.rainPct, wind = norm.windKph, uv = norm.uv;
    const displayCondition = computeHomeDisplayCondition(norm), hero = computeTodaysHero(norm);
    document.body.className = `weather-${displayCondition}`;
    let locationName = norm.locationName || activePlace?.name || 'My Location';
    safeText(locationEl, locationName);
    if (locationName === 'My Location' && activePlace?.lat && activePlace?.lon) {
      const cp = activePlace;
      reverseGeocode(activePlace.lat, activePlace.lon).then(cn => {
        if (cn && cp === activePlace) { safeText(locationEl, cn); if (activePlace) activePlace.name = cn;
          if (homePlace && homePlace.lat === cp.lat && homePlace.lon === cp.lon) { homePlace.name = cn; saveJSON(STORAGE.home, homePlace); }
        }
      }).catch(() => {});
    }
    safeText(headlineEl, getHeadline(displayCondition));
    safeText(tempEl, `${isNum(low) ? formatTemp(low) : '--°'} – ${isNum(hi) ? formatTemp(hi) : '--°'}`);
    safeText(descriptionEl, getWittyLine(displayCondition, rain, hi));
    const bylineEl = $('#weatherByline');
    if (bylineEl) {
      const ws = isNum(wind) ? formatWind(wind) : '--';
      const rs = isNum(rain) ? (rain < 10 ? 'None' : rain < 30 ? 'Unlikely' : rain < 55 ? 'Possible' : 'Likely') : '--';
      const us = isNum(uv) ? (uv < 3 ? 'Low' : uv < 6 ? 'Moderate' : uv < 8 ? 'High' : 'Very High') + ` (${round0(uv)})` : '--';
      bylineEl.innerHTML = `Wind ${ws} • Rain ${rs} • UV ${us}`;
    }
    const hc = ['hero-storm', 'hero-rain', 'hero-heat', 'hero-cold', 'hero-wind', 'hero-uv', 'hero-clear', 'hero-cloudy', 'hero-fog'];
    [headlineEl, tempEl, descriptionEl].forEach(el => { if (el) { el.classList.remove(...hc); el.classList.add('hero-' + displayCondition); } });
    window.__PW_LAST_DISPLAY = displayCondition; window.__PW_LAST_HERO = hero;
    renderSidebar(norm, hero); setBackgroundFor(displayCondition); createParticles(displayCondition);
  }
  function getWeatherIcon(rp, cp, tc) {
    if (isNum(rp) && rp >= 50) return '🌧️'; if (isNum(rp) && rp >= 30) return '🌦️';
    if (isNum(cp) && cp >= 70) return '☁️'; if (isNum(cp) && cp >= 40) return '⛅';
    if (isNum(tc) && tc >= 30) return '🔥'; if (isNum(tc) && tc <= 5) return '❄️'; return '☀️';
  }
  function renderHourly(hourly) {
    if (!hourlyTimeline) return; hourlyTimeline.innerHTML = '';
    hourly.slice(0, 24).forEach((h, i) => {
      const div = document.createElement('div'); div.classList.add('hourly-card');
      const ht = h.timeLocal || new Date(Date.now() + i * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: settings.time === '12' });
      div.innerHTML = `<div class="hour-time"><span class="weather-icon">${getWeatherIcon(h.rainChance, h.cloudPct, h.tempC)}</span>${ht}</div><div class="hour-temp">${formatTemp(h.tempC)}</div><div class="hour-detail"><span class="detail-value">${isNum(h.rainChance) ? round0(h.rainChance) + '%' : '--%'}</span></div>`;
      hourlyTimeline.appendChild(div);
    });
  }
  function computeDayHero(d) {
    const r = d.rainChance, u = d.uv, h = d.highC;
    if (isNum(r) && r >= 50) return 'Rainy'; if (isNum(r) && r >= 30) return 'Showers';
    if (isNum(u) && u >= 8) return 'High UV'; if (isNum(h) && h >= THRESH.HOT_C) return 'Hot';
    if (isNum(h) && h <= 10) return 'Cold'; if (isNum(u) && u >= 6) return 'UV Alert'; return '';
  }
  function renderWeek(daily) {
    if (!dailyCards) return; dailyCards.innerHTML = '';
    daily.forEach((d, i) => {
      const dn = d.dayLabel || new Date(Date.now() + i * 86400000).toLocaleDateString('en-US', { weekday: 'short' });
      const dh = computeDayHero(d), icon = getWeatherIcon(d.rainChance, d.cloudPct, d.highC);
      const div = document.createElement('div'); div.classList.add('daily-card');
      div.innerHTML = `<div class="day-name"><span class="weather-icon">${icon}</span>${dn}</div><div class="day-temp">${isNum(d.highC) ? formatTemp(d.highC) : '--°'}</div><div class="day-temp" style="font-size:0.8rem;opacity:0.7;">${isNum(d.lowC) ? formatTemp(d.lowC) : '--°'}</div>${dh ? `<div class="day-hero">${dh}</div>` : ''}<div class="day-detail"><span class="detail-label">Rain</span><span class="detail-value">${isNum(d.rainChance) ? round0(d.rainChance) + '%' : '--%'}</span></div>`;
      dailyCards.appendChild(div);
    });
  }
  function applySettings() {
    if (unitsTempSelect) unitsTempSelect.value = settings.temp;
    if (unitsWindSelect) unitsWindSelect.value = settings.wind;
    if (probRangeToggle) probRangeToggle.checked = !!settings.range;
    if (timeFormatSelect) timeFormatSelect.value = settings.time;
    if (languageSelect) languageSelect.value = settings.lang;
    if (lastPayload) { const norm = normalizePayload(lastPayload); window.__PW_LAST_NORM = norm; renderHome(norm); renderHourly(norm.hourly); renderWeek(norm.daily); }
  }
  async function loadAndRender(place) {
    activePlace = place; renderLoading(place.name || 'My Location');
    try { const payload = await fetchProbable(place); lastPayload = payload; const norm = normalizePayload(payload); window.__PW_LAST_NORM = norm; renderHome(norm); renderHourly(norm.hourly); renderWeek(norm.daily); }
    catch (e) { console.error("Load failed:", e); renderError("Couldn't fetch weather right now."); }
  }

  // ========== FAVORITES & RECENTS ==========
  const loadFavorites = () => loadJSON(STORAGE.favorites, []);
  const loadRecents = () => loadJSON(STORAGE.recents, []);
  const saveFavorites = (list) => saveJSON(STORAGE.favorites, list);
  const saveRecents = (list) => saveJSON(STORAGE.recents, list);

  function clearRecents() { localStorage.removeItem(STORAGE.recents); renderRecents(); }
  async function addFavorite(place) {
    let list = loadFavorites();
    if (list.some(p => samePlace(p, place))) { showToast('Already saved!'); return; }
    if (list.length >= 5) { showToast('Max 5 places. Remove one first.'); return; }
    const rn = await resolvePlaceName(place);
    list.unshift({ ...place, name: rn }); saveFavorites(list.slice(0, 5)); renderFavorites(); showToast(`Saved ${place.name}!`);
  }
  async function addRecentIfNew(place) {
    const favs = loadFavorites(); if (favs.some(p => samePlace(p, place))) return;
    const existing = loadRecents(); if (existing.some(p => samePlace(p, place))) return;
    const rn = await resolvePlaceName(place);
    saveRecents([{ ...place, name: rn }, ...existing.filter(p => !samePlace(p, { ...place, name: rn }))].slice(0, 20)); renderRecents();
  }
  async function toggleFavorite(place) {
    let list = loadFavorites();
    if (list.some(p => samePlace(p, place))) { list = list.filter(p => !samePlace(p, place)); saveFavorites(list); renderFavorites(); showToast('Removed'); return; }
    await addFavorite(place);
  }
  async function ensureFavoriteMeta(place) {
    if (!place || !isNum(place.lat) || !isNum(place.lon) || (isNum(place.tempC) && place.conditionKey)) return;
    const key = favoriteKey(place); if (pendingFavMeta.has(key)) return; pendingFavMeta.add(key);
    try { const payload = await fetchProbable(place); const norm = normalizePayload(payload); const list = loadFavorites(); const idx = list.findIndex(p => samePlace(p, place));
      if (idx !== -1) { list[idx] = { ...list[idx], tempC: norm.nowTemp ?? null, conditionKey: norm.conditionKey ?? null }; saveFavorites(list); renderFavorites(); }
    } catch {} finally { pendingFavMeta.delete(key); }
  }
  function renderRecents() {
    if (!recentList) return; const list = loadRecents();
    recentList.innerHTML = list.map(p => `<li class="recent-item" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)}</li>`).join('') || '<li style="opacity:0.6;cursor:default;">No recent searches yet.</li>';
    recentList.querySelectorAll('li[data-lat]').forEach(li => {
      li.addEventListener('click', () => { showScreen(screenHome); loadAndRender({ name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon) }); });
    });
  }
  function renderFavorites() {
    if (!favoritesList) return; const list = loadFavorites();
    const fl = document.getElementById('favLimit'); if (fl) fl.style.display = list.length >= 5 ? 'block' : 'none';
    favoritesList.innerHTML = list.map(p => {
      const temp = isNum(p.tempC) ? formatTemp(p.tempC) : '--°';
      const rb = manageMode ? `<button class="remove-fav" data-lat="${p.lat}" data-lon="${p.lon}">✕</button>` : '';
      return `<li class="favorite-item" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}"><button class="fav-star" data-lat="${p.lat}" data-lon="${p.lon}">★</button><span class="fav-name">${escapeHtml(p.name)}</span><span class="fav-temp">${temp}</span>${rb}</li>`;
    }).join('') || '<li style="opacity:0.6;cursor:default;">No saved places yet.</li>';
    favoritesList.querySelectorAll('li[data-lat] .fav-name').forEach(span => {
      span.addEventListener('click', () => { const li = span.closest('li'); showScreen(screenHome); loadAndRender({ name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon) }); });
    });
    favoritesList.querySelectorAll('.fav-star').forEach(btn => {
      btn.addEventListener('click', async (e) => { e.stopPropagation(); await toggleFavorite({ name: btn.closest('li')?.dataset?.name, lat: parseFloat(btn.dataset.lat), lon: parseFloat(btn.dataset.lon) }); });
    });
    favoritesList.querySelectorAll('.remove-fav').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); let list = loadFavorites(); list = list.filter(p => !samePlace(p, { lat: parseFloat(btn.dataset.lat), lon: parseFloat(btn.dataset.lon) })); saveFavorites(list); renderFavorites(); showToast('Removed'); });
    });
    list.forEach(p => ensureFavoriteMeta(p));
  }

  // ========== SEARCH ==========
  let searchTimeout = null, searchResults = [], activeSearchController = null, searchSeq = 0;
  const searchMiniCache = new Map();
  function parseQuery(raw) {
    const parts = raw.trim().split(/\s+/), last = parts[parts.length - 1];
    const cm = { us: 'us', usa: 'us', uk: 'gb', britain: 'gb', uae: 'ae', sa: 'za', southafrica: 'za' };
    const lk = last?.toLowerCase().replace(/[.,]/g, '');
    const cc = cm[lk] || (lk && lk.length === 2 ? lk : null);
    return { baseQuery: cc ? parts.slice(0, -1).join(' ') : raw.trim(), countryCode: cc };
  }
  async function runSearch(query) {
    if (!query || query.length < 2) { renderSearchResults([]); return; }
    const thisSeq = ++searchSeq; if (activeSearchController) activeSearchController.abort(); activeSearchController = new AbortController();
    const { baseQuery, countryCode } = parseQuery(query);
    try {
      let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(baseQuery)}&limit=8&addressdetails=1`;
      if (countryCode) url += `&countrycodes=${countryCode}`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'ProbablyWeather/1.0' }, signal: activeSearchController.signal });
      if (thisSeq !== searchSeq || !resp.ok) return;
      searchResults = (await resp.json()).map(r => ({ name: r.display_name?.split(',')[0] || 'Unknown', fullName: r.display_name, lat: r.lat, lon: r.lon, address: r.address }));
      renderSearchResults(searchResults);
    } catch (e) { if (e.name !== 'AbortError') console.error('Search error:', e); }
  }
  function formatSearchResult(r) { const a = r.address || {}; const city = a.city || a.town || a.village || r.name; return a.country ? `${city}, ${a.country}` : city; }
  async function miniFetchTemp(lat, lon) {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`; if (searchMiniCache.has(key)) return searchMiniCache.get(key);
    try { const norm = normalizePayload(await fetchProbable({ lat, lon, name: '' })); const r = { temp: formatTemp(norm.nowTemp), icon: conditionEmoji(norm.conditionKey) }; searchMiniCache.set(key, r); return r; } catch { return { temp: '--°', icon: '⛅' }; }
  }
  function renderSearchResults(results) {
    const rl = document.getElementById('searchResults') || (() => { const ul = document.createElement('ul'); ul.id = 'searchResults'; ul.className = 'search-results'; document.querySelector('.search-body')?.prepend(ul); return ul; })();
    if (!results.length) { rl.innerHTML = ''; return; }
    const favs = loadFavorites();
    rl.innerHTML = results.map(r => {
      const fn = escapeHtml(formatSearchResult(r)), isFav = favs.some(p => samePlace(p, { lat: parseFloat(r.lat), lon: parseFloat(r.lon) }));
      return `<li class="search-result-item" data-lat="${r.lat}" data-lon="${r.lon}" data-name="${fn}"><button class="fav-star${isFav ? ' is-fav' : ''}" data-lat="${r.lat}" data-lon="${r.lon}">${isFav ? '★' : '☆'}</button><span class="result-icon">⛅</span><span class="result-name">${fn}</span><span class="result-temp">--°</span></li>`;
    }).join('');
    rl.querySelectorAll('li[data-lat]').forEach(li => {
      li.addEventListener('click', async (e) => { if (e.target.closest('.fav-star')) return; const place = { name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon) }; showScreen(screenHome); loadAndRender(place); if (searchInput) searchInput.value = ''; rl.innerHTML = ''; addRecentIfNew(place).catch(() => {}); });
    });
    rl.querySelectorAll('.fav-star').forEach(btn => {
      btn.addEventListener('click', async (e) => { e.stopPropagation(); await toggleFavorite({ name: btn.closest('li')?.dataset?.name, lat: parseFloat(btn.dataset.lat), lon: parseFloat(btn.dataset.lon) }); renderSearchResults(results); });
    });
    rl.querySelectorAll('li[data-lat]').forEach(async (li) => { const mini = await miniFetchTemp(parseFloat(li.dataset.lat), parseFloat(li.dataset.lon)); const ie = li.querySelector('.result-icon'), te = li.querySelector('.result-temp'); if (ie) ie.textContent = mini.icon || '⛅'; if (te) te.textContent = mini.temp || '--°'; });
  }
  if (searchInput) searchInput.addEventListener('input', (e) => { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => runSearch(e.target.value), 300); });

  // ========== NAV & EVENTS ==========
  navHome?.addEventListener('click', () => { showScreen(screenHome); if (homePlace) loadAndRender(homePlace); });
  navHourly?.addEventListener('click', () => showScreen(screenHourly));
  navWeek?.addEventListener('click', () => showScreen(screenWeek));
  navSearch?.addEventListener('click', () => { showScreen(screenSearch); renderRecents(); renderFavorites(); });
  navSettings?.addEventListener('click', () => showScreen(screenSettings));
  unitsTempSelect?.addEventListener('change', () => { settings.temp = unitsTempSelect.value; saveSettings(); applySettings(); });
  unitsWindSelect?.addEventListener('change', () => { settings.wind = unitsWindSelect.value; saveSettings(); applySettings(); });
  probRangeToggle?.addEventListener('change', () => { settings.range = !!probRangeToggle.checked; saveSettings(); applySettings(); });
  timeFormatSelect?.addEventListener('change', () => { settings.time = timeFormatSelect.value; saveSettings(); applySettings(); });
  languageSelect?.addEventListener('change', () => { settings.lang = languageSelect.value; saveSettings(); applySettings(); });
  saveCurrent?.addEventListener('click', () => { if (activePlace) addFavorite(activePlace); });
  searchCancel?.addEventListener('click', () => { showScreen(screenHome); if (searchInput) searchInput.value = ''; });
  manageFavorites?.addEventListener('click', () => { if (loadFavorites().length === 0) { showToast('No saved places'); return; } manageMode = !manageMode; manageFavorites.textContent = manageMode ? 'Done' : 'Manage'; renderFavorites(); });
  clearRecentsBtn?.addEventListener('click', () => { clearRecents(); showToast('Cleared'); });

  // ========== INIT ==========
  renderRecents(); renderFavorites(); loadSettings(); applySettings();
  homePlace = loadJSON(STORAGE.home, null);
  const savedLoc = loadJSON(STORAGE.location, null);
  if (homePlace) { showScreen(screenHome); loadAndRender(homePlace); }
  else if (savedLoc?.lat && savedLoc?.lon) { homePlace = { name: savedLoc.city && savedLoc.countryCode ? `${savedLoc.city}, ${savedLoc.countryCode}` : (savedLoc.city || "My Location"), lat: savedLoc.lat, lon: savedLoc.lon }; saveJSON(STORAGE.home, homePlace); showScreen(screenHome); loadAndRender(homePlace); }
  else { showScreen(screenHome); renderLoading("My Location");
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = round1(pos.coords.latitude), lon = round1(pos.coords.longitude);
        try { const rev = await fetch(`/api/weather?reverse=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`); const data = await rev.json();
          const city = data?.city || "My Location", cc = data?.countryCode || null;
          saveJSON(STORAGE.location, { city, countryCode: cc, lat, lon }); homePlace = { name: cc ? `${city}, ${cc}` : city, lat, lon }; saveJSON(STORAGE.home, homePlace); loadAndRender(homePlace);
        } catch { homePlace = { name: "My Location", lat, lon }; saveJSON(STORAGE.home, homePlace); loadAndRender(homePlace); }
      }, () => { homePlace = { name: "Cape Town", lat: -33.9249, lon: 18.4241 }; saveJSON(STORAGE.home, homePlace); loadAndRender(homePlace); }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
    } else { homePlace = { name: "Cape Town", lat: -33.9249, lon: 18.4241 }; saveJSON(STORAGE.home, homePlace); loadAndRender(homePlace); }
  }
});
