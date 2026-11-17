# CRICBETUL × RPL Season 5 — Netlify Production Package

यह package **RPL Season 5 public website + player/team registration + payment UTR submission + organizer control room + live auction + LED display + OBS overlay** के लिए है। इसमें Netlify Functions और Netlify Database (PostgreSQL) का उपयोग किया गया है, ताकि registrations और auction state browser `localStorage` में न रहें बल्कि server-side database में सुरक्षित रहें।

## Visual design update

The public website and auction launch page use a clean, mobile-first cricket sports design: white/off-white surfaces, forest-green sports accents, subtle gold details that complement the official RPL crest, clear registration cards, larger touch targets, readable forms and a mobile quick-navigation bar. The LED auction board and OBS overlay intentionally retain a dark broadcast look for high contrast on screens and video.

## इस version में

- Mobile-first, responsive RPL Season 5 public website
- Official RPL crest, CRICBETUL logo और supplied YES BANK QR
- Player registration और unique `RPL5-####` ID
- Team registration
- Uploaded player photos / team logos के लिए Netlify Blobs media storage
- Payment UTR submission; records `PENDING` रहते हैं जब तक Admin जांच न करे
- एक central Organizer Control Room (`/admin.html`) with player/team/payment/auction/settings/backup tabs and LED/OBS preview links
- Organizer login protected by server-side `RPL_ADMIN_TOKEN`
- Player/team approval, payment review, auction control, team purse / squad checks (existing UI controls के अनुसार)
- Public auction board, 1920×1080 LED display, transparent OBS overlay
- Admin JSON backup और CSV exports
- Public API में phone numbers और payment/UTR records expose नहीं होते
- Admin writes और public registrations PostgreSQL row transaction/lock से सुरक्षित किए जाते हैं

## महत्वपूर्ण: सिर्फ ZIP drag-and-drop पर्याप्त नहीं है

इस package में server-side Functions और database migrations हैं। इसलिए इसे Netlify के साधारण static drag-and-drop upload की तरह deploy न करें। सबसे आसान रास्ता है ZIP extract करना, पूरा folder GitHub repository में डालना, फिर Netlify में उस GitHub repository को import करना। इससे Netlify build process Functions bundle कर सकता है और database migration apply कर सकता है।

Netlify Database की current documentation के अनुसार यह managed PostgreSQL है, `@netlify/database` dependency और `netlify/database/migrations/` में migration files से setup/migration lifecycle जुड़ा है। Netlify Database credit-based plans पर उपलब्ध है और compute/bandwidth credits consume कर सकता है। अगर आपके Netlify account में Database उपलब्ध नहीं है, deploy में database provisioning error आएगा; उस स्थिति में Supabase backend वाला विकल्प चाहिए होगा।

## Netlify पर deploy करने के steps

### 1. ZIP extract करें

`CRICBETUL_RPL5_NETLIFY.zip` को extract करें। Project root में `package.json`, `netlify.toml`, `public/` और `netlify/` folders होने चाहिए।

### 2. GitHub में project डालें

1. GitHub पर नया repository बनाएं, बेहतर है Private repository रखें।
2. ZIP extract करने के बाद उसके **अंदर की सभी files/folders** repository के root में upload करें। `CRICBETUL_RPL5_NETLIFY/CRICBETUL_RPL5_NETLIFY/` जैसी double nesting न बनाएं।
3. Commit करें।

### 3. Netlify से repository connect करें

1. Netlify Dashboard खोलें।
2. **Add new project → Import an existing project → GitHub** चुनें।
3. अपनी repository चुनें।
4. Build command `npm run build` और Publish directory `public` रखें। ये values `netlify.toml` में भी मौजूद हैं।
5. Deploy करें।

### 4. Netlify Database चालू करें

- Project में Netlify Database feature उपलब्ध होना चाहिए।
- इस project में `@netlify/database` dependency और `netlify/database/migrations/0001_create_rpl_state.sql` मौजूद हैं।
- Deploy lifecycle database provision/migration को process करेगा।
- Database plan/credits की उपलब्धता और billing Netlify account में जाँचें।

### 5. Admin secret सेट करें

Netlify → Project configuration → Environment variables में यह variable बनाएं:

- Name: `RPL_ADMIN_TOKEN`
- Value: कम से कम 32 characters का अपना unique random secret
- Scope: Functions (या All scopes)

Mac Terminal पर secret बनाने का command:

```bash
openssl rand -hex 32
```

