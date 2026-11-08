# 説明書(guide.html)を作る。日本語と英語を同じ形で書き、ページの中で切りかえる。
#   python3 tools/make_guide.py
# 画面の写真は assets/guide/ にある(tools/make_guide_scene.py の海の絵の上に、本物の操作パネルを出して撮ったもの)
import html, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

# 出方(アプリの出方と同じ順)。[日本語, 英語, 日本語の説明, 英語の説明, まれさ(1よくある〜3めったにない)]
PATTERNS = [
    ('潮吹きと背中', 'Blow & back', '息をしながら、背中を見せてゆっくり泳ぐ', 'Breathes and rolls its back at the surface', 1),
    ('鳴き声だけ', 'Song only', '姿は見えず、遠くから歌が聞こえる', 'No whale in sight, just a song from afar', 1),
    ('尾びれを上げて潜る', 'Fluke-up dive', '大きな尾びれを見せて深く潜る', 'Lifts its big tail and dives deep', 1),
    ('ジャンプ', 'Breach', '体の半分以上が水から飛び出す', 'Leaps half its body out of the water', 1),
    ('親子で泳ぐ', 'Mother & calf', 'お母さんと子どもがならんで泳ぐ', 'A mother and calf swim side by side', 2),
    ('寝ているクジラ', 'Sleeping whales', '水面に浮かんで、うとうと休む', 'Float at the surface and rest', 2),
    ('群れで泳ぐ', 'Pod', '付きそいのオスもいっしょに旅をする', 'A small group travels together', 2),
    ('大ジャンプ', 'Full breach', '尾びれの先まで、体全体が空中に!', 'The whole body clears the water!', 2),
    ('親子でジャンプ', 'Calf breach', '子どもが何度もジャンプの練習', 'The calf practices leaping again and again', 2),
    ('スパイホップ', 'Spyhop', '水面から顔を出して、まわりを見る', 'Pokes its head up to look around', 2),
    ('胸びれでたたく', 'Flipper slap', '長い胸びれで水面をバシャン', 'Slaps the water with its long flipper', 2),
    ('尾びれでたたく', 'Tail slap', '尾びれで水面をバシーン', 'Smacks the water with its tail', 2),
    # めったにない4つは、会えたときのお楽しみ(名前も、どんな姿かも書かない)
    ('？？？', '???', '会えたときのお楽しみ', 'A surprise for when you see it', 3),
    ('群れでスパイホップ', 'Group spyhop', 'みんなで顔を出して、きょろきょろ', 'Several heads pop up together', 3),
    ('？？？', '???', '会えたときのお楽しみ', 'A surprise for when you see it', 3),
    ('捕食', 'Lunge feeding', '口を大きく開けて、水ごとのみこむ', 'Opens wide and gulps a huge mouthful', 3),
    ('？？？', '???', '会えたときのお楽しみ', 'A surprise for when you see it', 3),
    ('？？？', '???', '会えたときのお楽しみ', 'A surprise for when you see it', 3),
]

# 「クジラをもっと知る(PR)」の紹介リンク(アフィリエイト)。url に紹介リンクを入れると、そのカードが押せるようになる。
# 空のあいだは「準備中」と出る。provider が 'amazon' のリンクが1つでもあると、Amazon アソシエイトの決まった文を出す
# (ステマ規制のため、見出しに「PR」を付け、紹介料を受け取ることをはっきり書いている)
AFFILIATE = [
    {'icon': 'boat', 'url': '', 'provider': '',
     'ja': ('本物のクジラに会いに行く', '沖縄・奄美・小笠原では、冬から春にザトウクジラに会えます。ホエールウォッチングのツアー'),
     'en': ('Meet real whales', 'In Okinawa, Amami and Ogasawara, humpbacks visit from winter to spring. Whale-watching tours')},
    {'icon': 'book', 'url': '', 'provider': '',
     'ja': ('クジラの本・図鑑', '尾びれでの見分け方や、歌のふしぎ。研究者ごっこが楽しくなる本'),
     'en': ('Whale books', 'How flukes tell whales apart, and the mystery of their songs')},
    {'icon': 'picture', 'url': '', 'provider': '',
     'ja': ('クジラの絵本', '寝る前に、子どもといっしょに読める絵本'),
     'en': ('Picture books', 'Whale stories to read together at bedtime')},
    {'icon': 'heart', 'url': '', 'provider': '',
     'ja': ('クジラのぬいぐるみ', 'ザトウクジラのぬいぐるみ。寝るときのおともに'),
     'en': ('Whale plushies', 'A cuddly humpback to keep you company')},
]

def t(ja, en):
    return {'ja': ja, 'en': en}

def phone(img, alt, tilt=0):
    return f'<figure class="phone" style="--tilt:{tilt}deg"><img src="assets/guide/{img}" alt="{html.escape(alt)}" loading="lazy" width="520" height="1126"></figure>'

