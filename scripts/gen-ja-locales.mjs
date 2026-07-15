import fs from "fs";
import path from "path";

const enDir = "src/locales/en";
const jaDir = "src/locales/ja";

const T = new Map();
const t = (en, ja) => T.set(en, ja);

// Core UI translations (EN exact match → JA)
const pairs = [
  ["Sign in to Locket", "Locketにログイン"],
  ["Email", "メール"],
  ["Phone number", "電話番号"],
  ["Password", "パスワード"],
  ["Enter your password", "パスワードを入力"],
  ["Forgot password?", "パスワードをお忘れですか？"],
  ["Remember me", "ログイン状態を保持"],
  ["Sign in with phone number?", "電話番号でログインしますか？"],
  ["Sign in with email?", "メールでログインしますか？"],
  ["Sign in", "ログイン"],
  ["Signing in...", "ログイン中..."],
  ["Please verify you are not a robot", "ロボットではないことを確認してください"],
  ["Invalid email address!", "メールアドレスが無効です！"],
  ["Invalid phone number!", "電話番号が無効です！"],
  ["Welcome, {{name}}!", "ようこそ、{{name}}さん！"],
  ["User", "ユーザー"],
  ["Incorrect email or password!", "メールまたはパスワードが正しくありません！"],
  [
    "Your session has expired. Please sign in again!",
    "セッションの有効期限が切れました。再度ログインしてください！",
  ],
  [
    "Too many failed attempts. Please try again later!",
    "失敗が多すぎます。しばらくしてから再試行してください！",
  ],
  ["You do not have permission to access this.", "この操作を行う権限がありません。"],
  ["Server error, please try again later!", "サーバーエラーです。しばらくしてから再試行してください！"],
  ["Connection error! Please check your network.", "接続エラーです。ネットワークを確認してください。"],
  ["Server did not return any data", "サーバーからデータが返りませんでした"],
  ["Please wait for Server02 to start.", "Server02の起動をお待ちください。"],
  ["Forgot password", "パスワードを忘れた場合"],
  [
    "Enter your email address to receive a password reset link.",
    "パスワード再設定リンクを受け取るメールアドレスを入力してください。",
  ],
  ["Enter your email", "メールアドレスを入力"],
  ["Send", "送信"],
  ["Sending...", "送信中..."],
  [
    "If you don't see the email, please check your Spam or Promotions folder.",
    "メールが届かない場合は、迷惑メールやプロモーションフォルダを確認してください。",
  ],
  ["Back to sign in", "ログインに戻る"],
  ["No account found with this email!", "このメールのアカウントが見つかりません！"],
  ["Notice from Huy Locket", "Huy Locketからのお知らせ"],
  [
    "A password reset link has been sent to your email!",
    "パスワード再設定リンクをメールに送信しました！",
  ],
  ["An error occurred, please try again later!", "エラーが発生しました。しばらくしてから再試行してください！"],
  ["Menu", "メニュー"],
  ["Sign out", "ログアウト"],
  ["Signed out successfully!", "ログアウトしました！"],
  ["Goodbye, {{name}}!", "さようなら、{{name}}さん！"],
  ["Sign out failed!", "ログアウトに失敗しました！"],
  ["Features", "機能"],
  ["Partners & Integrations", "パートナーと連携"],
  ["System & Support", "システムとサポート"],
  ["Resources", "リソース"],
  ["Home", "ホーム"],
  ["About Dio", "Dioについて"],
  ["Newsfeed", "ニュースフィード"],
  ["Install WebApp", "WebAppをインストール"],
  ["Support the project", "プロジェクトを支援"],
  ["Post photo & video", "写真・動画を投稿"],
  ["Locket Camera", "Locketカメラ"],
  ["Locket Tools", "Locketツール"],
  ["Locket Diary", "Locket日記"],
  ["Locket Friends", "Locketフレンド"],
  ["Membership plans", "メンバーシッププラン"],
  ["Your profile", "プロフィール"],
  ["Incidents", "障害情報"],
  ["Contact", "お問い合わせ"],
  ["Terms of use", "利用規約"],
  ["Privacy policy", "プライバシーポリシー"],
  ["Settings", "設定"],
  ["Timeline", "タイムライン"],
  ["Documentation", "ドキュメント"],
  ["Language", "言語"],
  ["Privacy", "プライバシー"],
  ["Seen Moments", "既読Moments"],
  [
    "When enabled, others can see that you've viewed their Moments.",
    "オンにすると、相手のMomentsを見たことが相手に伝わります。",
  ],
  ["Share History", "履歴を共有"],
  [
    "Automatically share your photo history from the last 30 days.",
    "直近30日の写真履歴を自動共有します。",
  ],
  ["Read Receipts", "既読表示"],
  [
    "When enabled, others can see that you've read their messages.",
    "オンにすると、メッセージの既読が相手に表示されます。",
  ],
  ["Hide from Search", "検索から隠す"],
  [
    "Allow others to find you using your username.",
    "ユーザー名で他の人に見つけられるようにします。",
  ],
  ["Watermark", "ウォーターマーク"],
  ["Watermark on save", "保存時のウォーターマーク"],
  [
    "On: add ♥ Locket when saving. Off: original photo.",
    "オン：保存時に♥ Locketを追加。オフ：オリジナル写真。",
  ],
  [
    "Add ♥ Locket at the bottom when downloading / sharing. Turn off to save the original.",
    "ダウンロード／共有時に下部へ♥ Locketを追加。オフでオリジナル保存。",
  ],
  ["On · ♥ Locket when saving", "オン · 保存時に♥ Locket"],
  ["Off · save original", "オフ · オリジナルを保存"],
  ["Media & saves", "メディアと保存"],
  ["📷 Media & saves", "📷 メディアと保存"],
  ["♥ Watermark", "♥ ウォーターマーク"],
  ["Send to", "送信先..."],
  ["Just now", "たった今"],
  ["{{count}} minutes ago", "{{count}}分前"],
  ["{{count}} hours ago", "{{count}}時間前"],
  ["{{count}} days ago", "{{count}}日前"],
  ["Checking server", "サーバーを確認中"],
  ["Server is running", "サーバーは稼働中です"],
  ["Server is unavailable", "サーバーに接続できません"],
  ["Restart", "再起動"],
  ["Go to Home", "ホームへ"],
  ["Cancel", "キャンセル"],
  ["Save", "保存"],
  ["Delete", "削除"],
  ["Edit", "編集"],
  ["Close", "閉じる"],
  ["Confirm", "確認"],
  ["Search", "検索"],
  ["Loading...", "読み込み中..."],
  ["Download", "ダウンロード"],
  ["Share", "共有"],
  ["Upload", "アップロード"],
  ["Friends", "フレンド"],
  ["Profile", "プロフィール"],
  ["Camera", "カメラ"],
  ["Music", "ミュージック"],
  ["Caption", "キャプション"],
  ["Theme", "テーマ"],
  ["Tools", "ツール"],
  ["Diary", "日記"],
  ["Post", "投稿"],
  ["Video", "動画"],
  ["Photo", "写真"],
  ["Image", "画像"],
  ["Error", "エラー"],
  ["Success", "成功"],
  ["Back", "戻る"],
  ["Next", "次へ"],
  ["Yes", "はい"],
  ["No", "いいえ"],
  ["Coming soon!", "近日公開！"],
  ["Send to...", "送信先..."],
  ["Preparing download...", "ダウンロード準備中..."],
  ["Download error", "ダウンロードエラー"],
  ["Share error", "共有エラー"],
];
for (const [en, ja] of pairs) T.set(en, ja);