Generated secret को Netlify environment variable में डालें। इसे GitHub, source code, WhatsApp group या public website में न डालें। इसके बाद नया deploy trigger करें। Netlify Functions runtime में environment variables Netlify UI/CLI/API से उपलब्ध होते हैं; `netlify.toml` में secret लिखना सुरक्षित या समर्थित तरीका नहीं है।

### 6. Deploy test करें

Deploy के बाद ये URLs खोलें:

- `/` — मुख्य RPL वेबसाइट
- `/admin.html` — एक जगह से Organizer Control Room खोलने का shortcut
- `/auction.html` — auction launchpad
- `/display.html` — LED / TV display
- `/overlay.html` — OBS transparent overlay
- `/setup-check.html` — Functions + database + admin setup status

`/setup-check.html` पर Database `Connected` और Organizer login `Configured` दिखना चाहिए। इसके बाद Organizer Control Room में `RPL_ADMIN_TOKEN` value से login करें।

## Local preview

Mac पर `run-demo-mac.command` चलाएं या project root में:

```bash
python3 -m http.server 8080 --directory public
```

फिर `http://localhost:8080` खोलें। Plain static local preview में Netlify Functions/Database नहीं चलते; local browser demo केवल localStorage preview mode है। Production test Netlify deploy पर करें।

Netlify Database local development के लिए Netlify CLI 26+ और Node.js 20.12.2+ की आवश्यकता बताई गई है; इस project में Node 22.13 रखा गया है। CLI local DB workflow के लिए `netlify dev` और database setup इस्तेमाल करें।

## Data कहाँ save होगा?

- Player/team/payment/auction state: Netlify managed PostgreSQL की `rpl_state` JSONB record में।
- Player photographs/team logos: Netlify Blobs `rpl-season5-media` store में।
- Static site files: `public/` folder में।

Website redeploy करने से managed database और site-wide media store की data files को सामान्यतः static build files की तरह replace नहीं किया जाता। फिर भी event से पहले और बाद में Admin panel से JSON backup download करें।

## Payment safety — public collection शुरू करने से पहले

Supplied QR में beneficiary `Mera Watan Welfare Foundation Betul` और decoded UPI ID `yespay.ypbsm000011951@yesbankltd` आता है। RPL organizer का नाम `Yuva Sangathan Raghuvanshi Samaj, District Betul` है — ये अलग names हैं। Organizer/account holder से लिखित अनुमति और beneficiary/UPI ID की पुष्टि किए बिना QR से tournament money collect न करें। Backup number `9303733408` को वेबसाइट में backup contact/payment number के रूप में रखा गया है; इसे UPI-enabled मानकर कोई auto-pay link नहीं बनाया गया है।

इस package में payment gateway, card processing, netbanking, automatic bank reconciliation या automatic payment confirmation शामिल नहीं है। यह UPI QR/UPI instructions और manual UTR submission/verification है। Admin को हर UTR receiving bank/account में check करना होगा। Website कभी UPI PIN, OTP, card CVV या bank password नहीं माँगती।

## Security notes

- Admin token server-side environment variable में रहता है; frontend में hardcode नहीं है।
- Admin endpoints token के बिना state return/save नहीं करते।
- Payment information public API से बाहर रखी जाती है।
- Public registrations validate होती हैं और image upload type/size सीमित है।
- एक single organizer/auction operator session का उपयोग करें; कई operators द्वारा एक साथ auction edits न करें।
- Netlify Database transaction support के साथ relational data के लिए है; media files Netlify Blobs में जाती हैं।
- नियमित database backups और export files रखें।

## Features की सीमा

यह package registration, payments review, player auction और OBS/LED auction graphics के लिए है। `/admin.html` एक ही control room entry देता है; उसी में players, teams, payments, auction, broadcast outputs, settings और backup के tabs हैं। यह ball-by-ball cricket scoring engine नहीं है और YouTube livestream को host/stream नहीं करता। Automatic bank reconciliation/payment gateway भी शामिल नहीं है।

## Troubleshooting

**`Database is not ready`**: Netlify account में Database feature/credits की उपलब्धता, migration status और deploy logs जाँचें।

**Admin login fail**: `RPL_ADMIN_TOKEN` सही नाम और Functions scope में set करें, फिर redeploy करें।

**Photo upload fail**: image 5 MB से छोटी होनी चाहिए; browser compressed photo upload करता है। Netlify request size/Function logs देखें।

**No cross-device updates**: `/setup-check.html` में database connected होना चाहिए। LED, OBS और public website सभी same deployed domain के URLs से खोलें।