def section(L, sid, color, icon, title, lead, body, shots):
    shots_html = ''.join(shots)
    return f'''
  <section class="feature" id="{sid}-{L}" style="--c: var(--{color})">
    <div class="feature-text">
      <span class="badge" aria-hidden="true">{icon}</span>
      <h2>{title}</h2>
      <p class="lead">{lead}</p>
      {body}
    </div>
    <div class="shots">{shots_html}</div>
  </section>'''

ICON = {
    'start': '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    'panel': '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 15h8M8 11h5"/></svg>',
    'whale': '<svg viewBox="0 0 24 24"><path d="M3 13c2-4 7-6 12-5l3-2v3c1.5 1 2.5 2 3 3l-3 1c-3 4-10 5-15 0z"/></svg>',
    'book': '<svg viewBox="0 0 24 24"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></svg>',
    'share': '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6h14v-6"/></svg>',
    'clock': '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M9.5 3h5"/></svg>',
    'moon': '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
    'camera': '<svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    'boat': '<svg viewBox="0 0 24 24"><path d="M3 15h18l-2.5 4h-13z"/><path d="M12 4v11M12 5l6 8h-6"/></svg>',
    'picture': '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 16l5-5 4 4 2-2 5 5"/><circle cx="15.5" cy="9.5" r="1.5"/></svg>',
    'heart': '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    'more': '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>',
    'help': '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/></svg>',
}

