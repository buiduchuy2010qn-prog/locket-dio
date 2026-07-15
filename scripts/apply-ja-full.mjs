/**
 * apply-ja-full.mjs
 * Deep-walks en/*.json string values, replaces via EN→JA map, writes ja/*.json.
 * Preserves {{placeholders}}, JSON keys/structure. UTF-8, 2-space pretty, no BOM.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const enDir = path.join(root, "src/locales/en");
const jaDir = path.join(root, "src/locales/ja");
const FILES = ["main.json", "features.json", "auth.json", "public.json"];

/** @type {Record<string, string>} */
const MAP = {
  // —— Core / camera-critical ——
  " (1 more needed)": " （あと1人）",
  "({{percent}}% of storage)": "（ストレージの{{percent}}%）",
  "0.5x is not supported on this device": "この端末では0.5xに対応していません",
  "2x is not supported on this device": "この端末では2xに対応していません",
  "A password reset link has been sent to your email!":
    "パスワード再設定リンクをメールに送信しました！",
  "API version:": "APIバージョン：",
  "About Dio": "Dioについて",
  Accept: "承認",
  "Accepted {{name}}": "{{name}}さんを承認しました",
  "Accepting request...": "リクエストを承認中...",
  "Access management page": "管理ページを開く",
  Activated: "有効",
  Activity: "アクティビティ",
  "Add Friend": "友だちを追加",
  "Add a new friend...": "新しい友だちを追加...",
  "Add friend": "友だち追加",
  "Add members": "メンバーを追加",
  "Add to Group": "グループに追加",
  "Added a member to the group": "グループにメンバーを追加しました",
  "Added to queue!": "キューに追加しました！",
  "Added {{target}} to the group": "{{target}}さんをグループに追加しました",
  "Adding member...": "メンバーを追加中...",
  "Adding reaction...": "リアクションを追加中...",
  "Advanced Features of Huy Locket": "Huy Locketの高度な機能",
  All: "すべて",
  "All posts loaded": "すべての投稿を読み込みました",
  "All rights reserved.": "All rights reserved.",
  "All service workers have been unregistered!":
    "すべてのService Workerの登録を解除しました！",
  "All shown": "すべて表示済み",
  "Allow camera access": "カメラへのアクセスを許可",
  "Allow location access": "位置情報へのアクセスを許可",
  "Allow others to find you using your username.":
    "ユーザー名で他の人に見つけられるようにします。",
  "Allow receiving notifications": "通知の受信を許可",
  "An error occurred while cancelling request!":
    "リクエストのキャンセル中にエラーが発生しました！",
  "An error occurred, please try again later":
    "エラーが発生しました。しばらくしてから再試行してください",
  "An error occurred, please try again later!":
    "エラーが発生しました。しばらくしてから再試行してください！",
  "Anonymous View": "匿名閲覧",
  "Appearance Settings": "表示設定",
  "Are you sure you want to clear all browser cache?":
    "ブラウザのキャッシュをすべて削除しますか？",
  "Are you sure you want to delete {{name}}?":
    "{{name}}さんを削除しますか？",
  "Are you sure you want to leave the group?": "グループを退出しますか？",
  "Are you sure you want to remove {{name}} from the group?":
    "{{name}}さんをグループから削除しますか？",
  "Ask a question...": "質問を入力...",
  "Automatically share last 30 days history with them.":
    "直近30日の履歴を自動で共有します。",
  "Automatically share your photo history from the last 30 days.":
    "直近30日の写真履歴を自動共有します。",
  "Avoid spamming too much.": "連続送信は控えめにしてください。",
  Back: "戻る",
  "Back to sign in": "ログインに戻る",
  Block: "ブロック",
  "Block friend": "友だちをブロック",
  "Block {{name}}?": "{{name}}さんをブロックしますか？",
  "Both of you will no longer be friends. This action cannot be undone.":
    "お互いに友だちではなくなります。この操作は取り消せません。",
  "Browser does not support notifications.":
    "このブラウザは通知に対応していません。",
  "Cache & API Configuration": "キャッシュとAPI設定",
  "Cache & Service Worker Manager": "キャッシュとService Worker管理",
  "Cache cleared!": "キャッシュを削除しました！",
  Camera: "カメラ",
  "Camera Background": "カメラ背景",
  "Camera access granted": "カメラへのアクセスを許可しました",
  "Camera is not ready yet, please wait a moment...":
    "カメラの準備ができていません。少しお待ちください...",
  "Camera permission has been granted.": "カメラの権限が許可されています。",
  Cancel: "キャンセル",
  Caption: "キャプション",
  "Cannot crop image.": "画像を切り抜けません。",
  "Cannot enable flash on current camera":
    "現在のカメラでフラッシュをオンにできません",
  "Caption Kanade": "Caption Kanade",
  "Change Photo": "写真を変更",
  "Change photo feature coming soon 🚀": "写真変更機能は近日公開 🚀",
  'Changed the group name to "{{name}}"':
    'グループ名を「{{name}}」に変更しました',
  "Changed the group photo": "グループ写真を変更しました",
  "Chat details": "チャット詳細",
  "Chat group": "グループチャット",
  "Check out source code at": "ソースコードはこちら",
  "Checking server": "サーバーを確認中",
  "Choose Emoji": "絵文字を選択",
  "Choose the display language of the app": "アプリの表示言語を選択",
  "Choose the photo you want others to see.":
    "他の人に表示する写真を選んでください。",
  "Clear Cache": "キャッシュを削除",
  "Click to refresh!": "タップして更新！",
  "Client version:": "クライアントバージョン：",
  Close: "閉じる",
  Collapse: "折りたたむ",
  Color: "カラー",
  "Coming soon": "近日公開",
  "Coming soon!": "近日公開！",
  Confirm: "確認",
  "Connect with thousands of Huy Locket users for support, new feature updates, and sharing experiences!":
    "何千人ものHuy Locketユーザーとつながり、サポートや新機能の更新、体験を共有しましょう！",
  "Connection error! Please check your network.":
    "接続エラーです。ネットワークを確認してください。",
  Contact: "お問い合わせ",
  "Contact & Support": "お問い合わせ・サポート",
  Convert: "変換",
  "Converting format": "フォーマット変換中",
  Copied: "コピーしました",
  Copy: "コピー",
  "Could not copy": "コピーできませんでした",
  "Create group ({{count}} members)": "グループを作成（{{count}}人）",
  "Create new group": "新しいグループを作成",
  "Create new group chat": "新しいグループチャットを作成",
  "Creating group...": "グループを作成中...",
  "Crop Image": "画像を切り抜き",
  "Crop videos/photos to square": "動画・写真を正方形に切り抜き",
  "Current language": "現在の言語",
  Delete: "削除",
  "Delete failed, please try again!":
    "削除に失敗しました。もう一度お試しください！",
  "Delete friend": "友だちを削除",
  "Delete moment?": "モーメントを削除しますか？",
  "Deleting friend...": "友だちを削除中...",
  Diary: "日記",
  "Display Name": "表示名",
  "Do not clear unless necessary — you will lose all locally saved data.":
    "必要な場合のみ削除してください — 端末に保存されたデータがすべて失われます。",
  "Do you want to cancel the friend request to {{name}}?":
    "{{name}}さんへの友だちリクエストをキャンセルしますか？",
  "Don't skip the next slides — there are many useful features for you":
    "次のスライドもぜひご覧ください — 便利な機能がたくさんあります",
  Download: "ダウンロード",
  "Download error": "ダウンロードエラー",
  "Drag image up/down or zoom to choose crop area.":
    "画像を上下にドラッグ、またはズームして切り抜き範囲を選択。",
  "Drag to adjust star rating": "ドラッグして星評価を調整",
  "Drag video up/down or zoom to choose crop area":
    "動画を上下にドラッグ、またはズームして切り抜き範囲を選択",
  Edit: "編集",
  "Edit Group": "グループを編集",
  "Edit Profile": "プロフィールを編集",
  Email: "メール",
  "Enable camera access to take photos directly from your device.":
    "端末から直接写真を撮るにはカメラへのアクセスを許可してください。",
  "Enable location access so the app can use device positioning.":
    "アプリが位置情報を使えるよう、位置情報へのアクセスを許可してください。",
  "Enable notifications to receive instant updates.":
    "最新情報をすぐ受け取るには通知を有効にしてください。",
  "Enter API endpoint...": "APIエンドポイントを入力...",
  "Enter group name...": "グループ名を入力...",
  "Enter message...": "メッセージを入力...",
  "Enter review caption": "レビューキャプションを入力",
  "Enter your email": "メールアドレスを入力",
  "Enter your email address to receive a password reset link.":
    "パスワード再設定リンクを受け取るメールアドレスを入力してください。",
  "Enter your password": "パスワードを入力",
  "Enter {{platform}} link": "{{platform}}のリンクを入力",
  Error: "エラー",
  "Error loading incoming requests": "受信リクエストの読み込みエラー",
  "Error loading outgoing requests": "送信リクエストの読み込みエラー",
  "Every contribution you make helps make the system better every day":
    "あなたのご支援が、システムをより良くする力になります",
  Everyone: "全員",
  "Explore hidden and advanced features that make using Huy Locket more powerful, faster, and smarter than ever.":
    "Huy Locketをより強力・高速・スマートにする、隠し機能や高度な機能を探索しましょう。",
  Extension: "拡張子",
  "Extensive settings": "詳細設定",
  "Failed to add member!": "メンバーの追加に失敗しました！",
  "Failed to add reaction!": "リアクションの追加に失敗しました！",
  "Failed to create group!": "グループの作成に失敗しました！",
  "Failed to create payload!": "ペイロードの作成に失敗しました！",
  "Failed to create payload. Upload process cancelled.":
    "ペイロードの作成に失敗しました。アップロードをキャンセルしました。",
  "Failed to leave group": "グループの退出に失敗しました",
  "Failed to recall message!": "メッセージの取り消しに失敗しました！",
  "Failed to refresh friends list.": "友だちリストの更新に失敗しました。",
  "Failed to remove member": "メンバーの削除に失敗しました",
  "Failed to remove reaction!": "リアクションの削除に失敗しました！",
  "Failed to save cropped video area.":
    "切り抜き動画領域の保存に失敗しました。",
  "Failed to send": "送信に失敗しました",
  "Failed to send message!": "メッセージの送信に失敗しました！",
  "Failed to send reaction!": "リアクションの送信に失敗しました！",
  "Failed to update status": "ステータスの更新に失敗しました",
  "Feature is under development!": "この機能は開発中です！",
  "Feature locked!": "機能がロックされています！",
  Features: "機能",
  "First Name": "名",
  Follow: "フォロー",
  "Follow updates at": "更新情報はこちら",
  "Forgot password": "パスワードを忘れた場合",
  "Forgot password?": "パスワードをお忘れですか？",
  "Friend Requests": "友だちリクエスト",
  "Friend request not found.": "友だちリクエストが見つかりません。",
  Friends: "友だち",
  "Friends List": "友だちリスト",
  "Friends list refreshed!": "友だちリストを更新しました！",
  "Friends since:": "友だちになってから：",
  "Get friend requests": "友だちリクエストを取得",
  "Get sent requests": "送信済みリクエストを取得",
  "Go to Browser Settings → Site Permissions → Notifications to turn them back on.":
    "ブラウザ設定 → サイトの権限 → 通知 から再度オンにしてください。",
  "Go to Home": "ホームへ",
  "Go to browser settings → Site permissions → Notifications to re-enable.":
    "ブラウザ設定 → サイトの権限 → 通知 から再度有効にしてください。",
  "Goodbye, {{name}}!": "さようなら、{{name}}さん！",
  "Group created successfully 🎉": "グループを作成しました 🎉",
  "Group member": "グループメンバー",
  "Group name": "グループ名",
  Hidden: "非表示",
  "Hidden & experimental features (beta features)":
    "隠し機能・実験的機能（ベータ）",
  Hide: "非表示",
  "Hide comments": "コメントを隠す",
  "Hide friend": "友だちを非表示",
  "Hide from Search": "検索から隠す",
  "Hide {{name}}?": "{{name}}さんを非表示にしますか？",
  History: "履歴",
  "History will be shared if they accept the request.":
    "リクエストが承認されると履歴が共有されます。",
  "Hold on": "少し待って",
  Home: "ホーム",
  "Huy Locket": "Huy Locket",
  "If image does not display correctly, please try converting format.":
    "画像が正しく表示されない場合は、フォーマット変換を試してください。",
  "If the post is unsuccessful, click on it and press retry to post again.":
    "投稿に失敗した場合は、タップして再試行してください。",
  "If you don't see the email, please check your Spam or Promotions folder.":
    "メールが届かない場合は、迷惑メールやプロモーションフォルダを確認してください。",
  "If you encounter an error, please report to admin. Code1.0.2":
    "エラーが発生した場合は管理者に報告してください。Code1.0.2",
  Image: "画像",
  "Image read": "画像を読み込みました",
  "In queue": "キュー内",
  Incidents: "障害情報",
  "Incident Center": "インシデントセンター",
  "Incident Reference Page": "インシデント参照ページ",
  "Incorrect email or password!": "メールまたはパスワードが正しくありません！",
  "Install WebApp": "WebAppをインストール",
  "Instant Invite": "インスタント招待",
  "Invalid email address!": "メールアドレスが無効です！",
  "Invalid phone number!": "電話番号が無効です！",
  "It seems we've lost this page somewhere.":
    "このページは存在しないか、移動した可能性があります。",
  "Join Community": "コミュニティに参加",
  "Join the Huy Locket Community": "Huy Locketコミュニティに参加",
  "Join the community on": "コミュニティに参加：",
  "Join to get the earliest updates and faster support":
    "参加して最新情報とより早いサポートを受けましょう",
  "Just now": "たった今",
  Language: "言語",
  "Last Name": "姓",
  "Last updated: {{time}}": "最終更新：{{time}}",
  "Leave group": "グループを退出",
  "Leave group?": "グループを退出しますか？",
  "Leaving group...": "グループを退出中...",
  "Left {{name}}": "{{name}}を退出しました",
  "Let's start!": "はじめよう！",
  "Limit:": "上限：",
  "List not loaded": "リストが読み込まれていません",
  "Load new version": "新しいバージョンを読み込む",
  Loading: "読み込み中",
  "Loading...": "読み込み中...",
  "Loading…": "読み込み中…",
  "Local storage usage:": "ローカルストレージ使用量：",
  Location: "位置情報",
  "Location access granted": "位置情報へのアクセスを許可しました",
  "Location permission has been granted.": "位置情報の権限が許可されています。",
  "Locket Camera": "Locketカメラ",
  "Locket Diary": "Locket日記",
  "Locket Friends": "Locketフレンド",
  "Locket Tools": "Locketツール",
  "Locket Upload": "Locket Upload",
  "Locket count is the number of posts on the web, which may differ from reality.":
    "Locket数はWeb上の投稿数であり、実際と異なる場合があります。",
  "Locket streak calendar": "Locketストリークカレンダー",
  Lockets: "Lockets",
  "Max zoom is not supported on this device":
    "この端末では最大ズームに対応していません",
  "Maximum 50 characters": "最大50文字",
  "Media & saves": "メディアと保存",
  "Media does not exist or download was cancelled.":
    "メディアが存在しないか、ダウンロードがキャンセルされました。",
  "Media does not exist or sharing was cancelled.":
    "メディアが存在しないか、共有がキャンセルされました。",
  "Media not found": "メディアが見つかりません",
  "Member added successfully 🎉": "メンバーを追加しました 🎉",
  "Members ({{count}})": "メンバー（{{count}}）",
  "Membership plans": "メンバーシッププラン",
  Menu: "メニュー",
  "Message copied": "メッセージをコピーしました",
  "Message recalled": "メッセージを取り消しました",
  "Message sent successfully!": "メッセージを送信しました！",
  Music: "ミュージック",
  "Music caption is only visible on iOS (Android will still post the photo without music caption).":
    "ミュージックキャプションはiOSでのみ表示されます（Androidでは写真のみ投稿されます）。",
  "Music fetched successfully": "曲情報を取得しました",
  "Mute notifications": "通知をミュート",
  Name: "名前",
  Next: "次へ",
  "Newsfeed": "ニュースフィード",
  No: "いいえ",
  "No activity yet": "まだアクティビティはありません",
  "No account found with this email!":
    "このメールのアカウントが見つかりません！",
  "No conversations yet": "まだ会話はありません",
  "No data": "データなし",
  "No data to upload.": "アップロードするデータがありません。",
  "No data...": "データがありません...",
  "No frame selected": "フレーム未選択",
  "No friends": "友だちがいません",
  "No friends to display": "表示する友だちがいません",
  "No matching friends": "一致する友だちがいません",
  "No matching users found": "一致するユーザーが見つかりません",
  "No messages yet": "まだメッセージはありません",
  "No service worker registered!": "Service Workerが登録されていません！",
  "No suitable camera found to switch zoom":
    "ズーム切替に適したカメラが見つかりません",
  "No username": "ユーザー名なし",
  "No video or thumbnail to download":
    "ダウンロードする動画またはサムネイルがありません",
  "No weather data available!": "天気データがありません！",
  None: "なし",
  "Not activated yet...": "まだ有効化されていません...",
  "Not friends yet": "まだ友だちではありません",
  "Note: Media in this section will be deleted after a certain period. If you encounter an error uploading, please try again or refer to the incidents page.":
    "注意：このセクションのメディアは一定期間後に削除されます。アップロードエラー時は再試行するか、インシデントページを参照してください。",
  "Note: New members can see previous messages.":
    "注意：新しいメンバーは過去のメッセージを見ることができます。",
  "Note: The streak on the web is fetched from Locket servers, so it displays faster than on the app. When you successfully post a photo/video on the web, the streak will increase by 1 and be maintained.":
    "注意：WebのストリークはLocketサーバーから取得するため、アプリより早く表示されます。Webで写真・動画の投稿に成功するとストリークが+1され維持されます。",
  "Notice from Huy Locket": "Huy Locketからのお知らせ",
  "Notification from Huy Locket": "Huy Locketからの通知",
  "Notification permission has been granted.":
    "通知の権限が許可されています。",
  "Notification permission is granted but push subscription is not set up.":
    "通知は許可されていますが、プッシュ購読が設定されていません。",
  "Notifications turned off 🔕": "通知をオフにしました 🔕",
  "Notifications turned on 🔔": "通知をオンにしました 🔔",
  "Notifications turned on!": "通知をオンにしました！",
  "Notifications turned on! 🎉": "通知をオンにしました！ 🎉",
  "Off · save original": "オフ · オリジナルを保存",
  "On · ♥ Locket when saving": "オン · 保存時に♥ Locket",
  "On: add ♥ Locket when saving. Off: original photo.":
    "オン：保存時に♥ Locketを追加。オフ：オリジナルを保存。",
  "Only photos and videos are supported.": "写真と動画のみ対応しています。",
  "Oops! Something went wrong.": "エラーが発生しました。",
  "Oops! The page you're looking for doesn't exist.":
    "お探しのページは見つかりません。",
  "Partners & Integrations": "パートナーと連携",
  Password: "パスワード",
  "Permissions Manager": "権限マネージャー",
  Phone: "電話",
  "Phone number": "電話番号",
  Photo: "写真",
  "Please consider registering a membership to support and unlock more features":
    "メンバーシップ登録でプロジェクトを支援し、さらに多くの機能を解放できます",
  "Please do not close the browser while the system processes the image.":
    "画像処理中はブラウザを閉じないでください。",
  "Please post a photo or video on the home screen to restore your streak!":
    "ホーム画面で写真または動画を投稿してストリークを復元してください！",
  "Please post a photo or video to activate your Huy Locket calendar💛":
    "写真または動画を投稿してHuy Locketカレンダーを有効化してください💛",
  "Please post to continue your streak today!":
    "今日のストリークを続けるには投稿してください！",
  "Please try again later!": "しばらくしてから再試行してください！",
  "Please verify you are not a robot":
    "ロボットではないことを確認してください",
  "Please wait for Server02 to start.": "Server02の起動をお待ちください。",
  Poll: "アンケート",
  Post: "投稿",
  "Post Mode Notice": "投稿モードの注意",
  "Post Photos & Videos Easily": "写真・動画をかんたんに投稿",
  "Post history shared.": "投稿履歴を共有しました。",
  "Post is being processed...": "投稿を処理中...",
  "Post photo & video": "写真・動画を投稿",
  "Post privately for your eyes only": "自分だけに非公開で投稿",
  "Preparing download...": "ダウンロード準備中...",
  "Preparing to download...": "ダウンロード準備中...",
  "Preparing to share...": "共有の準備中...",
  "Preparing your image": "画像を準備中",
  "Preparing your memories...": "思い出を準備しています…",
  Privacy: "プライバシー",
  "Privacy Policy": "プライバシーポリシー",
  "Privacy policy": "プライバシーポリシー",
  Private: "非公開",
  "Processing...": "処理中...",
  Profile: "プロフィール",
  "Profile Photo": "プロフィール写真",
  "Reaction added": "リアクションを追加しました",
  "Reaction removed": "リアクションを削除しました",
  "Reaction sent successfully!": "リアクションを送信しました！",
  Reactions: "リアクション",
  "Reactions ({{count}}):": "リアクション（{{count}}）：",
  "Reactions count": "リアクション数",
  "Read Receipts": "既読表示",
  Recall: "取り消し",
  "Recall failed, please try again":
    "取り消しに失敗しました。もう一度お試しください",
  "Recalling message...": "メッセージを取り消し中...",
  "Receive instant notifications for new features, incidents, or important updates from Huy Locket.":
    "Huy Locketの新機能・障害・重要なお知らせをすぐに通知で受け取ります。",
  Reconnect: "再接続",
  "Reconnect relay service": "リレーサービスを再接続",
  Refresh: "更新",
  "Refreshed successfully!": "更新しました！",
  'Regarding the streak display, e.g., if the web shows 5 but the app doesn\'t => app error, just post a photo/video on the Locket app and the streak will automatically display the corresponding number again.':
    "ストリーク表示について：例）Webは5なのにアプリに表示されない場合はアプリ側の不具合です。Locketアプリで写真・動画を1件投稿すると、対応する数値が再表示されます。",
  Reject: "拒否",
  "Remember me": "ログイン状態を保持",
  "Remove from group": "グループから削除",
  "Remove member": "メンバーを削除",
  "Removed a member from the group": "グループからメンバーを削除しました",
  "Removed from queue!": "キューから削除しました！",
  "Removed {{name}} from group": "{{name}}さんをグループから削除しました",
  "Removed {{target}} from the group":
    "{{target}}さんをグループから削除しました",
  "Removing member...": "メンバーを削除中...",
  "Removing reaction...": "リアクションを削除中...",
  "Replied to your Locket!": "あなたのLocketに返信がありました！",
  "Reply to {{name}}": "{{name}}さんに返信",
  Report: "報告",
  "Report feature is under development": "報告機能は開発中です",
  Repost: "再投稿",
  "Request cancelled successfully": "リクエストをキャンセルしました",
  "Request sent!": "リクエストを送信しました！",
  "Resend request": "リクエストを再送信",
  Resources: "リソース",
  Restart: "再起動",
  "Restore streak for {{date}}": "{{date}}のストリークを復元",
  Retry: "再試行",
  Review: "レビュー",
  Rollcalls: "ロールコール",
  Save: "保存",
  "Save API config (demo)": "API設定を保存（デモ）",
  "Save config": "設定を保存",
  "Save crop": "切り抜きを保存",
  Search: "検索",
  "Search and add best friends": "親友を検索して追加",
  "Search by name, username or UID...":
    "名前・ユーザー名・UIDで検索...",
  "Search emoji...": "絵文字を検索...",
  "Search friends...": "友だちを検索...",
  "Search members...": "メンバーを検索...",
  "Search results": "検索結果",
  "Searching for someone?": "誰かを探していますか？",
  "Searching user...": "ユーザーを検索中...",
  "Searching...": "検索中...",
  "See more": "もっと見る",
  "See more ({{count}})": "もっと見る（{{count}}）",
  "See {{count}} more conversations": "さらに{{count}}件の会話を見る",
  "Seen Moments": "既読Moments",
  "Select Camera Frame": "カメラフレームを選択",
  "Select address...": "住所を選択...",
  "Select at least 2 friends to create a group":
    "グループ作成には友だちを2人以上選択してください",
  "Select at least 2 members": "メンバーを2人以上選択してください",
  "Select emoji": "絵文字を選択",
  "Select photos or videos from your device, crop to square, add colorful captions, and post to Locket — in just a few taps!":
    "端末から写真・動画を選び、正方形に切り抜き、カラフルなキャプションを付けてLocketに投稿 — 数タップで完了！",
  "Select single": "単体を選択",
  Send: "送信",
  "Send group message...": "グループメッセージを送信...",
  "Send message...": "メッセージを送信...",
  "Send to": "送信先...",
  "Send to...": "送信先...",
  "Send to custom groups of friends": "カスタム友だちグループに送信",
  Sending: "送信中",
  "Sending...": "送信中...",
  "Sending message...": "メッセージを送信中...",
  "Sending request...": "リクエスト送信中...",
  Sent: "送信済み",
  "Sent Requests": "送信済みリクエスト",
  "Sent reaction {{emoji}}, power: {{power}}":
    "リアクション{{emoji}}を送信、パワー：{{power}}",
  "Server did not return any data": "サーバーからデータが返りませんでした",
  "Server error, please try again later!":
    "サーバーエラーです。しばらくしてから再試行してください！",
  "Server is running": "サーバーは稼働中です",
  "Server is unavailable": "サーバーに接続できません",
  "Setting Huy Locket": "Huy Locket設定",
  Settings: "設定",
  Share: "共有",
  "Share History": "履歴を共有",
  "Share error": "共有エラー",
  "Share history:": "履歴共有：",
  "Share history?": "履歴を共有しますか？",
  "Sign in": "ログイン",
  "Sign in to Locket": "Locketにログイン",
  "Sign in with email?": "メールでログインしますか？",
  "Sign in with phone number?": "電話番号でログインしますか？",
  "Sign out": "ログアウト",
  "Sign out failed!": "ログアウトに失敗しました！",
  "Signed out successfully!": "ログアウトしました！",
  "Signing in...": "ログイン中...",
  Size: "サイズ",
  "Skip crop": "切り抜きをスキップ",
  "Slow down :))": "少しゆっくり :))",
  "Sponsors Page": "スポンサーページ",
  "Status updated!": "ステータスを更新しました！",
  "Streak Recovery": "ストリーク復元",
  "Streak recovery mode": "ストリーク復元モード",
  "Subscribe to notifications": "通知を購読",
  "Subscribed successfully": "購読が完了しました",
  Success: "成功",
  "Successfully deleted friend": "友だちを削除しました",
  "Successfully deleted moment!": "モーメントを削除しました！",
  "Suggested pairs": "おすすめの組み合わせ",
  "Support the project": "プロジェクトを支援",
  "Support the project at": "プロジェクトを支援：",
  "Supports JPG, PNG, WEBP images": "JPG・PNG・WEBP画像に対応",
  Sync: "同期",
  "Syncing friends list...": "友だちリストを同期中...",
  "Syncing...": "同期中...",
  "System & Support": "システムとサポート",
  "Take photos directly from the camera": "カメラから直接撮影",
  "Tap to send reaction": "タップしてリアクションを送信",
  "Terms of Service": "利用規約",
  "Terms of use": "利用規約",
  Text: "テキスト",
  Theme: "テーマ",
  "The Huy Locket is loading.": "Huy Locketを読み込み中です。",
  "The Huy Locket web app encountered an unexpected error. Please try restarting the app or join our community for support.":
    "Huy Locketで予期しないエラーが発生しました。アプリを再起動するか、コミュニティでサポートを受けてください。",
  "The app can now access your location when needed.":
    "必要に応じてアプリが位置情報にアクセスできます。",
  "The app can now use your camera when needed.":
    "必要に応じてアプリがカメラを使用できます。",
  "The app can use your location when needed.":
    "必要に応じてアプリが位置情報を使用できます。",
  "The browser allows this site to use the camera.":
    "ブラウザがこのサイトのカメラ使用を許可しています。",
  "They will not be able to view your moments, send messages, or send friend requests. This action cannot be undone.":
    "相手はあなたのモーメントの閲覧、メッセージ送信、友だちリクエストができなくなります。この操作は取り消せません。",
  "This action cannot be undone.": "この操作は取り消せません。",
  "This browser does not support Service Worker.":
    "このブラウザはService Workerに対応していません。",
  "This browser does not support camera access.":
    "このブラウザはカメラアクセスに対応していません。",
  "This browser does not support location access.":
    "このブラウザは位置情報アクセスに対応していません。",
  "This camera does not support flash":
    "このカメラはフラッシュに対応していません",
  "This feature is coming soon!": "この機能は近日公開予定です！",
  "This feature is not available yet...": "この機能はまだ利用できません...",
  "This feature is under development!": "この機能は開発中です！",
  "This feature will be available soon!": "この機能はまもなく利用可能になります！",
  "This is a personal project under continuous development":
    "個人プロジェクトとして継続開発中です",
  "This is the name people will see.": "他の人に表示される名前です。",
  "This photo/video does not exist.": "この写真・動画は存在しません。",
  "This process usually takes about <b>30–60 seconds</b> depending on image size and format.":
    "画像のサイズと形式により、通常約<b>30〜60秒</b>かかります。",
  "This will delete the image from your history and cannot be undone.":
    "履歴から画像が削除され、取り消せません。",
  Timeline: "タイムライン",
  Tools: "ツール",
  "Too many failed attempts. Please try again later!":
    "失敗が多すぎます。しばらくしてから再試行してください！",
  "Total viewers": "閲覧者合計",
  "Turn on notifications from Huy Locket": "Huy Locketからの通知をオンにする",
  Type: "種類",
  "Ultra-fast search & filter friends": "超高速の友だち検索・フィルター",
  "Unable to fetch song information": "曲情報を取得できません",
  "Unable to retrieve location.": "位置情報を取得できません。",
  "Under construction...": "工事中...",
  Unhide: "再表示",
  "Unhide friend": "友だちを再表示",
  "Unhide {{name}}?": "{{name}}さんを再表示しますか？",
  Unknown: "不明",
  "Unknown error": "不明なエラー",
  "Unregister Service Worker": "Service Workerの登録解除",
  Upload: "アップロード",
  "Update failed!": "更新に失敗しました！",
  "Update group name": "グループ名を更新",
  "Update group photo": "グループ写真を更新",
  "Updated successfully 🎉": "更新しました 🎉",
  "Updating group name...": "グループ名を更新中...",
  "Updating...": "更新中...",
  Upgrade: "アップグレード",
  "Upgrade plan to increase limit!":
    "上限を増やすにはプランをアップグレード！",
  "Upgrade plan to send friend requests.":
    "友だちリクエストを送るにはプランをアップグレード。",
  "Uploaded to server": "サーバーにアップロード済み",
  "Uploading Photos/Videos": "写真・動画をアップロード中",
  "Used:": "使用中：",
  User: "ユーザー",
  "User data not found.": "ユーザーデータが見つかりません。",
  "User does not exist": "ユーザーが存在しません",
  "User found": "ユーザーが見つかりました",
  "User report submitted": "ユーザー報告を送信しました",
  Video: "動画",
  "Video is too small or invalid (under 0.2MB).":
    "動画が小さすぎるか無効です（0.2MB未満）。",
  "View comments": "コメントを見る",
  "Viewing time:": "閲覧時間：",
  "Waiting for approval": "承認待ち",
  Watermark: "ウォーターマーク",
  "Watermark on save": "保存時のウォーターマーク",
  Weather: "天気",
  "Web application that helps you upload photos & videos to Locket easier than ever — with many exclusive features only on Huy Locket.":
    "写真・動画をLocketにかんたんに投稿できるWebアプリ。Huy Locketだけの独自機能も多数。",
  "Website History": "ウェブサイト履歴",
  "Week {{week}} ({{label}})": "第{{week}}週（{{label}}）",
  "Week:": "週：",
  "Welcome to Huy Locket!": "Huy Locketへようこそ！",
  "Welcome, {{name}}!": "ようこそ、{{name}}さん！",
  "When enabled, others can see that you've read their messages.":
    "オンにすると、メッセージの既読が相手に表示されます。",
  "When enabled, others can see that you've viewed their Moments.":
    "オンにすると、相手のMomentsを見たことが相手に伝わります。",
  Yes: "はい",
  You: "あなた",
  "You already created a group": "すでにグループを作成済みです",
  "You already own a group!": "すでにグループを所有しています！",
  "You are already on the latest version!": "すでに最新バージョンです！",
  "You are blocking notifications from this website.":
    "このサイトからの通知をブロックしています。",
  "You are not a member of this group": "このグループのメンバーではありません",
  "You are selecting private mode!": "非公開モードを選択しています！",
  "You can change this permission at any time in Settings.":
    "この権限は設定からいつでも変更できます。",
  "You can download your friends' images/videos or delete them from your history":
    "友だちの画像・動画をダウンロードしたり、履歴から削除できます",
  "You cancelled the friend request to {{name}}":
    "{{name}}さんへの友だちリクエストをキャンセルしました",
  "You denied camera permission.": "カメラの権限を拒否しました。",
  "You denied location permission.": "位置情報の権限を拒否しました。",
  "You do not have permission to access this.":
    "この操作を行う権限がありません。",
  "You have blocked notifications. Go to browser settings to re-enable.":
    "通知をブロックしています。ブラウザ設定から再度有効にしてください。",
  "You have blocked notifications. Please go to browser settings to enable them again.":
    "通知をブロックしています。ブラウザ設定から再度有効にしてください。",
  "You were already subscribed to notifications.":
    "すでに通知を購読しています。",
  "You will no longer see their moments. They will not receive new moments you post since hiding.\nThey will not be notified and both of you will still appear on each other's friends list.":
    "相手のモーメントは表示されなくなります。非表示以降にあなたが投稿した新しいモーメントも相手には届きません。\n相手には通知されず、お互いの友だちリストには表示されたままです。",
  "You will now receive the latest notifications.":
    "これで最新の通知を受け取れます。",
  "You will receive notifications when there are new updates from Huy Locket.":
    "Huy Locketに新しい更新があると通知を受け取ります。",
  "You will receive notifications when there are new updates.":
    "新しい更新があると通知を受け取ります。",
  "You will receive updates from Huy Locket.":
    "Huy Locketからの更新を受け取れます。",
  "You will see their moments again and they will also see your new moments from now on.":
    "相手のモーメントが再び表示され、これ以降のあなたの新しいモーメントも相手に届きます。",
  "Your Captions": "あなたのキャプション",
  "Your Friends": "あなたの友だち",
  "Your email is used to sign in and can't be changed yet.":
    "このメールはログインに使用され、現時点では変更できません。",
  "Your profile": "プロフィール",
  "Your session has expired. Please sign in again!":
    "セッションの有効期限が切れました。再度ログインしてください！",
  "example@email.com": "example@email.com",
  friends: "友だち",
  "intensity {{intensity}}": "強さ {{intensity}}",
  "reacted {{emoji}}": "{{emoji}}でリアクション",
  user: "ユーザー",
  viewed: "閲覧済み",
  "{{actor}} added a member to the group":
    "{{actor}}さんがグループにメンバーを追加しました",
  "{{actor}} added {{target}} to the group":
    "{{actor}}さんが{{target}}さんをグループに追加しました",
  '{{actor}} changed the group name to "{{name}}"':
    '{{actor}}さんがグループ名を「{{name}}」に変更しました',
  "{{actor}} changed the group photo":
    "{{actor}}さんがグループ写真を変更しました",
  "{{actor}} removed a member from the group":
    "{{actor}}さんがグループからメンバーを削除しました",
  "{{actor}} removed {{target}} from the group":
    "{{actor}}さんが{{target}}さんをグループから削除しました",
  "{{count}} / {{max}} friends": "{{count}} / {{max}} 友だち",
  "{{count}} Locket": "{{count}} Locket",
  "{{count}} Lockets": "{{count}} Lockets",
  "{{count}} days ago": "{{count}}日前",
  "{{count}} friends": "{{count}}人の友だち",
  "{{count}} hours ago": "{{count}}時間前",
  "{{count}} minutes ago": "{{count}}分前",
  "{{count}} people": "{{count}}人",
  "{{count}}d streak": "{{count}}日連続",
  "{{type}} size limit exceeded. Maximum {{limit}} MB.":
    "{{type}}の容量制限を超えました。最大{{limit}} MB。",
  "↪ Replied to a moment": "↪ モーメントに返信",
  "⚠️ Cannot crop image. Error detail: {{error}}":
    "⚠️ 画像を切り抜けません。詳細：{{error}}",
  "⚠️ You have blocked notifications": "⚠️ 通知をブロックしています",
  "✏️ Notes": "✏️ メモ",
  "❌ Failed to accept request!": "❌ リクエストの承認に失敗しました！",
  "⭐ Displays up to 100 friends. Upgrade to Premium to see the full list.":
    "⭐ 最大100人の友だちを表示。Premiumにアップグレードで全件表示。",
  "⭐ Recommended": "⭐ おすすめ",
  "🎨 General": "🎨 一般",
  "🎨 Kanade Collab Caption": "🎨 Kanadeコラボキャプション",
  "🎬 Crop Video Studio": "🎬 動画切り抜きスタジオ",
  "🔄 Click Sync to reload latest friends data.":
    "🔄 同期をタップして最新の友だちデータを再読み込み。",
  "🔥 Popular": "🔥 人気",
  "🕒 Recent": "🕒 最近",
  "🖼️ Crop Image Studio": "🖼️ 画像切り抜きスタジオ",
  "😀 All": "😀 すべて",
  "😊 All": "😊 すべて",
  "📷 Media & saves": "📷 メディアと保存",
  "♥ Watermark": "♥ ウォーターマーク",
  "Add ♥ Locket at the bottom when downloading / sharing. Turn off to save the original.":
    "ダウンロード／共有時に下部へ♥ Locketを追加。オフでオリジナル保存。",
  "🌐 Language": "🌐 言語",
  "👁 Privacy": "👁 プライバシー",
  "Huy Locket • Share Moments •": "Huy Locket • 瞬間をシェア •",
  "Huy Locket • Modern • Convenient • Cross-Platform • Security •":
    "Huy Locket • モダン • 便利 • クロスプラットフォーム • セキュリティ •",
  Documentation: "ドキュメント",
  "Every contribution you make helps make the system better every day":
    "あなたのご支援が、システムをより良くする力になります",
};

