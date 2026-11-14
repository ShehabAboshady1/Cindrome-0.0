// services/engine/scoring.js
import { themeKeywords, TMDB_THEME_IDS, TMDB_GENRE_IDS } from "./constants.js";
import { getSimilarityScore } from "./textHelper.js";

export const scoreAndRank = (
  candidates,
  parsedIntent,
  userProfileStats = {},
  anchorTitles = null,
  userReviewsCount = 0,
) => {
  // Normalize reference anchor titles parameter to support a single string or an array of titles
  const normalizedAnchorList = (
    Array.isArray(anchorTitles)
      ? anchorTitles
      : anchorTitles
        ? [anchorTitles]
        : parsedIntent.anchorTitles ||
          parsedIntent.extractedReferenceTitles ||
          []
  )
    .filter(Boolean)
    .map((t) => String(t).trim());

  const requestedActors = (
    Array.isArray(parsedIntent?.actors)
      ? parsedIntent.actors
      : Array.isArray(parsedIntent?.extractedActors)
        ? parsedIntent.extractedActors
        : parsedIntent?.extractedActor
          ? [parsedIntent.extractedActor]
          : []
  )
    .filter(Boolean)
    .map((a) => String(a).toLowerCase().trim());

  const sportsRegex =
    /\b(sport|sports|football|soccer|basketball|baseball|tennis|athlete|athletics|coach|champion|championship|tournament|olympic|olympics|stadium|pitch|wrestler|wrestling|boxer|boxing|quarterback|touchdown|nfl|fifa|premier\s*league|world\s*cup|gridiron|super\s*bowl|underdog\s*athlete|nascar|formula\s*1|f1|motorsport|swimming|swimmer|grand\s*prix|le\s*mans|speedway)\b/i;

  const superheroRegex =
    /\b(superhero|superheroes|super\s*hero|super\s*heroes|superpower|superpowers|super\s*human|mutant|mutants|marvel|dc\s*comics|comic\s*book|avengers|batman|superman|iron\s*man|thor|captain\s*america|spider[- ]man|spiderman|x-men|wolverine|deadpool|guardians\s*of\s*the\s*galaxy|justice\s*league|justice\s*society|wonder\s*woman|flash|aquaman|black\s*panther|doctor\s*strange|thanos|infinity\s*war|endgame|gotham|dark\s*knight|man\s*of\s*steel|shazam|ant-man|daredevil|punisher|venom|hulk|peacemaker|the\s*boys|invincible|homelander|green\s*lantern|suicide\s*squad)\b/i;

  const timeTravelRegex =
    /\b(time travel|time-travel|time loop|time-loop|timelines?|space-time|wormhole|temporal|time machine|grandfather paradox|butterfly effect|quantum leap|alternate timeline|travel back in time|travel to the past|travel to the future|relativity|time dilation|delorean|marty mcfly|predestination|looper|twelve monkeys|tenet|donnie darko|coherence|primer|about time|butterfly effect|source code)\b/i;

  const twistRegex =
    /\b(plot twists?|twist ending|unexpected twist|shocking twist|crazy plot twists?|twists?|mind-bending|mind bending|secrets?|deception|conspiracy|illusion|simulation|reality|subconscious|hallucination|puzzle|mind game|unreliable narrator|amnesia|identity twist|double life|unpredictable|can'?t predict|mind[- ]blowing)\b/i;

  const explicitMagicRegex =
    /\b(magic|magical|sorcery|sorcerer|sorceress|witch|witches|witchcraft|wizard|wizards|mage|mages|spell|spells|grimoire|alchemist|alchemy|mana|caster|servant|holy grail|homunculus|magic user|black magic|arcane|necromancer|grimoires|magical girl|madoka|fate\/zero|overlord)\b/i;

  const nonMagicTitanOrNotebookRegex =
    /\b(titan|titans|colossal|survey corps|wall maria|eren yeager|death note|shinigami|light yagami|ryuk|notebook)\b/i;

  const crowdHorrorRegex =
    /\b(jump scare|slasher|paranormal|haunted house|demon|possession|curse|ghost|creature|cabin in the woods|killer|masked killer|evil dead|scream|insidious|talk to me|conjuring|quiet place|smile|sinister|it\b|m3gan|lights out|ouija|annabelle|nun|barbarian|terrifier|don't breathe|hereditary|black phone|get out|us\b|saw\b|final destination|cabin)\b/i;

  const iconicCrowdHorrorTitles =
    /\b(the conjuring|talk to me|scream|insidious|evil dead|a quiet place|smile|barbarian|sinister|it\b|don't breathe|the black phone|lights out|hereditary|m3gan|annabelle|the nun|terrifier|get out|us\b)\b/i;

  const hauntedHorrorMasterpiecesRegex =
    /\b(the conjuring|the conjuring 2|insidious|hereditary|sinister|the haunting in connecticut|poltergeist|the amityville horror|amityville|the others|paranormal activity|ouija|lights out|annabelle|the nun|talk to me|barbarian|the babadook|babadook|the shining|the grudge|the ring|house on haunted hill|the orphanage|woman in black|evil dead rise|the haunting of hill house|hill house|bly manor)\b/i;

  const hauntedHorrorThemesRegex =
    /\b(haunted house|cursed house|haunted family|cursed family|possession|demonic possession|demon|demons|evil spirit|evil presence|paranormal|supernatural|curse|exorcism|poltergeist|ghost|ghosts|creepy house|old house|entity|haunting)\b/i;

  const darkComedyMasterpiecesRegex =
    /\b(in bruges|fargo|parasite|the menu|knives out|glass onion|jojo rabbit|three billboards|the banshees of inisherin|snatch|lock, stock|pulp fiction|burn after reading|dr\. strangelove|american psycho|the wolf of wall street|birdman|the lobster|the favourite|poor things|kiss kiss bang bang|the nice guys|seven psychopaths|thank you for smoking|heathers|withnail and i|death of stalin|the death of stalin|triangle of sadness|wild tales|barry|succession|fargo|the white lotus|beef|Atlanta|fleabag|bojack horseman)\b/i;

  const darkComedyThemesRegex =
    /\b(dark comedy|black comedy|morbid humor|dark humor|satire|satirical|cynical|macabre|deadpan|absurd|twisted humor|gallows humor|murder|hitman|hitmen|crime|dysfunctional)\b/i;

  const explicitHeistRobberyRegex =
    /\b(heist|robbery|bank robbery|bank heist|plan a robbery|big robbery|vault|safe crack|safecracker|caper|getaway driver|steal money|ocean's eleven|ocean's twelve|ocean's thirteen|the town|baby driver|inside man|heat|the italian job|den of thieves|logan lucky|reservoir dogs|point break|now you see me|snatch|lock, stock|tower heist|the score|rififi|dog day afternoon|fast five|inception|money heist|armored)\b/i;

  const revengeOrPureMafiaRegex =
    /\b(equalizer|the equalizer|john wick|taken|revenge|vigilante|death wish|hitman|assassin|man on fire|law abiding citizen|sicario|peppermint|wrath of man)\b/i;

  const crimeFamilyMasterpiecesRegex =
    /\b(the godfather|the godfather part ii|the godfather: part ii|godfather|scarface|goodfellas|american gangster|the irishman|casino|the departed|a bronx tale|donnie brasco|once upon a time in america|peaky blinders|boardwalk empire|the sopranos|blow|gotti|snatch|gangs of new york|road to perdition|miller's crossing|narcos|city of god|black mass|the untouchables|carlito's way)\b/i;

  const crimeFamilyThemesRegex =
    /\b(crime family|mob family|mafia family|mafia empire|crime empire|building an empire|organized crime|gangster empire|godfather|corleone|mobster|gangster|kingpin|drug lord|criminal empire|underworld|syndicate|cartel|boss of bosses|don\b)\b/i;

  const mindBlowingActionHitsRegex =
    /\b(inception|the matrix|the matrix reloaded|matrix|edge of tomorrow|tenet|mad max: fury road|mad max fury road|terminator 2|terminator 2: judgment day|t2|minority report|interstellar|avatar|everything everywhere all at once|looper|upgrade|source code|v for vendetta|district 9|children of men|aliens|blade runner 2049|oldboy|dune|dune: part two|dune part two)\b/i;

  const mindBlowingActionThemesRegex =
    /\b(high concept|dream within a dream|simulation|virtual reality|time loop|reality|subconscious|mind-bending|dystopian future|apocalyptic road|quantum|manipulation of time|parallel universe|time paradox|cyberspace)\b/i;

  const bMovieTrashRegex =
    /\b(iron sky|virtuosity|sharknado|mega shark|transmorphers|age of tomorrow|alien vs hunter|titanic ii|the ritual killer|ritual killer)\b/i;

  const pureComedyHitsRegex =
    /\b(superbad|the hangover|21 jump street|22 jump street|tropic thunder|trading places|step brothers|we're the millers|bridesmaids|game night|horrible bosses|anchorman|dumb and dumber|liar liar|meet the parents|borat|old school|wedding crashers|ted\b|ted 2|good boys|blockers|tag\b|this is the end|zombieland|shaun of the dead|hot fuzz|the dictator|white chicks|rush hour|bad boys|groundhog day|airplane!|monty python)\b/i;

  const kidsComedyMascotRegex =
    /\b(sonic|sonic the hedgehog|minions|despicable me|alvin and the chipmunks|smurfs|paddington|spongebob|sponge bob|pokemon|detective pikachu|lego|garfield|peter rabbit|space jam|men in black|ghostbusters|shazam|ant-man|deadpool|marvel|dc comics)\b/i;

  const darkAnimeMasterpiecesRegex =
    /\b(attack on titan|death note|monster|berserk|tokyo ghoul|chainsaw man|vinland saga|parasyte|dororo|hellsing|psycho-pass|made in abyss|neon genesis evangelion|devilman crybaby|shinsekai yori|claymore|ergo proxy|texhnolyze|bungo stray dogs|bungou stray dogs|death parade|shiki|another|higurashi|shinigami|light yagami|johan liebert|dark gathering)\b/i;

  const lightOrEcchiFantasyAnimeRegex =
    /\b(the seven deadly sins|nanatsu no taizai|fairy tail|konosuba|black clover|danmachi|is it wrong to try to pick up girls|quintessential quintuplets|gotoubun no hanayome|my next life as a villainess|hamefura|no game no life|sword art online|welcome to demon school|radiant|seven deadly sins|rent-a-girlfriend|kanojo okarishimasu)\b/i;

  const iconicComfortShows =
    /\b(friends|the office|brooklyn nine-nine|brooklyn 99|modern family|how i met your mother|himym|parks and recreation|parks & rec|seinfeld|community|the big bang theory|malcolm in the middle|schitt's creek|new girl|scrubs|that '70s show|ted lasso|superstore|it's always sunny in philadelphia|arrested development|silicon valley|two and a half men|frasier|cheers|will & grace|curb your enthusiasm|broad city)\b/i;

  const teenOrKidsSportsTelenovelaRegex =
    /\b(o11ce|once\b|violetta|soy luna|patito feo|casi angeles|victorious|icarly|hannah montana|zoey 101|big time rush|disney channel|disney xd|nickelodeon|teen sitcom|tween|high school musical|saved by the bell|suite life|wizards of waverly place|sam & cat|henry danger|good luck charlie|shake it up|austin & ally|kc undercover|liv and maddie|teen drama|adolescence|high school football|youth academy)\b/i;

  const psychologicalMasterpiecesRegex =
    /\b(shutter island|fight club|prisoners|memento|se7en|seven|black swan|the prestige|zodiac|primal fear|the machinist|enemy|gone girl|the game|split|nightcrawler|the sixth sense|jacob's ladder|cure|identity|triangle|coherence|oldboy|mulholland drive|taxi driver|vertigo|misery|the silence of the lambs)\b/i;

  const psychologicalThemesRegex =
    /\b(psychological thriller|paranoia|delusion|sanity|insanity|hallucination|asylum|mental institution|amnesia|unreliable narrator|mind game|mind games|schizophrenia|obsession|psychosis|investigator|detective|dark secret|manipulation|gaslighting)\b/i;

  const slasherOrCheapHorrorRegex =
    /\b(slasher|masked killer|high school massacre|teen slasher|gorefest|chainsaw|splatter|cannibal|there's someone inside your house)\b/i;

  const feelGoodRomComRegex =
    /\b(romantic comedy|rom-com|romcom|feel-good|feel good|sweet|lighthearted|heartwarming|wedding|dating|fake dating|crush|falling in love|meet cute|matchmaker|vacation romance|love triangle|charming|crazy rich asians|about time|palm springs|set it up|the proposal|10 things i hate about you|clueless|notting hill|when harry met sally|how to lose a guy in 10 days|always be my maybe|50 first dates|hitch|crazy, stupid, love|friends with benefits|she's the man|easy a|to all the boys|pretty woman|mamma mia|legally blonde|love, simon|love simon|love, rosie|love rosie|anyone but you|the holiday|bridget jones|letters to juliet|27 dresses)\b/i;

  const tragicOrDepressingRomanceRegex =
    /\b(concentration camp|holocaust|world war|nazi|fascist|execution|terminal illness|cancer|dying|death|tragedy|tragic ending|bittersweet|melancholy|heartbreaking|depression|suicide|vietnam war|segregation|disability|life is beautiful|forrest gump|la la land|atonement|me before you|the fault in our stars|a walk to remember|brokeback mountain|requiem for a dream|titanic)\b/i;

  const darkOrExperimentalRomanceRegex =
    /\b(dark comedy|black comedy|morbid|surreal|surrealist|bizarre|experimental|arthouse|grotesque|frankenstein|reanimation|corpse|sex experiment|sexual awakening|fetish|prostitution|weird|quirky indie|yorgos lanthimos|wes anderson|poor things|the lobster|the favourite|moonrise kingdom|the grand budapest hotel|dogtooth|killing of a sacred deer|bones and all|beau is afraid)\b/i;

  const historicalWarRegex =
    /\b(war|world war|wwii|ww2|wwi|battle|battles|huge battles|epic battles|soldier|soldiers|army|infantry|combat|trenches|normandy|d-day|vietnam|crusade|crusades|crusaders|gladiator|gladiators|roman empire|medieval|kingdom|samurai|spartan|spartans|ancient warfare|saving private ryan|kingdom of heaven|braveheart|1917|dunkirk|hacksaw ridge|apocalypse now|platoon|full metal jacket|black hawk down|fury|the patriot|troy|300|master and commander|letters from iwo jima|bridge on the river kwai|all quiet on the western front|enemy at the gates|the bridge on the river kwai|paths of glory|the thin red line|midway|we were soldiers)\b/i;

  const swordWarfareThemesRegex =
    /\b(sword|swords|sword fight|blade|spear|shield|gladiator|gladiators|roman empire|ancient rome|ancient greece|spartan|spartans|crusade|crusades|crusaders|medieval|medieval warfare|knights|samurai|katana|feudal japan|kingdom|castle siege|chariot|arrow|arrows|bow|armor|broadsword|ancient warfare|ancient battles?|medieval armies|braveheart|troy|300|the last samurai|kingdom of heaven|the northman|the king|outlaw king|centurion|the eagle|red cliff|baahubali|alexander|spartacus|vikings|the last kingdom|vinland saga)\b/i;

  const modernWarfareOrCrimeRegex =
    /\b(world war|wwii|ww2|wwi|vietnam|nazi|hitler|pearl harbor|hacksaw ridge|unbroken|bridge on the river kwai|saving private ryan|dunkirk|1917|fury|platoon|full metal jacket|apocalypse now|black hawk down|enemy at the gates|machine gun|rifle|guns?|pistol|bullet|bullets|trench|trenches|normandy|d-day|air force|submarine|torpedo|bomber|tank|tanks|firearms|sniper|grenade|holocaust|all quiet on the western front|john wick|training day|equalizer|sicario|narcotics|lapd|police officer|detective|fbi|cia|swat|cartel|drug lord|mafia|gangster|hitman|assassin|car chase|heist|pirates of the caribbean|jack sparrow)\b/i;

  const trueCrimeDocRegex =
    /\b(documentary|docuseries|docu-series|true crime|investigative|real-life|archival|interviews?|unsolved mysteries|making a murderer|don't f\*\*k with cats|the jinx|night stalker|conversations with a killer|ted bundy|the staircase|wild wild country|keep sweet|tinder swindler|serial killer|homicide|cold case|forensic|fbi file|investigation discovery|murder trial|killer inside|evil genius|i am a killer|worst roommate ever|the act of killing|capturing the friedmans|paradise lost|the thin blue line)\b/i;

  const scienceNatureDocRegex =
    /\b(cosmos|astronomy|outer space|universe|planet earth|one strange rock|our planet|blue planet|wildlife|nature|animals?|ocean|oceans|earth|solar system|paleontology|dinosaur|climate|geology|evolution|space exploration|species|safari|national geographic|discovery channel|physics|quantum|biology)\b/i;

  const koreanTwistMasterpiecesRegex =
    /\b(signal|flower of evil|beyond evil|mouse|stranger|blind|tunnel|through the darkness|voice|save me|memorist|365: repeat the year|kairos|the guest|life on mars|nine: nine time travels|reset|the glory|extracurricular|squid game|mask girl)\b/i;

  const koreanThrillerThemesRegex =
    /\b(detective|police|serial killer|murder|investigation|corruption|revenge|conspiracy|crime syndicate|psychopath|unsolved case|prosecutor|courtroom|dark secret|suspense|thriller|mystery|hostage|twisted|plot twist|unpredictable)\b/i;

  const cuteRomComAnimeHitsRegex =
    /\b(kaguya-sama|love is war|horimiya|kimi ni todoke|my dress-up darling|toradora|the dangers in my heart|komi can't communicate|fruits basket|rascal does not dream|maid-sama|ouran|teasing master takagi|skip and loafer|tomo-chan|yamada-kun to lv999|bocchi the rock|wotakoi|tsuki ga kirei|my love story!!|ore monogatari|lovely complex|clannad|tamako love story|relife|nisekoi|romantic killer|golden time|saekano|tonikaku kawaii|fly me to the moon|pseudo harem|a sign of affection|blue box|aharen-san|shikimori's not just a cutie|angel next door spoils me rotten|my happy marriage)\b/i;

  const cuteRomComAnimeThemesRegex =
    /\b(high school romance|first love|falling in love|wholesome|sweet romance|cute|crush|confession|school life|slice of life|heartwarming|friendship and romance|romantic comedy|shy|awkward romance)\b/i;

  const ecchiOrAdultAnimeRegex =
    /\b(high school dxd|dxd|ecchi|harem|fanservice|fan service|hentai|erotic|borderline porn|kiss x sis|to love-ru|to love ru|monster musume|prison school|interspecies reviewers|yosuga no sora|shinmai maou|redo of healer|seikon no qwaser|valkyrie drive|queen's blade|shimoneta|testament of sister new devil|sekirei|freezing|heaven's lost property|rosario \+ vampire|ikkitousen|maken-ki|trinity seven|hybrid x heart|hundred\b|infinite stratos|date a live|danmachi|is it wrong to try to pick up girls in a dungeon|arrow of the orion|quintessential quintuplets|gotoubun no hanayome|my next life as a villainess|all routes lead to doom|hamefura|rent-a-girlfriend|kanojo okarishimasu|girlfriend, girlfriend|kanojo mo kanojo|domestic girlfriend|scum's wish|food wars|shokugeki no soma|fire force|goblin slayer|mushoku tensei|no game no life|sword art online|how not to summon a demon lord|arifureta|strike the blood|chivalry of a failed knight|the asterisk war|saekano)\b/i;

  const kidsMascotAnimeRegex =
    /\b(doraemon|beyblade|pokemon|pokémon|digimon|yu-gi-oh|yugioh|duel monsters|bakugan|yo-kai watch|inazuma eleven|crayon shin-chan|shin chan|anpanman|chibi maruko-chan|hamtaro|precure|pretty cure|aikatsu|pripara|sonic x|medabots|duel masters|zatch bell|keroro|astro boy|hunter x hunter)\b/i;

  const pureSportsAnimeRegex =
    /\b(haikyuu?|kuroko|blue lock|slam dunk|hajime no ippo|diamond no ace|free!|run with the wind|aoashi|captain tsubasa|yowamushi pedal|ping pong the animation)\b/i;

  const retroDatedAnimeRegex =
    /\b(ranma|urusei yatsura|maison ikkoku|kimagure orange road|city hunter|fist of the north star|touch\b)\b/i;

  const familyAnimationHitsRegex =
    /\b(coco|inside out|encanto|moana|zootopia|paddington|paddington 2|despicable me|toy story|finding nemo|finding dory|shrek|ratatouille|up\b|tangled|the incredibles|monsters, inc\.|monsters inc|how to train your dragon|frozen|sing\b|kung fu panda|madagascar|wall-e|spider-man: into the spider-verse|megamind|the lion king|beauty and the beast|aladdin|luca|soul\b|turning red|big hero 6|onward|tarzan|mulan)\b/i;

  const familyAnimationThemesRegex =
    /\b(family|friendship|heartwarming|wholesome|magical|cozy|adventure|parents|children|kids|journey|disney|pixar|dreamworks|illumination)\b/i;

  const cyberpunkHitsRegex =
    /\b(blade runner|blade runner 2049|ghost in the shell|akira|the matrix|dredd|upgrade|alita|alita: battle angel|cyberpunk|cyberpunk: edgerunners|robocop|total recall|minority report|altered carbon|ex machina|dark city|elysium|chappie|i am mother|i, robot|neuromancer|demolition man|johnny mnemonic|tron|tron: legacy|strange days|a\.i\. artificial intelligence|equilibrium|terminator|automata|district 9)\b/i;

  const cyberpunkThemesRegex =
    /\b(cyberpunk|dystopia|dystopian|cybernetic|cyborg|cyborgs|android|androids|robot|robots|replicants?|futuristic city|neon|neon lights|ruined future|post-apocalyptic|high-tech low-life|megacorporation|virtual reality|simulation|artificial intelligence|ai consciousness|cyber warfare|cyberspace|cyber crime|future noir|neo-tokyo|los angeles 2049|apocalyptic future)\b/i;

  const spaceOrTimeTravelRegex =
    /\b(space exploration|astronaut|astronauts|nasa|deep space|black hole|mars\b|the martian|interstellar|apollo|spacecraft|orbit|jupiter|saturn|alien planet|space station|galaxy|star wars|back to the future|delorean|time machine|time travel|galactic)\b/i;

  const crowdPleaserComedyRegex =
    /\b(brooklyn nine-nine|the office|modern family|parks and recreation|we're the millers|superbad|the hangover|21 jump street|22 jump street|game night|ted lasso|how i met your mother|community|the big bang theory|crazy stupid love|step brothers|bridesmaids|horrible bosses|central intelligence|grown ups|liar liar|dumb and dumber|schitt's creek|superstore|new girl|scrubs|white chicks|rush hour|anchorman|tropic thunder|meet the parents|dodgeball|airplane!|tag\b|borat|spy\b|mean girls|malcolm in the middle|ted\b|bad boys)\b/i;

  const dramedyOrArthouseRegex =
    /\b(la la land|the grand budapest hotel|life is beautiful|forrest gump|birdman|her\b|lost in translation|the banshees of inisherin|parasite|jojo rabbit|wes anderson|bittersweet|melancholy|tragic ending|musical drama|existential|crying|suicide|death|dying|grief|depression)\b/i;

  const philosophicalSpaceHitsRegex =
    /\b(interstellar|arrival|2001: a space odyssey|2001 a space odyssey|contact|ad astra|first man|solaris|gravity|moon\b|sunshine|the fountain|annihilation|high life)\b/i;

  const philosophicalSpaceThemesRegex =
    /\b(existential|meaning of life|humanity|philosophical|solitude|isolation in space|astronaut|space exploration|first contact|cosmos|relativity|time dilation|human existence|ponder|cosmic perspective|deep space)\b/i;

  const spaceActionOrLightRegex =
    /\b(star wars|guardians of the galaxy|back to the future|space jam|men in black|galaxy quest|thor|space balls|space cowboys|the fifth element|armageddon|independence day|valerian|star trek)\b/i;

  const underdogInspirationalHitsRegex =
    /\b(the pursuit of happyness|pursuit of happyness|whiplash|rocky|creed|ford v ferrari|cobra kai|moneyball|million dollar baby|the fighter|cinderella man|slumdog millionaire|the social network|the wolf of wall street|jerry maguire|rush\b|blind side|coach carter|southpaw|warrior|air\b|good will hunting|rudy|remember the titans|invincible|hustle|king richard)\b/i;

  const underdogThemesRegex =
    /\b(underdog|rags to riches|from nothing|struggle|perseverance|overcome|overcoming|odds|boxing|fighter|champion|ambition|success|hustle|determination|wealth|poverty to|hard work|training|triumph|against all odds|self made|broke)\b/i;

  const darkSciFiSeriesHitsRegex =
    /\b(dark|black mirror|severed|severance|westworld|altered carbon|the expanse|mr\. robot|mr robot|1899|devs|maniac|counterpart|silenced|silo|the peripheral|raised by wolves|3 body problem|fringe|orphan black|battlestar galactica|the handmaid's tale|snowpiercer|the 100|twelve monkeys|12 monkeys|legion|andor|foundation|alice in borderland|cyberpunk: edgerunners|psycho-pass|ergo proxy|serial experiments lain|steins;gate|texhnolyze|neon genesis evangelion)\b/i;

  const isExcludedSuperhero =
    parsedIntent.excludedKeywords &&
    parsedIntent.excludedKeywords.includes("9715");

  const wantsSuperhero =
    !isExcludedSuperhero &&
    ((parsedIntent.detectedKeywords &&
      parsedIntent.detectedKeywords.some((k) => k.name === "superhero")) ||
      /\b(superhero|superheroes|super\s*hero|super\s*heroes|marvel|dc|comic\s*book|mcu|dceu)\b/i.test(
        parsedIntent.originalText || "",
      ));

  const baseFloor = requestedActors.length > 0 ? 6.0 : 6.8;
  const effectiveRatingFloor = Math.max(
    baseFloor,
    parsedIntent.minRating || baseFloor,
  );

  return candidates
    .map((item) => {
      let s_intent = 0;
      let s_user = 50;
      let s_rating = (item.vote_average || 0) * 10;
      let penalties = 0;

      const itemTitle = (item.title || item.name || "").toLowerCase();
      const itemOverview = (item.overview || "").toLowerCase();
      const itemGenres = (item.genres || []).map((g) => g.toLowerCase());
      // Official TMDB Genre IDs ONLY
      const itemGenreIds = (item.genre_ids || []).map(Number);
      const voteCount = item.vote_count || 0;
      const voteAverage = item.vote_average || 0;
      const originalLang = (item.original_language || "").toLowerCase();

      const releaseDate = item.release_date || item.first_air_date || "";
      const releaseYear = releaseDate
        ? parseInt(releaseDate.split("-")[0], 10)
        : 0;

      // Official TMDB Keyword IDs ONLY (separated cleanly from itemGenreIds)
      const rawItemKeywords = Array.isArray(item.keywords)
        ? item.keywords
        : item.keywords?.keywords || item.keywords?.results || [];

      const itemKwIds = rawItemKeywords
        .map((k) => (typeof k === "object" ? Number(k?.id) : parseInt(k, 10)))
        .filter(Boolean);

      const itemKwStrings = rawItemKeywords
        .map((k) => (typeof k === "string" ? k : k?.name || ""))
        .filter(Boolean)
        .map((k) => k.toLowerCase().trim());

      const rawCastList = Array.isArray(item.cast)
        ? item.cast
        : Array.isArray(item.credits?.cast)
          ? item.credits.cast
          : Array.isArray(item.actors)
            ? item.actors
            : [];

      const itemCastNames = rawCastList
        .map((c) =>
          typeof c === "string" ? c : c?.name || c?.original_name || "",
        )
        .filter(Boolean)
        .map((n) => n.toLowerCase().trim());

      const itemSearchableText =
        `${itemTitle} ${itemOverview} ${item.tagline || ""} ${itemKwStrings.join(" ")} ${itemCastNames.join(" ")}`.toLowerCase();

      const lookupType = item.media_type === "movie" ? "movie" : "tv";
      const genreIdLookup = TMDB_GENRE_IDS[lookupType] || TMDB_GENRE_IDS.movie;

      if (parsedIntent.detectedGenres.length > 0) {
        const genreScores = parsedIntent.detectedGenres.map((genre) => {
          if (genre === "sports") {
            if (sportsRegex.test(itemTitle) || sportsRegex.test(itemOverview))
              return 100;
            if (itemGenres.some((g) => g.includes("sport"))) return 90;
            return 0;
          }

          const expectedId = genreIdLookup[genre];
          if (itemGenreIds.length > 0 && itemGenreIds[0] === expectedId)
            return 100;
          if (
            itemGenreIds.includes(expectedId) ||
            itemGenres.some((g) => g.includes(genre))
          )
            return 70;
          if (
            genre === "scifi" &&
            (itemGenreIds.includes(878) ||
              itemGenreIds.includes(10765) ||
              itemGenres.some(
                (g) => g.includes("sci-fi") || g.includes("science fiction"),
              ))
          ) {
            return 85;
          }
          if (itemOverview.includes(genre)) return 30;
          return 0;
        });

        const maxGenreScore = Math.max(...genreScores);
        const additionalMatches = genreScores.filter((s) => s > 0).length - 1;
        s_intent = Math.min(
          100,
          maxGenreScore + (additionalMatches > 0 ? additionalMatches * 15 : 0),
        );
      } else {
        s_intent = 60;
      }

      // Apply clear boost (Actor Boost) for titles featuring the requested actor
      let actorBoost = 0;
      if (requestedActors.length > 0) {
        const hasExplicitActorMatch =
          Boolean(item.matched_actor || item.isActorMatch || item.character) ||
          requestedActors.some(
            (reqActor) =>
              itemCastNames.some(
                (castName) =>
                  castName === reqActor ||
                  castName.includes(reqActor) ||
                  getSimilarityScore(castName, reqActor) >= 0.82,
              ) || itemSearchableText.includes(reqActor),
          );

        if (hasExplicitActorMatch) {
          s_intent = Math.max(s_intent, 95);
          s_intent = Math.min(100, s_intent + 35);
          actorBoost = 18;
        } else if (parsedIntent.detectedGenres.length === 0) {
          s_intent = Math.max(s_intent, 90);
          actorBoost = 10;
        }
      }

      if (parsedIntent.extractedDirector || parsedIntent.isNowPlaying) {
        s_intent = Math.max(s_intent, 90);
      }
      if (
        parsedIntent.detectedLanguage &&
        originalLang === parsedIntent.detectedLanguage
      ) {
        s_intent = Math.min(100, s_intent + 25);
      }

      const wantsTimeTravel =
        parsedIntent.detectedKeywords.some((k) => k.name === "time travel") ||
        /\b(time travel|time loop|timeline|wormhole)\b/i.test(
          parsedIntent.originalText,
        );

      const wantsPlotTwist =
        parsedIntent.detectedKeywords.some((k) => k.name === "plot twist") ||
        parsedIntent.hasTwistKeywords ||
        /\b(plot twists?|twist ending|crazy plot twists?|can'?t predict|unpredictable|mind[- ]blowing)\b/i.test(
          parsedIntent.originalText,
        );

      const wantsMindBending =
        parsedIntent.detectedKeywords.some((k) => k.name === "mind bending") ||
        /\b(mind[- ]bending|psychological puzzle)\b/i.test(
          parsedIntent.originalText,
        );

      const hasTimeTravelSignal =
        itemKwIds.includes(4379) ||
        timeTravelRegex.test(itemOverview) ||
        timeTravelRegex.test(itemTitle);

      const hasTwistSignal =
        itemKwIds.some((id) =>
          [12565, 9663, 10714, 9715, 11160, 9882].includes(id),
        ) ||
        twistRegex.test(itemOverview) ||
        twistRegex.test(itemTitle);

      if (wantsTimeTravel && hasTimeTravelSignal) {
        s_intent = Math.min(100, s_intent + 50);
      }

      if ((wantsPlotTwist || wantsMindBending) && hasTwistSignal) {
        s_intent = Math.min(100, s_intent + 40);
      }

      if (parsedIntent.isDarkAnime) {
        const isDarkHit =
          darkAnimeMasterpiecesRegex.test(itemTitle) ||
          /\b(dark fantasy|psychological|gore|brutal|tragedy|grim|bleak|demons?|disturbing|survival)\b/i.test(
            itemOverview,
          ) ||
          itemGenreIds.includes(10765) ||
          itemGenreIds.includes(9648);

        if (isDarkHit) {
          s_intent = Math.min(100, s_intent + 60);
        }
      }

      // Micro-Genre Boost: Dark Comedy / Black Comedy (`isDarkComedy`)
      const wantsDarkComedy =
        parsedIntent.isDarkComedy ||
        parsedIntent.detectedKeywords.some((k) => k.name === "dark comedy");

      if (wantsDarkComedy) {
        const isDarkComedyHit =
          darkComedyMasterpiecesRegex.test(itemTitle) ||
          itemKwIds.includes(9716) ||
          itemKwIds.includes(9717) ||
          (itemGenreIds.includes(35) &&
            (itemGenreIds.includes(80) ||
              itemGenreIds.includes(53) ||
              itemGenreIds.includes(18) ||
              itemGenreIds.includes(9648)) &&
            darkComedyThemesRegex.test(itemSearchableText));

        if (isDarkComedyHit) {
          s_intent = Math.min(100, s_intent + 60);
        } else if (
          itemGenreIds.includes(35) &&
          (itemGenreIds.includes(80) || itemGenreIds.includes(53))
        ) {
          s_intent = Math.min(100, s_intent + 40);
        }
      }

      if (parsedIntent.isPureComedy) {
        const isPureHit =
          pureComedyHitsRegex.test(itemTitle) ||
          (itemGenreIds[0] === 35 &&
            !itemGenreIds.includes(18) &&
            !itemGenreIds.includes(10749) &&
            voteAverage >= 7.0);

        if (isPureHit) {
          s_intent = Math.min(100, s_intent + 60);
        }
      }

      const wantsSitcom =
        parsedIntent.isSitcom ||
        parsedIntent.detectedKeywords.some((k) => k.name === "sitcom") ||
        normalizedAnchorList.some((aTitle) =>
          /\b(friends|the office|how i met your mother|himym|modern family|brooklyn 99|brooklyn nine-nine|new girl|parks and recreation|seinfeld|community|schitt's creek|scrubs|two and a half men|the big bang theory|big bang theory)\b/i.test(
            aTitle,
          ),
        ) ||
        (parsedIntent.isComfortComedy && !parsedIntent.isPureComedy) ||
        /\b(sitcoms?|sit-coms?|situational comed(?:y|ies))\b/i.test(
          parsedIntent.originalText,
        );

      if (wantsSitcom) {
        const isIconicSitcom = iconicComfortShows.test(itemTitle);
        const isPrimaryComedy =
          itemGenreIds.length > 0 && itemGenreIds[0] === 35;

        if (isIconicSitcom) {
          s_intent = Math.min(100, s_intent + 60);
        } else if (
          item.media_type === "tv" &&
          isPrimaryComedy &&
          !itemGenreIds.includes(18)
        ) {
          s_intent = Math.min(100, s_intent + 40);
        }
      }

      if (parsedIntent.isMindBlowingAction) {
        const isHitMba =
          mindBlowingActionHitsRegex.test(itemTitle) ||
          (mindBlowingActionThemesRegex.test(itemOverview) &&
            (itemGenreIds.includes(28) || itemGenreIds.includes(878))) ||
          (itemGenreIds.includes(28) &&
            itemGenreIds.includes(878) &&
            voteAverage >= 7.5);

        if (isHitMba) {
          s_intent = Math.min(100, s_intent + 60);
        }
      }

      if (parsedIntent.isHauntedHorror) {
        const isHauntedHit =
          hauntedHorrorMasterpiecesRegex.test(itemTitle) ||
          hauntedHorrorThemesRegex.test(itemOverview) ||
          itemKwIds.includes(3358) ||
          itemKwIds.includes(10292) ||
          itemGenreIds.includes(27);

        if (
          hauntedHorrorMasterpiecesRegex.test(itemTitle) ||
          hauntedHorrorThemesRegex.test(itemOverview) ||
          itemKwIds.includes(3358)
        ) {
          s_intent = Math.min(100, s_intent + 65);
        } else if (isHauntedHit) {
          s_intent = Math.min(100, s_intent + 45);
        }
      }

      const isHitRomComAnime =
        cuteRomComAnimeHitsRegex.test(itemTitle) ||
        cuteRomComAnimeThemesRegex.test(itemOverview) ||
        itemKwIds.some((id) => [9799, 9840, 158718].includes(id)) ||
        (itemGenreIds.includes(16) &&
          itemGenreIds.includes(35) &&
          itemGenreIds.includes(10749));

      if (parsedIntent.isCuteAnimeRomCom) {
        if (cuteRomComAnimeHitsRegex.test(itemTitle)) {
          s_intent = Math.min(100, s_intent + 75);
        } else if (isHitRomComAnime && releaseYear >= 2006) {
          s_intent = Math.min(100, s_intent + 60);
        }
      }

      if (parsedIntent.isCrimeFamily) {
        const isHitMobFilm =
          crimeFamilyMasterpiecesRegex.test(itemTitle) ||
          crimeFamilyThemesRegex.test(itemOverview) ||
          itemKwIds.includes(10391) ||
          itemKwIds.includes(242);

        if (isHitMobFilm) {
          s_intent = Math.min(100, s_intent + 60);
        }
      }

      const swordWarfareIdList = String(TMDB_THEME_IDS.swordWarfare)
        .split("|")
        .map((id) => parseInt(id, 10));

      const isSwordHit =
        itemKwIds.some((id) => swordWarfareIdList.includes(id)) ||
        swordWarfareThemesRegex.test(itemOverview) ||
        swordWarfareThemesRegex.test(itemTitle);

      if (parsedIntent.isSwordWarfare) {
        if (isSwordHit) {
          s_intent = Math.min(100, s_intent + 75);
        }
      }

      if (parsedIntent.isUnderdog) {
        const isUnderdogHit =
          underdogInspirationalHitsRegex.test(itemTitle) ||
          underdogThemesRegex.test(itemOverview) ||
          itemGenreIds.includes(18) ||
          itemGenres.some((g) => g.includes("sport") || g.includes("drama"));

        if (isUnderdogHit) {
          s_intent = Math.min(100, s_intent + 60);
        }
      }

      if (
        parsedIntent.isKorean &&
        (wantsPlotTwist || parsedIntent.hasTwistKeywords)
      ) {
        if (originalLang === "ko") {
          const isHitKoreanTwist =
            koreanTwistMasterpiecesRegex.test(itemTitle) ||
            (koreanThrillerThemesRegex.test(itemOverview) &&
              (itemGenreIds.includes(9648) || itemGenreIds.includes(80)));

          if (isHitKoreanTwist) {
            s_intent = Math.min(100, s_intent + 60);
          }
        }
      } else if (parsedIntent.isKorean && originalLang === "ko") {
        const isHitKorean =
          koreanTwistMasterpiecesRegex.test(itemTitle) ||
          koreanThrillerThemesRegex.test(itemOverview) ||
          itemGenreIds.includes(9648) ||
          itemGenreIds.includes(80);

        if (isHitKorean) {
          s_intent = Math.min(100, s_intent + 45);
        }
      }

      const wantsPsychological =
        parsedIntent.isPsychologicalThriller ||
        parsedIntent.detectedKeywords.some(
          (k) => k.name === "psychological thriller",
        ) ||
        /\b(psychological thriller|mess with my head|mindfuck|mind game)\b/i.test(
          parsedIntent.originalText,
        );

      const isPsychologicalHit =
        psychologicalMasterpiecesRegex.test(itemTitle) ||
        psychologicalThemesRegex.test(itemOverview) ||
        itemKwIds.some((id) => [10714, 12565, 9663].includes(id));

      if (wantsPsychological && isPsychologicalHit) {
        s_intent = Math.min(100, s_intent + 50);
      }

      const hasExplicitHeistRobbery =
        explicitHeistRobberyRegex.test(itemTitle) ||
        explicitHeistRobberyRegex.test(itemOverview) ||
        itemKwIds.some((id) => [10051, 6492, 10292].includes(id));

      if (parsedIntent.isHeistRobbery && hasExplicitHeistRobbery) {
        s_intent = Math.min(100, s_intent + 60);
      }

      const isCyberpunkHit =
        cyberpunkHitsRegex.test(itemTitle) ||
        cyberpunkThemesRegex.test(itemOverview) ||
        itemKwIds.some((id) => [12190, 4565, 2853, 156395].includes(id));

      if (parsedIntent.isCyberpunk && isCyberpunkHit) {
        s_intent = Math.min(100, s_intent + 60);
      }

      const isDeepSpacePhilosophical =
        philosophicalSpaceHitsRegex.test(itemTitle) ||
        (philosophicalSpaceThemesRegex.test(itemOverview) &&
          (itemGenreIds.includes(878) || itemGenreIds.includes(18)));

      if (parsedIntent.isPhilosophicalSciFi && isDeepSpacePhilosophical) {
        s_intent = Math.min(100, s_intent + 60);
      }

      if (
        (parsedIntent.isComfortComedy || parsedIntent.isTiredMood) &&
        !parsedIntent.isPureComedy &&
        !wantsDarkComedy &&
        !wantsSitcom
      ) {
        const isPureLaughHit =
          crowdPleaserComedyRegex.test(itemTitle) ||
          (itemGenreIds.includes(35) && !itemGenreIds.includes(18));

        if (isPureLaughHit) {
          s_intent = Math.min(100, s_intent + 60);
        }
      }

      const hasBothAnimationAndFamily =
        (itemGenreIds.includes(16) ||
          itemGenres.some((g) => g.includes("animation"))) &&
        (itemGenreIds.includes(10751) ||
          itemGenres.some((g) => g.includes("family")));

      const isFamilyAnimationHit =
        hasBothAnimationAndFamily ||
        familyAnimationHitsRegex.test(itemTitle) ||
        (itemGenreIds.includes(16) &&
          familyAnimationThemesRegex.test(itemOverview));

      if (parsedIntent.isFamilyAnimation && isFamilyAnimationHit) {
        s_intent = Math.min(100, s_intent + 50);
      }

      const wantsRomCom =
        parsedIntent.isRomCom ||
        parsedIntent.detectedKeywords.some((k) => k.name === "rom-com") ||
        (/\b(sweet|light|lift my mood|feel[- ]good|rom-com|romcom|romantic comedy)\b/i.test(
          parsedIntent.originalText,
        ) &&
          (parsedIntent.detectedGenres.includes("romance") ||
            parsedIntent.detectedGenres.includes("comedy")));

      const hasBothRomanceAndComedy =
        (itemGenreIds.includes(35) ||
          itemGenres.some((g) => g.includes("comedy"))) &&
        (itemGenreIds.includes(10749) ||
          itemGenres.some((g) => g.includes("romance")));

      const isFeelGoodRomCom =
        hasBothRomanceAndComedy ||
        feelGoodRomComRegex.test(itemTitle) ||
        feelGoodRomComRegex.test(itemOverview) ||
        itemKwIds.some((id) => [9799, 158718, 3133].includes(id));

      if (wantsRomCom && isFeelGoodRomCom) {
        s_intent = Math.min(100, s_intent + 50);
      }

      const hasWarOrHistoryGenre =
        itemGenreIds.includes(10752) ||
        itemGenreIds.includes(36) ||
        itemGenres.some((g) => g.includes("war") || g.includes("history"));

      const isGenuineHistoricalWar =
        hasWarOrHistoryGenre ||
        historicalWarRegex.test(itemTitle) ||
        historicalWarRegex.test(itemOverview) ||
        itemKwIds.some((id) => [11162, 233, 210103].includes(id));

      if (parsedIntent.isHistoricalWar && isGenuineHistoricalWar) {
        s_intent = Math.min(100, s_intent + 60);
      }

      const isDocContent =
        itemGenreIds.includes(99) ||
        itemGenres.some((g) => g.includes("documentary")) ||
        trueCrimeDocRegex.test(itemTitle) ||
        trueCrimeDocRegex.test(itemOverview);

      const hasExplicitCrimeSignal =
        trueCrimeDocRegex.test(itemTitle) ||
        trueCrimeDocRegex.test(itemOverview) ||
        itemKwIds.some((id) => [10714, 9882, 9715, 10303].includes(id));

      const isHitTrueCrime = isDocContent && hasExplicitCrimeSignal;

      if (parsedIntent.isTrueCrimeDoc && isHitTrueCrime) {
        s_intent = Math.min(100, s_intent + 60);
      }

      const wantsMagic =
        parsedIntent.detectedKeywords.some((k) => k.name === "magic") ||
        /\b(magic|magical|sorcery|sorcerer|witch|witches|witchcraft|wizard|wizards|mage|mages|spell|spells|alchemy)\b/i.test(
          parsedIntent.originalText,
        );

      const wantsDark =
        parsedIntent.wantsDark ||
        /\b(dark|grim|bleak|mature|disturbing|gothic|brutal|suffering)\b/i.test(
          parsedIntent.originalText,
        );

      const hasExplicitMagic =
        itemKwIds.includes(2343) ||
        itemKwIds.includes(9799) ||
        explicitMagicRegex.test(itemTitle) ||
        explicitMagicRegex.test(itemOverview);

      if (wantsMagic && hasExplicitMagic) {
        s_intent = Math.min(100, s_intent + 40);
      }

      const hasSciFiGenreId =
        itemGenreIds.includes(878) ||
        itemGenreIds.includes(10765) ||
        itemGenres.some(
          (g) => g.includes("sci-fi") || g.includes("science fiction"),
        );

      if (wantsDark && !parsedIntent.isDarkAnime && !wantsDarkComedy) {
        const darkToneRegex =
          /\b(dark|death|tragedy|grim|violent|psychological|gore|brutal|survival|sinister|curse|bloody|dark fantasy|macabre|demon|demons|dystopian|bleak|mystery|conspiracy|mind-bending)\b/i;
        if (
          darkSciFiSeriesHitsRegex.test(itemTitle) &&
          parsedIntent.detectedGenres.includes("scifi")
        ) {
          s_intent = Math.min(100, s_intent + 55);
        } else if (
          (!parsedIntent.detectedGenres.includes("scifi") || hasSciFiGenreId) &&
          (darkToneRegex.test(itemOverview) ||
            darkToneRegex.test(itemTitle) ||
            itemGenreIds.includes(27) ||
            itemGenreIds.includes(53) ||
            itemGenreIds.includes(9648))
        ) {
          s_intent = Math.min(100, s_intent + 30);
        }
      }

      if (parsedIntent.isHorrorNight) {
        const isIconicHit = iconicCrowdHorrorTitles.test(itemTitle);
        const isCrowdHorror =
          crowdHorrorRegex.test(itemOverview) ||
          crowdHorrorRegex.test(itemTitle);

        if (isIconicHit && releaseYear >= 2010) {
          s_intent = Math.min(100, s_intent + 50);
        } else if (isCrowdHorror && releaseYear >= 2010) {
          s_intent = Math.min(100, s_intent + 35);
        }
      }

      const isSciFiContext =
        (parsedIntent.detectedGenres.includes("scifi") ||
          normalizedAnchorList.some((aTitle) =>
            /interstellar|arrival|contact|2001/i.test(aTitle),
          )) &&
        !parsedIntent.isCyberpunk;

      if (isSciFiContext && hasSciFiGenreId) {
        const deepSpaceRegex =
          /\b(deep space|black hole|wormhole|space exploration|astronaut|astronauts|nasa|extraterrestrial|first contact|relativity|quantum|cosmos|cosmic|spacecraft|orbit|gravity|astrophysics|space mission|space flight|time travel|parallel universe|dystopian|future|sci-fi)\b/i;
        if (
          deepSpaceRegex.test(itemOverview) ||
          deepSpaceRegex.test(itemTitle)
        ) {
          s_intent = Math.min(100, s_intent + 35);
        }
      }

      let s_user_genre = 50;
      let s_user_kw = 20;
      let matched_user_keywords = [];

      const userGenres = userProfileStats?.genres || userProfileStats || {};
      const userKeywords = userProfileStats?.keywords || {};

      const normalizedUserKeywords = {};
      for (const [k, v] of Object.entries(userKeywords)) {
        if (k && v !== undefined) {
          normalizedUserKeywords[k.toLowerCase().trim()] = v;
        }
      }

      const totalUserKw = Object.keys(normalizedUserKeywords).length;
      const hasUserGenres = Object.keys(userGenres).length > 0;

      if (userReviewsCount >= 5 && (hasUserGenres || totalUserKw > 0)) {
        let userTotal = 0;
        let matchedGenresCount = 0;
        itemGenres.forEach((g) => {
          const gLower = g.toLowerCase().trim();
          if (userGenres[gLower] !== undefined) {
            const val = userGenres[gLower];
            const scoreOutOf10 = val <= 5 ? val * 2 : val;
            userTotal += (scoreOutOf10 / 10) * 100;
            matchedGenresCount++;
          }
        });
        if (matchedGenresCount > 0) {
          s_user_genre = userTotal / matchedGenresCount;
        }

        const candidateThemesSet = new Set();

        for (const [theme, data] of Object.entries(themeKeywords)) {
          const themeLower = theme.toLowerCase().trim();
          const hasExactKw = itemKwStrings.some((kw) => kw === themeLower);
          const hasTermMatch = data.terms.some((t) => {
            const tLower = t.toLowerCase().trim();
            return (
              new RegExp(`\\b${tLower}\\b`, "i").test(itemSearchableText) ||
              itemKwStrings.some((kw) => kw === tLower)
            );
          });

          if (hasExactKw || hasTermMatch) {
            candidateThemesSet.add(themeLower);
          }
        }

        if (
          normalizedUserKeywords["plot twist"] &&
          (twistRegex.test(itemSearchableText) ||
            itemKwIds.includes(12565) ||
            itemKwStrings.some(
              (k) => k === "plot twist" || k === "twist ending",
            ))
        ) {
          candidateThemesSet.add("plot twist");
        }

        if (
          normalizedUserKeywords["psychological thriller"] &&
          (psychologicalThemesRegex.test(itemSearchableText) ||
            itemKwIds.includes(10714) ||
            itemKwStrings.some(
              (k) => k === "psychological thriller" || k === "mind games",
            ))
        ) {
          candidateThemesSet.add("psychological thriller");
        }

        if (
          normalizedUserKeywords["time travel"] &&
          (timeTravelRegex.test(itemSearchableText) ||
            itemKwIds.includes(4379) ||
            itemKwStrings.some((k) => k === "time travel" || k === "time loop"))
        ) {
          candidateThemesSet.add("time travel");
        }

        if (
          normalizedUserKeywords["cyberpunk"] &&
          (cyberpunkThemesRegex.test(itemSearchableText) ||
            itemKwIds.includes(12190) ||
            itemKwStrings.some((k) => k === "cyberpunk" || k === "cyber-punk"))
        ) {
          candidateThemesSet.add("cyberpunk");
        }

        matched_user_keywords = Array.from(candidateThemesSet).filter(
          (theme) => {
            const t = theme.toLowerCase().trim();
            return (
              normalizedUserKeywords[t] !== undefined ||
              Object.keys(normalizedUserKeywords).some((uk) => uk === t)
            );
          },
        );

        if (totalUserKw > 0) {
          if (matched_user_keywords.length === 0) {
            s_user_kw = 20;
          } else {
            let kwScoreSum = 0;
            matched_user_keywords.forEach((theme) => {
              const t = theme.toLowerCase().trim();
              let r = normalizedUserKeywords[t] || 8.0;
              const normR = r <= 5 ? r * 2 : r;
              kwScoreSum += (normR / 10) * 100;
            });

            const avgKwRating = kwScoreSum / matched_user_keywords.length;

            let matchProportion = 0.35;
            if (matched_user_keywords.length === 2) {
              matchProportion = 0.6;
            } else if (matched_user_keywords.length >= 3) {
              matchProportion = 0.85;
            }

            s_user_kw = Math.round(avgKwRating * matchProportion);
          }

          s_user = Math.round(0.35 * s_user_genre + 0.65 * s_user_kw);
        } else {
          s_user = s_user_genre;
          s_user_kw = s_user_genre;
        }
      }

      const s_user_kw_bonus = s_user - s_user_genre;

      // ==============================================================
      // Strict Penalties System
      // ==============================================================
      let hasSevereExclusionViolation = false;

      const isLowRatedQualityViolation = voteAverage < effectiveRatingFloor;
      if (isLowRatedQualityViolation) {
        penalties += 60;
        hasSevereExclusionViolation = true;
      }

      const isAnimeCandidate =
        item.media_type === "anime" ||
        parsedIntent.targetType === "anime" ||
        (originalLang === "ja" && itemGenreIds.includes(16));

      const hasEcchiOrHaremSignal =
        ecchiOrAdultAnimeRegex.test(itemTitle) ||
        ecchiOrAdultAnimeRegex.test(itemOverview) ||
        itemKwIds.some((id) => [2858, 190370, 9716].includes(id)) ||
        itemKwStrings.some((k) =>
          /\b(ecchi|harem|fanservice|fan service|softcore|erotic|reverse harem)\b/i.test(
            k,
          ),
        );

      const isEcchiViolation =
        (isAnimeCandidate || parsedIntent.isCuteAnimeRomCom) &&
        hasEcchiOrHaremSignal;

      if (isEcchiViolation) {
        penalties += 95;
        hasSevereExclusionViolation = true;
      }

      if (parsedIntent.excludeViolence) {
        const hasViolentOrGorySignal =
          itemGenreIds.includes(27) ||
          /\b(gore|gory|slasher|bloody|brutal|massacre|serial killer|torture|ultra-violent|ultraviolent|splatter|mutilation|decapitation)\b/i.test(
            itemSearchableText,
          );
        if (hasViolentOrGorySignal) {
          penalties += 85;
          hasSevereExclusionViolation = true;
        }
      }

      const wantsExplicitAnimeInPrompt =
        parsedIntent.wantsExplicitAnime ||
        parsedIntent.targetType === "anime" ||
        /\b(anime|manga)\b/i.test(parsedIntent.originalText || "");

      if (
        parsedIntent.isSwordWarfare &&
        !wantsExplicitAnimeInPrompt &&
        isAnimeCandidate
      ) {
        penalties += 90;
        hasSevereExclusionViolation = true;
      }

      const isSciFiMismatchViolation =
        parsedIntent.detectedGenres.includes("scifi") &&
        !hasSciFiGenreId &&
        !darkSciFiSeriesHitsRegex.test(itemTitle);

      if (isSciFiMismatchViolation) {
        penalties += 80;
        hasSevereExclusionViolation = true;
      }

      const hasModernGunsOrCrimeInSwordSearch =
        parsedIntent.isSwordWarfare &&
        (modernWarfareOrCrimeRegex.test(itemTitle) ||
          modernWarfareOrCrimeRegex.test(itemOverview) ||
          (itemGenreIds.includes(80) && !isSwordHit) ||
          (!isSwordHit && !hasWarOrHistoryGenre));

      if (hasModernGunsOrCrimeInSwordSearch) {
        penalties += 80;
        hasSevereExclusionViolation = true;
      }

      if (
        parsedIntent.minYear &&
        releaseYear > 0 &&
        releaseYear < parsedIntent.minYear
      ) {
        penalties += 65;
        hasSevereExclusionViolation = true;
      }

      if (
        parsedIntent.maxYear &&
        releaseYear > 0 &&
        releaseYear > parsedIntent.maxYear
      ) {
        penalties += 65;
        hasSevereExclusionViolation = true;
      }

      if (
        Array.isArray(parsedIntent.strictFormats) &&
        parsedIntent.strictFormats.length > 0
      ) {
        if (parsedIntent.strictFormats.includes("silent")) {
          const hasSilentSignal =
            /\b(silent|silent film|silent movie|silent era|pantomime|intertitles)\b/i.test(
              itemSearchableText,
            ) ||
            (releaseYear > 0 && releaseYear <= 1931);
          if (!hasSilentSignal) {
            penalties += 80;
            hasSevereExclusionViolation = true;
          }
        }
        if (parsedIntent.strictFormats.includes("black and white")) {
          const hasBwSignal =
            /\b(black and white|black & white|b&w|monochrome|noir)\b/i.test(
              itemSearchableText,
            ) ||
            (releaseYear > 0 && releaseYear <= 1960);
          if (!hasBwSignal) {
            penalties += 75;
            hasSevereExclusionViolation = true;
          }
        }
      }

      if (parsedIntent.excludedTermsFromPrompt?.includes("detective")) {
        const isDetectiveCentric =
          /\b(detective|police detective|lead detective)\b/i.test(itemTitle);
        if (isDetectiveCentric) {
          penalties += 30;
        }
      }

      if (
        parsedIntent.excludedTermsFromPrompt &&
        parsedIntent.excludedTermsFromPrompt.length > 0
      ) {
        const hasExcludedTerm = parsedIntent.excludedTermsFromPrompt.some(
          (term) => {
            if (term === "detective") return false;
            if (term === "ecchi" || term === "harem") {
              return hasEcchiOrHaremSignal;
            }
            const termRegex = new RegExp(`\\b${term}\\b`, "i");
            return (
              termRegex.test(itemTitle) ||
              termRegex.test(itemOverview) ||
              itemKwStrings.includes(term)
            );
          },
        );
        if (hasExcludedTerm) {
          penalties += 85;
          hasSevereExclusionViolation = true;
        }
      }

      if (
        parsedIntent.excludedGenres &&
        parsedIntent.excludedGenres.length > 0
      ) {
        const hasExcludedGenre = parsedIntent.excludedGenres.some((exG) => {
          if (exG === "family") {
            return (
              itemGenreIds.includes(10751) ||
              itemGenreIds.includes(10762) ||
              kidsMascotAnimeRegex.test(itemTitle)
            );
          }
          const exId = genreIdLookup[exG];
          return itemGenreIds.includes(exId) || itemGenres.includes(exG);
        });
        if (hasExcludedGenre) {
          penalties += 75;
          hasSevereExclusionViolation = true;
        }
      }

      if (parsedIntent.excludedGenres.includes("comedy")) {
        const hasComedySignal =
          itemGenreIds.includes(35) ||
          itemGenres.some((g) => g.includes("comedy"));
        if (hasComedySignal) {
          penalties += 75;
          hasSevereExclusionViolation = true;
        }
      }

      const hasSuperheroSignal =
        itemKwIds.includes(9715) ||
        superheroRegex.test(itemTitle) ||
        superheroRegex.test(itemOverview);

      if (isExcludedSuperhero && hasSuperheroSignal) {
        penalties += 85;
        hasSevereExclusionViolation = true;
      }

      const hasSpecificIntentFlag =
        parsedIntent.isHorrorNight ||
        parsedIntent.isCrimeHeist ||
        parsedIntent.isCrimeFamily ||
        parsedIntent.isHeistRobbery ||
        parsedIntent.isPsychologicalThriller ||
        parsedIntent.isRomCom ||
        parsedIntent.isCuteAnimeRomCom ||
        parsedIntent.isDarkAnime ||
        parsedIntent.isDarkComedy ||
        parsedIntent.isSitcom ||
        parsedIntent.isSwordWarfare ||
        parsedIntent.isHistoricalWar ||
        parsedIntent.isHauntedHorror ||
        parsedIntent.isMindBlowingAction ||
        parsedIntent.hasQualityFloor ||
        parsedIntent.isPureComedy ||
        parsedIntent.isTrueCrimeDoc ||
        parsedIntent.isKorean ||
        parsedIntent.hasTwistKeywords ||
        parsedIntent.isUnderdog ||
        parsedIntent.isFamilyAnimation ||
        parsedIntent.isCyberpunk ||
        parsedIntent.isPhilosophicalSciFi ||
        Boolean(parsedIntent.extractedDirector) ||
        requestedActors.length > 0 ||
        parsedIntent.isNowPlaying ||
        parsedIntent.detectedKeywords.length > 0;

      if (
        (parsedIntent.detectedGenres.length > 0 || hasSpecificIntentFlag) &&
        s_intent < 75
      ) {
        penalties += 40;
      }

      if (parsedIntent.detectedGenres.length > 0 && s_intent === 0) {
        penalties += 55;
      }

      if (parsedIntent.isDarkAnime) {
        const isMasterpieceHit = darkAnimeMasterpiecesRegex.test(itemTitle);
        if (
          !isMasterpieceHit &&
          (lightOrEcchiFantasyAnimeRegex.test(itemTitle) ||
            kidsMascotAnimeRegex.test(itemTitle) ||
            /\b(ecchi|cheerful|harem|fan-service|fanservice|lighthearted adventure)\b/i.test(
              itemOverview,
            ) ||
            itemGenreIds.includes(10762) ||
            itemGenreIds.includes(10751))
        ) {
          penalties += 80;
          hasSevereExclusionViolation = true;
        }
      }

      if (wantsSitcom) {
        const isIconicSitcom = iconicComfortShows.test(itemTitle);
        const isPrimaryComedy =
          itemGenreIds.length > 0 && itemGenreIds[0] === 35;

        if (!isPrimaryComedy && !isIconicSitcom) {
          penalties += 35;
        }

        if (
          sportsRegex.test(itemTitle) ||
          sportsRegex.test(itemOverview) ||
          itemKwIds.includes(6075) ||
          itemGenres.some((g) => g.includes("sport"))
        ) {
          penalties += 50;
        }

        if (
          teenOrKidsSportsTelenovelaRegex.test(itemTitle) ||
          teenOrKidsSportsTelenovelaRegex.test(itemOverview) ||
          itemGenreIds.includes(10762) ||
          itemGenreIds.includes(10766)
        ) {
          penalties += 55;
        }

        if (itemGenreIds.includes(18) && !isIconicSitcom) {
          penalties += 30;
        }

        if (voteCount < 400 && !isIconicSitcom) {
          penalties += 25;
        }
      }

      if (parsedIntent.isPureComedy) {
        const isIconicComedy = pureComedyHitsRegex.test(itemTitle);
        const isComedyPrimary =
          itemGenreIds.length > 0 && itemGenreIds[0] === 35;

        if (originalLang !== "en" && !isIconicComedy) {
          penalties += 40;
        }

        if (!isComedyPrimary && !isIconicComedy) {
          penalties += 25;
        }

        if (
          (itemGenreIds.includes(28) || itemGenreIds.includes(80)) &&
          !isIconicComedy
        ) {
          penalties += 20;
        }

        if (
          (itemGenreIds.includes(18) ||
            itemGenreIds.includes(53) ||
            dramedyOrArthouseRegex.test(itemTitle)) &&
          !isIconicComedy
        ) {
          penalties += 35;
        }

        if (voteAverage < 7.0) {
          penalties += Math.min(40, Math.round((7.0 - voteAverage) * 30));
        }

        if (
          itemGenreIds.includes(10751) ||
          itemGenreIds.includes(10762) ||
          itemGenreIds.includes(16) ||
          kidsComedyMascotRegex.test(itemTitle)
        ) {
          penalties += 55;
        }
      }

      if (
        (parsedIntent.hasQualityFloor || parsedIntent.isMindBlowingAction) &&
        !parsedIntent.isPureComedy &&
        !wantsSitcom &&
        requestedActors.length === 0
      ) {
        if (voteAverage < 7.0) {
          penalties += Math.min(35, Math.round((7.0 - voteAverage) * 25));
        } else if (voteAverage < 7.2) {
          penalties += 15;
        }

        if (bMovieTrashRegex.test(itemTitle)) {
          penalties += 75;
          hasSevereExclusionViolation = true;
        }

        if (voteCount < 500 && voteAverage < 7.5) {
          penalties += 20;
        }
      }

      if (parsedIntent.isHauntedHorror) {
        if (
          itemGenreIds.includes(10751) ||
          itemGenreIds.includes(10762) ||
          itemGenres.some((g) => g.includes("family") || g.includes("kids"))
        ) {
          penalties += 55;
        }

        if (itemGenreIds.includes(35)) {
          penalties += 35;
        }

        const isHauntedHit =
          hauntedHorrorMasterpiecesRegex.test(itemTitle) ||
          hauntedHorrorThemesRegex.test(itemOverview) ||
          itemGenreIds.includes(27) ||
          itemKwIds.includes(3358) ||
          itemKwIds.includes(10292);

        if (!isHauntedHit) {
          penalties += 25;
        }
      }

      if (parsedIntent.isCuteAnimeRomCom) {
        if (hasEcchiOrHaremSignal) {
          penalties += 95;
        }

        if (
          itemGenreIds.includes(10762) ||
          kidsMascotAnimeRegex.test(itemTitle) ||
          kidsMascotAnimeRegex.test(itemOverview)
        ) {
          penalties += 85;
        }

        if (
          pureSportsAnimeRegex.test(itemTitle) ||
          (itemKwIds.includes(6075) &&
            !cuteRomComAnimeHitsRegex.test(itemTitle))
        ) {
          penalties += 55;
        }

        if (
          !parsedIntent.wantsClassic &&
          (retroDatedAnimeRegex.test(itemTitle) ||
            (releaseYear > 0 && releaseYear < 2005))
        ) {
          penalties += 35;
        }

        const hasRomanceOrCute =
          cuteRomComAnimeHitsRegex.test(itemTitle) ||
          cuteRomComAnimeThemesRegex.test(itemOverview) ||
          itemKwIds.includes(9799) ||
          itemKwIds.includes(9840) ||
          itemKwIds.includes(158718) ||
          itemGenreIds.includes(10749);

        if (!hasRomanceOrCute) {
          penalties += 35;
        }
      }

      if (parsedIntent.isCrimeFamily) {
        if (
          itemGenreIds.includes(10751) ||
          itemGenreIds.includes(10762) ||
          itemGenreIds.includes(16)
        ) {
          penalties += 45;
        }

        const isHitMobFilm =
          crimeFamilyMasterpiecesRegex.test(itemTitle) ||
          crimeFamilyThemesRegex.test(itemOverview) ||
          itemGenreIds.includes(80) ||
          itemKwIds.includes(10391) ||
          itemKwIds.includes(242);

        if (!isHitMobFilm) {
          penalties += 25;
        }
      }

      if (parsedIntent.isTrueCrimeDoc) {
        if (!isDocContent) {
          penalties += 50;
        } else if (!hasExplicitCrimeSignal) {
          penalties += 25;
        }

        if (
          scienceNatureDocRegex.test(itemTitle) ||
          scienceNatureDocRegex.test(itemOverview)
        ) {
          penalties += 40;
        }

        if (itemGenreIds.includes(35) || itemGenreIds.includes(878)) {
          penalties += 25;
        }
      }

      if (parsedIntent.isSwordWarfare) {
        if (itemGenreIds.includes(14) && !isSwordHit) {
          penalties += 60;
        }
      }

      if (parsedIntent.isUnderdog) {
        if (
          itemGenreIds.includes(27) ||
          (itemGenreIds.includes(878) && !itemGenreIds.includes(18)) ||
          itemGenreIds.includes(14)
        ) {
          penalties += 30;
        }
      }

      if (parsedIntent.isKorean) {
        if (originalLang !== "ko") {
          penalties += 55;
        }
      }

      if (
        parsedIntent.detectedLanguage &&
        !parsedIntent.isKorean &&
        originalLang &&
        originalLang !== parsedIntent.detectedLanguage
      ) {
        penalties += 60;
        hasSevereExclusionViolation = true;
      }

      if (wantsPlotTwist || parsedIntent.hasTwistKeywords) {
        if (!hasTwistSignal && !koreanTwistMasterpiecesRegex.test(itemTitle)) {
          penalties += 25;
        }
      }

      if (parsedIntent.isHeistRobbery) {
        if (
          revengeOrPureMafiaRegex.test(itemTitle) ||
          revengeOrPureMafiaRegex.test(itemOverview)
        ) {
          penalties += 35;
        }

        if (!hasExplicitHeistRobbery) {
          penalties += 35;
        }

        if (
          itemKwIds.includes(9715) ||
          (itemGenreIds.includes(878) &&
            !/\binception|matrix\b/i.test(itemTitle))
        ) {
          penalties += 30;
        }
      }

      if (parsedIntent.isCyberpunk) {
        if (
          spaceOrTimeTravelRegex.test(itemTitle) ||
          spaceOrTimeTravelRegex.test(itemOverview)
        ) {
          penalties += 35;
        }

        if (!isCyberpunkHit) {
          penalties += 25;
        }
      }

      if (parsedIntent.isPhilosophicalSciFi) {
        if (
          spaceActionOrLightRegex.test(itemTitle) ||
          spaceActionOrLightRegex.test(itemOverview)
        ) {
          penalties += 35;
        }

        if (itemGenreIds.includes(35)) {
          penalties += 30;
        }

        if (!isDeepSpacePhilosophical) {
          penalties += 25;
        }
      }

      if (
        (parsedIntent.isComfortComedy || parsedIntent.isTiredMood) &&
        !wantsDarkComedy
      ) {
        if (itemGenreIds.includes(18)) {
          penalties += 35;
        }

        if (
          dramedyOrArthouseRegex.test(itemTitle) ||
          dramedyOrArthouseRegex.test(itemOverview)
        ) {
          penalties += 40;
        }

        if (
          itemGenreIds.includes(10762) ||
          teenOrKidsSportsTelenovelaRegex.test(itemTitle) ||
          teenOrKidsSportsTelenovelaRegex.test(itemOverview)
        ) {
          penalties += 45;
        }

        const wantsAnime =
          /\banime|manga\b/i.test(parsedIntent.originalText) ||
          parsedIntent.targetType === "anime";
        if (
          !wantsAnime &&
          (originalLang === "ja" ||
            item.media_type === "anime" ||
            itemGenreIds.includes(16))
        ) {
          penalties += 45;
        }

        if (
          itemGenreIds.includes(27) ||
          itemGenreIds.includes(10752) ||
          itemGenreIds.includes(9648)
        ) {
          penalties += 30;
        }
      }

      if (parsedIntent.isFamilyAnimation) {
        const wantsAnime = /\banime\b/i.test(parsedIntent.originalText);
        if (
          !wantsAnime &&
          (originalLang === "ja" || itemKwIds.includes(210024))
        ) {
          penalties += 40;
        }

        if (
          itemGenreIds.includes(27) ||
          itemGenreIds.includes(53) ||
          itemGenreIds.includes(80)
        ) {
          penalties += 45;
        }

        if (
          !hasBothAnimationAndFamily &&
          !familyAnimationHitsRegex.test(itemTitle)
        ) {
          penalties += 25;
        }
      }

      if (parsedIntent.isHistoricalWar) {
        if (!isGenuineHistoricalWar) {
          penalties += 40;
        }

        const wantsSciFi = parsedIntent.detectedGenres.includes("scifi");
        if (!wantsSciFi && itemGenreIds.includes(878)) {
          penalties += 45;
        }

        if (
          itemKwIds.includes(9715) ||
          /\b(superhero|marvel|dc comics|avengers)\b/i.test(itemOverview)
        ) {
          penalties += 45;
        }

        if (itemGenreIds.includes(35) || itemGenreIds.includes(27)) {
          penalties += 25;
        }
      }

      if (wantsRomCom) {
        if (
          darkOrExperimentalRomanceRegex.test(itemTitle) ||
          darkOrExperimentalRomanceRegex.test(itemOverview) ||
          itemKwIds.includes(9716)
        ) {
          penalties += 35;
        }

        if (
          tragicOrDepressingRomanceRegex.test(itemTitle) ||
          tragicOrDepressingRomanceRegex.test(itemOverview) ||
          itemGenreIds.includes(10752) ||
          itemGenreIds.includes(36)
        ) {
          penalties += 40;
        }

        const hasDrama = itemGenreIds.includes(18);
        if (hasDrama && !hasBothRomanceAndComedy) {
          penalties += 25;
        }

        if (!hasBothRomanceAndComedy) {
          penalties += 20;
        }
      }

      if (wantsPsychological) {
        if (
          slasherOrCheapHorrorRegex.test(itemTitle) ||
          slasherOrCheapHorrorRegex.test(itemOverview)
        ) {
          penalties += 40;
        }

        if (!isPsychologicalHit) {
          penalties += 20;
        }
      }

      if (parsedIntent.isHorrorNight) {
        if (
          !parsedIntent.wantsClassic &&
          releaseYear > 0 &&
          releaseYear < 2010
        ) {
          penalties += 25;
        }

        if (itemGenreIds.includes(35)) {
          penalties += 35;
        }

        if (voteCount < 1000) {
          penalties += 25;
        }

        const isSlowBurnOrArthouse =
          /\b(black and white|surrealist|arthouse|slow burn|psychological study|psycho|the shining|eraserhead|rosemary's baby)\b/i.test(
            itemOverview,
          ) || /\b(psycho|the shining|eraserhead)\b/i.test(itemTitle);

        if (isSlowBurnOrArthouse) {
          penalties += 20;
        }
      }

      if (wantsMagic) {
        if (
          nonMagicTitanOrNotebookRegex.test(itemOverview) ||
          nonMagicTitanOrNotebookRegex.test(itemTitle)
        ) {
          penalties += 35;
        } else if (!hasExplicitMagic) {
          penalties += 20;
        }
      }

      if (wantsTimeTravel && !hasTimeTravelSignal) {
        penalties += 35;
      }

      const isSuperhero =
        superheroRegex.test(itemTitle) ||
        superheroRegex.test(itemOverview) ||
        itemKwIds.includes(9715);

      if (wantsSuperhero) {
        if (isSuperhero) {
          s_intent = Math.min(100, s_intent + 45);
        } else {
          penalties += 55;
        }
      } else {
        if (isSuperhero && requestedActors.length === 0) {
          penalties += isExcludedSuperhero ? 80 : 40;
        } else if (isSuperhero && isExcludedSuperhero) {
          penalties += 80;
        }
      }

      const detectedSportSubThemes = parsedIntent.detectedKeywords.filter((k) =>
        ["racing", "boxing", "football", "basketball"].includes(k.name),
      );
      const userWantsSports =
        (parsedIntent.detectedGenres.includes("sports") ||
          detectedSportSubThemes.length > 0) &&
        !parsedIntent.isUnderdog &&
        !parsedIntent.isCuteAnimeRomCom &&
        !wantsSitcom;

      if (userWantsSports) {
        const hasSportsSignal =
          sportsRegex.test(itemOverview) ||
          sportsRegex.test(itemTitle) ||
          itemGenres.some((g) => g.includes("sport"));

        if (!hasSportsSignal) {
          penalties += 65;
        }

        const wantsSciFi =
          parsedIntent.detectedGenres.includes("scifi") || wantsTimeTravel;
        const hasSciFiOrTimeTravel =
          itemGenreIds.includes(878) ||
          timeTravelRegex.test(itemOverview) ||
          /\b(back to the future)\b/i.test(itemTitle);

        if (!wantsSciFi && hasSciFiOrTimeTravel) {
          penalties += 55;
        }
      }

      const isMovieSearch =
        parsedIntent.targetType === "movie" || item.media_type === "movie";
      const isTvMovieOrSpecial =
        itemGenreIds.includes(10770) ||
        /\b(doctor who|tv special|special episode|christmas special|holiday special|made-for-tv)\b/i.test(
          itemTitle,
        ) ||
        /\b(doctor who|tardis|time lord)\b/i.test(itemOverview);
      if (isMovieSearch && isTvMovieOrSpecial) {
        penalties += 35;
      }

      const isDarkOrThriller =
        itemGenreIds.includes(53) ||
        itemGenreIds.includes(80) ||
        itemGenreIds.includes(27) ||
        itemGenreIds.includes(10752);
      const userWantedDark =
        wantsDarkComedy ||
        parsedIntent.detectedKeywords.some((k) => k.name === "dark comedy") ||
        parsedIntent.detectedGenres.includes("horror") ||
        parsedIntent.detectedGenres.includes("mystery") ||
        parsedIntent.detectedGenres.includes("crime") ||
        parsedIntent.detectedGenres.includes("war") ||
        wantsDark ||
        parsedIntent.isHorrorNight ||
        parsedIntent.isCrimeHeist ||
        wantsPsychological ||
        parsedIntent.isHistoricalWar ||
        parsedIntent.isSwordWarfare ||
        parsedIntent.isTrueCrimeDoc ||
        parsedIntent.isKorean ||
        parsedIntent.hasTwistKeywords ||
        parsedIntent.isCyberpunk ||
        parsedIntent.isPhilosophicalSciFi ||
        parsedIntent.isUnderdog ||
        parsedIntent.isCrimeFamily ||
        parsedIntent.isHauntedHorror ||
        parsedIntent.isMindBlowingAction ||
        parsedIntent.isDarkAnime;
      if (
        parsedIntent.detectedGenres.includes("comedy") &&
        isDarkOrThriller &&
        !userWantedDark &&
        !parsedIntent.isFamilyAnimation &&
        !parsedIntent.isCuteAnimeRomCom
      ) {
        penalties += 30;
      }

      if (normalizedAnchorList.length > 0) {
        const cleanItem = itemTitle.toLowerCase().trim();
        const isExactOrSequel = normalizedAnchorList.some((aTitle) => {
          const cleanAnchor = aTitle.toLowerCase().trim();
          return (
            cleanItem === cleanAnchor ||
            cleanItem.startsWith(cleanAnchor + " ") ||
            cleanItem.startsWith(cleanAnchor + ":") ||
            cleanItem.startsWith(cleanAnchor + " -")
          );
        });

        if (isExactOrSequel) {
          penalties += 85;
          hasSevereExclusionViolation = true;
        }
      }

      const isExemptCuteAnime =
        parsedIntent.isCuteAnimeRomCom && isHitRomComAnime;
      const isExemptTrueCrime = parsedIntent.isTrueCrimeDoc && isHitTrueCrime;

      if (
        userReviewsCount >= 5 &&
        totalUserKw > 0 &&
        s_user_kw < 40 &&
        !isExemptCuteAnime &&
        !isExemptTrueCrime &&
        requestedActors.length === 0
      ) {
        penalties += 30;
      }

      let rawScore = 0;
      if (userReviewsCount < 5) {
        rawScore = 0.6 * s_intent + 0.4 * s_rating;
      } else if (userReviewsCount <= 9) {
        rawScore = 0.5 * s_intent + 0.15 * s_user + 0.35 * s_rating;
      } else {
        rawScore = 0.4 * s_intent + 0.35 * s_user + 0.25 * s_rating;
      }

      let popularityBonus = 0;
      if (voteCount >= 4000) {
        popularityBonus = 12;
      } else if (voteCount >= 1500) {
        popularityBonus = 8;
      } else if (voteCount >= 500) {
        popularityBonus = 4;
      }

      let recencyBonus = 0;
      if (!parsedIntent.wantsClassic && releaseYear >= 2010) {
        recencyBonus = 6;
      } else if (!parsedIntent.wantsClassic && releaseYear >= 2000) {
        recencyBonus = 3;
      }

      const hasHardPenaltyTrigger =
        isEcchiViolation ||
        isLowRatedQualityViolation ||
        isSciFiMismatchViolation ||
        hasModernGunsOrCrimeInSwordSearch ||
        hasSevereExclusionViolation ||
        (parsedIntent.isCuteAnimeRomCom &&
          (itemGenreIds.includes(10762) ||
            kidsMascotAnimeRegex.test(itemTitle)));

      const maxPenaltyCap = hasHardPenaltyTrigger ? 95 : 45;
      penalties = Math.min(penalties, maxPenaltyCap);

      const finalScore = Math.min(
        100,
        Math.max(
          0,
          rawScore + popularityBonus + recencyBonus + actorBoost - penalties,
        ),
      );

      return {
        ...item,
        breakdown: {
          s_intent,
          s_user,
          s_user_genre,
          s_user_kw,
          s_user_kw_bonus,
          matched_user_keywords,
          s_rating,
          penalties,
          popularityBonus,
          recencyBonus,
          actorBoost,
        },
        finalScore,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
};