def page(L):
    T = lambda ja, en: ja if L == 'ja' else en
    rare = {1: T('よく出る', 'Common'), 2: T('ときどき', 'Sometimes'), 3: T('めったにない', 'Rare')}
    chips = ''.join(
        f'<li class="chip r{r}"><b>{T(a, b)}</b><span>{T(c, d)}</span><em>{rare[r]}</em></li>'
        for a, b, c, d, r in PATTERNS)
    nav = [('start', T('はじめる', 'Start')), ('panel', T('操作パネル', 'Panel')), ('whales', T('クジラの出かた', 'Whales')),
           ('book', T('写真と図鑑', 'Photos & Book')), ('share', T('シェア', 'Share')), ('timer', T('タイマー', 'Timer')),
           ('sleep', T('おやすみ', 'Sleep')), ('night', T('寝かしつけ', 'Bedtime')), ('more', T('もっと知る', 'Learn more')), ('help', T('こまったとき', 'Help'))]
    nav_html = ''.join(f'<a href="#{k}-{L}">{v}</a>' for k, v in nav)
    S = []
    S.append(section(L, 'start', 'sun', ICON['start'], T('まずは、海へ', 'First, head to the sea'),
        T('画面の「さぁ、クジラたちに会いにいこう」をタップすると、波の音が流れはじめます。あとは、のんびり待つだけ。',
          'Tap “Let’s go meet the whales” and the waves start rolling in. Then just relax and wait.'),
        f'''<ul class="steps">
          <li>{T('音を出したいときは、iPhone のマナーモードを切っておいてね。', 'Turn off silent mode on iPhone to hear the sound.')}</li>
          <li>{T('ホーム画面に追加すると、アプリみたいに開けます。一度開けば、電波がなくても動きます。', 'Add it to your home screen to open it like an app. After the first visit it even works offline.')}</li>
          <li class="tip"><b>iPhone</b> {T('共有ボタン →「ホーム画面に追加」', 'Share button → “Add to Home Screen”')}　<b>Android</b> {T('メニュー →「ホーム画面に追加」', 'Menu → “Add to Home screen”')}</li>
        </ul>''',
        [phone(f'{L}-start.jpg', T('はじめの画面', 'Start screen'), -3)]))
    S.append(section(L, 'panel', 'sea', ICON['panel'], T('タップでパネルが出るよ', 'Tap for the control panel'),
        T('海をタップすると操作パネルが出て、もう一度タップすると消えます。勝手には消えないので、ゆっくり選べます。',
          'Tap the sea to show the panel, and tap again to hide it. It stays put until you do.'),
        f'''<dl class="legend">
          <div><dt>{T('景色', 'View')}</dt><dd>{T('崖の上・上空・間近の3つのカメラ', 'Three cameras: Cliff, Sky and Up close')}</dd></div>
          <div><dt>{T('空', 'Sky')}</dt><dd>{T('帯の太陽を指でなぞると、好きな時刻の空に(15分きざみ)。ちょんと押すと朝・昼・夕方・夜。ゴールデンアワーやブルーアワーも。「自動」は本物の空に合わせます', 'Drag the sun along the bar for any time of day (in 15-minute steps), or tap for morning, day, evening or night, plus golden and blue hour. “Auto” follows the real sky')}</dd></div>
          <div><dt>{T('図鑑', 'Book')}</dt><dd>{T('会えたクジラの記録', 'Your record of whales you have met')}</dd></div>
          <div><dt>{T('シャッター', 'Shutter')}</dt><dd>{T('いまの海を写真に', 'Take a photo of the sea right now')}</dd></div>
          <div><dt>{T('呼ぶ', 'Call')}</dt><dd>{T('すぐにクジラが来てくれる(図鑑には数えません)', 'A whale comes right away (not counted in your Book)')}</dd></div>
          <div><dt>{T('右上', 'Top right')}</dt><dd>{T('全画面・タイマー・音量・真っ暗画面・おやすみモード', 'Full screen, timers, volume, dark screen and sleep mode')}</dd></div>
          <div><dt>{T('言語', 'Language')}</dt><dd>{T('日本語と English を切りかえ', 'Switch between Japanese and English')}</dd></div>
        </dl>''',
        [phone(f'{L}-panel.jpg', T('操作パネル', 'Control panel'), 2)]))
    S.append(f'''
  <section class="feature wide" id="whales-{L}" style="--c: var(--coral)">
    <div class="feature-text">
      <span class="badge" aria-hidden="true">{ICON['whale']}</span>
      <h2>{T('クジラたちは、気まぐれにやってくる', 'The whales come when they please')}</h2>
      <p class="lead">{T('はじめは「よく来る」で、5〜15分に1回くらい。どんな姿を見せてくれるかは、そのときのお楽しみ。来る間隔は、時計のボタンで「ときどき(1〜3時間)」まで変えられます。間隔を長くするほど、めずらしい動きに会いやすくなります。',
        'At first they come “Often”, about once every 5–15 minutes, and you never know what you will see. Use the clock button to change how often, up to “Rarely” (1–3 h). The longer the gap, the rarer the moves you may see.')}</p>
    </div>
    <ul class="chips">{chips}</ul>
    <p class="note">{T('どの動きも、記録計をつけたクジラの研究や図鑑の数値をもとに作っています。', 'Every move is based on figures from tagging studies and field guides.')}</p>
  </section>''')
    S.append(section(L, 'book', 'mint', ICON['book'], T('写真を撮って、図鑑をうめよう', 'Snap photos, fill your Book'),
        T('水面に姿を見せたクジラは、図鑑にのります。尾びれの裏の模様は1頭ずつちがうので、同じ子が来るとわかるよ。',
          'Whales that show themselves at the surface are added to your Book. Each has its own fluke pattern, so you will know when an old friend returns.'),
        f'''<ul class="levels">
          <li><b>1{T('回', '×')}</b>{T('尾びれの模様と名前', 'Fluke pattern and name')}</li>
          <li><b>2{T('回', '×')}</b>{T('全長', 'Length')}</li>
          <li><b>3{T('回', '×')}</b>{T('体重と特徴', 'Weight and features')}</li>
          <li class="cam"><b>{ICON['camera']}</b>{T('その子の写真を撮ると、全身の姿がのる', 'Photograph it to add its full-body portrait')}</li>
        </ul>
        <p>{T('「名前を付ける」で、好きな名前に変えられます。真っ白な子やフジツボだらけの子など、24頭の個性をさがしてね。', 'Tap “Rename” to give it any name you like. Look for all 24, from a pure white whale to one covered in barnacles.')}</p>
        <p class="tip-box">{T('はじめて会ったクジラにはタグが付き、図鑑の地図で「いまどのあたりを旅しているか」が見られます。もう一度会うと、そのあいだに回ってきた回遊の道すじが地図にのります。', 'Each whale is tagged the first time you meet. Its page shows a map of where it is traveling now, and when you meet again, the route of its migration is added.')}</p>
        <p class="tip-box">{T('図鑑の「歌」には、聞いたクジラの歌が月ごとに集まります。本物のザトウクジラのように、歌は月ごとに少しずつ形を変え、毎年7月にはがらりと新しい歌に入れかわります。', 'The “Songs” tab collects the whale songs you hear, month by month. Like real humpbacks, the song changes a little every month, and every July a brand-new song takes over.')}</p>
        <p class="tip-box">{T('撮った写真には100点まん点の点数がつきます。クジラを大きく、まんなか近くに、体が切れないように写すと「写り方」(60点)が上がり、ジャンプの空中や泡の輪、とくべつな子、夕焼けや夜の空、何頭もいっしょだと「めずらしさ」(40点)が上がります。90点以上はS!', 'Every photo gets a score out of 100. Framing (60): a big whale, near the middle, not cut off. Rarity (40): mid-air jumps, bubble rings, special whales, sunset or night skies, several whales together. 90+ is an S!')}</p>
        <p class="tip-box">{T('図鑑の「研究」は、研究者ごっこ。海で撮った尾びれの写真を見て、図鑑のどの子かを当てます。3頭以上に会うと遊べます。', '“Research” is a scientist game: look at a fluke photo taken at sea and find which whale in your Book it is. Meet 3 whales to unlock it.')}</p>
        <p class="tip-box">{T('機種変更の前は、図鑑のいちばん下の「バックアップ」で、図鑑と写真をファイルに書き出しておくと安心。新しいスマホで「ファイルから読み込む」と、もとにもどります。', 'Changing phones? Use “Backup” at the bottom of the Book to save your whales and photos to a file, then “Load from a file” on the new phone.')}</p>''',
        [phone(f'{L}-book.jpg', T('図鑑の一覧', 'Whale Book list'), -2), phone(f'{L}-whale.jpg', T('1頭のページ', 'A whale’s page'), 3)]))
    S.append(section(L, 'share', 'sea', ICON['share'], T('お気に入りを、シェア', 'Share your favorites'),
        T('図鑑の「この子をシェアする」や「写真と名前を1枚にまとめてシェア」で、X や Instagram にそのまま投稿できる1枚ができます。',
          'Use “Share this whale” or “Share my photos and whales” in the Book to make a ready-to-post image for X or Instagram.'),
        f'''<ul class="steps">
          <li>{T('大きさは Instagram の縦長(4:5)。X でもきれいに見えます。', 'It is sized for Instagram portrait posts (4:5) and looks great on X too.')}</li>
          <li>{T('共有の画面が出ないときは、画像を長押しして保存してから投稿してね。', 'If the share sheet does not open, long-press the image to save it, then post it.')}</li>
        </ul>''',
        [f'<figure class="card-shot"><img src="assets/guide/{L}-card.jpg" alt="{T("シェア用の1枚", "Share image")}" loading="lazy" width="720" height="900"></figure>']))
    S.append(section(L, 'timer', 'sun', ICON['clock'], T('クジラが時間を教えてくれる', 'A whale tells you the time'),
        T('時計のボタンでタイマーを決めると、その時間にクジラが鳴きながら顔を出して知らせてくれます。おやすみモードでも鳴るよ。',
          'Set a timer with the clock button. When time is up, a whale pops up calling to let you know, even in sleep mode.'),
        f'''<ul class="steps">
          <li>{T('「5分後」〜「1時間後」か、「時刻で」決められます。', 'Choose 5 minutes to 1 hour, or pick a time.')}</li>
          <li>{T('タイマーのあいだは、ほかのクジラは来ません。', 'No other whales come while the timer is running.')}</li>
          <li>{T('「来る前に知らせる」をオンにすると、ほかのタブやアプリを見ているときや、しばらく画面をさわっていないときに、クジラが来る1分前くらいに「もうすぐクジラが来てくれるかも?」と知らせます。知らせてから5分さわらないと、はじめのページにもどります。', 'Turn on “Let me know before” to get a heads-up about a minute before a whale comes, while you are in another tab or app or have not touched the screen for a while. If you do not touch the app for 5 minutes after that, it goes back to the start page.')}</li>
          <li class="tip">{T('スマホでは、ほかのアプリに切りかえたり画面を消したりすると、アプリが止まるので知らせられません。おやすみモード・タイマー・真っ暗画面のときも知らせません。', 'On phones, the app pauses when you switch apps or turn off the screen, so it cannot notify you then. No heads-up in sleep mode, during timers, or with the dark screen.')}</li>
          <li class="tip">{T('画面が消えると鳴らないので、画面はつけたままにしてね。', 'Keep the screen on. It cannot ring once the screen sleeps.')}</li>
        </ul>''',
        [phone(f'{L}-timer.jpg', T('タイマーを決める', 'Setting a timer'), -2), phone(f'{L}-alarm.jpg', T('時間になったとき', 'When time is up'), 3)]))
    S.append(section(L, 'sleep', 'night', ICON['moon'], T('おやすみモード', 'Sleep mode'),
        T('右上の月のボタンで、波の音だけのおやすみモードに。クジラの大きな声は鳴らないので、赤ちゃんの寝かしつけにぴったり。',
          'The moon button switches to sleep mode: waves only, no loud whale calls. Perfect for bedtime.'),
        f'''<ul class="steps">
          <li>{T('オンのあいだは月のボタンが光り、パネルを閉じても右上に小さな月が出ます。', 'The moon button glows while it is on, and a tiny moon stays in the corner when the panel is closed.')}</li>
          <li>{T('ときどき、クジラの親子のささやき(波にまぎれるくらい小さな声)が聞こえます。本物の親子も、敵に聞かれないように小さな声で話します。いらないときは、音量のボタンで切れます。', 'Now and then you may hear a mother and calf whispering, softer than the waves. Real humpback mothers and calves whisper so predators cannot hear. Turn it off under the volume button.')}</li>
          <li>{T('パネルの下の「閉じても残るボタン」で、写真のボタンを左下・真ん中・右下に残せます。', 'Under “Photo button” you can keep a shutter on screen at the left, center or right.')}</li>
        </ul>''',
        [phone(f'{L}-sleep.jpg', T('おやすみモード', 'Sleep mode'), 2), phone(f'{L}-closed.jpg', T('パネルを閉じたところ', 'Panel closed'), -3)]))
    S.append(section(L, 'night', 'night', ICON['moon'], T('寝かしつけの、心強い味方', 'Bedtime helpers'),
        T('時計のボタンの「おやすみタイマー」を決めると、波の音がだんだん小さくなって、静かに止まります。眠ったあとに音が鳴りつづけません。',
          'Set the “Sleep timer” under the clock button and the waves slowly fade out, then stop, so nothing keeps playing after your little one drifts off.'),
        f'''<ul class="steps">
          <li>{T('15分・30分・1時間・1時間半から選べます。後ろの半分で、ゆっくり小さくなります。', 'Choose 15 min, 30 min, 1 h or 1.5 h. The second half fades out gently.')}</li>
          <li>{T('小さくなりはじめたら、クジラは来ません。止まったあとは、画面をタップすると、また流れます。', 'No whales come once the fade begins. When it stops, tap the screen to start the waves again.')}</li>
          <li>{T('音量のボタンの「水中マイク」をオンにすると、水の中で聞いているような音に。波はこもって、クジラの声が近くなり、ときどき遠くの歌が聞こえてきます。', 'Turn on “Hydrophone” under the volume button to listen as if underwater: the waves are muffled, whale calls come closer, and distant songs sometimes drift in.')}</li>
          <li>{T('右上の「真っ暗画面」のボタンで、音はそのままに画面だけ真っ暗にできます。タップでもどります。夜の部屋がまぶしくならず、電池ももちます。', 'The dark-screen button at the top right turns the screen black while the sound keeps playing. Tap to come back. No glow in the bedroom, and it saves battery.')}</li>
        </ul>''',
        [phone(f'{L}-sleeptimer.jpg', T('おやすみタイマー', 'Sleep timer'), -2)]))
    faq = [
        (T('ボタンの意味を忘れた', 'I forgot what the buttons do'), T('パネルの左上の「使い方」を押すと、ボタンの紹介をもう一度見られます。', 'Tap “How to use” at the top left of the panel to see the button tour again.')),
        (T('音が出ない', 'No sound'), T('マナーモードを切って、音量を上げてみてね。おやすみモードのときは、クジラの大きな声は鳴りません。', 'Turn off silent mode and turn up the volume. In sleep mode, loud whale calls do not play.')),
        (T('しばらくすると止まる', 'It stops after a while'), T('画面が消えると止まります。おやすみタイマーを決めているあいだは、画面がつけたままになります(できる端末のみ)。画面の光が気になるときは「真っ暗画面」を使ってね。', 'It pauses when the screen sleeps. While a sleep timer is set, the screen stays on (on supported devices). If the light bothers you, use the dark screen.')),
        (T('クジラが来ない', 'No whales come'), T('時計のボタンで選んだ間隔で来ます(はじめは5〜15分に1回くらい)。待てないときは「呼ぶ」を押してね。', 'They come at the pace set with the clock button (about every 5–15 minutes at first). Can’t wait? Tap “Call”.')),
        (T('図鑑や写真は、どこにあるの?', 'Where are my Book and photos?'), T('このスマホのブラウザの中だけに保存されています。どこにも送っていません。', 'Only in this browser on this device. Nothing is sent anywhere.')),
    ]
    faq_html = ''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q, a in faq)
    # クジラをもっと知る(PR)
    cards = []
    for a in AFFILIATE:
        title, text = a[L]
        inner = f'<span class="aff-icon" aria-hidden="true">{ICON[a["icon"]]}</span><span class="aff-text"><b>{title}</b><span>{text}</span></span>'
        if a['url']:
            cards.append(f'<li><a class="aff-card" href="{html.escape(a["url"])}" target="_blank" rel="sponsored noopener">{inner}<em>{T("見てみる", "Take a look")} ↗</em></a></li>')
        else:
            cards.append(f'<li><div class="aff-card soon">{inner}<em>{T("準備中", "Coming soon")}</em></div></li>')
    amazon = any(a['provider'] == 'amazon' and a['url'] for a in AFFILIATE)
    S.append(f'''
  <section class="feature wide" id="more-{L}" style="--c: var(--sun)">
    <div class="feature-text">
      <span class="badge" aria-hidden="true">{ICON['more']}</span>
      <h2>{T('クジラをもっと知る', 'Learn more about whales')} <span class="pr">PR</span></h2>
      <p class="lead">{T('アプリで会ったクジラの、本物に会いに行ったり、本で調べたり。', 'Go meet the real ones, or read more about the whales you met in the app.')}</p>
    </div>
    <ul class="aff">{''.join(cards)}</ul>
    <p class="aff-note">{T('この欄のリンクは広告(アフィリエイト)です。リンクから買ったり申し込んだりすると、このアプリの作者が紹介料を受け取ることがあります。値段は変わりません。', 'Links in this section are ads (affiliate links). If you buy or book through them, the maker of this app may earn a fee. It does not change your price.')}{(' ' + T('Amazonのアソシエイトとして、このアプリの作者は適格販売により収入を得ています。', 'As an Amazon Associate, the maker of this app earns from qualifying purchases.')) if amazon else ''}</p>
  </section>''')
    S.append(f'''
  <section class="feature wide" id="help-{L}" style="--c: var(--sea)">
    <div class="feature-text">
      <span class="badge" aria-hidden="true">{ICON['help']}</span>
      <h2>{T('こまったときは', 'If something seems off')}</h2>
    </div>
    <div class="faq">{faq_html}</div>
  </section>''')
    return f'''
<div data-l="{L}" lang="{L}"{' hidden' if L == 'en' else ''}>
  <header class="hero">
    <div class="hero-text">
      <p class="kicker">{T('つかいかたガイド', 'How to use')}</p>
      <h1>{T('クジラが<br>見てる', 'Whale<br>Watch')}</h1>
      <p class="hero-lead">{T('波の音を流しっぱなしにできる、海の定点カメラ。ときどき、クジラがやってきます。', 'A fixed camera on the sea with endless waves. Now and then, whales come by.')}</p>
      <div class="hero-actions">
        <a class="btn" href="./">{T('海を見に行く', 'Go to the sea')}</a>
        <span class="switch">{'<b>日本語</b> <a href="#" data-to="en">English</a>' if L == 'ja' else '<a href="#" data-to="ja">日本語</a> <b>English</b>'}</span>
      </div>
    </div>
    <div class="hero-shot">{phone(f'{L}-closed.jpg', T('海とクジラ', 'The sea and a whale'), 4)}</div>
  </header>
  <nav class="toc" aria-label="{T('もくじ', 'Contents')}">{nav_html}</nav>
  {''.join(S)}
  <footer class="foot">
    <a class="btn" href="./">{T('さぁ、クジラたちに会いにいこう', 'Let’s go meet the whales')}</a>
    <p><a href="about.html">{T('このアプリについて(素材・データの扱い)', 'About this app (credits, privacy)')}</a></p>
  </footer>
</div>'''

