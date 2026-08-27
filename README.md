# Halo Chat

少人数のチームや友人同士で使うための、Windowsデスクトップ＋Web/PWA対応チャットです。Electronアプリ内にローカルサーバーを内蔵しているため、1台だけでもすぐに起動できます。ブラウザーからはWindows、macOS、Linux、iPhone、Androidで参加できます。

## 現在使える機能

- 複数ルームのリアルタイムテキストチャット
- メッセージ履歴のローカル保存（最大1,000件）
- Postgresを使ったクラウド永続保存
- オンラインメンバーと入力中表示
- WebRTCによる少人数向け音声通話
- スマートフォン対応Web/PWA画面
- アクセスキーによるサーバー保護
- ブラウザー通知
- タスクトレイ常駐
- ウィンドウを閉じている間のWindows通知
- Windowsインストーラーの生成

## 開発モードで起動

```powershell
npm install
npm run dev
```

最初の画面では、表示名を入力し、サーバーURLは既定値の `http://127.0.0.1:3020` のまま開始できます。

## Windowsインストーラーを作成

```powershell
npm run package:win
```

生成物は `release-package` フォルダーに保存されます。

## Webブラウザーから接続

サーバーを起動してから、同じPCで次を開きます。

```text
http://127.0.0.1:3020
```

スマートフォンなど別端末からマイクやPWA機能を使う場合はHTTPSが必要です。外部非公開で使う場合はTailscale Serve、無料クラウドの場合はRender＋Neonに対応しています。詳しくは [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) を参照してください。

## 同じLAN内の別PCから接続

ホストPCでHalo Chatを起動し、WindowsファイアウォールでTCP 3020番ポートの受信を許可します。参加側の接続画面には次の形式でホストPCのLAN IPアドレスを入力します。

```text
http://192.168.x.x:3020
```

音声通話ではインターネット上のSTUNサーバーを利用します。社外や異なるネットワークから安定して利用するには、HTTPS対応の公開サーバーとTURNサーバーが必要です。

## 独立したサーバーとして起動

デスクトップアプリから切り離してサーバーだけを動かす場合：

```powershell
npm run server
```

環境変数 `HALO_CHAT_PORT`、`HALO_CHAT_HOST`、`HALO_CHAT_DATA` でポート、待受アドレス、データ保存先を変更できます。`HALO_CHAT_ACCESS_KEY` を設定するとアクセスキー認証、`DATABASE_URL` を設定するとPostgres保存が有効になります。

## MVPとしての注意点

このバージョンは信頼できる少人数グループでの利用を想定しています。クラウドへ配置する場合は必ず長い `HALO_CHAT_ACCESS_KEY` を設定してください。本格的な一般公開には、ユーザー別アカウント、レート制限、管理機能、TURN/SFU、添付ファイル検査などが追加で必要です。