// Also cover hide_content split if en uses separate lines without the combined string
MAP[
  "You will no longer see their moments. They will not receive new moments you post since hiding."
] =
  "相手のモーメントは表示されなくなります。非表示以降にあなたが投稿した新しいモーメントも相手には届きません。";
MAP[
  "They will not be notified and both of you will still appear on each other's friends list."
] =
  "相手には通知されず、お互いの友だちリストには表示されたままです。";

function translateTree(obj) {
  if (typeof obj === "string") {
    if (Object.prototype.hasOwnProperty.call(MAP, obj)) return MAP[obj];
    return obj;
  }
  if (Array.isArray(obj)) return obj.map(translateTree);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = translateTree(v);
    return out;
  }
  return obj;
}

function forceCritical(file, ja) {
  if (file === "main.json" && ja.home) {
    ja.home.everyone = "全員";
    ja.home.send_to = "送信先...";
    ja.home.friends_count = "{{count}}人の友だち";
    ja.home.history = "履歴";
    ja.home.private = "非公開";
    ja.home.all = "すべて";
  }
  if (file === "main.json" && ja.left) {
    ja.left.rollcalls = "ロールコール";
    ja.left.lockets = "Lockets";
    ja.left.streak_days = "{{count}}日連続";
    ja.left.history = ja.left.history; // no-op if absent
  }
  if (file === "main.json" && ja.bottom) {
    ja.bottom.private = "非公開";
    ja.bottom.media_not_found = "メディアが見つかりません";
  }
  if (file === "features.json") {
    if (ja.history_select_friend) {
      ja.history_select_friend.everyone = "全員";
    }
    if (ja.friends?.friends_count) {
      ja.friends.friends_count = "{{count}}人の友だち";
    }
  }
  return ja;
}