CSS = '''
  /* 海のポップなガイド: 太いふちと、ずらした影のステッカー風。色は空・海・太陽・サンゴ・ミントの5色 */
  :root {
    --bg: #eaf7ff; --paper: #ffffff; --ink: #0b2f5b; --muted: #43628a; --line: #0b2f5b;
    --sea: #1f7ae0; --coral: #ff6b57; --sun: #ffc23d; --mint: #22c3a2; --night: #3a3f9a;
    --wave: #cdeeff; --shadow: #0b2f5b;
    --display: "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Zen Maru Gothic", system-ui, sans-serif;
    --body: "Zen Maru Gothic", "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;
  }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --bg: #071a33; --paper: #0e2a4d; --ink: #eaf4ff; --muted: #a9c3e2; --line: #9fd3ff;
    --sea: #4aa3ff; --coral: #ff8a78; --sun: #ffd166; --mint: #3fe0bf; --night: #8f95ff; --wave: #0c2747; --shadow: #000814; color-scheme: dark; } }
  :root[data-theme="dark"] {
    --bg: #071a33; --paper: #0e2a4d; --ink: #eaf4ff; --muted: #a9c3e2; --line: #9fd3ff;
    --sea: #4aa3ff; --coral: #ff8a78; --sun: #ffd166; --mint: #3fe0bf; --night: #8f95ff; --wave: #0c2747; --shadow: #000814; color-scheme: dark; }
  * { box-sizing: border-box; }
  html { background: var(--bg); }
  body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--body); font-size: 16px; line-height: 1.75;
    padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
    padding-block: max(16px, env(safe-area-inset-top, 0px)) max(32px, env(safe-area-inset-bottom, 0px));
    background-image: radial-gradient(circle at 12% 8%, var(--wave) 0 120px, transparent 121px), radial-gradient(circle at 92% 30%, var(--wave) 0 160px, transparent 161px); }
  [hidden] { display: none !important; }
  a { color: var(--sea); font-weight: 700; }
  a:focus-visible, summary:focus-visible { outline: 3px solid var(--coral); outline-offset: 3px; border-radius: 8px; }
  main { width: min(1040px, 100%); margin: 0 auto; }
  h1, h2 { font-family: var(--display); text-wrap: balance; margin: 0; }
  .hero { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr); gap: 24px; align-items: center; padding-block: 24px 8px; }
  .kicker { display: inline-block; margin: 0 0 10px; padding: 4px 14px; border: 3px solid var(--line); border-radius: 999px;
    background: var(--sun); color: #0b2f5b; font-family: var(--display); font-weight: 800; letter-spacing: 0.06em; box-shadow: 3px 3px 0 var(--shadow); }
  h1 { font-size: clamp(52px, 12vw, 104px); line-height: 1.02; font-weight: 900; letter-spacing: 0.01em; color: var(--sea);
    text-shadow: 4px 4px 0 var(--sun); }
  .hero-lead { font-size: 18px; max-width: 30em; margin: 16px 0 20px; }
  .hero-actions { display: flex; flex-wrap: wrap; gap: 12px 16px; align-items: center; }
  .btn { display: inline-flex; align-items: center; min-height: 52px; padding: 0 24px; border: 3px solid var(--line); border-radius: 999px;
    background: var(--coral); color: #fff; text-decoration: none; font-family: var(--display); font-weight: 800; font-size: 18px; box-shadow: 4px 4px 0 var(--shadow);
    transition: transform .12s, box-shadow .12s; }
  .btn:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 var(--shadow); }
  .switch { font-size: 14px; display: inline-flex; gap: 10px; }
  .hero-shot { justify-self: center; }
  .phone { margin: 0; width: min(240px, 70vw); border: 4px solid var(--line); border-radius: 34px; overflow: hidden; background: #06325a;
    box-shadow: 6px 6px 0 var(--shadow); transform: rotate(var(--tilt)); }
  .phone img { display: block; width: 100%; height: auto; }
  .toc { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0 8px; }
  .toc a { padding: 6px 14px; border: 2px solid var(--line); border-radius: 999px; background: var(--paper); text-decoration: none; color: var(--ink);
    font-size: 14px; box-shadow: 2px 2px 0 var(--shadow); }
  .feature { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px 32px; align-items: center; margin: 36px 0;
    padding: 28px; border: 3px solid var(--line); border-radius: 28px; background: var(--paper); box-shadow: 6px 6px 0 var(--c); }
  .feature.wide { grid-template-columns: minmax(0, 1fr); }
  .feature-text { min-width: 0; }
  .badge { display: inline-grid; place-items: center; width: 56px; height: 56px; border: 3px solid var(--line); border-radius: 18px; background: var(--c);
    box-shadow: 3px 3px 0 var(--shadow); margin-bottom: 12px; transform: rotate(-6deg); }
  .badge svg { width: 30px; height: 30px; fill: none; stroke: #fff; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  .badge svg path[d^="M8 5v14"] { fill: #fff; }
  h2 { font-size: clamp(26px, 5vw, 36px); line-height: 1.25; font-weight: 800; }
  .lead { font-size: 17px; margin: 10px 0 14px; max-width: 34em; }
  .shots { display: flex; gap: 18px; flex-wrap: wrap; justify-content: center; }
  .shots .phone { width: min(200px, 42vw); }
  .card-shot { margin: 0; width: min(300px, 80vw); border: 4px solid var(--line); border-radius: 18px; overflow: hidden; box-shadow: 6px 6px 0 var(--shadow); transform: rotate(2deg); }
  .card-shot img { display: block; width: 100%; height: auto; }
  .steps { margin: 0; padding-left: 1.2em; display: grid; gap: 6px; }
  .tip-box { margin: 10px 0 0; padding: 10px 14px; border-radius: 14px; background: var(--wave); font-size: 14px; }
  .steps .tip { list-style: none; margin-left: -1.2em; padding: 8px 12px; border-radius: 14px; background: var(--wave); font-size: 14px; }
  .legend { display: grid; gap: 8px; margin: 0; }
  .legend div { display: grid; grid-template-columns: 6.5em minmax(0, 1fr); gap: 10px; align-items: baseline; }
  .legend dt { justify-self: start; padding: 2px 10px; border: 2px solid var(--line); border-radius: 10px; background: var(--sun); color: #0b2f5b;
    font-family: var(--display); font-weight: 800; font-size: 14px; }
  .legend dd { margin: 0; min-width: 0; }
  .chips { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr)); gap: 12px; }
  .chip { position: relative; padding: 12px 14px 12px; border: 2px solid var(--line); border-radius: 18px; background: var(--bg); display: grid; gap: 2px; }
  .chip b { font-family: var(--display); font-size: 17px; }
  .chip span { font-size: 14px; color: var(--muted); line-height: 1.55; }
  .chip em { position: absolute; top: -10px; right: 10px; font-style: normal; font-size: 11px; font-weight: 800; padding: 1px 9px; border: 2px solid var(--line); border-radius: 999px; color: #0b2f5b; }
  .chip.r1 em { background: var(--mint); } .chip.r2 em { background: var(--sun); } .chip.r3 em { background: var(--coral); color: #fff; }
  .note { margin: 14px 0 0; font-size: 13px; color: var(--muted); }
  .levels { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 8px; }
  .levels li { display: grid; grid-template-columns: 3.4em minmax(0, 1fr); gap: 10px; align-items: center; }
  .levels b { display: grid; place-items: center; height: 38px; border: 2px solid var(--line); border-radius: 12px; background: var(--mint); color: #0b2f5b;
    font-family: var(--display); font-weight: 900; font-variant-numeric: tabular-nums; }
  .levels .cam b { background: var(--coral); }
  .levels .cam svg { width: 22px; height: 22px; fill: none; stroke: #fff; stroke-width: 2; }
  .faq { display: grid; gap: 10px; }
  details { border: 2px solid var(--line); border-radius: 16px; background: var(--bg); padding: 4px 16px; }
  summary { cursor: pointer; font-family: var(--display); font-weight: 800; font-size: 17px; min-height: 44px; display: flex; align-items: center; }
  details p { margin: 0 0 12px; }
  .pr { display: inline-block; vertical-align: middle; margin-left: 6px; padding: 2px 10px; border: 2px solid var(--line); border-radius: 999px;
    background: var(--sun); color: #0b2f5b; font-size: 14px; letter-spacing: 0.08em; }
  .aff { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .aff-card { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 4px 12px; align-items: start; height: 100%; padding: 14px 16px;
    border: 2px solid var(--line); border-radius: 18px; background: var(--bg); color: var(--ink); text-decoration: none; box-shadow: 4px 4px 0 var(--shadow); }
  a.aff-card:hover { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 var(--shadow); }
  .aff-icon { display: grid; place-items: center; width: 44px; height: 44px; border: 2px solid var(--line); border-radius: 14px; background: var(--sun); }
  .aff-icon svg { width: 24px; height: 24px; fill: none; stroke: #0b2f5b; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .aff-text { display: grid; gap: 2px; }
  .aff-text b { font-family: var(--display); font-weight: 800; font-size: 17px; }
  .aff-text span { font-size: 14px; color: var(--muted); line-height: 1.6; }
  .aff-card em { grid-column: 2; font-style: normal; font-weight: 700; font-size: 14px; color: var(--sea); }
  .aff-card.soon { box-shadow: none; border-style: dashed; }
  .aff-card.soon em { color: var(--muted); }
  .aff-note { margin: 14px 0 0; font-size: 13px; line-height: 1.7; color: var(--muted); }
  .foot { text-align: center; padding-block: 20px 8px; display: grid; justify-items: center; gap: 8px; }
  @media (max-width: 720px) {
    .hero { grid-template-columns: minmax(0, 1fr); }
    .hero-shot { order: -1; }
    .feature { grid-template-columns: minmax(0, 1fr); padding: 22px 18px; }
    .legend div { grid-template-columns: minmax(0, 1fr); gap: 2px; }
    .aff { grid-template-columns: minmax(0, 1fr); }
  }
  @media (prefers-reduced-motion: reduce) { .btn { transition: none; } }
'''