function translateTree(obj) {
  if (typeof obj === "string") return T.has(obj) ? T.get(obj) : obj;
  if (Array.isArray(obj)) return obj.map(translateTree);
  if (obj && typeof obj === "object") {
    const o = {};
    for (const [k, v] of Object.entries(obj)) o[k] = translateTree(v);
    return o;
  }
  return obj;
}

const publicJa = {
  server: {
    checking: "サーバーを確認中",
    online: "サーバーは稼働中です",
    offline: "サーバーに接続できません",
  },
  time: {
    just_now: "たった今",
    minutes_ago: "{{count}}分前",
    hours_ago: "{{count}}時間前",
    days_ago: "{{count}}日前",
  },
  error_boundary: {
    title: "エラーが発生しました。",
    description:
      "Huy Locketで予期しないエラーが発生しました。アプリを再起動するか、コミュニティでサポートを受けてください。",
    restart: "再起動",
    join_community: "コミュニティに参加",
  },
  not_found: {
    title: "お探しのページは見つかりません。",
    description: "このページは存在しないか、移動した可能性があります。",
    go_home: "ホームへ",
  },
  loading_page: {
    title: "Huy Locketを読み込み中です。",
    description: "思い出を準備しています…",
  },
  rotating_circle: {
    outer: "Huy Locket • 瞬間をシェア •",
    inner: "Huy Locket • モダン • 便利 • クロスプラットフォーム • セキュリティ •",
  },
};

fs.mkdirSync(jaDir, { recursive: true });
fs.writeFileSync(
  path.join(jaDir, "public.json"),
  JSON.stringify(publicJa, null, 2) + "\n",
);

for (const file of ["auth.json", "features.json", "main.json"]) {
  const en = JSON.parse(fs.readFileSync(path.join(enDir, file), "utf8"));
  const ja = translateTree(en);
  // Force critical nested keys
  if (file === "features.json" && ja.setting_poup) {
    ja.setting_poup.title = "設定";
    if (ja.setting_poup.language) {
      ja.setting_poup.language.section = "🌐 言語";
      ja.setting_poup.language.title = "言語";
    }
    if (ja.setting_poup.media) {
      ja.setting_poup.media.section = "ウォーターマーク";
      ja.setting_poup.media.menu_name = "ウォーターマーク";
      if (ja.setting_poup.media.watermark) {
        ja.setting_poup.media.watermark.title = "ウォーターマーク";
        ja.setting_poup.media.watermark.description =
          "オン：保存時に♥ Locketを追加。オフ：オリジナルを保存。";
        ja.setting_poup.media.watermark.on_hint = "オン · 保存時に♥ Locket";
        ja.setting_poup.media.watermark.off_hint = "オフ · オリジナルを保存";
      }
    }
    if (ja.setting_poup.privacy) {
      ja.setting_poup.privacy.section = "👁 プライバシー";
    }
  }
  if (file === "features.json" && ja.language_popup) {
    ja.language_popup.title = "言語";
  }
  if (file === "main.json" && ja.home) {
    ja.home.send_to = "送信先...";
  }
  fs.writeFileSync(path.join(jaDir, file), JSON.stringify(ja, null, 2) + "\n");
  console.log("wrote", file);
}
console.log("Japanese locales ready");