function countStrings(obj, acc = { n: 0 }) {
  if (typeof obj === "string") acc.n++;
  else if (obj && typeof obj === "object")
    Object.values(obj).forEach((v) => countStrings(v, acc));
  return acc.n;
}

function compareEqual(en, ja, list = []) {
  if (typeof en === "string") {
    if (en === ja) list.push(en);
  } else if (en && typeof en === "object" && !Array.isArray(en)) {
    for (const k of Object.keys(en)) compareEqual(en[k], ja?.[k], list);
  }
  return list;
}

fs.mkdirSync(jaDir, { recursive: true });

let totalEn = 0;
let totalEqual = 0;
const equalUniq = new Set();

for (const file of FILES) {
  const enPath = path.join(enDir, file);
  const jaPath = path.join(jaDir, file);
  const en = JSON.parse(fs.readFileSync(enPath, "utf8").replace(/^\uFEFF/, ""));
  let ja = translateTree(en);
  ja = forceCritical(file, ja);

  const text = JSON.stringify(ja, null, 2) + "\n";
  fs.writeFileSync(jaPath, text, { encoding: "utf8" });

  const n = countStrings(en);
  const same = compareEqual(en, ja);
  totalEn += n;
  totalEqual += same.length;
  same.forEach((s) => equalUniq.add(s));
  console.log(
    `wrote ja/${file}  strings=${n}  stillEqual=${same.length}`,
  );
}

console.log("---");
console.log("Total EN string leaves:", totalEn);
console.log("Still equal to EN (count):", totalEqual);
console.log("Still equal unique:", equalUniq.size);
console.log(
  "Remaining unique (allowed brands/etc):",
  [...equalUniq].sort().join(" | ") || "(none)",
);
console.log("Japanese full apply done.");