SCRIPT = '''
<script>
  // アプリで選んだ言語(なければ端末の言語)で見せる。上の「日本語 / English」でも切りかえられる
  (function () {
    var pick = 'ja';
    try {
      var saved = JSON.parse(localStorage.getItem('whale-ocean-settings') || 'null');
      var l = saved && saved.lang;
      pick = l === 'ja' || l === 'en' ? l : (/^ja/i.test((navigator.languages && navigator.languages[0]) || navigator.language || 'ja') ? 'ja' : 'en');
    } catch (e) {}
    function show(l) {
      document.querySelectorAll('[data-l]').forEach(function (d) { d.hidden = d.getAttribute('data-l') !== l; });
      document.documentElement.lang = l;
      document.title = l === 'en' ? 'Whale Watch Guide' : 'クジラが見てる ガイド';
    }
    show(pick);
    document.querySelectorAll('[data-to]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); show(a.getAttribute('data-to')); window.scrollTo(0, 0); });
    });
  })();
</script>'''

out = f'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<title>クジラが見てる ガイド</title>
<meta name="description" content="クジラが見てるの使い方ガイド。カメラ、クジラの出かた、写真と図鑑、シェア、タイマー、おやすみモード。">
<meta name="theme-color" content="#1f7ae0">
<link rel="icon" href="assets/icons/favicon-32.png" sizes="32x32">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@700;800;900&family=Zen+Maru+Gothic:wght@500;700&display=swap" rel="stylesheet">
<style>{CSS}</style>
</head>
<body>
<main>
{page('ja')}
{page('en')}
</main>
{SCRIPT}
</body>
</html>
'''
(ROOT / 'guide.html').write_text(out)
print('guide.html', len(out))
